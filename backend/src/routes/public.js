import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import pool from '../db/pool.js';
import { computeSlots, parseTimeToMinutes, CANCEL_MIN_HOURS } from '../services/availability.js';
import { insertBookingWithRetry } from '../services/bookingCode.js';
import { requireCustomerAuth } from '../middleware/requireCustomerAuth.js';
import { calculateVoucherDiscount } from '../services/loyalty.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const router = Router();

const availabilityQuerySchema = z.object({
  serviceId: z.coerce
    .number({ error: 'serviceId harus berupa angka.' })
    .int({ message: 'serviceId harus bilangan bulat.' })
    .positive({ message: 'serviceId harus bilangan bulat positif.' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal harus YYYY-MM-DD.' }),
});

const createBookingSchema = z.object({
  serviceId: z.coerce
    .number({ error: 'serviceId harus berupa angka.' })
    .int({ message: 'serviceId harus bilangan bulat.' })
    .positive({ message: 'serviceId harus bilangan bulat positif.' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal harus YYYY-MM-DD.' }),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, { message: 'Format jam harus HH:mm.' }),
  customerName: z
    .string({ error: 'Nama pelanggan wajib diisi.' })
    .trim()
    .min(1, { message: 'Nama pelanggan wajib diisi.' })
    .optional(),
  customerPhone: z
    .union([z.string(), z.number()])
    .transform((val) => String(val).replace(/[\s-]/g, ''))
    .pipe(
      z.string().regex(/^(0[0-9]{8,14}|\+62[0-9]{7,13})$/, {
        message: 'Nomor telepon harus format Indonesia (9-15 digit, diawali 0 atau +62).',
      })
    )
    .optional(),
  customerVoucherId: z
    .preprocess(
      (v) => (v === '' || v === undefined || v === null ? null : v),
      z.coerce
        .number({ error: 'customerVoucherId harus berupa angka.' })
        .int({ message: 'customerVoucherId harus bilangan bulat.' })
        .positive({ message: 'customerVoucherId harus bilangan bulat positif.' })
        .nullable()
    )
    .optional(),
});

// Kode booking dari URL: dinormalisasi ke huruf besar. Format salah diperlakukan
// sama seperti kode tidak ada (404), agar tidak membocorkan informasi.
const bookingCodeParamSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{1,20}$/);

// Query opsional ?lat=&lng= untuk mengurutkan UMKM berdasarkan jarak (km)
const nearQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

// GET /api/public/businesses
router.get('/businesses', async (req, res, next) => {
  try {
    const { category } = req.query;
    const params = [];
    let near = null;

    if (req.query.lat !== undefined || req.query.lng !== undefined) {
      const parsedNear = nearQuerySchema.safeParse({ lat: req.query.lat, lng: req.query.lng });
      if (!parsedNear.success) {
        return res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'Koordinat lokasi tidak valid.' },
        });
      }
      near = parsedNear.data;
    }

    // Rumus Haversine (radius bumi 6371 km); NULL jika UMKM belum punya titik lokasi
    const distanceSql = near
      ? `, ROUND(6371 * 2 * ASIN(SQRT(
            POWER(SIN(RADIANS(latitude - ?) / 2), 2) +
            COS(RADIANS(?)) * COS(RADIANS(latitude)) * POWER(SIN(RADIANS(longitude - ?) / 2), 2)
          )), 2) AS distance_km`
      : '';
    if (near) params.push(near.lat, near.lat, near.lng);

    let sql = `SELECT name, slug, category, address, latitude, longitude${distanceSql} FROM businesses`;

    if (category) {
      sql += ' WHERE category = ?';
      params.push(category);
    }

    sql += near ? ' ORDER BY distance_km IS NULL, distance_km ASC, name ASC' : ' ORDER BY name ASC';

    const [rows] = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/public/businesses/:slug/availability
router.get('/businesses/:slug/availability', async (req, res, next) => {
  try {
    const { slug } = req.params;

    const parsed = availabilityQuerySchema.safeParse({
      serviceId: req.query.serviceId ?? req.query.service_id,
      date: req.query.date,
    });

    if (!parsed.success) {
      const message = parsed.error.issues?.[0]?.message || 'Input tidak valid.';
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message } });
    }

    const { serviceId, date } = parsed.data;

    const targetDate = dayjs.tz(date, 'Asia/Jakarta');
    if (!targetDate.isValid() || targetDate.format('YYYY-MM-DD') !== date) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Tanggal tidak valid.' } });
    }

    // 1. Cari UMKM berdasarkan slug
    const [bizRows] = await pool.query(
      'SELECT id FROM businesses WHERE slug = ?',
      [slug]
    );

    if (bizRows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'UMKM tidak ditemukan.' } });
    }

    const businessId = bizRows[0].id;

    // 2. Cari layanan aktif milik UMKM
    const [serviceRows] = await pool.query(
      'SELECT id, duration_min, is_active FROM services WHERE id = ? AND business_id = ?',
      [serviceId, businessId]
    );

    if (serviceRows.length === 0 || !serviceRows[0].is_active) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Layanan tidak ditemukan.' } });
    }

    const service = serviceRows[0];

    // 3. Cek jam operasional hari tersebut (0=Minggu, 6=Sabtu)
    const weekday = targetDate.day();
    const [hoursRows] = await pool.query(
      'SELECT open_time, close_time, is_closed FROM operating_hours WHERE business_id = ? AND weekday = ?',
      [businessId, weekday]
    );

    const isClosed = hoursRows.length === 0 || Boolean(hoursRows[0].is_closed);
    const openTime = hoursRows.length > 0 ? hoursRows[0].open_time : null;
    const closeTime = hoursRows.length > 0 ? hoursRows[0].close_time : null;

    // 4. Cek apakah tanggal libur
    const [holidayRows] = await pool.query(
      'SELECT id FROM holidays WHERE business_id = ? AND date = ?',
      [businessId, date]
    );
    const isHoliday = holidayRows.length > 0;

    // 5. Ambil booking aktif (menunggu atau dikonfirmasi) pada tanggal tersebut
    const startOfDay = `${date} 00:00:00`;
    const endOfDay = `${date} 23:59:59`;
    const [bookingRows] = await pool.query(
      `SELECT start_at, end_at FROM bookings
       WHERE business_id = ?
         AND status IN ('menunggu', 'dikonfirmasi')
         AND start_at <= ? AND end_at >= ?`,
      [businessId, endOfDay, startOfDay]
    );

    // 6. Hitung slot jam kosong
    const slots = computeSlots({
      date,
      durationMin: service.duration_min,
      openTime,
      closeTime,
      isClosed,
      isHoliday,
      activeBookings: bookingRows,
      now: dayjs().tz('Asia/Jakarta'),
    });

    return res.json({
      date,
      slots,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/public/businesses/:slug
router.get('/businesses/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;

    const [bizRows] = await pool.query(
      'SELECT id, name, slug, category, address, latitude, longitude, phone FROM businesses WHERE slug = ?',
      [slug]
    );

    if (bizRows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'UMKM tidak ditemukan.' } });
    }

    const business = bizRows[0];

    const [serviceRows] = await pool.query(
      'SELECT id, name, price, duration_min FROM services WHERE business_id = ? AND is_active = 1 ORDER BY name ASC',
      [business.id]
    );

    // Hapus id internal dari response publik (opsional tapi aman)
    const { id: _id, ...publicBusiness } = business;

    return res.json({ ...publicBusiness, services: serviceRows });
  } catch (err) {
    next(err);
  }
});

// POST /api/public/businesses/:slug/bookings (wajib login konsumen)
router.post('/businesses/:slug/bookings', requireCustomerAuth, async (req, res, next) => {
  try {
    const { slug } = req.params;

    const parsed = createBookingSchema.safeParse({
      serviceId: req.body.serviceId ?? req.body.service_id,
      date: req.body.date,
      time: req.body.time,
      customerName: req.body.customerName ?? req.body.customer_name,
      customerPhone: req.body.customerPhone ?? req.body.customer_phone,
      customerVoucherId: req.body.customerVoucherId ?? req.body.customer_voucher_id,
    });

    if (!parsed.success) {
      const message = parsed.error.issues?.[0]?.message || 'Input tidak valid.';
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message } });
    }

    const [custRows] = await pool.query(
      'SELECT id, name, phone FROM customers WHERE id = ?',
      [req.customerId]
    );
    if (custRows.length === 0) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Akun pelanggan tidak ditemukan. Silakan masuk ulang.' },
      });
    }
    const customer = custRows[0];

    const { serviceId, date, time, customerVoucherId } = parsed.data;
    const customerName = parsed.data.customerName ?? customer.name;
    const customerPhone = parsed.data.customerPhone ?? customer.phone;

    const timeFormatted = time.length === 5 ? `${time}:00` : time;
    const startDayjs = dayjs.tz(`${date} ${timeFormatted}`, 'Asia/Jakarta');

    if (!startDayjs.isValid() || startDayjs.format('YYYY-MM-DD') !== date) {
      return res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Waktu reservasi tidak valid.' },
      });
    }

    const nowWib = dayjs().tz('Asia/Jakarta');
    if (startDayjs.isBefore(nowWib)) {
      return res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Waktu reservasi tidak boleh di masa lalu.' },
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1) Cari UMKM berdasarkan slug dan kunci barisnya (SELECT ... FOR UPDATE)
      const [bizCheck] = await conn.query('SELECT id FROM businesses WHERE slug = ? FOR UPDATE', [slug]);
      if (bizCheck.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'UMKM tidak ditemukan.' } });
      }

      const businessId = bizCheck[0].id;

      // 2) Validasi:
      // a. Layanan milik UMKM & aktif
      const [serviceRows] = await conn.query(
        'SELECT id, name, price, duration_min, is_active FROM services WHERE id = ? AND business_id = ?',
        [serviceId, businessId]
      );

      if (serviceRows.length === 0 || !serviceRows[0].is_active) {
        await conn.rollback();
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Layanan tidak ditemukan atau tidak aktif.' },
        });
      }
      const service = serviceRows[0];

      // b. Bukan hari libur
      const [holidayRows] = await conn.query(
        'SELECT id FROM holidays WHERE business_id = ? AND date = ?',
        [businessId, date]
      );
      if (holidayRows.length > 0) {
        await conn.rollback();
        return res.status(422).json({
          error: { code: 'BUSINESS_CLOSED', message: 'UMKM sedang libur pada tanggal tersebut.' },
        });
      }

      // c. Di dalam jam operasional
      const weekday = startDayjs.day();
      const [hoursRows] = await conn.query(
        'SELECT open_time, close_time, is_closed FROM operating_hours WHERE business_id = ? AND weekday = ?',
        [businessId, weekday]
      );
      if (hoursRows.length === 0 || Boolean(hoursRows[0].is_closed)) {
        await conn.rollback();
        return res.status(422).json({
          error: { code: 'BUSINESS_CLOSED', message: 'UMKM tutup pada hari tersebut.' },
        });
      }

      const openMin = parseTimeToMinutes(hoursRows[0].open_time);
      const closeMin = parseTimeToMinutes(hoursRows[0].close_time);
      const startMin = startDayjs.hour() * 60 + startDayjs.minute();
      const endMin = startMin + service.duration_min;

      if (openMin === null || closeMin === null || startMin < openMin || endMin > closeMin) {
        await conn.rollback();
        return res.status(422).json({
          error: { code: 'OUTSIDE_OPERATING_HOURS', message: 'Waktu reservasi di luar jam operasional UMKM.' },
        });
      }

      // 3) Cek tabrakan dengan reservasi aktif (menunggu/dikonfirmasi) di rentang [mulai, selesai)
      const startAt = startDayjs.format('YYYY-MM-DD HH:mm:ss');
      const endAt = startDayjs.add(service.duration_min, 'minute').format('YYYY-MM-DD HH:mm:ss');

      const [conflictRows] = await conn.query(
        `SELECT id FROM bookings
         WHERE business_id = ?
           AND status IN ('menunggu', 'dikonfirmasi')
           AND start_at < ?
           AND end_at > ?
         FOR UPDATE`,
        [businessId, endAt, startAt]
      );

      // 4) Jika bentrok → ROLLBACK, balas 409 {code:"SLOT_TAKEN", message:"Jam sudah terisi, pilih jam lain."}
      if (conflictRows.length > 0) {
        await conn.rollback();
        return res.status(409).json({
          error: {
            code: 'SLOT_TAKEN',
            message: 'Jam sudah terisi, pilih jam lain.',
          },
        });
      }

      // 5) Terapkan voucher jika dipilih, INSERT status 'menunggu', COMMIT
      const originalPrice = Number(service.price || 0);
      let discountAmount = 0;
      let finalPrice = originalPrice;
      let appliedCustomerVoucherId = null;

      if (customerVoucherId) {
        const [cvRows] = await conn.query(
          `SELECT cv.id, cv.status, cv.voucher_id, v.title, v.discount_type, v.discount_value, v.min_spend, v.max_discount
           FROM customer_vouchers cv
           JOIN vouchers v ON cv.voucher_id = v.id
           WHERE cv.id = ? AND cv.customer_id = ?
           FOR UPDATE`,
          [customerVoucherId, customer.id]
        );

        if (cvRows.length === 0) {
          await conn.rollback();
          return res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'Voucher tidak ditemukan.' },
          });
        }

        const cv = cvRows[0];
        if (cv.status !== 'tersedia') {
          await conn.rollback();
          return res.status(422).json({
            error: { code: 'VOUCHER_UNAVAILABLE', message: 'Voucher sudah digunakan atau tidak berlaku lagi.' },
          });
        }

        const disc = calculateVoucherDiscount(cv, originalPrice);
        if (!disc.valid) {
          await conn.rollback();
          return res.status(422).json({
            error: { code: 'VOUCHER_MIN_SPEND', message: disc.message },
          });
        }

        discountAmount = disc.discountAmount;
        finalPrice = disc.finalPrice;
        appliedCustomerVoucherId = cv.id;

        await conn.query(
          "UPDATE customer_vouchers SET status = 'terpakai', used_at = NOW() WHERE id = ?",
          [cv.id]
        );
      }

      const code = await insertBookingWithRetry(conn, {
        businessId,
        serviceId: service.id,
        customerId: customer.id,
        customerName,
        customerPhone,
        startAt,
        endAt,
        status: 'menunggu',
        originalPrice,
        discountAmount,
        finalPrice,
        customerVoucherId: appliedCustomerVoucherId,
      });

      await conn.commit();

      return res.status(201).json({
        code,
        startAt,
        endAt,
        status: 'menunggu',
        originalPrice,
        discountAmount,
        finalPrice,
      });
    } catch (err) {
      try {
        await conn.rollback();
      } catch (_) {}
      next(err);
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/public/bookings/:code
router.get('/bookings/:code', async (req, res, next) => {
  try {
    const parsedCode = bookingCodeParamSchema.safeParse(req.params.code);
    if (!parsedCode.success) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Kode booking tidak ditemukan.' },
      });
    }
    const code = parsedCode.data;

    const [rows] = await pool.query(
      `SELECT
        b.code,
        biz.name AS businessName,
        biz.slug AS businessSlug,
        biz.address AS businessAddress,
        biz.latitude AS businessLatitude,
        biz.longitude AS businessLongitude,
        s.name AS serviceName,
        DATE_FORMAT(b.start_at, '%Y-%m-%d %H:%i:%s') AS startAt,
        DATE_FORMAT(b.end_at, '%Y-%m-%d %H:%i:%s') AS endAt,
        b.status,
        b.customer_name AS customerName,
        COALESCE(b.original_price, s.price, 0) AS originalPrice,
        COALESCE(b.discount_amount, 0) AS discountAmount,
        COALESCE(b.final_price, s.price, 0) AS finalPrice,
        COALESCE(b.points_earned, 0) AS pointsEarned
      FROM bookings b
      JOIN businesses biz ON b.business_id = biz.id
      JOIN services s ON b.service_id = s.id
      WHERE b.code = ?`,
      [code]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Kode booking tidak ditemukan.' },
      });
    }

    const booking = rows[0];

    return res.json({
      code: booking.code,
      businessName: booking.businessName,
      businessSlug: booking.businessSlug,
      businessAddress: booking.businessAddress,
      businessLatitude: booking.businessLatitude,
      businessLongitude: booking.businessLongitude,
      serviceName: booking.serviceName,
      startAt: booking.startAt,
      endAt: booking.endAt,
      status: booking.status,
      customerName: booking.customerName,
      originalPrice: Number(booking.originalPrice || 0),
      discountAmount: Number(booking.discountAmount || 0),
      finalPrice: Number(booking.finalPrice || 0),
      pointsEarned: Number(booking.pointsEarned || 0),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/public/bookings/:code/cancel
router.post('/bookings/:code/cancel', async (req, res, next) => {
  try {
    const parsedCode = bookingCodeParamSchema.safeParse(req.params.code);
    if (!parsedCode.success) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Kode booking tidak ditemukan.' },
      });
    }
    const code = parsedCode.data;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(
        `SELECT
          b.id,
          b.code,
          b.status,
          b.customer_voucher_id,
          DATE_FORMAT(b.start_at, '%Y-%m-%d %H:%i:%s') AS startAt
        FROM bookings b
        WHERE b.code = ?
        FOR UPDATE`,
        [code]
      );

      if (rows.length === 0) {
        await conn.rollback();
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Kode booking tidak ditemukan.' },
        });
      }

      const booking = rows[0];

      // Status hanya boleh dibatalkan jika menunggu atau dikonfirmasi
      if (booking.status !== 'menunggu' && booking.status !== 'dikonfirmasi') {
        await conn.rollback();
        return res.status(422).json({
          error: {
            code: 'CANNOT_CANCEL',
            message: `Reservasi tidak dapat dibatalkan karena statusnya sudah '${booking.status}'.`,
          },
        });
      }

      // Sisa waktu ke jam mulai harus >= CANCEL_MIN_HOURS (2 jam, WIB)
      const nowWib = dayjs().tz('Asia/Jakarta');
      const startWib = dayjs.tz(booking.startAt, 'Asia/Jakarta');
      const diffSeconds = startWib.diff(nowWib, 'second');
      const minRequiredSeconds = CANCEL_MIN_HOURS * 3600;

      if (diffSeconds < minRequiredSeconds) {
        await conn.rollback();
        return res.status(422).json({
          error: {
            code: 'CANCEL_TOO_LATE',
            message: `Pembatalan hanya dapat dilakukan paling lambat ${CANCEL_MIN_HOURS} jam sebelum jam reservasi.`,
          },
        });
      }

      await conn.query(
        "UPDATE bookings SET status = 'dibatalkan' WHERE id = ?",
        [booking.id]
      );

      if (booking.customer_voucher_id) {
        await conn.query(
          "UPDATE customer_vouchers SET status = 'tersedia', used_at = NULL WHERE id = ? AND status = 'terpakai'",
          [booking.customer_voucher_id]
        );
      }

      await conn.commit();

      return res.json({
        code: booking.code,
        status: 'dibatalkan',
        message: 'Reservasi berhasil dibatalkan.',
      });
    } catch (err) {
      try {
        await conn.rollback();
      } catch (_) {}
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
});

export default router;
