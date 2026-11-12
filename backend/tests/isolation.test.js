/**
 * Tes Sesi 10 — Isolasi Antar-UMKM (F-11)
 * Menguji lintas-tenant: token A tidak bisa mengakses atau mengubah data milik UMKM B (404),
 * data B di database tetap utuh, dan endpoint GET list milik A tidak membocorkan data B.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import pool from '../src/db/pool.js';
import app from '../src/app.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const JWT_SECRET = process.env.JWT_SECRET || 'changeme_jwt_secret';

function makeToken(businessId) {
  return jwt.sign({ businessId }, JWT_SECRET, { expiresIn: '8h' });
}

const SLUG_A = 'umkm-iso-a';
const SLUG_B = 'umkm-iso-b';

let bizIdA, bizIdB;
let tokenA, tokenB;
let serviceIdA, serviceIdB;
let holidayIdA, holidayIdB;
let bookingA_menunggu, bookingA_dikonfirmasi;
let bookingB_menunggu, bookingB_dikonfirmasi;

const todayDate = dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD');
const futureDateA = dayjs().tz('Asia/Jakarta').add(5, 'day').format('YYYY-MM-DD');
const futureDateB = dayjs().tz('Asia/Jakarta').add(6, 'day').format('YYYY-MM-DD');

beforeAll(async () => {
  // Bersihkan data uji sebelumnya jika ada
  await pool.query('DELETE FROM businesses WHERE slug IN (?, ?)', [SLUG_A, SLUG_B]);

  // 1. Siapkan UMKM A beserta datanya
  const [resBizA] = await pool.query(
    `INSERT INTO businesses (owner_email, password_hash, name, slug, category, address, phone)
     VALUES ('iso-owner-a@test.com', 'hash_a', 'Barbershop Isolasi A', ?, 'barbershop', 'Jl. Isolasi A No. 1', '08110000001')`,
    [SLUG_A]
  );
  bizIdA = resBizA.insertId;
  tokenA = makeToken(bizIdA);

  const [resSrvA] = await pool.query(
    `INSERT INTO services (business_id, name, price, duration_min, is_active)
     VALUES (?, 'Layanan Potong A', 35000, 30, 1)`,
    [bizIdA]
  );
  serviceIdA = resSrvA.insertId;

  await pool.query(
    `INSERT INTO operating_hours (business_id, weekday, open_time, close_time, is_closed)
     VALUES (?, 1, '08:00:00', '16:00:00', 0)`,
    [bizIdA]
  );

  const [resHolA] = await pool.query(
    `INSERT INTO holidays (business_id, date, note)
     VALUES (?, ?, 'Libur Khusus A')`,
    [bizIdA, futureDateA]
  );
  holidayIdA = resHolA.insertId;

  const [resBookA1] = await pool.query(
    `INSERT INTO bookings (code, business_id, service_id, customer_name, customer_phone, start_at, end_at, status)
     VALUES ('ISOA0002', ?, ?, 'Pelanggan A1', '08111111111', ?, ?, 'menunggu')`,
    [bizIdA, serviceIdA, `${todayDate} 10:00:00`, `${todayDate} 10:30:00`]
  );
  bookingA_menunggu = resBookA1.insertId;

  const [resBookA2] = await pool.query(
    `INSERT INTO bookings (code, business_id, service_id, customer_name, customer_phone, start_at, end_at, status)
     VALUES ('ISOA0003', ?, ?, 'Pelanggan A2', '08111111112', ?, ?, 'dikonfirmasi')`,
    [bizIdA, serviceIdA, `${todayDate} 11:00:00`, `${todayDate} 11:30:00`]
  );
  bookingA_dikonfirmasi = resBookA2.insertId;

  // 2. Siapkan UMKM B beserta datanya
  const [resBizB] = await pool.query(
    `INSERT INTO businesses (owner_email, password_hash, name, slug, category, address, phone)
     VALUES ('iso-owner-b@test.com', 'hash_b', 'Salon Isolasi B', ?, 'salon', 'Jl. Isolasi B No. 2', '08220000002')`,
    [SLUG_B]
  );
  bizIdB = resBizB.insertId;
  tokenB = makeToken(bizIdB);

  const [resSrvB] = await pool.query(
    `INSERT INTO services (business_id, name, price, duration_min, is_active)
     VALUES (?, 'Layanan Creambath B', 80000, 60, 1)`,
    [bizIdB]
  );
  serviceIdB = resSrvB.insertId;

  await pool.query(
    `INSERT INTO operating_hours (business_id, weekday, open_time, close_time, is_closed)
     VALUES (?, 1, '10:00:00', '20:00:00', 0)`,
    [bizIdB]
  );

  const [resHolB] = await pool.query(
    `INSERT INTO holidays (business_id, date, note)
     VALUES (?, ?, 'Libur Khusus B')`,
    [bizIdB, futureDateB]
  );
  holidayIdB = resHolB.insertId;

  const [resBookB1] = await pool.query(
    `INSERT INTO bookings (code, business_id, service_id, customer_name, customer_phone, start_at, end_at, status)
     VALUES ('ISOB0002', ?, ?, 'Pelanggan B1', '08222222221', ?, ?, 'menunggu')`,
    [bizIdB, serviceIdB, `${todayDate} 13:00:00`, `${todayDate} 14:00:00`]
  );
  bookingB_menunggu = resBookB1.insertId;

  const [resBookB2] = await pool.query(
    `INSERT INTO bookings (code, business_id, service_id, customer_name, customer_phone, start_at, end_at, status)
     VALUES ('ISOB0003', ?, ?, 'Pelanggan B2', '08222222222', ?, ?, 'dikonfirmasi')`,
    [bizIdB, serviceIdB, `${todayDate} 15:00:00`, `${todayDate} 16:00:00`]
  );
  bookingB_dikonfirmasi = resBookB2.insertId;
});

afterAll(async () => {
  if (bizIdA || bizIdB) {
    await pool.query('DELETE FROM businesses WHERE id IN (?, ?)', [bizIdA, bizIdB]);
  }
  await pool.end();
});

describe('F-11: Isolasi Endpoint Berparameter ID (Token A terhadap Data B)', () => {
  it('PUT /api/services/:id milik B dengan token A -> 404 & data B tidak berubah', async () => {
    const res = await request(app)
      .put(`/api/services/${serviceIdB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Bajak Layanan B', price: 1000, duration_min: 15 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    const [rows] = await pool.query(
      'SELECT name, price, duration_min, is_active FROM services WHERE id = ?',
      [serviceIdB]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Layanan Creambath B');
    expect(Number(rows[0].price)).toBe(80000);
    expect(rows[0].duration_min).toBe(60);
    expect(rows[0].is_active).toBe(1);
  });

  it('DELETE /api/services/:id milik B dengan token A -> 404 & layanan B tetap aktif', async () => {
    const res = await request(app)
      .delete(`/api/services/${serviceIdB}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    const [rows] = await pool.query(
      'SELECT is_active FROM services WHERE id = ?',
      [serviceIdB]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].is_active).toBe(1);
  });

  it('DELETE /api/holidays/:id milik B dengan token A -> 404 & libur B tetap ada', async () => {
    const res = await request(app)
      .delete(`/api/holidays/${holidayIdB}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    const [rows] = await pool.query(
      'SELECT id, note FROM holidays WHERE id = ?',
      [holidayIdB]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe('Libur Khusus B');
  });

  it('POST /api/bookings/:id/confirm milik B dengan token A -> 404 & status B tetap menunggu', async () => {
    const res = await request(app)
      .post(`/api/bookings/${bookingB_menunggu}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    const [rows] = await pool.query(
      'SELECT status FROM bookings WHERE id = ?',
      [bookingB_menunggu]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('menunggu');
  });

  it('POST /api/bookings/:id/complete milik B dengan token A -> 404 & status B tetap dikonfirmasi', async () => {
    const res = await request(app)
      .post(`/api/bookings/${bookingB_dikonfirmasi}/complete`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    const [rows] = await pool.query(
      'SELECT status FROM bookings WHERE id = ?',
      [bookingB_dikonfirmasi]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('dikonfirmasi');
  });

  it('POST /api/bookings/:id/cancel milik B (menunggu & dikonfirmasi) dengan token A -> 404 & status B tidak berubah', async () => {
    const res1 = await request(app)
      .post(`/api/bookings/${bookingB_menunggu}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res1.status).toBe(404);
    expect(res1.body.error.code).toBe('NOT_FOUND');

    const res2 = await request(app)
      .post(`/api/bookings/${bookingB_dikonfirmasi}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res2.status).toBe(404);
    expect(res2.body.error.code).toBe('NOT_FOUND');

    const [rows] = await pool.query(
      'SELECT id, status FROM bookings WHERE id IN (?, ?) ORDER BY id ASC',
      [bookingB_menunggu, bookingB_dikonfirmasi]
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe('menunggu');
    expect(rows[1].status).toBe('dikonfirmasi');
  });
});

describe('F-11: Isolasi Endpoint GET List & Dashboard (Token A tidak memuat data B)', () => {
  it('GET /api/services dengan token A hanya mengembalikan layanan A, tanpa layanan B', async () => {
    const res = await request(app)
      .get('/api/services')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((s) => s.id);
    expect(ids).toContain(serviceIdA);
    expect(ids).not.toContain(serviceIdB);
    expect(res.body.every((s) => s.name !== 'Layanan Creambath B')).toBe(true);
  });

  it('GET /api/holidays dengan token A hanya mengembalikan hari libur A, tanpa hari libur B', async () => {
    const res = await request(app)
      .get('/api/holidays')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((h) => h.id);
    expect(ids).toContain(holidayIdA);
    expect(ids).not.toContain(holidayIdB);
    expect(res.body.every((h) => h.note !== 'Libur Khusus B')).toBe(true);
  });

  it('GET /api/bookings dengan token A hanya mengembalikan reservasi A, tanpa reservasi B', async () => {
    const res = await request(app)
      .get('/api/bookings')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const list = res.body.bookings || res.body.data;
    expect(Array.isArray(list)).toBe(true);

    const ids = list.map((b) => b.id);
    expect(ids).toContain(bookingA_menunggu);
    expect(ids).toContain(bookingA_dikonfirmasi);
    expect(ids).not.toContain(bookingB_menunggu);
    expect(ids).not.toContain(bookingB_dikonfirmasi);

    const codes = list.map((b) => b.code);
    expect(codes).not.toContain('ISOB0002');
    expect(codes).not.toContain('ISOB0003');
  });

  it('GET /api/dashboard dengan token A hanya memuat reservasi & statistik A, tanpa data B', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const todayIds = res.body.today.map((b) => b.id);
    const historyIds = res.body.history.map((b) => b.id);

    expect(todayIds).toContain(bookingA_menunggu);
    expect(todayIds).toContain(bookingA_dikonfirmasi);
    expect(todayIds).not.toContain(bookingB_menunggu);
    expect(todayIds).not.toContain(bookingB_dikonfirmasi);

    expect(historyIds).not.toContain(bookingB_menunggu);
    expect(historyIds).not.toContain(bookingB_dikonfirmasi);
    expect(res.body.counts.hari_ini).toBe(2);
  });

  it('GET /api/operating-hours & GET /api/me dengan token A hanya memuat data A, bukan B', async () => {
    const resHours = await request(app)
      .get('/api/operating-hours')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(resHours.status).toBe(200);
    const monday = resHours.body.find((d) => d.weekday === 1);
    expect(monday.open_time).toBe('08:00');
    expect(monday.close_time).toBe('16:00');

    const resMe = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(resMe.status).toBe(200);
    expect(resMe.body.slug).toBe(SLUG_A);
    expect(resMe.body.name).toBe('Barbershop Isolasi A');
  });
});

