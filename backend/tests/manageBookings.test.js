/**
 * Tes Sesi 9: Kelola Reservasi + Dashboard (F-08, F-09)
 * Menguji integrasi endpoint auth, multi-tenant, transisi status, dan dashboard.
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

const SLUG_A = 'biz-f09-a';
const SLUG_B = 'biz-f09-b';

let bizIdA, bizIdB;
let tokenA, tokenB;
let serviceIdA, serviceIdB;

beforeAll(async () => {
  // Bersihkan data lama jika ada
  await pool.query('DELETE FROM businesses WHERE slug IN (?, ?)', [SLUG_A, SLUG_B]);

  // Siapkan UMKM A
  const [resA] = await pool.query(
    `INSERT INTO businesses (owner_email, password_hash, name, slug, category, address, phone)
     VALUES ('owner-f09-a@test.com', 'dummyhash', 'Salon Cantik F09', ?, 'salon', 'Jl. Melati A', '08111111111')`,
    [SLUG_A]
  );
  bizIdA = resA.insertId;
  tokenA = makeToken(bizIdA);

  const [srvA] = await pool.query(
    `INSERT INTO services (business_id, name, price, duration_min, is_active)
     VALUES (?, 'Creambath A', 50000, 60, 1)`,
    [bizIdA]
  );
  serviceIdA = srvA.insertId;

  // Siapkan UMKM B
  const [resB] = await pool.query(
    `INSERT INTO businesses (owner_email, password_hash, name, slug, category, address, phone)
     VALUES ('owner-f09-b@test.com', 'dummyhash', 'Bengkel Mantap F09', ?, 'bengkel', 'Jl. Mawar B', '08222222222')`,
    [SLUG_B]
  );
  bizIdB = resB.insertId;
  tokenB = makeToken(bizIdB);

  const [srvB] = await pool.query(
    `INSERT INTO services (business_id, name, price, duration_min, is_active)
     VALUES (?, 'Ganti Oli B', 75000, 30, 1)`,
    [bizIdB]
  );
  serviceIdB = srvB.insertId;
});

afterAll(async () => {
  if (bizIdA || bizIdB) {
    await pool.query('DELETE FROM businesses WHERE id IN (?, ?)', [bizIdA, bizIdB]);
  }
  await pool.end();
});

// Helper membuat booking langsung ke DB
async function insertBooking({
  bizId = bizIdA,
  srvId = serviceIdA,
  code,
  customerName = 'Budi Santoso',
  customerPhone = '081234567890',
  startAt,
  endAt,
  status = 'menunggu',
}) {
  const [res] = await pool.query(
    `INSERT INTO bookings (code, business_id, service_id, customer_name, customer_phone, start_at, end_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, bizId, srvId, customerName, customerPhone, startAt, endAt, status]
  );
  return res.insertId;
}

describe('Sesi 9 — Auth & Proteksi Endpoint (F-08, F-09)', () => {
  it('GET /api/bookings tanpa token -> 401', async () => {
    const res = await request(app).get('/api/bookings');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/dashboard tanpa token -> 401', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/bookings/:id/confirm tanpa token -> 401', async () => {
    const res = await request(app).post('/api/bookings/1/confirm');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/bookings/:id/complete tanpa token -> 401', async () => {
    const res = await request(app).post('/api/bookings/1/complete');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/bookings/:id/cancel tanpa token -> 401', async () => {
    const res = await request(app).post('/api/bookings/1/cancel');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('Sesi 9 — F-08: Transisi Status Reservasi', () => {
  it('alur menunggu -> dikonfirmasi -> selesai berhasil', async () => {
    const startAt = dayjs().tz('Asia/Jakarta').add(1, 'day').format('YYYY-MM-DD 09:00:00');
    const endAt = dayjs().tz('Asia/Jakarta').add(1, 'day').format('YYYY-MM-DD 10:00:00');
    const bookingId = await insertBooking({
      code: 'F9FLOW01',
      startAt,
      endAt,
      status: 'menunggu',
    });

    // 1. Konfirmasi (menunggu -> dikonfirmasi)
    const resConfirm = await request(app)
      .post(`/api/bookings/${bookingId}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(resConfirm.status).toBe(200);
    expect(resConfirm.body.status).toBe('dikonfirmasi');

    // Cek di DB
    const [rowsAfterConfirm] = await pool.query('SELECT status FROM bookings WHERE id = ?', [bookingId]);
    expect(rowsAfterConfirm[0].status).toBe('dikonfirmasi');

    // 2. Selesaikan (dikonfirmasi -> selesai)
    const resComplete = await request(app)
      .post(`/api/bookings/${bookingId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(resComplete.status).toBe(200);
    expect(resComplete.body.status).toBe('selesai');

    // Cek di DB
    const [rowsAfterComplete] = await pool.query('SELECT status FROM bookings WHERE id = ?', [bookingId]);
    expect(rowsAfterComplete[0].status).toBe('selesai');

    // 3. Status selesai tidak boleh diubah lagi
    const resAfter1 = await request(app)
      .post(`/api/bookings/${bookingId}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(resAfter1.status).toBe(422);
    expect(resAfter1.body.error.code).toBe('INVALID_STATUS_TRANSITION');

    const resAfter2 = await request(app)
      .post(`/api/bookings/${bookingId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(resAfter2.status).toBe(422);
    expect(resAfter2.body.error.code).toBe('INVALID_STATUS_TRANSITION');

    const resAfter3 = await request(app)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(resAfter3.status).toBe(422);
    expect(resAfter3.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('complete langsung dari menunggu harus ditolak (422) - complete hanya boleh jika sudah dikonfirmasi', async () => {
    const startAt = dayjs().tz('Asia/Jakarta').add(1, 'day').format('YYYY-MM-DD 11:00:00');
    const endAt = dayjs().tz('Asia/Jakarta').add(1, 'day').format('YYYY-MM-DD 12:00:00');
    const bookingId = await insertBooking({
      code: 'F9FLOW02',
      startAt,
      endAt,
      status: 'menunggu',
    });

    const res = await request(app)
      .post(`/api/bookings/${bookingId}/complete`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');

    // Pastikan data tidak berubah di DB
    const [rows] = await pool.query('SELECT status FROM bookings WHERE id = ?', [bookingId]);
    expect(rows[0].status).toBe('menunggu');
  });

  it('pembatalan oleh pemilik dari status menunggu berhasil', async () => {
    const startAt = dayjs().tz('Asia/Jakarta').add(2, 'day').format('YYYY-MM-DD 13:00:00');
    const endAt = dayjs().tz('Asia/Jakarta').add(2, 'day').format('YYYY-MM-DD 14:00:00');
    const bookingId = await insertBooking({
      code: 'F9FLOW03',
      startAt,
      endAt,
      status: 'menunggu',
    });

    const res = await request(app)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('dibatalkan');

    // Tidak boleh diubah lagi setelah dibatalkan
    const resReconfirm = await request(app)
      .post(`/api/bookings/${bookingId}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(resReconfirm.status).toBe(422);
    expect(resReconfirm.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('pembatalan oleh pemilik dari status dikonfirmasi berhasil', async () => {
    const startAt = dayjs().tz('Asia/Jakarta').add(2, 'day').format('YYYY-MM-DD 15:00:00');
    const endAt = dayjs().tz('Asia/Jakarta').add(2, 'day').format('YYYY-MM-DD 16:00:00');
    const bookingId = await insertBooking({
      code: 'F9FLOW04',
      startAt,
      endAt,
      status: 'dikonfirmasi',
    });

    const res = await request(app)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('dibatalkan');

    // Pastikan di DB statusnya dibatalkan
    const [rows] = await pool.query('SELECT status FROM bookings WHERE id = ?', [bookingId]);
    expect(rows[0].status).toBe('dibatalkan');
  });

  it('reservasi tidak ditemukan -> 404', async () => {
    const res = await request(app)
      .post('/api/bookings/99999999/confirm')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('ID tidak valid -> 422', async () => {
    const res = await request(app)
      .post('/api/bookings/not-a-number/confirm')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Sesi 9 — F-11: Isolasi Multi-Tenant pada Pemilik Reservasi', () => {
  it('pemilik B tidak dapat mengonfirmasi, menyelesaikan, atau membatalkan reservasi UMKM A (harus 404)', async () => {
    const startAt = dayjs().tz('Asia/Jakarta').add(3, 'day').format('YYYY-MM-DD 10:00:00');
    const endAt = dayjs().tz('Asia/Jakarta').add(3, 'day').format('YYYY-MM-DD 11:00:00');
    const bookingIdA = await insertBooking({
      bizId: bizIdA,
      srvId: serviceIdA,
      code: 'F9ISOL01',
      startAt,
      endAt,
      status: 'menunggu',
    });

    // Pemilik B mencoba confirm booking A
    const resConfirm = await request(app)
      .post(`/api/bookings/${bookingIdA}/confirm`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resConfirm.status).toBe(404);
    expect(resConfirm.body.error.code).toBe('NOT_FOUND');

    // Pemilik B mencoba complete booking A
    const resComplete = await request(app)
      .post(`/api/bookings/${bookingIdA}/complete`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resComplete.status).toBe(404);
    expect(resComplete.body.error.code).toBe('NOT_FOUND');

    // Pemilik B mencoba cancel booking A
    const resCancel = await request(app)
      .post(`/api/bookings/${bookingIdA}/cancel`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resCancel.status).toBe(404);
    expect(resCancel.body.error.code).toBe('NOT_FOUND');

    // Data UMKM A tidak boleh berubah
    const [rows] = await pool.query('SELECT status FROM bookings WHERE id = ?', [bookingIdA]);
    expect(rows[0].status).toBe('menunggu');
  });
});

describe('Sesi 9 — GET /api/bookings (Filter & Paginasi)', () => {
  const targetDate = dayjs().tz('Asia/Jakarta').add(5, 'day').format('YYYY-MM-DD');

  beforeAll(async () => {
    // Buat data beberapa booking untuk UMKM A
    await insertBooking({
      bizId: bizIdA,
      srvId: serviceIdA,
      code: 'F9LIST01',
      startAt: `${targetDate} 08:00:00`,
      endAt: `${targetDate} 09:00:00`,
      status: 'menunggu',
    });

    await insertBooking({
      bizId: bizIdA,
      srvId: serviceIdA,
      code: 'F9LIST02',
      startAt: `${targetDate} 10:00:00`,
      endAt: `${targetDate} 11:00:00`,
      status: 'dikonfirmasi',
    });

    await insertBooking({
      bizId: bizIdA,
      srvId: serviceIdA,
      code: 'F9LIST03',
      startAt: `${targetDate} 13:00:00`,
      endAt: `${targetDate} 14:00:00`,
      status: 'selesai',
    });

    // Booking milik UMKM B pada tanggal yang sama
    await insertBooking({
      bizId: bizIdB,
      srvId: serviceIdB,
      code: 'F9LIST99',
      startAt: `${targetDate} 09:00:00`,
      endAt: `${targetDate} 09:30:00`,
      status: 'menunggu',
    });
  });

  it('mengambil daftar reservasi hanya milik UMKM sendiri', async () => {
    const res = await request(app)
      .get('/api/bookings')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.bookings).toBeDefined();
    // Pastikan tidak ada kode milik UMKM B
    const codes = res.body.bookings.map((b) => b.code);
    expect(codes).not.toContain('F9LIST99');
  });

  it('mendukung query parameter kosong ?date=&status=&page= tanpa error', async () => {
    const res = await request(app)
      .get('/api/bookings?date=&status=&page=')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.bookings).toBeDefined();
    expect(res.body.page).toBe(1);
  });

  it('filter berdasarkan date', async () => {
    const res = await request(app)
      .get(`/api/bookings?date=${targetDate}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const codes = res.body.bookings.map((b) => b.code);
    expect(codes).toContain('F9LIST01');
    expect(codes).toContain('F9LIST02');
    expect(codes).toContain('F9LIST03');
  });

  it('filter berdasarkan status', async () => {
    const res = await request(app)
      .get(`/api/bookings?date=${targetDate}&status=dikonfirmasi`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.bookings.length).toBe(1);
    expect(res.body.bookings[0].code).toBe('F9LIST02');
    expect(res.body.bookings[0].status).toBe('dikonfirmasi');
  });

  it('paginasi limit dan page', async () => {
    const res = await request(app)
      .get(`/api/bookings?date=${targetDate}&limit=1&page=2`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(1);
    expect(res.body.bookings.length).toBe(1);
    expect(res.body.totalPages).toBeGreaterThanOrEqual(2);
  });

  it('validasi query: format tanggal tidak valid -> 422', async () => {
    const res = await request(app)
      .get('/api/bookings?date=12-11-2026')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('validasi query: status tidak valid -> 422', async () => {
    const res = await request(app)
      .get('/api/bookings?status=pending')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('validasi query: page bukan angka -> 422 dengan pesan Bahasa Indonesia', async () => {
    const res = await request(app)
      .get('/api/bookings?page=abc')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('Page harus berupa angka.');
  });
});

describe('Sesi 9 — F-09: GET /api/dashboard', () => {
  const todayWib = dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD');

  beforeAll(async () => {
    // Siapkan data hari ini untuk UMKM A
    await insertBooking({
      bizId: bizIdA,
      srvId: serviceIdA,
      code: 'F9DASH01',
      startAt: `${todayWib} 08:30:00`,
      endAt: `${todayWib} 09:30:00`,
      status: 'menunggu',
    });

    await insertBooking({
      bizId: bizIdA,
      srvId: serviceIdA,
      code: 'F9DASH02',
      startAt: `${todayWib} 10:00:00`,
      endAt: `${todayWib} 11:00:00`,
      status: 'dikonfirmasi',
    });

    await insertBooking({
      bizId: bizIdA,
      srvId: serviceIdA,
      code: 'F9DASH03',
      startAt: `${todayWib} 14:00:00`,
      endAt: `${todayWib} 15:00:00`,
      status: 'selesai',
    });

    await insertBooking({
      bizId: bizIdA,
      srvId: serviceIdA,
      code: 'F9DASH04',
      startAt: `${todayWib} 16:00:00`,
      endAt: `${todayWib} 17:00:00`,
      status: 'dibatalkan',
    });

    // Data UMKM B hari ini (tidak boleh masuk ke dashboard A)
    await insertBooking({
      bizId: bizIdB,
      srvId: serviceIdB,
      code: 'F9DASH99',
      startAt: `${todayWib} 08:30:00`,
      endAt: `${todayWib} 09:00:00`,
      status: 'menunggu',
    });
  });

  it('mengembalikan format dashboard lengkap: { today, counts, history }', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('today');
    expect(res.body).toHaveProperty('counts');
    expect(res.body).toHaveProperty('history');

    // Cek counts
    expect(typeof res.body.counts.menunggu).toBe('number');
    expect(typeof res.body.counts.dikonfirmasi).toBe('number');
    expect(typeof res.body.counts.hari_ini).toBe('number');
    expect(res.body.counts.menunggu).toBeGreaterThanOrEqual(1);
    expect(res.body.counts.dikonfirmasi).toBeGreaterThanOrEqual(1);
    expect(res.body.counts.hari_ini).toBeGreaterThanOrEqual(4);

    // Cek today: semua reservasi hari ini WIB UMKM A
    const todayCodes = res.body.today.map((b) => b.code);
    expect(todayCodes).toContain('F9DASH01');
    expect(todayCodes).toContain('F9DASH02');
    expect(todayCodes).toContain('F9DASH03');
    expect(todayCodes).toContain('F9DASH04');
    // Tidak boleh mengandung booking UMKM B
    expect(todayCodes).not.toContain('F9DASH99');

    // Cek history: harus hanya berisi status selesai atau dibatalkan, maksimal 20
    expect(res.body.history.length).toBeLessThanOrEqual(20);
    for (const item of res.body.history) {
      expect(['selesai', 'dibatalkan']).toContain(item.status);
    }
    const historyCodes = res.body.history.map((b) => b.code);
    expect(historyCodes).toContain('F9DASH03');
    expect(historyCodes).toContain('F9DASH04');
  });
});
