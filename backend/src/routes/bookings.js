import { Router } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { canTransition, BOOKING_STATUS } from '../services/bookingStatus.js';

const router = Router();

// Kolom waktu sudah berupa string WIB "YYYY-MM-DD HH:mm:ss" (DATE_FORMAT di query).
// Respons memakai camelCase, konsisten dengan endpoint publik.
export function formatBooking(row) {
  return {
    id: row.id,
    code: row.code,
    serviceId: row.service_id,
    serviceName: row.service_name || '',
    price: row.price != null ? Number(row.price) : null,
    durationMin: row.duration_min != null ? Number(row.duration_min) : null,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const idParamSchema = z.coerce
  .number({ error: 'ID reservasi tidak valid.' })
  .int({ message: 'ID reservasi tidak valid.' })
  .positive({ message: 'ID reservasi tidak valid.' });

const listQuerySchema = z.object({
  date: z
    .preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal harus YYYY-MM-DD.' }).optional()
    ),
  status: z
    .preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.enum([BOOKING_STATUS.MENUNGGU, BOOKING_STATUS.DIKONFIRMASI, BOOKING_STATUS.SELESAI, BOOKING_STATUS.DIBATALKAN], {
        message: 'Status tidak valid.',
      }).optional()
    ),
  page: z.preprocess(
    (v) => (v === undefined || (typeof v === 'string' && v.trim() === '') ? 1 : Number(v)),
    z.number({ error: 'Page harus berupa angka.' })
      .int({ message: 'Page harus bilangan bulat.' })
      .min(1, { message: 'Page minimal 1.' })
      .default(1)
  ),
  limit: z.preprocess(
    (v) => (v === undefined || (typeof v === 'string' && v.trim() === '') ? 10 : Number(v)),
    z.number({ error: 'Limit harus berupa angka.' })
      .int({ message: 'Limit harus bilangan bulat.' })
      .min(1, { message: 'Limit minimal 1.' })
      .max(100, { message: 'Limit maksimal 100.' })
      .default(10)
  ),
});

// GET /api/bookings?date=&status=&page=
router.get('/bookings', requireAuth, async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const message = parsed.error.issues?.[0]?.message || 'Input query tidak valid.';
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message } });
    }

    const { date, status, page, limit } = parsed.data;
    const conditions = ['b.business_id = ?'];
    const params = [req.businessId];

    if (date) {
      conditions.push('b.start_at >= ? AND b.start_at <= ?');
      params.push(`${date} 00:00:00`, `${date} 23:59:59`);
    }

    if (status) {
      conditions.push('b.status = ?');
      params.push(status);
    }

    const whereClause = conditions.join(' AND ');

    // Hitung total data
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM bookings b WHERE ${whereClause}`,
      params
    );
    const total = countRows[0]?.total ? Number(countRows[0].total) : 0;

    // Ambil data dengan paginasi
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
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
      WHERE ${whereClause}
      ORDER BY b.start_at ASC, b.id ASC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const items = rows.map(formatBooking);
    const totalPages = Math.ceil(total / limit);

    return res.json({ bookings: items, page, limit, total, totalPages });
  } catch (err) {
    next(err);
  }
});

// Helper untuk update transisi status
async function handleStatusTransition(req, res, next, targetStatus) {
  const parsedId = idParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'ID reservasi tidak valid.' },
    });
  }
  const id = parsedId.data;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT
        b.id,
        b.code,
        b.business_id,
        b.service_id,
        s.name AS service_name,
        b.customer_name,
        b.customer_phone,
        DATE_FORMAT(b.start_at, '%Y-%m-%d %H:%i:%s') AS start_at,
        DATE_FORMAT(b.end_at, '%Y-%m-%d %H:%i:%s') AS end_at,
        b.status
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.id = ? AND b.business_id = ?
      FOR UPDATE`,
      [id, req.businessId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      // AGENTS.md aturan 10: Multi-tenant filter business_id dari token. Akses data UMKM lain -> 404
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Reservasi tidak ditemukan.' },
      });
    }

    const booking = rows[0];

    if (!canTransition(booking.status, targetStatus)) {
      await conn.rollback();
      return res.status(422).json({
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: `Status reservasi tidak dapat diubah dari '${booking.status}' ke '${targetStatus}'.`,
        },
      });
    }

    await conn.query('UPDATE bookings SET status = ? WHERE id = ?', [targetStatus, id]);

    await conn.commit();

    return res.json({
      id: booking.id,
      code: booking.code,
      status: targetStatus,
      previousStatus: booking.status,
      customerName: booking.customer_name,
      serviceName: booking.service_name || '',
      startAt: booking.start_at,
      endAt: booking.end_at,
      message: `Status reservasi berhasil diubah menjadi '${targetStatus}'.`,
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
}

// POST /api/bookings/:id/confirm
router.post('/bookings/:id/confirm', requireAuth, (req, res, next) => {
  return handleStatusTransition(req, res, next, BOOKING_STATUS.DIKONFIRMASI);
});

// POST /api/bookings/:id/complete
router.post('/bookings/:id/complete', requireAuth, (req, res, next) => {
  return handleStatusTransition(req, res, next, BOOKING_STATUS.SELESAI);
});

// POST /api/bookings/:id/cancel
router.post('/bookings/:id/cancel', requireAuth, (req, res, next) => {
  return handleStatusTransition(req, res, next, BOOKING_STATUS.DIBATALKAN);
});

export default router;
