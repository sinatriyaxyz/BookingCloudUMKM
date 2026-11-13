import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// GET /api/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, owner_email, name, slug, category, address, latitude, longitude, phone, created_at FROM businesses WHERE id = ?',
      [req.businessId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Data tidak ditemukan.' } });
    }
    return res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;

