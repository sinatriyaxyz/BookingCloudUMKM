/**
 * Tes Sistem Poin & Voucher Konsumen + Dashboard Analisis Pemilik UMKM.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockConn = {
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  query: vi.fn(),
};

vi.mock('../src/db/pool.js', () => {
  const mockQuery = vi.fn();
  const mockGetConnection = vi.fn(async () => mockConn);
  return {
    default: {
      query: mockQuery,
      getConnection: mockGetConnection,
    },
  };
});

import pool from '../src/db/pool.js';
import app from '../src/app.js';
import {
  calculatePointsForPrice,
  calculateVoucherDiscount,
  getCustomerTier,
  generateCustomerVoucherCode,
} from '../src/services/loyalty.js';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme_jwt_secret';

function makeCustomerToken(customerId = 10) {
  return jwt.sign({ customerId, role: 'customer', email: 'c@test.id' }, JWT_SECRET);
}

function makeOwnerToken(businessId = 7) {
  return jwt.sign({ userId: 3, businessId, role: 'owner', email: 'o@test.id' }, JWT_SECRET);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Service loyalty helpers', () => {
  it('calculatePointsForPrice menghitung poin min 10 dan kelipatan Rp 1.000', () => {
    expect(calculatePointsForPrice(0)).toBe(10);
    expect(calculatePointsForPrice(5000)).toBe(10);
    expect(calculatePointsForPrice(45000)).toBe(45);
    expect(calculatePointsForPrice(120000)).toBe(120);
  });

  it('calculateVoucherDiscount menangani tipe fixed dan percent + maxDiscount + minSpend', () => {
    const fixedVoucher = {
      discount_type: 'fixed',
      discount_value: 10000,
      min_spend: 50000,
      max_discount: null,
    };
    expect(calculateVoucherDiscount(fixedVoucher, 40000).valid).toBe(false);
    expect(calculateVoucherDiscount(fixedVoucher, 60000)).toEqual({
      valid: true,
      discountAmount: 10000,
      finalPrice: 50000,
    });

    const pctVoucher = {
      discount_type: 'percent',
      discount_value: 20,
      min_spend: 50000,
      max_discount: 15000,
    };
    expect(calculateVoucherDiscount(pctVoucher, 100000)).toEqual({
      valid: true,
      discountAmount: 15000,
      finalPrice: 85000,
    });
  });

  it('getCustomerTier mengembalikan tier yang tepat berdasarkan lifetimePoints', () => {
    expect(getCustomerTier(0).name).toBe('Bronze');
    expect(getCustomerTier(250).name).toBe('Silver');
    expect(getCustomerTier(650).name).toBe('Gold');
    expect(getCustomerTier(1500).name).toBe('Platinum');
  });

  it('generateCustomerVoucherCode menghasilkan kode unik berawalan prefix', () => {
    const code = generateCustomerVoucherCode('HEMAT');
    expect(code).toMatch(/^HEMAT-[A-Z2-9]{4}$/);
  });
});

describe('GET /api/customer/loyalty', () => {
  it('menolak tanpa token dan menolak token pemilik UMKM → 401', async () => {
    const r1 = await request(app).get('/api/customer/loyalty');
    expect(r1.status).toBe(401);

    const r2 = await request(app)
      .get('/api/customer/loyalty')
      .set('Authorization', `Bearer ${makeOwnerToken(7)}`);
    expect(r2.status).toBe(401);
  });

  it('mengembalikan poin, tier, katalog voucher, voucher milik, dan riwayat poin', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 10, name: 'Budi', points: 180 }]])
      .mockResolvedValueOnce([[{ lifetimePoints: 260 }]])
      .mockResolvedValueOnce([
        [{ id: 1, codePrefix: 'HEMAT5K', title: 'Potongan Rp 5.000', pointsCost: 50 }],
      ])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([
        [{ id: 99, type: 'earn', points: 45, description: 'Poin selesai', createdAt: '2026-11-10 10:00:00' }],
      ]);

    const res = await request(app)
      .get('/api/customer/loyalty')
      .set('Authorization', `Bearer ${makeCustomerToken(10)}`);

    expect(res.status).toBe(200);
    expect(res.body.points).toBe(180);
    expect(res.body.lifetimePoints).toBe(260);
    expect(res.body.tier.name).toBe('Silver');
    expect(res.body.catalog).toHaveLength(1);
    expect(res.body.history).toHaveLength(1);
  });
});

describe('POST /api/customer/vouchers/redeem', () => {
  it('poin tidak cukup → 422 INSUFFICIENT_POINTS', async () => {
    mockConn.query
      .mockResolvedValueOnce([[{ id: 10, points: 30 }]])
      .mockResolvedValueOnce([
        [
          {
            id: 2,
            code_prefix: 'DISKON10K',
            title: 'Potongan Rp 10.000',
            discount_type: 'fixed',
            discount_value: 10000,
            max_discount: null,
            min_spend: 50000,
            points_cost: 90,
            is_active: 1,
          },
        ],
      ]);

    const res = await request(app)
      .post('/api/customer/vouchers/redeem')
      .set('Authorization', `Bearer ${makeCustomerToken(10)}`)
      .send({ voucherId: 2 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_POINTS');
    expect(mockConn.rollback).toHaveBeenCalled();
  });

  it('penukaran sukses → 201 + sisa poin berkurang + voucher dibuat', async () => {
    mockConn.query
      .mockResolvedValueOnce([[{ id: 10, points: 150 }]])
      .mockResolvedValueOnce([
        [
          {
            id: 1,
            code_prefix: 'HEMAT5K',
            title: 'Potongan Rp 5.000',
            description: 'Hemat Rp 5.000',
            discount_type: 'fixed',
            discount_value: 5000,
            max_discount: null,
            min_spend: 25000,
            points_cost: 50,
            is_active: 1,
          },
        ],
      ])
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE customers
      .mockResolvedValueOnce([]) // SAVEPOINT
      .mockResolvedValueOnce([{ insertId: 77 }]) // INSERT customer_vouchers
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // INSERT point_transactions

    const res = await request(app)
      .post('/api/customer/vouchers/redeem')
      .set('Authorization', `Bearer ${makeCustomerToken(10)}`)
      .send({ voucherId: 1 });

    expect(res.status).toBe(201);
    expect(res.body.points).toBe(100);
    expect(res.body.customerVoucher.id).toBe(77);
    expect(res.body.customerVoucher.code).toMatch(/^HEMAT5K-[A-Z2-9]{4}$/);
    expect(mockConn.commit).toHaveBeenCalled();
  });
});

describe('GET /api/analytics', () => {
  it('menolak tanpa token dan menolak token konsumen → 401', async () => {
    const r1 = await request(app).get('/api/analytics');
    expect(r1.status).toBe(401);

    const r2 = await request(app)
      .get('/api/analytics')
      .set('Authorization', `Bearer ${makeCustomerToken(10)}`);
    expect(r2.status).toBe(401);
  });

  it('menolak parameter days selain 7/30/90 → 422', async () => {
    const res = await request(app)
      .get('/api/analytics?days=14')
      .set('Authorization', `Bearer ${makeOwnerToken(7)}`);
    expect(res.status).toBe(422);
  });

  it('mengembalikan data analitik terisolasi business_id dari JWT pemilik', async () => {
    pool.query
      .mockResolvedValueOnce([
        [
          {
            totalBookings: 5,
            waitingBookings: 1,
            confirmedBookings: 1,
            completedBookings: 2,
            cancelledBookings: 1,
            totalRevenue: 150000,
            potentialRevenue: 75000,
            totalDiscountGiven: 10000,
            uniqueCustomers: 3,
          },
        ],
      ])
      .mockResolvedValueOnce([[{ previousRevenue: 100000 }]])
      .mockResolvedValueOnce([[{ repeatCustomers: 1 }]])
      .mockResolvedValueOnce([
        [{ date: '2026-11-12', bookings: 2, completed: 2, cancelled: 0, revenue: 150000 }],
      ])
      .mockResolvedValueOnce([
        [{ serviceId: 1, name: 'Potong Rambut', bookings: 4, completedBookings: 2, revenue: 150000 }],
      ])
      .mockResolvedValueOnce([[{ hour: 10, bookings: 3 }]])
      .mockResolvedValueOnce([[{ dow: 5, bookings: 3, revenue: 150000 }]])
      .mockResolvedValueOnce([
        [
          {
            name: 'Andi',
            phone: '08123456789',
            bookings: 3,
            completedBookings: 2,
            totalSpent: 150000,
            lastVisit: '2026-11-12',
          },
        ],
      ]);

    const res = await request(app)
      .get('/api/analytics?days=7')
      .set('Authorization', `Bearer ${makeOwnerToken(7)}`);

    expect(res.status).toBe(200);
    expect(res.body.periodDays).toBe(7);
    expect(res.body.summary.totalRevenue).toBe(150000);
    expect(res.body.summary.revenueGrowthPct).toBe(50);
    expect(res.body.summary.completionRate).toBe(40);
    expect(res.body.dailyTrend).toHaveLength(7);
    expect(res.body.hourlyDistribution).toHaveLength(14);
    expect(res.body.weekdayDistribution).toHaveLength(7);
    expect(res.body.topServices[0].name).toBe('Potong Rambut');
    expect(res.body.topCustomers[0].name).toBe('Andi');

    // Verifikasi isolasi tenant: parameter pertama setiap query adalah businessId = 7
    for (const call of pool.query.mock.calls) {
      expect(call[1][0]).toBe(7);
    }
  });
});
