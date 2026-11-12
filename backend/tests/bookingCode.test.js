import { describe, it, expect, vi } from 'vitest';
import {
  BOOKING_CODE_CHARS,
  generateBookingCode,
  isValidBookingCode,
  insertBookingWithRetry,
} from '../src/services/bookingCode.js';

describe('bookingCode service', () => {
  it('panjang kode harus tepat 8 karakter', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateBookingCode();
      expect(code).toHaveLength(8);
    }
  });

  it('hanya menggunakan karakter yang diizinkan (tanpa I, O, 0, 1)', () => {
    // Karakter I, O, 0, 1 tidak boleh ada
    expect(BOOKING_CODE_CHARS).not.toContain('I');
    expect(BOOKING_CODE_CHARS).not.toContain('O');
    expect(BOOKING_CODE_CHARS).not.toContain('0');
    expect(BOOKING_CODE_CHARS).not.toContain('1');

    for (let i = 0; i < 50; i++) {
      const code = generateBookingCode();
      expect(isValidBookingCode(code)).toBe(true);
      expect(code).not.toMatch(/[IO01]/);
    }
  });

  it('isValidBookingCode menolak format tidak valid', () => {
    expect(isValidBookingCode('ABC1234')).toBe(false); // 7 karakter
    expect(isValidBookingCode('ABC123456')).toBe(false); // 9 karakter
    expect(isValidBookingCode('ABCDI234')).toBe(false); // mengandung 'I'
    expect(isValidBookingCode('ABCDO234')).toBe(false); // mengandung 'O'
    expect(isValidBookingCode('ABCD0234')).toBe(false); // mengandung '0'
    expect(isValidBookingCode('ABCD1234')).toBe(false); // mengandung '1'
    expect(isValidBookingCode('abcd2345')).toBe(false); // huruf kecil
    expect(isValidBookingCode(null)).toBe(false);
  });

  it('insertBookingWithRetry retry jika terjadi ER_DUP_ENTRY dan sukses berikutnya', async () => {
    const mockConn = {
      query: vi
        .fn()
        // Panggilan SAVEPOINT
        .mockResolvedValueOnce([{}])
        // Panggilan INSERT pertama: gagal ER_DUP_ENTRY
        .mockRejectedValueOnce(Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' }))
        // Panggilan ROLLBACK TO SAVEPOINT
        .mockResolvedValueOnce([{}])
        // Panggilan SAVEPOINT kedua
        .mockResolvedValueOnce([{}])
        // Panggilan INSERT kedua: sukses
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        // Panggilan RELEASE SAVEPOINT
        .mockResolvedValueOnce([{}]),
    };

    const code = await insertBookingWithRetry(
      mockConn,
      {
        businessId: 1,
        serviceId: 2,
        customerName: 'Budi',
        customerPhone: '08123456789',
        startAt: '2026-11-20 10:00:00',
        endAt: '2026-11-20 10:30:00',
      },
      3
    );

    expect(code).toHaveLength(8);
    expect(isValidBookingCode(code)).toBe(true);
    expect(mockConn.query).toHaveBeenCalledTimes(6);
  });

  it('insertBookingWithRetry melempar error jika melebihi batas retry', async () => {
    const mockConn = {
      query: vi
        .fn()
        .mockImplementation((sql) => {
          if (sql.startsWith('INSERT')) {
            const err = new Error('Duplicate');
            err.code = 'ER_DUP_ENTRY';
            return Promise.reject(err);
          }
          return Promise.resolve([{}]);
        }),
    };

    await expect(
      insertBookingWithRetry(
        mockConn,
        {
          businessId: 1,
          serviceId: 2,
          customerName: 'Budi',
          customerPhone: '08123456789',
          startAt: '2026-11-20 10:00:00',
          endAt: '2026-11-20 10:30:00',
        },
        3
      )
    ).rejects.toThrow();
  });
});
