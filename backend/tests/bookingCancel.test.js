/**
 * Tes F-07 & F-10: Cek status + batal oleh pelanggan
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import pool from '../src/db/pool.js';
import app from '../src/app.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const BIZ_SLUG = 'f08-barbershop';
let businessId;
let serviceId;

beforeAll(async () => {
  // Bersihkan data lama jika ada
  await pool.query('DELETE FROM businesses WHERE slug = ?', [BIZ_SLUG]);

  // Siapkan UMKM uji coba
  const [bizRes] = await pool.query(
    `INSERT INTO businesses (owner_email, password_hash, name, slug, category, address, phone)
     VALUES ('f08-owner@test.com', 'dummyhash', 'Barber F08 Test', ?, 'barbershop', 'Jl. Test F08', '081234567890')`,
    [BIZ_SLUG]
  );
  businessId = bizRes.insertId;

  // Siapkan Layanan uji coba
  const [srvRes] = await pool.query(
    `INSERT INTO services (business_id, name, price, duration_min, is_active)
     VALUES (?, 'Potong Rambut F08', 40000, 30, 1)`,
    [businessId]
  );
  serviceId = srvRes.insertId;
});

afterAll(async () => {
  if (businessId) {
    await pool.query('DELETE FROM businesses WHERE id = ?', [businessId]);
  }
  await pool.end();
});

describe('F-07: Cek Status Reservasi (GET /api/public/bookings/:code)', () => {
  it('cek status: berhasil mengambil detail reservasi dengan format yang tepat', async () => {
    const startAt = dayjs().tz('Asia/Jakarta').add(3, 'day').format('YYYY-MM-DD 10:00:00');
    const endAt = dayjs().tz('Asia/Jakarta').add(3, 'day').format('YYYY-MM-DD 10:30:00');
    const code = 'F08CHK01';

    await pool.query(
      `INSERT INTO bookings (code, business_id, service_id, customer_name, customer_phone, start_at, end_at, status)
       VALUES (?, ?, ?, 'Budi Pelanggan', '081234567890', ?, ?, 'menunggu')`,
      [code, businessId, serviceId, startAt, endAt]
    );

    const res = await request(app).get(`/api/public/bookings/${code}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 'F08CHK01',
      businessName: 'Barber F08 Test',
      serviceName: 'Potong Rambut F08',
      startAt,
      endAt,
      status: 'menunggu',
      customerName: 'Budi Pelanggan',
    });
    // Info lokasi UMKM untuk peta di halaman sukses/cek status
    expect(res.body).toHaveProperty('businessSlug');
    expect(res.body).toHaveProperty('businessLatitude');
    expect(res.body).toHaveProperty('businessLongitude');
  });

  it('kode huruf kecil diterima dan otomatis dinormalisasi ke huruf besar', async () => {
    const startAt = dayjs().tz('Asia/Jakarta').add(4, 'day').format('YYYY-MM-DD 11:00:00');
    const endAt = dayjs().tz('Asia/Jakarta').add(4, 'day').format('YYYY-MM-DD 11:30:00');
    const code = 'F08LOW01';

    await pool.query(
      `INSERT INTO bookings (code, business_id, service_id, customer_name, customer_phone, start_at, end_at, status)
       VALUES (?, ?, ?, 'Siti Lower', '081234567891', ?, ?, 'dikonfirmasi')`,
      [code, businessId, serviceId, startAt, endAt]
    );

    const res = await request(app).get(`/api/public/bookings/${code.toLowerCase()}`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(code);
    expect(res.body.status).toBe('dikonfirmasi');
    expect(res.body.customerName).toBe('Siti Lower');
  });

  it('kode salah / tidak ada → 404 NOT_FOUND', async () => {
    const res = await request(app).get('/api/public/bookings/TIDAKADA');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('F-10: Batal oleh Pelanggan (POST /api/public/bookings/:code/cancel)', () => {
  it('kode salah → 404 NOT_FOUND', async () => {
    const res = await request(app).post('/api/public/bookings/TIDAKADA/cancel');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('batal sukses: reservasi menunggu dan sisa waktu >= 2 jam berhasil dibatalkan', async () => {
    const startAt = dayjs().tz('Asia/Jakarta').add(5, 'day').format('YYYY-MM-DD 14:00:00');
    const endAt = dayjs().tz('Asia/Jakarta').add(5, 'day').format('YYYY-MM-DD 14:30:00');
    const code = 'F08CAN01';

    await pool.query(
      `INSERT INTO bookings (code, business_id, service_id, customer_name, customer_phone, start_at, end_at, status)
       VALUES (?, ?, ?, 'Joko Sukses', '081234567892', ?, ?, 'menunggu')`,
      [code, businessId, serviceId, startAt, endAt]
    );

    const res = await request(app).post(`/api/public/bookings/${code}/cancel`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(code);
    expect(res.body.status).toBe('dibatalkan');

    // Verifikasi di DB
    const [rows] = await pool.query('SELECT status FROM bookings WHERE code = ?', [code]);
    expect(rows[0].status).toBe('dibatalkan');

    // Verifikasi via GET endpoint
    const getRes = await request(app).get(`/api/public/bookings/${code}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.status).toBe('dibatalkan');
  });

  it('batal sukses: reservasi dikonfirmasi dengan kode huruf kecil berhasil dibatalkan', async () => {
    const startAt = dayjs().tz('Asia/Jakarta').add(6, 'day').format('YYYY-MM-DD 15:00:00');
    const endAt = dayjs().tz('Asia/Jakarta').add(6, 'day').format('YYYY-MM-DD 15:30:00');
    const code = 'F08CONF1';

    await pool.query(
      `INSERT INTO bookings (code, business_id, service_id, customer_name, customer_phone, start_at, end_at, status)
       VALUES (?, ?, ?, 'Rina Konfirm', '081234567893', ?, ?, 'dikonfirmasi')`,
      [code, businessId, serviceId, startAt, endAt]
    );

    const res = await request(app).post(`/api/public/bookings/${code.toLowerCase()}/cancel`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(code);
    expect(res.body.status).toBe('dibatalkan');

    const [rows] = await pool.query('SELECT status FROM bookings WHERE code = ?', [code]);
    expect(rows[0].status).toBe('dibatalkan');
  });

  it('batal terlalu mepet ditolak: sisa waktu < 2 jam → 422', async () => {
    // 1 jam dari sekarang (< CANCEL_MIN_HOURS = 2 jam)
    const startAt = dayjs().tz('Asia/Jakarta').add(1, 'hour').format('YYYY-MM-DD HH:mm:ss');
    const endAt = dayjs().tz('Asia/Jakarta').add(90, 'minute').format('YYYY-MM-DD HH:mm:ss');
    const code = 'F08MEPET';

    await pool.query(
      `INSERT INTO bookings (code, business_id, service_id, customer_name, customer_phone, start_at, end_at, status)
       VALUES (?, ?, ?, 'Andi Mepet', '081234567894', ?, ?, 'menunggu')`,
      [code, businessId, serviceId, startAt, endAt]
    );

    const res = await request(app).post(`/api/public/bookings/${code}/cancel`);

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('CANCEL_TOO_LATE');

    // Pastikan status di DB tidak berubah
    const [rows] = await pool.query('SELECT status FROM bookings WHERE code = ?', [code]);
    expect(rows[0].status).toBe('menunggu');
  });

  it('batal pada waktu lampau ditolak → 422', async () => {
    // Reservasi di masa lampau (kemarin)
    const startAt = dayjs().tz('Asia/Jakarta').subtract(1, 'day').format('YYYY-MM-DD 10:00:00');
    const endAt = dayjs().tz('Asia/Jakarta').subtract(1, 'day').format('YYYY-MM-DD 10:30:00');
    const code = 'F08PAS01';

    await pool.query(
      `INSERT INTO bookings (code, business_id, service_id, customer_name, customer_phone, start_at, end_at, status)
       VALUES (?, ?, ?, 'Doni Lampau', '081234567895', ?, ?, 'menunggu')`,
      [code, businessId, serviceId, startAt, endAt]
    );

    const res = await request(app).post(`/api/public/bookings/${code}/cancel`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CANCEL_TOO_LATE');
  });

  it('batal pada status selesai ditolak → 422', async () => {
    const startAt = dayjs().tz('Asia/Jakarta').add(7, 'day').format('YYYY-MM-DD 16:00:00');
    const endAt = dayjs().tz('Asia/Jakarta').add(7, 'day').format('YYYY-MM-DD 16:30:00');
    const code = 'F08SELES';

    await pool.query(
      `INSERT INTO bookings (code, business_id, service_id, customer_name, customer_phone, start_at, end_at, status)
       VALUES (?, ?, ?, 'Dewi Selesai', '081234567896', ?, ?, 'selesai')`,
      [code, businessId, serviceId, startAt, endAt]
    );

    const res = await request(app).post(`/api/public/bookings/${code}/cancel`);

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('CANNOT_CANCEL');

    // Status di DB tetap 'selesai'
    const [rows] = await pool.query('SELECT status FROM bookings WHERE code = ?', [code]);
    expect(rows[0].status).toBe('selesai');
  });

  it('batal pada status dibatalkan ditolak → 422', async () => {
    const startAt = dayjs().tz('Asia/Jakarta').add(8, 'day').format('YYYY-MM-DD 17:00:00');
    const endAt = dayjs().tz('Asia/Jakarta').add(8, 'day').format('YYYY-MM-DD 17:30:00');
    const code = 'F08BATAL';

    await pool.query(
      `INSERT INTO bookings (code, business_id, service_id, customer_name, customer_phone, start_at, end_at, status)
       VALUES (?, ?, ?, 'Eko Batal', '081234567897', ?, ?, 'dibatalkan')`,
      [code, businessId, serviceId, startAt, endAt]
    );

    const res = await request(app).post(`/api/public/bookings/${code}/cancel`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CANNOT_CANCEL');
  });
});
