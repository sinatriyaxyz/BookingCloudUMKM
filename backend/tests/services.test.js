/**
 * Tes F-03: Kelola layanan (services)
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
// GET /api/services
// ---------------------------------------------------------------------------
describe('GET /api/services', () => {
  it('tanpa token → 401', async () => {
    const res = await request(app).get('/api/services');
    expect(res.status).toBe(401);
  });

  it('dengan token → daftar layanan aktif UMKM sendiri', async () => {
    const rows = [
      { id: 1, name: 'Potong Rambut', price: 25000, duration_min: 30 },
      { id: 2, name: 'Cuci Rambut', price: 15000, duration_min: 15 },
    ];
    pool.query.mockResolvedValueOnce([rows]);

    const res = await request(app)
      .get('/api/services')
      .set('Authorization', `Bearer ${makeToken(1)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe('Potong Rambut');
    // pastikan business_id tidak bocor
    expect(res.body[0]).not.toHaveProperty('business_id');
  });
});

// ---------------------------------------------------------------------------
// POST /api/services
// ---------------------------------------------------------------------------
describe('POST /api/services', () => {
  it('tambah layanan valid → 201', async () => {
    pool.query.mockResolvedValueOnce([{ insertId: 10 }]);

    const res = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${makeToken(1)}`
      )
      .send({ name: 'Potong Rambut', price: 25000, duration_min: 30 });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(10);
    expect(res.body.name).toBe('Potong Rambut');
  });

  it('nama kosong → 422', async () => {
    const res = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${makeToken(1)}`
      )
      .send({ name: '', price: 25000, duration_min: 30 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('harga negatif → 422', async () => {
    const res = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${makeToken(1)}`
      )
      .send({ name: 'X', price: -1, duration_min: 30 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('harga bukan angka → 422 dengan pesan Bahasa Indonesia', async () => {
    const res = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ name: 'X', price: 'abc', duration_min: 30 });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('Harga harus berupa angka.');
  });

  it('harga desimal / nama hanya spasi → 422', async () => {
    const r1 = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ name: 'X', price: 1500.5, duration_min: 30 });
    expect(r1.status).toBe(422);

    const r2 = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ name: '   ', price: 1000, duration_min: 30 });
    expect(r2.status).toBe(422);
  });

  it('ID bukan angka pada PUT/DELETE → 422', async () => {
    const r1 = await request(app)
      .put('/api/services/abc')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ name: 'Y' });
    expect(r1.status).toBe(422);

    const r2 = await request(app)
      .delete('/api/services/abc')
      .set('Authorization', `Bearer ${makeToken(1)}`);
    expect(r2.status).toBe(422);
  });

  it('durasi 10 menit (< 15) → 422', async () => {
    const res = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${makeToken(1)}`
      )
      .send({ name: 'X', price: 0, duration_min: 10 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('durasi 500 menit (> 480) → 422', async () => {
    const res = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${makeToken(1)}`
      )
      .send({ name: 'X', price: 0, duration_min: 500 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('durasi 25 menit (bukan kelipatan 15) → 422', async () => {
    const res = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${makeToken(1)}`
      )
      .send({ name: 'X', price: 0, duration_min: 25 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('tanpa token → 401', async () => {
    const res = await request(app)
      .post('/api/services')
      .send({ name: 'X', price: 0, duration_min: 30 });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/services/:id
// ---------------------------------------------------------------------------
describe('PUT /api/services/:id', () => {
  it('update layanan milik sendiri → 200', async () => {
    const existing = [{ id: 3 }];
    const updated = { id: 3, name: 'Potong Rambut VIP', price: 50000, duration_min: 60 };

    pool.query
      .mockResolvedValueOnce([existing])   // SELECT cek kepemilikan
      .mockResolvedValueOnce([{}])          // UPDATE
      .mockResolvedValueOnce([[updated]]); // SELECT after update

    const res = await request(app)
      .put('/api/services/3')
      .set('Authorization', `Bearer ${makeToken(1)}`
      )
      .send({ name: 'Potong Rambut VIP', price: 50000, duration_min: 60 });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Potong Rambut VIP');
  });

  it('layanan milik UMKM lain → 404', async () => {
    // businessId=2 mencoba edit layanan milik businessId=1
    pool.query.mockResolvedValueOnce([[]]); // SELECT kosong → not found

    const res = await request(app)
      .put('/api/services/3')
      .set('Authorization', `Bearer ${makeToken(2)}`
      )
      .send({ name: 'Hacked', price: 0, duration_min: 15 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('durasi bukan kelipatan 15 → 422', async () => {
    const res = await request(app)
      .put('/api/services/3')
      .set('Authorization', `Bearer ${makeToken(1)}`
      )
      .send({ duration_min: 20 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('body kosong → 422', async () => {
    const res = await request(app)
      .put('/api/services/3')
      .set('Authorization', `Bearer ${makeToken(1)}`
      )
      .send({});

    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/services/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/services/:id', () => {
  it('hapus layanan milik sendiri → 204', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 5 }]]) // SELECT kepemilikan
      .mockResolvedValueOnce([{}]);           // UPDATE is_active=0

    const res = await request(app)
      .delete('/api/services/5')
      .set('Authorization', `Bearer ${makeToken(1)}`);

    expect(res.status).toBe(204);
  });

  it('layanan milik UMKM lain → 404', async () => {
    pool.query.mockResolvedValueOnce([[]]); // kosong → not found

    const res = await request(app)
      .delete('/api/services/5')
      .set('Authorization', `Bearer ${makeToken(2)}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('tanpa token → 401', async () => {
    const res = await request(app).delete('/api/services/5');
    expect(res.status).toBe(401);
  });
});

