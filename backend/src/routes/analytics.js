import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const router = Router();

const querySchema = z.object({
  days: z.coerce
    .number({ error: 'Parameter days harus berupa angka.' })
    .int()
    .refine((val) => [7, 30, 90].includes(val), {
      message: 'Parameter days harus 7, 30, atau 90.',
    })
    .default(30),
});

const WEEKDAY_MAP = [
  { dow: 2, label: 'Sen', fullName: 'Senin' },
  { dow: 3, label: 'Sel', fullName: 'Selasa' },
  { dow: 4, label: 'Rab', fullName: 'Rabu' },
  { dow: 5, label: 'Kam', fullName: 'Kamis' },
  { dow: 6, label: 'Jum', fullName: 'Jumat' },
  { dow: 7, label: 'Sab', fullName: 'Sabtu' },
  { dow: 1, label: 'Min', fullName: 'Minggu' },
];

// GET /api/analytics?days=7|30|90
router.get('/analytics', requireAuth, async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues?.[0]?.message || 'Parameter tidak valid.',
        },
      });
    }

    const days = parsed.data.days;
    const businessId = req.businessId;

    const nowWib = dayjs().tz('Asia/Jakarta');
    const endDate = nowWib.format('YYYY-MM-DD');
    const startDayjs = nowWib.subtract(days - 1, 'day');
    const startDate = startDayjs.format('YYYY-MM-DD');

    const startAtStr = `${startDate} 00:00:00`;
    const endAtStr = `${endDate} 23:59:59`;

    const prevEndDayjs = startDayjs.subtract(1, 'day');
    const prevStartDayjs = prevEndDayjs.subtract(days - 1, 'day');
    const prevStartStr = `${prevStartDayjs.format('YYYY-MM-DD')} 00:00:00`;
    const prevEndStr = `${prevEndDayjs.format('YYYY-MM-DD')} 23:59:59`;

    const [
      [summaryRows],
      [prevRows],
      [repeatRows],
      [trendRows],
      [serviceRows],
      [hourRows],
      [weekdayRows],
      [customerRows],
    ] = await Promise.all([
      pool.query(
        `SELECT
          COUNT(*) AS totalBookings,
          COALESCE(SUM(CASE WHEN b.status = 'menunggu' THEN 1 ELSE 0 END), 0) AS waitingBookings,
          COALESCE(SUM(CASE WHEN b.status = 'dikonfirmasi' THEN 1 ELSE 0 END), 0) AS confirmedBookings,
          COALESCE(SUM(CASE WHEN b.status = 'selesai' THEN 1 ELSE 0 END), 0) AS completedBookings,
          COALESCE(SUM(CASE WHEN b.status = 'dibatalkan' THEN 1 ELSE 0 END), 0) AS cancelledBookings,
          COALESCE(SUM(CASE WHEN b.status = 'selesai' THEN COALESCE(b.final_price, s.price, 0) ELSE 0 END), 0) AS totalRevenue,
          COALESCE(SUM(CASE WHEN b.status IN ('menunggu', 'dikonfirmasi') THEN COALESCE(b.final_price, s.price, 0) ELSE 0 END), 0) AS potentialRevenue,
          COALESCE(SUM(CASE WHEN b.status != 'dibatalkan' THEN COALESCE(b.discount_amount, 0) ELSE 0 END), 0) AS totalDiscountGiven,
          COUNT(DISTINCT CASE WHEN b.status != 'dibatalkan' THEN COALESCE(CAST(b.customer_id AS CHAR), b.customer_phone) ELSE NULL END) AS uniqueCustomers
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.business_id = ? AND b.start_at >= ?`,
        [businessId, startAtStr]
      ),
      pool.query(
        `SELECT
          COALESCE(SUM(CASE WHEN b.status = 'selesai' THEN COALESCE(b.final_price, s.price, 0) ELSE 0 END), 0) AS previousRevenue
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.business_id = ? AND b.start_at BETWEEN ? AND ?`,
        [businessId, prevStartStr, prevEndStr]
      ),
      pool.query(
        `SELECT COUNT(*) AS repeatCustomers FROM (
          SELECT COALESCE(CAST(customer_id AS CHAR), customer_phone) AS cust_key
          FROM bookings
          WHERE business_id = ? AND start_at >= ? AND status != 'dibatalkan'
          GROUP BY cust_key
          HAVING COUNT(*) >= 2
        ) t`,
        [businessId, startAtStr]
      ),
      pool.query(
        `SELECT
          DATE_FORMAT(b.start_at, '%Y-%m-%d') AS date,
          COUNT(*) AS bookings,
          COALESCE(SUM(CASE WHEN b.status = 'selesai' THEN 1 ELSE 0 END), 0) AS completed,
          COALESCE(SUM(CASE WHEN b.status = 'dibatalkan' THEN 1 ELSE 0 END), 0) AS cancelled,
          COALESCE(SUM(CASE WHEN b.status = 'selesai' THEN COALESCE(b.final_price, s.price, 0) ELSE 0 END), 0) AS revenue
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.business_id = ? AND b.start_at BETWEEN ? AND ?
        GROUP BY DATE_FORMAT(b.start_at, '%Y-%m-%d')
        ORDER BY date ASC`,
        [businessId, startAtStr, endAtStr]
      ),
      pool.query(
        `SELECT
          s.id AS serviceId,
          COALESCE(s.name, 'Layanan Dihapus') AS name,
          COUNT(*) AS bookings,
          COALESCE(SUM(CASE WHEN b.status = 'selesai' THEN 1 ELSE 0 END), 0) AS completedBookings,
          COALESCE(SUM(CASE WHEN b.status = 'selesai' THEN COALESCE(b.final_price, s.price, 0) ELSE 0 END), 0) AS revenue
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.business_id = ? AND b.start_at >= ? AND b.status != 'dibatalkan'
        GROUP BY s.id, s.name
        ORDER BY bookings DESC, revenue DESC
        LIMIT 6`,
        [businessId, startAtStr]
      ),
      pool.query(
        `SELECT
          HOUR(b.start_at) AS hour,
          COUNT(*) AS bookings
        FROM bookings b
        WHERE b.business_id = ? AND b.start_at >= ? AND b.status != 'dibatalkan'
        GROUP BY HOUR(b.start_at)
        ORDER BY hour ASC`,
        [businessId, startAtStr]
      ),
      pool.query(
        `SELECT
          DAYOFWEEK(b.start_at) AS dow,
          COUNT(*) AS bookings,
          COALESCE(SUM(CASE WHEN b.status = 'selesai' THEN COALESCE(b.final_price, s.price, 0) ELSE 0 END), 0) AS revenue
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.business_id = ? AND b.start_at >= ? AND b.status != 'dibatalkan'
        GROUP BY DAYOFWEEK(b.start_at)`,
        [businessId, startAtStr]
      ),
      pool.query(
        `SELECT
          MAX(b.customer_name) AS name,
          b.customer_phone AS phone,
          COUNT(*) AS bookings,
          COALESCE(SUM(CASE WHEN b.status = 'selesai' THEN 1 ELSE 0 END), 0) AS completedBookings,
          COALESCE(SUM(CASE WHEN b.status = 'selesai' THEN COALESCE(b.final_price, s.price, 0) ELSE 0 END), 0) AS totalSpent,
          DATE_FORMAT(MAX(b.start_at), '%Y-%m-%d') AS lastVisit
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.business_id = ? AND b.start_at >= ? AND b.status != 'dibatalkan'
        GROUP BY COALESCE(CAST(b.customer_id AS CHAR), b.customer_phone), b.customer_phone
        ORDER BY bookings DESC, totalSpent DESC
        LIMIT 5`,
        [businessId, startAtStr]
      ),
    ]);

    const rawSum = summaryRows[0] || {};
    const totalBookings = Number(rawSum.totalBookings || 0);
    const waitingBookings = Number(rawSum.waitingBookings || 0);
    const confirmedBookings = Number(rawSum.confirmedBookings || 0);
    const completedBookings = Number(rawSum.completedBookings || 0);
    const cancelledBookings = Number(rawSum.cancelledBookings || 0);
    const totalRevenue = Number(rawSum.totalRevenue || 0);
    const potentialRevenue = Number(rawSum.potentialRevenue || 0);
    const totalDiscountGiven = Number(rawSum.totalDiscountGiven || 0);
    const uniqueCustomers = Number(rawSum.uniqueCustomers || 0);
    const repeatCustomers = Number(repeatRows[0]?.repeatCustomers || 0);

    const previousRevenue = Number(prevRows[0]?.previousRevenue || 0);
    let revenueGrowthPct = 0;
    if (previousRevenue > 0) {
      revenueGrowthPct = Math.round(((totalRevenue - previousRevenue) / previousRevenue) * 1000) / 10;
    } else if (totalRevenue > 0) {
      revenueGrowthPct = 100;
    }

    const completionRate = totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 1000) / 10 : 0;
    const cancellationRate = totalBookings > 0 ? Math.round((cancelledBookings / totalBookings) * 1000) / 10 : 0;
    const avgOrderValue = completedBookings > 0 ? Math.round(totalRevenue / completedBookings) : 0;

    // Isi seluruh tanggal agar grafik tren harian selalu kontinyu
    const trendByDate = new Map();
    for (const row of trendRows) {
      trendByDate.set(row.date, {
        date: row.date,
        bookings: Number(row.bookings || 0),
        completed: Number(row.completed || 0),
        cancelled: Number(row.cancelled || 0),
        revenue: Number(row.revenue || 0),
      });
    }

    const dailyTrend = [];
    for (let i = 0; i < days; i += 1) {
      const d = startDayjs.add(i, 'day').format('YYYY-MM-DD');
      dailyTrend.push(
        trendByDate.get(d) || {
          date: d,
          bookings: 0,
          completed: 0,
          cancelled: 0,
          revenue: 0,
        }
      );
    }

    const statusBreakdown = [
      { status: 'selesai', label: 'Selesai', count: completedBookings },
      { status: 'dikonfirmasi', label: 'Dikonfirmasi', count: confirmedBookings },
      { status: 'menunggu', label: 'Menunggu', count: waitingBookings },
      { status: 'dibatalkan', label: 'Dibatalkan', count: cancelledBookings },
    ];

    const topServices = serviceRows.map((row) => ({
      serviceId: row.serviceId,
      name: row.name,
      bookings: Number(row.bookings || 0),
      completedBookings: Number(row.completedBookings || 0),
      revenue: Number(row.revenue || 0),
    }));

    const hourMap = new Map();
    for (const row of hourRows) {
      hourMap.set(Number(row.hour), Number(row.bookings || 0));
    }
    const hourlyDistribution = [];
    for (let h = 8; h <= 21; h += 1) {
      hourlyDistribution.push({
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
        bookings: hourMap.get(h) || 0,
      });
    }

    const dowMap = new Map();
    for (const row of weekdayRows) {
      dowMap.set(Number(row.dow), {
        bookings: Number(row.bookings || 0),
        revenue: Number(row.revenue || 0),
      });
    }
    const weekdayDistribution = WEEKDAY_MAP.map((day) => {
      const data = dowMap.get(day.dow) || { bookings: 0, revenue: 0 };
      return {
        label: day.label,
        fullName: day.fullName,
        bookings: data.bookings,
        revenue: data.revenue,
      };
    });

    const topCustomers = customerRows.map((row) => ({
      name: row.name || 'Pelanggan',
      phone: row.phone,
      bookings: Number(row.bookings || 0),
      completedBookings: Number(row.completedBookings || 0),
      totalSpent: Number(row.totalSpent || 0),
      lastVisit: row.lastVisit,
    }));

    return res.json({
      periodDays: days,
      startDate,
      endDate,
      summary: {
        totalRevenue,
        previousRevenue,
        revenueGrowthPct,
        potentialRevenue,
        totalDiscountGiven,
        totalBookings,
        completedBookings,
        confirmedBookings,
        waitingBookings,
        cancelledBookings,
        completionRate,
        cancellationRate,
        avgOrderValue,
        uniqueCustomers,
        repeatCustomers,
      },
      dailyTrend,
      statusBreakdown,
      topServices,
      hourlyDistribution,
      weekdayDistribution,
      topCustomers,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
