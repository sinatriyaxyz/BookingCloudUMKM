import { Router } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const dayItemSchema = z.object({
  weekday: z.number({ invalid_type_error: 'Weekday harus berupa angka.' })
    .int({ message: 'Weekday harus bilangan bulat.' })
    .min(0, { message: 'Weekday minimal 0.' })
    .max(6, { message: 'Weekday maksimal 6.' }),
  open_time: z.string().regex(timeRegex, { message: 'Format jam buka harus HH:mm.' }),
  close_time: z.string().regex(timeRegex, { message: 'Format jam tutup harus HH:mm.' }),
  is_closed: z.boolean().optional().default(false),
});

function formatTime(val) {
  if (!val) return '09:00';
  const str = String(val);
  return str.slice(0, 5);
}

// GET /api/operating-hours
router.get('/operating-hours', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT weekday, open_time, close_time, is_closed FROM operating_hours WHERE business_id = ? ORDER BY weekday ASC',
      [req.businessId]
    );

    const days = [];
    for (let w = 0; w < 7; w++) {
      const found = rows.find((r) => r.weekday === w);
      if (found) {
        days.push({
          weekday: found.weekday,
          open_time: formatTime(found.open_time),
          close_time: formatTime(found.close_time),
          is_closed: Boolean(found.is_closed),
        });
      } else {
        days.push({
          weekday: w,
          open_time: '09:00',
          close_time: '17:00',
          is_closed: true,
        });
      }
    }

    return res.json(days);
  } catch (err) {
    next(err);
  }
});

// PUT /api/operating-hours
router.put('/operating-hours', requireAuth, async (req, res, next) => {
  try {
    const rawList = Array.isArray(req.body) ? req.body : req.body?.hours;
    if (!rawList || !Array.isArray(rawList)) {
      return res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Data jam operasional harus berupa array 7 hari.' },
      });
    }

    if (rawList.length !== 7) {
      return res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Jam operasional harus mencakup tepat 7 hari (0-6).' },
      });
    }

    const parsedItems = [];
    const seenWeekdays = new Set();

    for (const item of rawList) {
      const parsed = dayItemSchema.safeParse(item);
      if (!parsed.success) {
        const message = parsed.error.issues?.[0]?.message || 'Input jam operasional tidak valid.';
        return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message } });
      }

      const data = parsed.data;
      if (seenWeekdays.has(data.weekday)) {
        return res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: `Hari ${data.weekday} duplikat.` },
        });
      }
      seenWeekdays.add(data.weekday);

      const open = formatTime(data.open_time);
      const close = formatTime(data.close_time);

      if (open >= close) {
        return res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: `Jam buka harus lebih awal dari jam tutup untuk hari ${data.weekday}.`,
          },
        });
      }

      parsedItems.push({
        weekday: data.weekday,
        open_time: open,
        close_time: close,
        is_closed: Boolean(data.is_closed),
      });
    }

    if (seenWeekdays.size !== 7) {
      return res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Jam operasional harus mencakup seluruh hari dari 0 sampai 6.' },
      });
    }

    parsedItems.sort((a, b) => a.weekday - b.weekday);

    const placeholders = parsedItems.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const values = [];
    for (const item of parsedItems) {
      values.push(req.businessId, item.weekday, item.open_time, item.close_time, item.is_closed ? 1 : 0);
    }

    const sql = `
      INSERT INTO operating_hours (business_id, weekday, open_time, close_time, is_closed)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        open_time = VALUES(open_time),
        close_time = VALUES(close_time),
        is_closed = VALUES(is_closed)
    `;

    await pool.query(sql, values);

    return res.json(parsedItems);
  } catch (err) {
    next(err);
  }
});

export default router;
