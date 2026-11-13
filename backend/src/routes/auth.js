import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import { BUSINESS_CATEGORIES } from '../constants/categories.js';

const router = Router();

// Helpers
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function uniqueSlug(base) {
  let slug = slugify(base);
  let suffix = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const [rows] = await pool.query('SELECT id FROM businesses WHERE slug = ?', [candidate]);
    if (rows.length === 0) return candidate;
    suffix += 1;
  }
}

// POST /api/auth/register
const registerSchema = z.object({
  email: z.string().email({ message: 'Email tidak valid.' }),
  password: z.string().min(8, { message: 'Password minimal 8 karakter.' }),
  businessName: z.string().min(1, { message: 'Nama usaha tidak boleh kosong.' }),
  category: z.enum(BUSINESS_CATEGORIES, {
    message: 'Kategori tidak valid.',
  }),
});

router.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues?.[0]?.message || 'Input tidak valid.';
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message } });
    }
    const { email, password, businessName, category } = parsed.data;

    // Cek email unik
    const [existing] = await pool.query('SELECT id FROM businesses WHERE owner_email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: { code: 'EMAIL_TAKEN', message: 'Email sudah terdaftar.' } });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const slug = await uniqueSlug(businessName);

    const [result] = await pool.query(
      'INSERT INTO businesses (owner_email, password_hash, name, slug, category) VALUES (?, ?, ?, ?, ?)',
      [email, password_hash, businessName, slug, category]
    );

    return res.status(201).json({ id: result.insertId, slug });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
const loginSchema = z.object({
  email: z.string().email({ message: 'Email tidak valid.' }),
  password: z.string().min(1, { message: 'Password tidak boleh kosong.' }),
});

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues?.[0]?.message || 'Input tidak valid.';
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message } });
    }
    const { email, password } = parsed.data;

    const [rows] = await pool.query('SELECT id, password_hash FROM businesses WHERE owner_email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email atau password salah.' } });
    }

    const business = rows[0];
    const match = await bcrypt.compare(password, business.password_hash);
    if (!match) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email atau password salah.' } });
    }

    const token = jwt.sign(
      { businessId: business.id },
      process.env.JWT_SECRET || 'changeme_jwt_secret',
      { expiresIn: '8h' }
    );

    return res.json({ token });
  } catch (err) {
    next(err);
  }
});

export default router;
