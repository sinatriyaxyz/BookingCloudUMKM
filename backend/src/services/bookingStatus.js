/**
 * Layanan validasi transisi status booking (F-08)
 * Sesuai aturan bisnis AGENTS.md:
 * - Menunggu -> Dikonfirmasi -> Selesai
 * - Dibatalkan hanya dari Menunggu atau Dikonfirmasi
 * - Tidak ada transisi lain. Reservasi yang Selesai/Dibatalkan tidak boleh diubah lagi.
 */

export const BOOKING_STATUS = Object.freeze({
  MENUNGGU: 'menunggu',
  DIKONFIRMASI: 'dikonfirmasi',
  SELESAI: 'selesai',
  DIBATALKAN: 'dibatalkan',
});

const VALID_TRANSITIONS = {
  [BOOKING_STATUS.MENUNGGU]: [
    BOOKING_STATUS.DIKONFIRMASI,
    BOOKING_STATUS.DIBATALKAN,
  ],
  [BOOKING_STATUS.DIKONFIRMASI]: [
    BOOKING_STATUS.SELESAI,
    BOOKING_STATUS.DIBATALKAN,
  ],
  [BOOKING_STATUS.SELESAI]: [],
  [BOOKING_STATUS.DIBATALKAN]: [],
};

/**
 * Fungsi murni untuk memeriksa apakah transisi status diizinkan.
 * @param {string} from - Status saat ini
 * @param {string} to - Status tujuan
 * @returns {boolean}
 */
export function canTransition(from, to) {
  if (typeof from !== 'string' || typeof to !== 'string') {
    return false;
  }

  const fromNorm = from.trim().toLowerCase();
  const toNorm = to.trim().toLowerCase();

  const allowed = VALID_TRANSITIONS[fromNorm];
  if (!allowed) {
    return false;
  }

  return allowed.includes(toNorm);
}
