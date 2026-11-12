import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

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
