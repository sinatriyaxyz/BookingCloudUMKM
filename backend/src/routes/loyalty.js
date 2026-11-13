import { Router } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { requireCustomerAuth } from '../middleware/requireCustomerAuth.js';
import { generateCustomerVoucherCode, getCustomerTier } from '../services/loyalty.js';

const router = Router();

const redeemSchema = z.object({
  voucherId: z.coerce
    .number({ error: 'voucherId harus berupa angka.' })
    .int({ message: 'voucherId harus bilangan bulat.' })
    .positive({ message: 'voucherId harus bilangan bulat positif.' }),
});

// GET /api/customer/loyalty
router.get('/loyalty', requireCustomerAuth, async (req, res, next) => {
  try {
    const [custRows] = await pool.query(
      'SELECT id, name, points FROM customers WHERE id = ?',
      [req.customerId]
    );
    if (custRows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Akun pelanggan tidak ditemukan.' },
      });
    }

    const customer = custRows[0];

    const [lifetimeRows] = await pool.query(
      `SELECT COALESCE(SUM(points), 0) AS lifetimePoints
       FROM point_transactions
       WHERE customer_id = ? AND type = 'earn'`,
      [req.customerId]
    );
    const lifetimePoints = Number(lifetimeRows[0]?.lifetimePoints || 0);
    const tier = getCustomerTier(lifetimePoints);

    const [catalog] = await pool.query(
      `SELECT
        id,
        code_prefix AS codePrefix,
        title,
        description,
        discount_type AS discountType,
        discount_value AS discountValue,
        max_discount AS maxDiscount,
        min_spend AS minSpend,
        points_cost AS pointsCost
      FROM vouchers
      WHERE is_active = 1
      ORDER BY points_cost ASC, id ASC`
    );

    const [myVouchers] = await pool.query(
      `SELECT
        cv.id,
        cv.code,
        cv.status,
        DATE_FORMAT(cv.redeemed_at, '%Y-%m-%d %H:%i:%s') AS redeemedAt,
        DATE_FORMAT(cv.used_at, '%Y-%m-%d %H:%i:%s') AS usedAt,
        v.id AS voucherId,
        v.title,
        v.description,
        v.discount_type AS discountType,
        v.discount_value AS discountValue,
        v.max_discount AS maxDiscount,
        v.min_spend AS minSpend,
        v.points_cost AS pointsCost
      FROM customer_vouchers cv
      JOIN vouchers v ON cv.voucher_id = v.id
      WHERE cv.customer_id = ?
      ORDER BY FIELD(cv.status, 'tersedia', 'terpakai'), cv.redeemed_at DESC`,
      [req.customerId]
    );

    const [history] = await pool.query(
      `SELECT
        id,
        type,
        points,
        description,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM point_transactions
      WHERE customer_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 30`,
      [req.customerId]
    );

    return res.json({
      points: Number(customer.points || 0),
      lifetimePoints,
      tier,
      catalog,
      myVouchers,
      history,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/customer/vouchers/redeem
router.post('/vouchers/redeem', requireCustomerAuth, async (req, res, next) => {
  try {
    const parsed = redeemSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues?.[0]?.message || 'Input tidak valid.';
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message } });
    }

    const { voucherId } = parsed.data;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [custRows] = await conn.query(
        'SELECT id, points FROM customers WHERE id = ? FOR UPDATE',
        [req.customerId]
      );
      if (custRows.length === 0) {
        await conn.rollback();
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Akun pelanggan tidak ditemukan.' },
        });
      }
      const customer = custRows[0];

      const [voucherRows] = await conn.query(
        `SELECT id, code_prefix, title, description, discount_type, discount_value, max_discount, min_spend, points_cost, is_active
         FROM vouchers
         WHERE id = ? AND is_active = 1`,
        [voucherId]
      );
      if (voucherRows.length === 0) {
        await conn.rollback();
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Voucher tidak ditemukan atau tidak aktif.' },
        });
      }
      const voucher = voucherRows[0];

      const currentPoints = Number(customer.points || 0);
      const cost = Number(voucher.points_cost || 0);
      if (currentPoints < cost) {
        await conn.rollback();
        return res.status(422).json({
          error: {
            code: 'INSUFFICIENT_POINTS',
            message: `Poin Anda belum cukup. Dibutuhkan ${cost} poin (tersedia ${currentPoints} poin).`,
          },
        });
      }

      const newPoints = currentPoints - cost;
      await conn.query('UPDATE customers SET points = ? WHERE id = ?', [newPoints, customer.id]);

      let cvId = null;
      let code = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateCustomerVoucherCode(voucher.code_prefix);
        try {
          await conn.query('SAVEPOINT sp_insert_cv');
          const [insRes] = await conn.query(
            `INSERT INTO customer_vouchers (customer_id, voucher_id, code, status)
             VALUES (?, ?, ?, 'tersedia')`,
            [customer.id, voucher.id, candidate]
          );
          await conn.query('RELEASE SAVEPOINT sp_insert_cv');
          cvId = insRes.insertId;
          code = candidate;
          break;
        } catch (err) {
          await conn.query('ROLLBACK TO SAVEPOINT sp_insert_cv').catch(() => {});
          if ((err.code === 'ER_DUP_ENTRY' || err.errno === 1062) && attempt < 4) {
            continue;
          }
          throw err;
        }
      }

      await conn.query(
        `INSERT INTO point_transactions (customer_id, voucher_id, type, points, description)
         VALUES (?, ?, 'redeem', ?, ?)`,
        [customer.id, voucher.id, -cost, `Tukar voucher ${voucher.title} (${code})`]
      );

      await conn.commit();

      return res.status(201).json({
        points: newPoints,
        message: `Berhasil menukar ${cost} poin menjadi voucher ${voucher.title}!`,
        customerVoucher: {
          id: cvId,
          voucherId: voucher.id,
          code,
          title: voucher.title,
          description: voucher.description,
          discountType: voucher.discount_type,
          discountValue: voucher.discount_value,
          maxDiscount: voucher.max_discount,
          minSpend: voucher.min_spend,
          pointsCost: cost,
          status: 'tersedia',
        },
      });
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
});

export default router;

