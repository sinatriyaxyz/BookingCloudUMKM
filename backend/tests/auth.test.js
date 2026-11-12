/**
 * Tes F-01: register, login, /api/me
 * Pool DB di-mock agar tidak perlu koneksi MariaDB nyata.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// --- Mock pool SEBELUM app di-import ---
vi.mock('../src/db/pool.js', () => {
  const mockQuery = vi.fn();
  return { default: { query: mockQuery } };
});

import pool from '../src/db/pool.js';
import app from '../src/app.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme_jwt_secret';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
describe('POST /api/auth/register', () => {
  it('register sukses → 201', async () => {
    // Tidak ada email existing, slug unik, insert berhasil
    pool.query
      .mockResolvedValueOnce([[]])           // SELECT email → kosong
      .mockResolvedValueOnce([[]])           // SELECT slug di uniqueSlug → kosong (slug tersedia)
      .mockResolvedValueOnce([{ insertId: 1 }]); // INSERT

    const res = await request(app).post('/api/auth/register').send({
      email: 'owner@test.com',
      password: 'rahasia123',
      businessName: 'Barber Jaya',
      category: 'barbershop',
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('slug');
  });

  it('email sudah terdaftar → 409', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // email sudah ada

    const res = await request(app).post('/api/auth/register').send({
      email: 'duplicate@test.com',
      password: 'rahasia123',
      businessName: 'Barber Jaya',
      category: 'barbershop',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('password kurang dari 8 karakter → 422', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'valid@test.com',
      password: 'short',
      businessName: 'Barber Jaya',
      category: 'barbershop',
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('kategori tidak valid → 422', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'valid@test.com',
      password: 'rahasia123',
      businessName: 'Barber Jaya',
      category: 'invalid_cat',
    });

    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
describe('POST /api/auth/login', () => {
  it('login berhasil → 200 + token', async () => {
    const hash = await bcrypt.hash('rahasia123', 10);
    pool.query.mockResolvedValueOnce([[{ id: 1, password_hash: hash }]]);

    const res = await request(app).post('/api/auth/login').send({
      email: 'owner@test.com',
      password: 'rahasia123',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    const payload = jwt.verify(res.body.token, JWT_SECRET);
    expect(payload.businessId).toBe(1);
  });

  it('password salah → 401', async () => {
    const hash = await bcrypt.hash('rahasia123', 10);
    pool.query.mockResolvedValueOnce([[{ id: 1, password_hash: hash }]]);

    const res = await request(app).post('/api/auth/login').send({
      email: 'owner@test.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('email tidak ditemukan → 401', async () => {
    pool.query.mockResolvedValueOnce([[]]); // kosong

    const res = await request(app).post('/api/auth/login').send({
      email: 'notfound@test.com',
      password: 'rahasia123',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

// ---------------------------------------------------------------------------
// GET /api/me
// ---------------------------------------------------------------------------
describe('GET /api/me', () => {
  it('tanpa token → 401', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
  });

  it('token tidak valid → 401', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer tokenpalsu');
    expect(res.status).toBe(401);
  });

  it('token valid → 200 + data UMKM (tanpa password_hash)', async () => {
    const token = jwt.sign({ businessId: 7 }, JWT_SECRET, { expiresIn: '8h' });
    pool.query.mockResolvedValueOnce([[{
      id: 7,
      owner_email: 'owner@test.com',
      name: 'Barber Jaya',
      slug: 'barber-jaya',
      category: 'barbershop',
      address: null,
      phone: null,
      created_at: '2026-01-01 08:00:00',
    }]]);

    const res = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 7);
    expect(res.body).not.toHaveProperty('password_hash');
  });
});
