import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

const holidaySchema = z.object({
  date: z
    .string({ invalid_type_error: 'Tanggal harus berupa string.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal harus YYYY-MM-DD.' })
    .refine((d) => !isNaN(Date.parse(d)), { message: 'Tanggal tidak valid.' }),
  note: z.string().max(255, { message: 'Catatan maksimal 255 karakter.' }).optional().nullable().default(''),
});

function formatDate(val) {
  if (val instanceof Date) {
    return dayjs(val).format('YYYY-MM-DD');
  }
  return String(val).slice(0, 10);
}

// GET /api/holidays
router.get('/holidays', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, DATE_FORMAT(date, '%Y-%m-%d') as date, note FROM holidays WHERE business_id = ? ORDER BY date ASC",
      [req.businessId]
    );

    const holidays = rows.map((r) => ({
      id: r.id,
      date: formatDate(r.date),
      note: r.note || '',
    }));

    return res.json(holidays);
  } catch (err) {
    next(err);
  }
});

// POST /api/holidays
router.post('/holidays', requireAuth, async (req, res, next) => {
  try {
    const parsed = holidaySchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues?.[0]?.message || 'Input tidak valid.';
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message } });
    }

    const { date, note } = parsed.data;

    // Cek duplikat tanggal untuk UMKM yang sama
    const [existing] = await pool.query(
      'SELECT id FROM holidays WHERE business_id = ? AND date = ?',
      [req.businessId, date]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: { code: 'DUPLICATE_HOLIDAY', message: 'Tanggal libur sudah terdaftar.' },
      });
    }

    try {
      const [result] = await pool.query(
        'INSERT INTO holidays (business_id, date, note) VALUES (?, ?, ?)',
        [req.businessId, date, note || null]
      );

      return res.status(201).json({
        id: result.insertId,
        date,
        note: note || '',
      });
    } catch (insertErr) {
      if (insertErr.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          error: { code: 'DUPLICATE_HOLIDAY', message: 'Tanggal libur sudah terdaftar.' },
        });
      }
      throw insertErr;
    }
  } catch (err) {
    next(err);
  }
});

// DELETE /api/holidays/:id
router.delete('/holidays/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'ID libur tidak valid.' } });
    }

    const [existing] = await pool.query(
      'SELECT id FROM holidays WHERE id = ? AND business_id = ?',
      [id, req.businessId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Tanggal libur tidak ditemukan.' },
      });
    }

    await pool.query('DELETE FROM holidays WHERE id = ? AND business_id = ?', [id, req.businessId]);

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
