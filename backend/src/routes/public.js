import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import pool from '../db/pool.js';
import { computeSlots, parseTimeToMinutes } from '../services/availability.js';
import { insertBookingWithRetry } from '../services/bookingCode.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const router = Router();

const availabilityQuerySchema = z.object({
  serviceId: z.coerce
    .number({ invalid_type_error: 'serviceId harus berupa angka.' })
    .int({ message: 'serviceId harus bilangan bulat.' })
    .positive({ message: 'serviceId harus bilangan bulat positif.' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal harus YYYY-MM-DD.' }),
});

const createBookingSchema = z.object({
  serviceId: z.coerce
    .number({ invalid_type_error: 'serviceId harus berupa angka.' })
    .int({ message: 'serviceId harus bilangan bulat.' })
    .positive({ message: 'serviceId harus bilangan bulat positif.' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal harus YYYY-MM-DD.' }),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, { message: 'Format jam harus HH:mm.' }),
  customerName: z
    .string({ invalid_type_error: 'Nama pelanggan harus berupa teks.' })
    .trim()
    .min(1, { message: 'Nama pelanggan wajib diisi.' }),
  customerPhone: z
    .union([z.string(), z.number()])
    .transform((val) => String(val).replace(/[\s-]/g, ''))
    .pipe(
      z.string().regex(/^(0[0-9]{8,14}|\+62[0-9]{7,13})$/, {
        message: 'Nomor telepon harus format Indonesia (9-15 digit, diawali 0 atau +62).',
      })
    ),
});

// GET /api/public/businesses
router.get('/businesses', async (req, res, next) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT name, slug, category, address FROM businesses';
    const params = [];

    if (category) {
      sql += ' WHERE category = ?';
      params.push(category);
    }

    sql += ' ORDER BY name ASC';

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
      'SELECT id, name, slug, category, address, phone FROM businesses WHERE slug = ?',
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

// POST /api/public/businesses/:slug/bookings
router.post('/businesses/:slug/bookings', async (req, res, next) => {
  try {
    const { slug } = req.params;

    const parsed = createBookingSchema.safeParse({
      serviceId: req.body.serviceId ?? req.body.service_id,
      date: req.body.date,
      time: req.body.time,
      customerName: req.body.customerName ?? req.body.customer_name,
      customerPhone: req.body.customerPhone ?? req.body.customer_phone,
    });

    if (!parsed.success) {
      const message = parsed.error.issues?.[0]?.message || 'Input tidak valid.';
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message } });
    }

    const { serviceId, date, time, customerName, customerPhone } = parsed.data;

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
      await conn.query('SELECT id FROM businesses WHERE id = ? FOR UPDATE', [businessId]);

      // 2) Validasi:
      // a. Layanan milik UMKM & aktif
      const [serviceRows] = await conn.query(
        'SELECT id, name, duration_min, is_active FROM services WHERE id = ? AND business_id = ?',
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
          code: 'SLOT_TAKEN',
          message: 'Jam sudah terisi, pilih jam lain.',
        });
      }

      // 5) INSERT status 'menunggu', COMMIT, balas 201 {code, startAt, endAt, status}
      const code = await insertBookingWithRetry(conn, {
        businessId,
        serviceId: service.id,
        customerName,
        customerPhone,
        startAt,
        endAt,
        status: 'menunggu',
      });

      await conn.commit();

      return res.status(201).json({
        code,
        startAt,
        endAt,
        status: 'menunggu',
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

export default router;
