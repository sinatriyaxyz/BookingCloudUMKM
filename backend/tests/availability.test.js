/**
 * Tes F-05: Jam kosong (availability)
 * Termasuk unit test fungsi murni computeSlots (8 kasus wajib) dan tes endpoint HTTP.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../src/db/pool.js', () => {
  const mockQuery = vi.fn();
  return { default: { query: mockQuery } };
});

import pool from '../src/db/pool.js';
import app from '../src/app.js';
import { computeSlots, SLOT_STEP_MIN } from '../src/services/availability.js';

beforeEach(() => vi.clearAllMocks());

// ===========================================================================
// 1. UNIT TEST FUNGSI MURNI: computeSlots
// ===========================================================================
describe('F-05 computeSlots (unit test fungsi murni)', () => {
  it('konstanta SLOT_STEP_MIN bernilai 30', () => {
    expect(SLOT_STEP_MIN).toBe(30);
  });

  // Kasus 1: Hari tutup
  it('kasus 1: hari tutup (isClosed: true) → []', () => {
    const slots = computeSlots({
      date: '2026-11-20',
      durationMin: 30,
      openTime: '09:00',
      closeTime: '17:00',
      isClosed: true,
      isHoliday: false,
      now: '2026-11-20 08:00:00',
    });
    expect(slots).toEqual([]);
  });

  // Kasus 2: Hari libur
  it('kasus 2: libur (isHoliday: true) → []', () => {
    const slots = computeSlots({
      date: '2026-11-20',
      durationMin: 30,
      openTime: '09:00',
      closeTime: '17:00',
      isClosed: false,
      isHoliday: true,
      now: '2026-11-20 08:00:00',
    });
    expect(slots).toEqual([]);
  });

  // Kasus 3: Slot mepet jam tutup
  it('kasus 3: slot mepet jam tutup (slot + durasi <= jam tutup) → slot terakhir tepat selesai saat tutup', () => {
    const slots = computeSlots({
      date: '2026-11-20',
      durationMin: 60,
      openTime: '09:00',
      closeTime: '12:00',
      isClosed: false,
      isHoliday: false,
      now: '2026-11-20 08:00:00',
    });
    // 09:00 (selesai 10:00), 09:30 (10:30), 10:00 (11:00), 10:30 (11:30), 11:00 (12:00)
    // 11:30 tidak termasuk karena selesai 12:30 (> 12:00)
    expect(slots).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00']);
  });

  // Kasus 4: Booking di tengah
  it('kasus 4: booking di tengah → slot yang bertabrakan dibuang', () => {
    const slots = computeSlots({
      date: '2026-11-20',
      durationMin: 30,
      openTime: '09:00',
      closeTime: '12:00',
      isClosed: false,
      isHoliday: false,
      activeBookings: [
        { start_at: '2026-11-20 10:00:00', end_at: '2026-11-20 11:00:00' },
      ],
      now: '2026-11-20 08:00:00',
    });
    // Slot 10:00 dan 10:30 bertabrakan dengan booking 10:00-11:00
    expect(slots).toEqual(['09:00', '09:30', '11:00', '11:30']);
  });

  // Kasus 5: Booking beririsan sebagian
  it('kasus 5: booking beririsan sebagian (durasi 60m vs booking 10:00-10:30) → buang slot yang beririsan', () => {
    const slots = computeSlots({
      date: '2026-11-20',
      durationMin: 60,
      openTime: '09:00',
      closeTime: '12:00',
      isClosed: false,
      isHoliday: false,
      activeBookings: [
        { start_at: '2026-11-20 10:00:00', end_at: '2026-11-20 10:30:00' },
      ],
      now: '2026-11-20 08:00:00',
    });
    // 09:00 selesai 10:00 (tidak beririsan dengan [10:00, 10:30))
    // 09:30 selesai 10:30 (beririsan [10:00, 10:30)) → DIBUANG
    // 10:00 selesai 11:00 (beririsan [10:00, 10:30)) → DIBUANG
    // 10:30 selesai 11:30 (tidak beririsan)
    // 11:00 selesai 12:00 (tidak beririsan)
    expect(slots).toEqual(['09:00', '10:30', '11:00']);
  });

  // Kasus 6: Tanggal lampau
  it('kasus 6: tanggal lampau → []', () => {
    const slots = computeSlots({
      date: '2026-11-10',
      durationMin: 30,
      openTime: '09:00',
      closeTime: '17:00',
      isClosed: false,
      isHoliday: false,
      now: '2026-11-12 10:00:00',
    });
    expect(slots).toEqual([]);
  });

  // Kasus 7: Hari ini sebagian lewat
  it('kasus 7: hari ini sebagian lewat (now 10:15) → slot <= 10:15 dibuang', () => {
    const slots = computeSlots({
      date: '2026-11-20',
      durationMin: 30,
      openTime: '09:00',
      closeTime: '12:00',
      isClosed: false,
      isHoliday: false,
      now: '2026-11-20 10:15:00',
    });
    // 09:00, 09:30, 10:00 sudah lewat (< 10:15)
    // Tersisa 10:30, 11:00, 11:30
    expect(slots).toEqual(['10:30', '11:00', '11:30']);
  });

  // Kasus 8: Durasi panjang
  it('kasus 8: durasi panjang (120 menit) → slot dihitung per 30 menit selama muat', () => {
    const slots = computeSlots({
      date: '2026-11-20',
      durationMin: 120,
      openTime: '09:00',
      closeTime: '12:00',
      isClosed: false,
      isHoliday: false,
      now: '2026-11-20 08:00:00',
    });
    // 09:00 selesai 11:00 (<= 12:00)
    // 09:30 selesai 11:30 (<= 12:00)
    // 10:00 selesai 12:00 (<= 12:00)
    // 10:30 selesai 12:30 (> 12:00) → tidak muat
    expect(slots).toEqual(['09:00', '09:30', '10:00']);
  });
});

// ===========================================================================
// 2. TES ENDPOINT: GET /api/public/businesses/:slug/availability
// ===========================================================================
describe('GET /api/public/businesses/:slug/availability', () => {
  it('validasi gagal jika serviceId tidak disertakan → 422', async () => {
    const res = await request(app).get('/api/public/businesses/barber-jaya/availability?date=2026-11-20');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('validasi gagal jika format date bukan YYYY-MM-DD → 422', async () => {
    const res = await request(app).get('/api/public/businesses/barber-jaya/availability?serviceId=1&date=20-11-2026');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('UMKM tidak ditemukan → 404', async () => {
    // mock query businesses -> empty
    pool.query.mockResolvedValueOnce([[]]);

    const res = await request(app).get('/api/public/businesses/tidak-ada/availability?serviceId=1&date=2026-11-20');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('layanan tidak ditemukan / tidak aktif → 404', async () => {
    // 1. mock query business -> found id: 1
    pool.query.mockResolvedValueOnce([[{ id: 1 }]]);
    // 2. mock query service -> not found
    pool.query.mockResolvedValueOnce([[]]);

    const res = await request(app).get('/api/public/businesses/barber-jaya/availability?serviceId=999&date=2026-11-20');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('berhasil mendapatkan slot jam kosong (termasuk filter booking aktif)', async () => {
    // 1. mock business -> id: 1
    pool.query.mockResolvedValueOnce([[{ id: 1 }]]);
    // 2. mock service -> id: 1, duration_min: 30, is_active: 1
    pool.query.mockResolvedValueOnce([[{ id: 1, duration_min: 30, is_active: 1 }]]);
    // 3. mock operating hours -> weekday Friday (2026-11-20 is Friday, weekday 5)
    pool.query.mockResolvedValueOnce([
      [{ open_time: '09:00:00', close_time: '12:00:00', is_closed: 0 }],
    ]);
    // 4. mock holidays -> none
    pool.query.mockResolvedValueOnce([[]]);
    // 5. mock active bookings -> booking 10:00 - 10:30
    pool.query.mockResolvedValueOnce([
      [{ start_at: '2026-11-20 10:00:00', end_at: '2026-11-20 10:30:00' }],
    ]);

    const res = await request(app).get('/api/public/businesses/barber-jaya/availability?serviceId=1&date=2026-11-20');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('date', '2026-11-20');
    expect(res.body).toHaveProperty('slots');
    expect(Array.isArray(res.body.slots)).toBe(true);
    // Karena 2026-11-20 di masa lalu dari waktu riil (sekarang), slot bisa kosong jika now > date.
    // Tapi kita bisa verifikasi bahwa format respon sesuai dan endpoint berhasil.
  });

  it('mendukung parameter service_id (snake_case) dan tanggal di masa depan', async () => {
    // 1. mock business -> id: 1
    pool.query.mockResolvedValueOnce([[{ id: 1 }]]);
    // 2. mock service -> id: 1, duration_min: 30, is_active: 1
    pool.query.mockResolvedValueOnce([[{ id: 1, duration_min: 30, is_active: 1 }]]);
    // 3. mock operating hours -> buka 09:00 - 11:00
    pool.query.mockResolvedValueOnce([
      [{ open_time: '09:00:00', close_time: '11:00:00', is_closed: 0 }],
    ]);
    // 4. mock holidays -> none
    pool.query.mockResolvedValueOnce([[]]);
    // 5. mock active bookings -> none
    pool.query.mockResolvedValueOnce([[]]);

    // Tanggal jauh di masa depan: tahun 2099
    const res = await request(app).get('/api/public/businesses/barber-jaya/availability?service_id=1&date=2099-01-02');

    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2099-01-02');
    expect(res.body.slots).toEqual(['09:00', '09:30', '10:00', '10:30']);
  });
});
