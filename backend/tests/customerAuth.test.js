/**
 * Tes Akun Konsumen: register, login, /api/customer/me, /api/customer/bookings,
 * isolasi token pemilik vs konsumen, dan proteksi endpoint booking.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

vi.mock('../src/db/pool.js', () => {
  const mockQuery = vi.fn();
  return { default: { query: mockQuery } };
});

import pool from '../src/db/pool.js';
import app from '../src/app.js';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme_jwt_secret';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/customer/auth/register', () => {
  it('daftar konsumen sukses → 201 + token + data customer', async () => {
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 42 }]);

    const res = await request(app).post('/api/customer/auth/register').send({
      name: 'Siti Rahma',
      email: 'siti@contoh.id',
      phone: '081234567890',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.customer).toEqual({
      id: 42,
      name: 'Siti Rahma',
      email: 'siti@contoh.id',
      phone: '081234567890',
    });

    const decoded = jwt.verify(res.body.token, JWT_SECRET);
    expect(decoded.customerId).toBe(42);
    expect(decoded.role).toBe('customer');
  });

  it('email sudah terdaftar → 409 EMAIL_TAKEN', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1 }]]);

    const res = await request(app).post('/api/customer/auth/register').send({
      name: 'Siti Rahma',
      email: 'siti@contoh.id',
      phone: '081234567890',
      password: 'password123',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('nomor telepon tidak valid → 422', async () => {
    const res = await request(app).post('/api/customer/auth/register').send({
      name: 'Siti Rahma',
      email: 'siti@contoh.id',
      phone: '12345',
      password: 'password123',
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('password kurang dari 8 karakter → 422', async () => {
    const res = await request(app).post('/api/customer/auth/register').send({
      name: 'Siti Rahma',
      email: 'siti@contoh.id',
      phone: '081234567890',
      password: '123',
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/customer/auth/login', () => {
  it('login berhasil → 200 + token + customer', async () => {
    const hash = await bcrypt.hash('password123', 10);
    pool.query.mockResolvedValueOnce([
      [{ id: 7, name: 'Budi', email: 'budi@contoh.id', phone: '081298765432', password_hash: hash }],
    ]);

    const res = await request(app).post('/api/customer/auth/login').send({
      email: 'budi@contoh.id',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.customer).toEqual({
      id: 7,
      name: 'Budi',
      email: 'budi@contoh.id',
      phone: '081298765432',
    });
  });

  it('password salah → 401 INVALID_CREDENTIALS', async () => {
    const hash = await bcrypt.hash('password123', 10);
    pool.query.mockResolvedValueOnce([
      [{ id: 7, name: 'Budi', email: 'budi@contoh.id', phone: '081298765432', password_hash: hash }],
    ]);

    const res = await request(app).post('/api/customer/auth/login').send({
      email: 'budi@contoh.id',
      password: 'salah',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('email tidak ditemukan → 401 INVALID_CREDENTIALS', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const res = await request(app).post('/api/customer/auth/login').send({
      email: 'tidakada@contoh.id',
      password: 'password123',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('Proteksi & Isolasi Role Token (Konsumen vs Pemilik)', () => {
  const customerToken = jwt.sign({ customerId: 10, role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });
  const ownerToken = jwt.sign({ businessId: 5 }, JWT_SECRET, { expiresIn: '1h' });

  it('GET /api/customer/me tanpa token → 401', async () => {
    const res = await request(app).get('/api/customer/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/customer/me dengan token pemilik UMKM → 401', async () => {
    const res = await request(app)
      .get('/api/customer/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(401);
  });

  it('GET /api/customer/me dengan token konsumen → 200', async () => {
    pool.query.mockResolvedValueOnce([
      [{ id: 10, name: 'Ani', email: 'ani@contoh.id', phone: '081234567890', createdAt: '2026-11-13 10:00:00' }],
    ]);

    const res = await request(app)
      .get('/api/customer/me')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Ani');
  });

  it('GET /api/customer/bookings dengan token konsumen → 200', async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          code: 'AB23CD45',
          businessName: 'Barber Jaya',
          businessSlug: 'barber-jaya',
          category: 'barbershop',
          serviceName: 'Potong Rambut',
          price: 35000,
          durationMin: 30,
          startAt: '2026-11-15 10:00:00',
          endAt: '2026-11-15 10:30:00',
          status: 'menunggu',
          customerName: 'Ani',
          customerPhone: '081234567890',
        },
      ],
    ]);

    const res = await request(app)
      .get('/api/customer/bookings')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.bookings).toHaveLength(1);
    expect(res.body.bookings[0].code).toBe('AB23CD45');
  });

  it('GET /api/me (endpoint pemilik) menolak token konsumen → 401', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(401);
  });

  it('POST /api/public/businesses/barber-jaya/bookings tanpa token → 401', async () => {
    const res = await request(app)
      .post('/api/public/businesses/barber-jaya/bookings')
      .send({
        serviceId: 1,
        date: '2026-11-20',
        time: '10:00',
        customerName: 'Tamu',
        customerPhone: '081234567890',
      });
    expect(res.status).toBe(401);
  });

  it('POST /api/public/businesses/barber-jaya/bookings dengan token pemilik → 401', async () => {
    const res = await request(app)
      .post('/api/public/businesses/barber-jaya/bookings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        serviceId: 1,
        date: '2026-11-20',
        time: '10:00',
        customerName: 'Pemilik',
        customerPhone: '081234567890',
      });
    expect(res.status).toBe(401);
  });
});

