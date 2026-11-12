import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import pool from '../db/pool.js';
import { computeSlots } from '../services/availability.js';

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

export default router;
