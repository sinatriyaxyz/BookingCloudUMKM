import crypto from 'node:crypto';
import { BOOKING_CODE_CHARS } from './bookingCode.js';

/**
 * Hitung poin loyalitas yang didapat pelanggan dari sebuah reservasi selesai.
 * Minimal 10 poin per reservasi selesai, atau 1 poin per Rp 1.000 nilai transaksi.
 */
export function calculatePointsForPrice(price) {
  const numeric = Math.max(0, Number(price) || 0);
  return Math.max(10, Math.floor(numeric / 1000));
}

/**
 * Hitung potongan harga voucher terhadap harga layanan.
 */
export function calculateVoucherDiscount(voucher, servicePrice) {
  const price = Math.max(0, Number(servicePrice) || 0);
  const minSpend = Math.max(0, Number(voucher.min_spend ?? voucher.minSpend ?? 0));

  if (price < minSpend) {
    return {
      valid: false,
      message: `Voucher ini membutuhkan minimal transaksi Rp ${minSpend.toLocaleString('id-ID')}.`,
    };
  }

  const type = voucher.discount_type ?? voucher.discountType;
  const value = Math.max(0, Number(voucher.discount_value ?? voucher.discountValue ?? 0));
  const maxDiscountRaw = voucher.max_discount ?? voucher.maxDiscount;
  const maxDiscount = maxDiscountRaw != null ? Math.max(0, Number(maxDiscountRaw)) : null;

  let discountAmount = 0;
  if (type === 'fixed') {
    discountAmount = Math.min(value, price);
  } else if (type === 'percent') {
    const raw = Math.floor((price * value) / 100);
    const capped = maxDiscount != null ? Math.min(raw, maxDiscount) : raw;
    discountAmount = Math.min(capped, price);
  }

  return {
    valid: true,
    discountAmount,
    finalPrice: Math.max(0, price - discountAmount),
  };
}

/**
 * Tentukan tier member berdasarkan total poin yang pernah dikumpulkan.
 */
export function getCustomerTier(lifetimePoints) {
  const pts = Math.max(0, Number(lifetimePoints) || 0);
  if (pts >= 700) {
    return { name: 'Platinum', icon: '💎', minPoints: 700, nextTier: null, nextThreshold: null };
  }
  if (pts >= 300) {
    return { name: 'Gold', icon: '🥇', minPoints: 300, nextTier: 'Platinum', nextThreshold: 700 };
  }
  if (pts >= 100) {
    return { name: 'Silver', icon: '🥈', minPoints: 100, nextTier: 'Gold', nextThreshold: 300 };
  }
  return { name: 'Bronze', icon: '🥉', minPoints: 0, nextTier: 'Silver', nextThreshold: 100 };
}

/**
 * Buat kode unik voucher pelanggan, misalnya HEMAT5K-9X4M.
 */
export function generateCustomerVoucherCode(prefix = 'VCR') {
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += BOOKING_CODE_CHARS[crypto.randomInt(0, BOOKING_CODE_CHARS.length)];
  }
  const cleanPrefix = String(prefix || 'VCR')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  return `${cleanPrefix}-${suffix}`;
}

