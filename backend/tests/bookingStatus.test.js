import { describe, it, expect } from 'vitest';
import { canTransition, BOOKING_STATUS } from '../src/services/bookingStatus.js';

describe('F-08: Unit Test canTransition(from, to) - Semua Kombinasi', () => {
  const statuses = [
    BOOKING_STATUS.MENUNGGU,
    BOOKING_STATUS.DIKONFIRMASI,
    BOOKING_STATUS.SELESAI,
    BOOKING_STATUS.DIBATALKAN,
  ];

  // Matriks kebenaran yang valid sesuai aturan AGENTS.md:
  // - menunggu -> dikonfirmasi, dibatalkan
  // - dikonfirmasi -> selesai, dibatalkan
  // - selesai -> tidak ada
  // - dibatalkan -> tidak ada
  const validTransitions = {
    'menunggu -> dikonfirmasi': true,
    'menunggu -> dibatalkan': true,
    'dikonfirmasi -> selesai': true,
    'dikonfirmasi -> dibatalkan': true,
  };

  describe('Semua 16 kombinasi 4 status resmi', () => {
    for (const from of statuses) {
      for (const to of statuses) {
        const pair = `${from} -> ${to}`;
        const expected = Boolean(validTransitions[pair]);

        it(`transisi ${pair} harus mengembalikan ${expected}`, () => {
          expect(canTransition(from, to)).toBe(expected);
        });
      }
    }
  });

  describe('Toleransi huruf besar/kecil dan spasi', () => {
    it('menerima status huruf besar (case-insensitive)', () => {
      expect(canTransition('MENUNGGU', 'DIKONFIRMASI')).toBe(true);
      expect(canTransition('Dikonfirmasi', 'SELESAI')).toBe(true);
      expect(canTransition('Menunggu', 'DIBATALKAN')).toBe(true);
      expect(canTransition('DIKONFIRMASI', 'DIBATALKAN')).toBe(true);
    });

    it('mentoleransi spasi di awal/akhir string', () => {
      expect(canTransition('  menunggu  ', '  dikonfirmasi  ')).toBe(true);
      expect(canTransition(' dikonfirmasi ', ' selesai ')).toBe(true);
    });
  });

  describe('Input tidak valid, kosong, atau di luar status resmi', () => {
    it('mengembalikan false jika from atau to null/undefined/bukan string', () => {
      expect(canTransition(null, 'dikonfirmasi')).toBe(false);
      expect(canTransition('menunggu', null)).toBe(false);
      expect(canTransition(undefined, undefined)).toBe(false);
      expect(canTransition(123, 'dikonfirmasi')).toBe(false);
      expect(canTransition('menunggu', {})).toBe(false);
    });

    it('mengembalikan false untuk status yang tidak dikenal', () => {
      expect(canTransition('pending', 'confirmed')).toBe(false);
      expect(canTransition('menunggu', 'approved')).toBe(false);
      expect(canTransition('unknown', 'selesai')).toBe(false);
      expect(canTransition('', '')).toBe(false);
    });
  });
});
