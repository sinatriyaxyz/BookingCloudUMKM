/**
 * Tes F-02: profil UMKM + halaman publik
 * Pool DB di-mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../src/db/pool.js', () => {
  const mockQuery = vi.fn();
  return { default: { query: mockQuery } };
});

import pool from '../src/db/pool.js';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme_jwt_secret';

function makeToken(businessId = 1) {
  return jwt.sign({ businessId }, JWT_SECRET, { expiresIn: '8h' });
}

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// PUT /api/me/profile
// ---------------------------------------------------------------------------
describe('PUT /api/me/profile', () => {
  it('update profil berhasil → 200 + data baru', async () => {
    const updated = {
      id: 1,
      owner_email: 'owner@test.com',
      name: 'Barber Jaya Baru',
      slug: 'barber-jaya',
      category: 'barbershop',
      address: 'Jl. Merdeka 1',
      phone: '081234567890',
      created_at: '2026-01-01 08:00:00',
    };
    pool.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE
      .mockResolvedValueOnce([[updated]]);              // SELECT

    const res = await request(app)
      .put('/api/me/profile')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ name: 'Barber Jaya Baru', address: 'Jl. Merdeka 1' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Barber Jaya Baru');
    expect(res.body.slug).toBe('barber-jaya'); // slug tidak berubah
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('tanpa token → 401', async () => {
    const res = await request(app).put('/api/me/profile').send({ name: 'X' });
    expect(res.status).toBe(401);
  });

  it('kategori tidak valid → 422', async () => {
    const res = await request(app)
      .put('/api/me/profile')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ category: 'invalid_cat' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('body kosong → 422', async () => {
    const res = await request(app)
      .put('/api/me/profile')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({});
    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// GET /api/public/businesses
// ---------------------------------------------------------------------------
describe('GET /api/public/businesses', () => {
  it('tanpa filter → daftar semua UMKM', async () => {
    const rows = [
      { name: 'Barber A', slug: 'barber-a', category: 'barbershop', address: null },
      { name: 'Salon B', slug: 'salon-b', category: 'salon', address: 'Jl. Dua' },
    ];
    pool.query.mockResolvedValueOnce([rows]);

    const res = await request(app).get('/api/public/businesses');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).not.toHaveProperty('owner_email');
    expect(res.body[0]).not.toHaveProperty('password_hash');
  });

  it('filter ?category=barbershop → hanya barbershop', async () => {
    const rows = [{ name: 'Barber A', slug: 'barber-a', category: 'barbershop', address: null }];
    pool.query.mockResolvedValueOnce([rows]);

    const res = await request(app).get('/api/public/businesses?category=barbershop');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe('barbershop');
  });
});

// ---------------------------------------------------------------------------
// GET /api/public/businesses/:slug
// ---------------------------------------------------------------------------
describe('GET /api/public/businesses/:slug', () => {
  it('slug valid → 200 + profil + layanan aktif', async () => {
    const biz = { id: 5, name: 'Barber Jaya', slug: 'barber-jaya', category: 'barbershop', address: null, phone: null };
    const services = [
      { id: 1, name: 'Potong Rambut', price: 25000, duration_min: 30 },
    ];
    pool.query
      .mockResolvedValueOnce([[biz]])       // SELECT business
      .mockResolvedValueOnce([services]);    // SELECT services

    const res = await request(app).get('/api/public/businesses/barber-jaya');
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('barber-jaya');
    expect(res.body.services).toHaveLength(1);
    // Tidak ada data sensitif
    expect(res.body).not.toHaveProperty('owner_email');
    expect(res.body).not.toHaveProperty('password_hash');
    expect(res.body).not.toHaveProperty('id');
  });

  it('slug tidak ditemukan → 404', async () => {
    pool.query.mockResolvedValueOnce([[]]); // kosong

    const res = await request(app).get('/api/public/businesses/tidak-ada');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
