import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import { requireCustomerAuth } from '../middleware/requireCustomerAuth.js';

const router = Router();

const phoneSchema = z
  .union([z.string(), z.number()])
  .transform((val) => String(val).replace(/[\s-]/g, ''))
  .pipe(
    z.string().regex(/^(0[0-9]{8,14}|\+62[0-9]{7,13})$/, {
      message: 'Nomor telepon harus format Indonesia (9-15 digit, diawali 0 atau +62).',
    })
  );

const registerSchema = z.object({
  name: z
    .string({ error: 'Nama lengkap wajib diisi.' })
    .trim()
    .min(1, { message: 'Nama lengkap wajib diisi.' })
    .max(255, { message: 'Nama lengkap maksimal 255 karakter.' }),
  email: z
    .string({ error: 'Email wajib diisi.' })
    .trim()
    .toLowerCase()
    .email({ message: 'Email tidak valid.' }),
  phone: phoneSchema,
  password: z
    .string({ error: 'Password wajib diisi.' })
    .min(8, { message: 'Password minimal 8 karakter.' }),
});

const loginSchema = z.object({
  email: z
    .string({ error: 'Email wajib diisi.' })
    .trim()
    .toLowerCase()
    .email({ message: 'Email tidak valid.' }),
  password: z
    .string({ error: 'Password wajib diisi.' })
    .min(1, { message: 'Password tidak boleh kosong.' }),
});

function signCustomerToken(customerId) {
  return jwt.sign(
    { customerId, role: 'customer' },
    process.env.JWT_SECRET || 'changeme_jwt_secret',
    { expiresIn: '7d' }
  );
}

// POST /api/customer/auth/register
router.post('/auth/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues?.[0]?.message || 'Input tidak valid.';
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message } });
    }

    const { name, email, phone, password } = parsed.data;

    const [existing] = await pool.query('SELECT id FROM customers WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({
        error: { code: 'EMAIL_TAKEN', message: 'Email sudah terdaftar sebagai akun pelanggan.' },
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO customers (name, email, phone, password_hash) VALUES (?, ?, ?, ?)',
      [name, email, phone, passwordHash]
    );

    const customer = { id: result.insertId, name, email, phone };
    const token = signCustomerToken(customer.id);

    return res.status(201).json({ token, customer });
  } catch (err) {
    next(err);
  }
});

// POST /api/customer/auth/login
router.post('/auth/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues?.[0]?.message || 'Input tidak valid.';
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message } });
    }

    const { email, password } = parsed.data;

    const [rows] = await pool.query(
      'SELECT id, name, email, phone, password_hash FROM customers WHERE email = ?',
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email atau password salah.' },
      });
    }

    const row = rows[0];
    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email atau password salah.' },
      });
    }

    const customer = { id: row.id, name: row.name, email: row.email, phone: row.phone };
    const token = signCustomerToken(row.id);

    return res.json({ token, customer });
  } catch (err) {
    next(err);
  }
});

// GET /api/customer/me
router.get('/me', requireCustomerAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, points, created_at AS createdAt FROM customers WHERE id = ?',
      [req.customerId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Akun pelanggan tidak ditemukan.' } });
    }
    return res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/customer/bookings
router.get('/bookings', requireCustomerAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        b.code,
        biz.name AS businessName,
        biz.slug AS businessSlug,
        biz.category,
        s.name AS serviceName,
        s.price,
        s.duration_min AS durationMin,
        b.original_price AS originalPrice,
        b.discount_amount AS discountAmount,
        b.final_price AS finalPrice,
        b.points_earned AS pointsEarned,
        DATE_FORMAT(b.start_at, '%Y-%m-%d %H:%i:%s') AS startAt,
        DATE_FORMAT(b.end_at, '%Y-%m-%d %H:%i:%s') AS endAt,
        b.status,
        b.customer_name AS customerName,
        b.customer_phone AS customerPhone
      FROM bookings b
      JOIN businesses biz ON b.business_id = biz.id
      JOIN services s ON b.service_id = s.id
      WHERE b.customer_id = ?
      ORDER BY b.start_at DESC`,
      [req.customerId]
    );
    return res.json({ bookings: rows });
  } catch (err) {
    next(err);
  }
});

export default router;

