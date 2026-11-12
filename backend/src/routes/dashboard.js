import { Router } from 'express';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { formatBooking } from './bookings.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const router = Router();

// GET /api/dashboard
router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    const todayWib = dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD');

    const startOfToday = `${todayWib} 00:00:00`;
    const endOfToday = `${todayWib} 23:59:59`;

    // 1. Ambil reservasi hari ini WIB
    const [todayRows] = await pool.query(
      `SELECT
        b.id,
        b.code,
        b.business_id,
        b.service_id,
        s.name AS service_name,
        s.price,
        s.duration_min,
        b.customer_name,
        b.customer_phone,
        DATE_FORMAT(b.start_at, '%Y-%m-%d %H:%i:%s') AS start_at,
        DATE_FORMAT(b.end_at, '%Y-%m-%d %H:%i:%s') AS end_at,
        b.status,
        DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(b.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.business_id = ?
        AND b.start_at >= ?
        AND b.start_at <= ?
      ORDER BY b.start_at ASC, b.id ASC`,
      [req.businessId, startOfToday, endOfToday]
    );

    // 2. Hitung jumlah status: menunggu, dikonfirmasi, hari_ini
    const [countRows] = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN status = 'menunggu' THEN 1 ELSE 0 END), 0) AS menunggu,
        COALESCE(SUM(CASE WHEN status = 'dikonfirmasi' THEN 1 ELSE 0 END), 0) AS dikonfirmasi,
        COALESCE(SUM(CASE WHEN start_at >= ? AND start_at <= ? THEN 1 ELSE 0 END), 0) AS hari_ini
      FROM bookings
      WHERE business_id = ?`,
      [startOfToday, endOfToday, req.businessId]
    );

    const countRow = countRows[0] || {};
    const counts = {
      menunggu: Number(countRow.menunggu || 0),
      dikonfirmasi: Number(countRow.dikonfirmasi || 0),
      hari_ini: Number(countRow.hari_ini || 0),
    };

    // 3. Ambil riwayat: 20 reservasi terakhir yang selesai atau dibatalkan
    const [historyRows] = await pool.query(
      `SELECT
        b.id,
        b.code,
        b.business_id,
        b.service_id,
        s.name AS service_name,
        s.price,
        s.duration_min,
        b.customer_name,
        b.customer_phone,
        DATE_FORMAT(b.start_at, '%Y-%m-%d %H:%i:%s') AS start_at,
        DATE_FORMAT(b.end_at, '%Y-%m-%d %H:%i:%s') AS end_at,
        b.status,
        DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(b.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.business_id = ?
        AND b.status IN ('selesai', 'dibatalkan')
      ORDER BY b.start_at DESC, b.id DESC
      LIMIT 20`,
      [req.businessId]
    );

    return res.json({
      today: todayRows.map(formatBooking),
      counts,
      history: historyRows.map(formatBooking),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
