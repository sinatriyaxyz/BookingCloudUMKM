import crypto from 'node:crypto';

/**
 * Karakter yang diizinkan untuk kode booking:
 * - Huruf kapital A-Z tanpa 'I' dan 'O'
 * - Angka 2-9 tanpa '0' dan '1'
 * Total 32 karakter (24 huruf + 8 angka).
 */
export const BOOKING_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Menghasilkan kode booking 8 karakter secara acak dan aman.
 */
export function generateBookingCode(length = 8) {
  let result = '';
  for (let i = 0; i < length; i++) {
    const idx = crypto.randomInt(0, BOOKING_CODE_CHARS.length);
    result += BOOKING_CODE_CHARS[idx];
  }
  return result;
}

/**
 * Validasi apakah format kode booking sesuai standar (8 karakter, karakter valid).
 */
export function isValidBookingCode(code) {
  if (typeof code !== 'string' || code.length !== 8) {
    return false;
  }
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code);
}

/**
 * Insert booking ke database dengan mekanisme retry otomatis jika terjadi
 * bentrok UNIQUE constraint pada kolom code (ER_DUP_ENTRY).
 * Menggunakan SAVEPOINT agar kegagalan satu statement tidak merusak transaksi.
 */
export async function insertBookingWithRetry(
  conn,
  {
    businessId,
    serviceId,
    customerId = null,
    customerName,
    customerPhone,
    startAt,
    endAt,
    originalPrice = 0,
    discountAmount = 0,
    finalPrice = 0,
    customerVoucherId = null,
    status = 'menunggu',
  },
  maxRetries = 5
) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = generateBookingCode();
    try {
      await conn.query('SAVEPOINT sp_insert_booking');
      await conn.query(
        `INSERT INTO bookings (
           code, business_id, service_id, customer_id, customer_name, customer_phone,
           start_at, end_at, original_price, discount_amount, final_price, customer_voucher_id, status
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          code,
          businessId,
          serviceId,
          customerId,
          customerName,
          customerPhone,
          startAt,
          endAt,
          originalPrice,
          discountAmount,
          finalPrice,
          customerVoucherId,
          status,
        ]
      );
      await conn.query('RELEASE SAVEPOINT sp_insert_booking');
      return code;
    } catch (err) {
      await conn.query('ROLLBACK TO SAVEPOINT sp_insert_booking').catch(() => {});
      const isDuplicate = err.code === 'ER_DUP_ENTRY' || err.errno === 1062;
      if (isDuplicate && attempt < maxRetries - 1) {
        continue;
      }
      throw err;
    }
  }
  throw new Error('Gagal menghasilkan kode booking unik setelah beberapa percobaan.');
}
