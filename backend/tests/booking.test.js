/**
 * Tes F-06: Booking + anti-bentrok
 * Menjalankan pengujian terhadap MariaDB dengan transaksi dan SELECT ... FOR UPDATE nyata.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import pool from '../src/db/pool.js';
import app from '../src/app.js';
import { isValidBookingCode } from '../src/services/bookingCode.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const JWT_SECRET = process.env.JWT_SECRET || 'changeme_jwt_secret';
const BIZ_SLUG = 'f06-barbershop';
const CUSTOMER_EMAIL = 'f06-customer@test.com';
let businessId;
let serviceId;
let customerId;
let customerToken;

const targetDate = dayjs().tz('Asia/Jakarta').add(10, 'day').format('YYYY-MM-DD');
const holidayDate = dayjs().tz('Asia/Jakarta').add(25, 'day').format('YYYY-MM-DD');

beforeAll(async () => {
  // Bersihkan data lama jika ada
  await pool.query('DELETE FROM businesses WHERE slug = ?', [BIZ_SLUG]);
  await pool.query('DELETE FROM customers WHERE email = ?', [CUSTOMER_EMAIL]);

  // Siapkan akun konsumen uji coba
  const [custRes] = await pool.query(
    `INSERT INTO customers (name, email, phone, password_hash)
     VALUES ('Pelanggan F06', ?, '081234567890', 'dummyhash')`,
    [CUSTOMER_EMAIL]
  );
  customerId = custRes.insertId;
  customerToken = jwt.sign({ customerId, role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });

  // Siapkan UMKM uji coba
  const [bizRes] = await pool.query(
    `INSERT INTO businesses (owner_email, password_hash, name, slug, category, address, phone)
     VALUES ('f06-owner@test.com', 'dummyhash', 'Barber F06 Test', ?, 'barbershop', 'Jl. Test F06', '081234567890')`,
    [BIZ_SLUG]
  );
  businessId = bizRes.insertId;

  // Siapkan Layanan uji coba (durasi 30 menit)
  const [srvRes] = await pool.query(
    `INSERT INTO services (business_id, name, price, duration_min, is_active)
     VALUES (?, 'Cukur Rambut F06', 35000, 30, 1)`,
    [businessId]
  );
  serviceId = srvRes.insertId;

  // Siapkan jam operasional 7 hari: 09:00 - 18:00
  for (let weekday = 0; weekday < 7; weekday++) {
    await pool.query(
      `INSERT INTO operating_hours (business_id, weekday, open_time, close_time, is_closed)
       VALUES (?, ?, '09:00:00', '18:00:00', 0)`,
      [businessId, weekday]
    );
  }

  // Siapkan 1 tanggal libur
  await pool.query(
    `INSERT INTO holidays (business_id, date, note)
     VALUES (?, ?, 'Libur Uji Coba F06')`,
    [businessId, holidayDate]
  );
});

afterAll(async () => {
  if (businessId) {
    await pool.query('DELETE FROM businesses WHERE id = ?', [businessId]);
  }
  if (customerId) {
    await pool.query('DELETE FROM customers WHERE id = ?', [customerId]);
  }
  await pool.end();
});

describe('F-06: Booking dan Anti-Bentrok', () => {
  it('tanpa login konsumen → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .post(`/api/public/businesses/${BIZ_SLUG}/bookings`)
      .send({
        serviceId,
        date: targetDate,
        time: '10:00',
        customerName: 'Tamu Tanpa Akun',
        customerPhone: '081234567890',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // =========================================================================
  // a) Booking sukses → mendapat kode 8 karakter
  // =========================================================================
  it('a) booking sukses → mendapat kode 8 karakter dan data reservasi lengkap', async () => {
    const res = await request(app)
      .post(`/api/public/businesses/${BIZ_SLUG}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        serviceId,
        date: targetDate,
        time: '10:00',
        customerName: 'Ahmad Pelanggan',
        customerPhone: '081234567890',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('code');
    expect(res.body.code).toHaveLength(8);
    expect(isValidBookingCode(res.body.code)).toBe(true);
    expect(res.body.status).toBe('menunggu');
    expect(res.body.startAt).toBe(`${targetDate} 10:00:00`);
    expect(res.body.endAt).toBe(`${targetDate} 10:30:00`);

    // Pastikan tersimpan di DB
    const [rows] = await pool.query('SELECT * FROM bookings WHERE code = ?', [res.body.code]);
    expect(rows).toHaveLength(1);
    expect(rows[0].customer_name).toBe('Ahmad Pelanggan');
    expect(rows[0].status).toBe('menunggu');
  });

  // =========================================================================
  // b) di luar jam buka → 422; tanggal lampau → 422; hari libur → 422
  // =========================================================================
  describe('b) validasi jam operasional, tanggal lampau, dan hari libur', () => {
    it('di luar jam buka (sebelum buka 08:00) → 422', async () => {
      const res = await request(app)
        .post(`/api/public/businesses/${BIZ_SLUG}/bookings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId,
          date: targetDate,
          time: '08:00',
          customerName: 'Budi Test',
          customerPhone: '081234567890',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('OUTSIDE_OPERATING_HOURS');
    });

    it('di luar jam buka (melewati tutup: jam 18:00 untuk layanan 30m) → 422', async () => {
      const res = await request(app)
        .post(`/api/public/businesses/${BIZ_SLUG}/bookings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId,
          date: targetDate,
          time: '18:00',
          customerName: 'Budi Test',
          customerPhone: '081234567890',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('OUTSIDE_OPERATING_HOURS');
    });

    it('tanggal lampau → 422', async () => {
      const res = await request(app)
        .post(`/api/public/businesses/${BIZ_SLUG}/bookings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId,
          date: '2020-01-01',
          time: '10:00',
          customerName: 'Budi Test',
          customerPhone: '081234567890',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('hari libur → 422', async () => {
      const res = await request(app)
        .post(`/api/public/businesses/${BIZ_SLUG}/bookings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId,
          date: holidayDate,
          time: '10:00',
          customerName: 'Budi Test',
          customerPhone: '081234567890',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('BUSINESS_CLOSED');
    });

    it('nama kosong → 422', async () => {
      const res = await request(app)
        .post(`/api/public/businesses/${BIZ_SLUG}/bookings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId,
          date: targetDate,
          time: '10:00',
          customerName: '   ',
          customerPhone: '081234567890',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('telepon tidak valid (< 9 digit atau bukan awalan 0/+62) → 422', async () => {
      const res = await request(app)
        .post(`/api/public/businesses/${BIZ_SLUG}/bookings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId,
          date: targetDate,
          time: '10:00',
          customerName: 'Budi',
          customerPhone: '12345',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // c) booking beririsan → 409
  // =========================================================================
  it('c) booking beririsan → 409 { code: "SLOT_TAKEN" }', async () => {
    // 1. Buat booking awal pada 11:00 (11:00 - 11:30)
    const firstRes = await request(app)
      .post(`/api/public/businesses/${BIZ_SLUG}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        serviceId,
        date: targetDate,
        time: '11:00',
        customerName: 'Pelanggan Pertama',
        customerPhone: '081234567890',
      });
    expect(firstRes.status).toBe(201);

    // 2. Coba booking di jam yang persis sama (11:00)
    const sameRes = await request(app)
      .post(`/api/public/businesses/${BIZ_SLUG}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        serviceId,
        date: targetDate,
        time: '11:00',
        customerName: 'Pelanggan Kedua',
        customerPhone: '+6281234567891',
      });
    expect(sameRes.status).toBe(409);
    expect(sameRes.body.error.code).toBe('SLOT_TAKEN');
    expect(sameRes.body.error.message).toBe('Jam sudah terisi, pilih jam lain.');

    // 3. Coba booking beririsan sebagian (11:15 - 11:45)
    const overlapRes = await request(app)
      .post(`/api/public/businesses/${BIZ_SLUG}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        serviceId,
        date: targetDate,
        time: '11:15',
        customerName: 'Pelanggan Ketiga',
        customerPhone: '081234567892',
      });
    expect(overlapRes.status).toBe(409);
    expect(overlapRes.body.error.code).toBe('SLOT_TAKEN');

    // 4. Booking tepat setelahnya (11:30 - 12:00) harus BERHASIL (tidak beririsan)
    const nextRes = await request(app)
      .post(`/api/public/businesses/${BIZ_SLUG}/bookings`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        serviceId,
        date: targetDate,
        time: '11:30',
        customerName: 'Pelanggan Keempat',
        customerPhone: '081234567893',
      });
    expect(nextRes.status).toBe(201);
  });

  // =========================================================================
  // d) KONKURENSI: 20 request serentak ke jam sama → tepat 1 status 201, 19 status 409
  // =========================================================================
  it('d) KONKURENSI: kirim 20 request booking serentak ke jam yang sama → tepat 1 status 201, 19 status 409', async () => {
    const concurrentTime = '14:00';

    const requests = Array.from({ length: 20 }, (_, idx) =>
      request(app)
        .post(`/api/public/businesses/${BIZ_SLUG}/bookings`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId,
          date: targetDate,
          time: concurrentTime,
          customerName: `Pelanggan Konkuren ${idx + 1}`,
          customerPhone: `0812345000${String(idx).padStart(2, '0')}`,
        })
    );

    const responses = await Promise.all(requests);

    const status201 = responses.filter((r) => r.status === 201);
    const status409 = responses.filter((r) => r.status === 409);

    expect(status201).toHaveLength(1);
    expect(status409).toHaveLength(19);

    for (const res of status409) {
      expect(res.body.error.code).toBe('SLOT_TAKEN');
    }

    // Pastikan di database hanya ada 1 baris di jam tersebut
    const [dbRows] = await pool.query(
      'SELECT id, code, status FROM bookings WHERE business_id = ? AND start_at = ?',
      [businessId, `${targetDate} ${concurrentTime}:00`]
    );
    expect(dbRows).toHaveLength(1);
    expect(dbRows[0].status).toBe('menunggu');
  });
});
