import { Router } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// Schema validasi
const serviceSchema = z.object({
  name: z.string().min(1, { message: 'Nama layanan tidak boleh kosong.' }),
  price: z.number({ invalid_type_error: 'Harga harus berupa angka.' }).min(0, { message: 'Harga tidak boleh negatif.' }),
  duration_min: z
    .number({ invalid_type_error: 'Durasi harus berupa angka.' })
    .int({ message: 'Durasi harus bilangan bulat.' })
    .min(15, { message: 'Durasi minimal 15 menit.' })
    .max(480, { message: 'Durasi maksimal 480 menit.' })
    .refine((v) => v % 15 === 0, { message: 'Durasi harus kelipatan 15 menit.' }),
});

const patchSchema = serviceSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'Minimal satu field harus diisi.' }
);

// GET /api/services
router.get('/services', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, price, duration_min FROM services WHERE business_id = ? AND is_active = 1 ORDER BY id',
      [req.businessId]
    );
    return res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/services
router.post('/services', requireAuth, async (req, res, next) => {
  try {
    const parsed = serviceSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues?.[0]?.message || 'Input tidak valid.';
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message } });
    }
    const { name, price, duration_min } = parsed.data;

    const [result] = await pool.query(
      'INSERT INTO services (business_id, name, price, duration_min) VALUES (?, ?, ?, ?)',
      [req.businessId, name, price, duration_min]
    );
    return res.status(201).json({ id: result.insertId, name, price, duration_min });
  } catch (err) {
    next(err);
  }
});

// PUT /api/services/:id
router.put('/services/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues?.[0]?.message || 'Input tidak valid.';
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message } });
    }

    // Cek kepemilikan
    const [rows] = await pool.query(
      'SELECT id FROM services WHERE id = ? AND business_id = ? AND is_active = 1',
      [id, req.businessId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Layanan tidak ditemukan.' } });
    }

    const data = parsed.data;
    const fields = [];
    const values = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.price !== undefined) { fields.push('price = ?'); values.push(data.price); }
    if (data.duration_min !== undefined) { fields.push('duration_min = ?'); values.push(data.duration_min); }
    values.push(id);

    await pool.query(`UPDATE services SET ${fields.join(', ')} WHERE id = ?`, values);

    const [updated] = await pool.query(
      'SELECT id, name, price, duration_min FROM services WHERE id = ?',
      [id]
    );
    return res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/services/:id  (soft delete)
router.delete('/services/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const [rows] = await pool.query(
      'SELECT id FROM services WHERE id = ? AND business_id = ? AND is_active = 1',
      [id, req.businessId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Layanan tidak ditemukan.' } });
    }

    await pool.query('UPDATE services SET is_active = 0 WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

