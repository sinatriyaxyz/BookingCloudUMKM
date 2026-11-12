/**
 * Tes F-04: Hari libur (holidays)
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

describe('GET /api/holidays', () => {
  it('tanpa token → 401', async () => {
    const res = await request(app).get('/api/holidays');
    expect(res.status).toBe(401);
  });

  it('dengan token → return daftar libur milik UMKM sendiri', async () => {
    const rows = [
      { id: 1, date: '2026-12-25', note: 'Hari Raya Natal' },
      { id: 2, date: '2027-01-01', note: 'Tahun Baru' },
    ];
    pool.query.mockResolvedValueOnce([rows]);

    const res = await request(app)
      .get('/api/holidays')
      .set('Authorization', `Bearer ${makeToken(1)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].date).toBe('2026-12-25');
    expect(res.body[0].note).toBe('Hari Raya Natal');
  });
});

describe('POST /api/holidays', () => {
  it('tanpa token → 401', async () => {
    const res = await request(app).post('/api/holidays').send({ date: '2026-12-25', note: 'Natal' });
    expect(res.status).toBe(401);
  });

  it('tambah libur valid → 201', async () => {
    pool.query
      .mockResolvedValueOnce([[]]) // cek duplikat: tidak ada
      .mockResolvedValueOnce([{ insertId: 5 }]); // INSERT

    const res = await request(app)
      .post('/api/holidays')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ date: '2026-12-25', note: 'Hari Raya Natal' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(5);
    expect(res.body.date).toBe('2026-12-25');
    expect(res.body.note).toBe('Hari Raya Natal');
  });

  it('libur duplikat ditolak → 409 DUPLICATE_HOLIDAY', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // cek duplikat: sudah ada

    const res = await request(app)
      .post('/api/holidays')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ date: '2026-12-25', note: 'Natal Lagi' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_HOLIDAY');
  });

  it('format tanggal tidak valid → 422', async () => {
    const res = await request(app)
      .post('/api/holidays')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send({ date: '25-12-2026', note: 'Salah format' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/holidays/:id', () => {
  it('tanpa token → 401', async () => {
    const res = await request(app).delete('/api/holidays/1');
    expect(res.status).toBe(401);
  });

  it('hapus libur milik sendiri → 204', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]]) // SELECT kepemilikan
      .mockResolvedValueOnce([{}]); // DELETE

    const res = await request(app)
      .delete('/api/holidays/1')
      .set('Authorization', `Bearer ${makeToken(1)}`);

    expect(res.status).toBe(204);
  });

  it('hapus libur milik UMKM lain → 404 (isolasi data)', async () => {
    pool.query.mockResolvedValueOnce([[]]); // tidak ditemukan untuk businessId=2

    const res = await request(app)
      .delete('/api/holidays/1')
      .set('Authorization', `Bearer ${makeToken(2)}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
