import { Router } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { BUSINESS_CATEGORIES } from '../constants/categories.js';

const router = Router();

// PUT /api/me/profile
const profileSchema = z.object({
  name: z.string().min(1, { message: 'Nama tidak boleh kosong.' }).optional(),
  category: z
    .enum(BUSINESS_CATEGORIES, {
      message: 'Kategori tidak valid.',
    })
    .optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  latitude: z.number({ message: 'Latitude harus berupa angka.' })
    .min(-90, { message: 'Latitude harus di antara -90 dan 90.' })
    .max(90, { message: 'Latitude harus di antara -90 dan 90.' })
    .nullable().optional(),
  longitude: z.number({ message: 'Longitude harus berupa angka.' })
    .min(-180, { message: 'Longitude harus di antara -180 dan 180.' })
    .max(180, { message: 'Longitude harus di antara -180 dan 180.' })
    .nullable().optional(),
}).refine(
  (d) => (d.latitude === undefined) === (d.longitude === undefined)
    && (d.latitude === null) === (d.longitude === null),
  { message: 'Latitude dan longitude harus diisi bersamaan.' }
);

router.put('/me/profile', requireAuth, async (req, res, next) => {
  try {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues?.[0]?.message || 'Input tidak valid.';
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message } });
    }

    const data = parsed.data;
    const fields = [];
    const values = [];

    if (data.name !== undefined)     { fields.push('name = ?');     values.push(data.name); }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
    if (data.address !== undefined)  { fields.push('address = ?');  values.push(data.address); }
    if (data.phone !== undefined)    { fields.push('phone = ?');    values.push(data.phone); }
    if (data.latitude !== undefined) {
      fields.push('latitude = ?', 'longitude = ?');
      values.push(data.latitude, data.longitude);
    }

    if (fields.length === 0) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Tidak ada field yang diperbarui.' } });
    }

    values.push(req.businessId);
    await pool.query(`UPDATE businesses SET ${fields.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.query(
      'SELECT id, owner_email, name, slug, category, address, latitude, longitude, phone, created_at FROM businesses WHERE id = ?',
      [req.businessId]
    );

    return res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;

