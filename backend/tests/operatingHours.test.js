/**
 * Tes F-04: Jam operasional (operating-hours)
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

function makeValid7Days() {
  return [
    { weekday: 0, open_time: '09:00', close_time: '17:00', is_closed: true },
    { weekday: 1, open_time: '08:00', close_time: '20:00', is_closed: false },
    { weekday: 2, open_time: '08:00', close_time: '20:00', is_closed: false },
    { weekday: 3, open_time: '08:00', close_time: '20:00', is_closed: false },
    { weekday: 4, open_time: '08:00', close_time: '20:00', is_closed: false },
    { weekday: 5, open_time: '08:00', close_time: '21:00', is_closed: false },
    { weekday: 6, open_time: '09:00', close_time: '21:00', is_closed: false },
  ];
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/operating-hours', () => {
  it('tanpa token → 401', async () => {
    const res = await request(app).get('/api/operating-hours');
    expect(res.status).toBe(401);
  });

  it('belum pernah diatur → 7 hari dengan is_closed: true', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .get('/api/operating-hours')
      .set('Authorization', `Bearer ${makeToken(1)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);
    for (let i = 0; i < 7; i++) {
      expect(res.body[i].weekday).toBe(i);
      expect(res.body[i].is_closed).toBe(true);
    }
  });

  it('sebagian hari diatur → hari lain dianggap tutup (is_closed: true)', async () => {
    const existing = [
      { weekday: 1, open_time: '08:00:00', close_time: '17:00:00', is_closed: 0 },
      { weekday: 2, open_time: '08:00:00', close_time: '17:00:00', is_closed: 0 },
    ];
    pool.query.mockResolvedValueOnce([existing]);

    const res = await request(app)
      .get('/api/operating-hours')
      .set('Authorization', `Bearer ${makeToken(1)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);
    expect(res.body[0].weekday).toBe(0);
    expect(res.body[0].is_closed).toBe(true);
    expect(res.body[1].weekday).toBe(1);
    expect(res.body[1].is_closed).toBe(false);
    expect(res.body[1].open_time).toBe('08:00');
    expect(res.body[2].weekday).toBe(2);
    expect(res.body[2].is_closed).toBe(false);
    expect(res.body[3].weekday).toBe(3);
    expect(res.body[3].is_closed).toBe(true);
  });
});

describe('PUT /api/operating-hours', () => {
  it('tanpa token → 401', async () => {
    const res = await request(app).put('/api/operating-hours').send(makeValid7Days());
    expect(res.status).toBe(401);
  });

  it('validasi jam: open_time >= close_time → 422', async () => {
    const days = makeValid7Days();
    days[1] = { weekday: 1, open_time: '17:00', close_time: '08:00', is_closed: false };

    const res = await request(app)
      .put('/api/operating-hours')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send(days);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/jam buka harus lebih awal/i);
  });

  it('validasi jam: open_time == close_time → 422', async () => {
    const days = makeValid7Days();
    days[2] = { weekday: 2, open_time: '09:00', close_time: '09:00', is_closed: false };

    const res = await request(app)
      .put('/api/operating-hours')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send(days);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('validasi jam: format jam tidak valid → 422', async () => {
    const days = makeValid7Days();
    days[0] = { weekday: 0, open_time: '25:00', close_time: '17:00', is_closed: true };

    const res = await request(app)
      .put('/api/operating-hours')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send(days);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('jumlah hari kurang dari 7 → 422', async () => {
    const days = makeValid7Days().slice(0, 5);

    const res = await request(app)
      .put('/api/operating-hours')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send(days);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('weekday duplikat → 422', async () => {
    const days = makeValid7Days();
    days[6].weekday = 1;

    const res = await request(app)
      .put('/api/operating-hours')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send(days);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('simpan 7 hari valid dengan is_closed: true diperbolehkan → 200', async () => {
    pool.query.mockResolvedValueOnce([{}]);

    const days = makeValid7Days();
    const res = await request(app)
      .put('/api/operating-hours')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send(days);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);
    expect(res.body[0].weekday).toBe(0);
    expect(res.body[0].is_closed).toBe(true);
    expect(res.body[1].weekday).toBe(1);
    expect(res.body[1].is_closed).toBe(false);
  });

  it('set lalu baca ulang → data tersimpan dapat dibaca kembali', async () => {
    const days = makeValid7Days();

    // Mock query PUT
    pool.query.mockResolvedValueOnce([{}]);

    const putRes = await request(app)
      .put('/api/operating-hours')
      .set('Authorization', `Bearer ${makeToken(1)}`)
      .send(days);

    expect(putRes.status).toBe(200);

    // Mock query GET berikutnya
    const dbRows = days.map((d) => ({
      weekday: d.weekday,
      open_time: `${d.open_time}:00`,
      close_time: `${d.close_time}:00`,
      is_closed: d.is_closed ? 1 : 0,
    }));
    pool.query.mockResolvedValueOnce([dbRows]);

    const getRes = await request(app)
      .get('/api/operating-hours')
      .set('Authorization', `Bearer ${makeToken(1)}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toHaveLength(7);
    expect(getRes.body[0].open_time).toBe('09:00');
    expect(getRes.body[0].close_time).toBe('17:00');
    expect(getRes.body[0].is_closed).toBe(true);
    expect(getRes.body[1].open_time).toBe('08:00');
    expect(getRes.body[1].close_time).toBe('20:00');
    expect(getRes.body[1].is_closed).toBe(false);
  });
});
