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

  it('update kategori baru (klinik_kecantikan) berhasil → 200', async () => {
    const updated = {
      id: 1,
      owner_email: 'owner@test.com',
      name: 'Glow Clinic',
      slug: 'glow-clinic',
      category: 'klinik_kecantikan',
      address: 'Jl. Melati 5',
      phone: '081234567890',
      created_at: '2026-01-01 08:00:00',
    };
    pool.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updated]]);

    const res = await request(app)
      .put('/api/me/profile')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ category: 'klinik_kecantikan' });

    expect(res.status).toBe(200);
    expect(res.body.category).toBe('klinik_kecantikan');
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

  it('simpan koordinat lokasi → 200, UPDATE latitude & longitude dengan business_id dari token', async () => {
    const updated = { id: 1, name: 'Barber', slug: 'barber', category: 'barbershop', latitude: '-6.917464', longitude: '107.619123' };
    pool.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updated]]);

    const res = await request(app)
      .put('/api/me/profile')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ latitude: -6.917464, longitude: 107.619123 });

    expect(res.status).toBe(200);
    expect(res.body.latitude).toBe('-6.917464');
    const [sql, values] = pool.query.mock.calls[0];
    expect(sql).toContain('latitude = ?');
    expect(sql).toContain('longitude = ?');
    expect(values).toEqual([-6.917464, 107.619123, 1]);
  });

  it('hapus koordinat (null, null) → 200', async () => {
    pool.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 1, latitude: null, longitude: null }]]);

    const res = await request(app)
      .put('/api/me/profile')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ latitude: null, longitude: null });
    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[0][1]).toEqual([null, null, 1]);
  });

  it('latitude di luar rentang → 422', async () => {
    const res = await request(app)
      .put('/api/me/profile')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ latitude: 95, longitude: 107 });
    expect(res.status).toBe(422);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('hanya latitude tanpa longitude → 422', async () => {
    const res = await request(app)
      .put('/api/me/profile')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ latitude: -6.9 });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('Latitude dan longitude harus diisi bersamaan.');
  });

  it('latitude berupa teks → 422', async () => {
    const res = await request(app)
      .put('/api/me/profile')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ latitude: 'abc', longitude: 107 });
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

  it('?lat=&lng= → query memakai Haversine & urut jarak terdekat', async () => {
    const rows = [
      { name: 'Dekat', slug: 'dekat', category: 'barbershop', address: null, latitude: '-6.900000', longitude: '107.600000', distance_km: 1.2 },
      { name: 'Tanpa Lokasi', slug: 'tanpa', category: 'salon', address: null, latitude: null, longitude: null, distance_km: null },
    ];
    pool.query.mockResolvedValueOnce([rows]);

    const res = await request(app).get('/api/public/businesses?lat=-6.91&lng=107.61');
    expect(res.status).toBe(200);
    expect(res.body[0].distance_km).toBe(1.2);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('distance_km');
    expect(sql).toContain('ORDER BY distance_km IS NULL');
    expect(params).toEqual([-6.91, -6.91, 107.61]);
  });

  it('koordinat tidak valid → 422', async () => {
    const res = await request(app).get('/api/public/businesses?lat=abc&lng=107');
    expect(res.status).toBe(422);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('hanya lat tanpa lng → 422', async () => {
    const res = await request(app).get('/api/public/businesses?lat=-6.9');
    expect(res.status).toBe(422);
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

