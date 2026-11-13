import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { Alert, Button, rupiah } from '../components/ui.jsx'
import {
  PeakHoursChart,
  ServiceBarChart,
  StatusDonutChart,
  TrendAreaChart,
  WeekdayChart,
} from '../components/AnalyticsCharts.jsx'

const PERIOD_OPTIONS = [
  { days: 7, label: '7 Hari' },
  { days: 30, label: '30 Hari' },
  { days: 90, label: '90 Hari' },
]

export default function Analytics() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const loadAnalytics = useCallback(async (selectedDays) => {
    setLoading(true)
    setErr('')
    try {
      const res = await api('/analytics', { query: { days: selectedDays } })
      setData(res)
    } catch (e) {
      setErr(e.message || 'Gagal memuat data analisis.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAnalytics(days)
  }, [days, loadAnalytics])

  const s = data?.summary || {}
  const growth = Number(s.revenueGrowthPct || 0)

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h1 style={{ margin: 0 }}>Analisis Bisnis</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Pantau omzet, jam sibuk, layanan terlaris, dan retensi pelanggan{' '}
            {data ? `(${data.startDate} s.d. ${data.endDate} WIB)` : ''}
          </p>
        </div>

        <div className="analytics-controls">
          <div className="analytics-period-pills" role="group" aria-label="Pilih periode analisis">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                type="button"
                className={`period-pill ${days === opt.days ? 'is-active' : ''}`}
                onClick={() => setDays(opt.days)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" className="small" onClick={() => loadAnalytics(days)} disabled={loading}>
            {loading ? 'Memuat...' : 'Muat Ulang'}
          </Button>
        </div>
      </div>

      <Alert error={err} />

      {loading && !data ? (
        <div className="card">
          <p className="muted">Menyiapkan grafik analisis bisnis...</p>
        </div>
      ) : data ? (
        <>
          <div className="analytics-kpi-grid">
            <div className="kpi-card kpi-primary">
              <div className="kpi-top">
                <span className="kpi-label">Pendapatan Selesai</span>
                <span className="kpi-icon">💰</span>
              </div>
              <div className="kpi-value">{rupiah(s.totalRevenue || 0)}</div>
              <div className="kpi-foot">
                <span className={`kpi-delta ${growth >= 0 ? 'is-up' : 'is-down'}`}>
                  {growth >= 0 ? '▲' : '▼'} {Math.abs(growth)}%
                </span>
                <span className="muted small">vs {days} hari sebelumnya</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Potensi Pendapatan Aktif</span>
                <span className="kpi-icon">⏳</span>
              </div>
              <div className="kpi-value">{rupiah(s.potentialRevenue || 0)}</div>
              <div className="kpi-foot">
                <span className="muted small">
                  {s.waitingBookings || 0} menunggu · {s.confirmedBookings || 0} dikonfirmasi
                </span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Rata-rata Transaksi</span>
                <span className="kpi-icon">🧾</span>
              </div>
              <div className="kpi-value">{rupiah(s.avgOrderValue || 0)}</div>
              <div className="kpi-foot">
                <span className="muted small">
                  Diskon voucher diberikan: {rupiah(s.totalDiscountGiven || 0)}
                </span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Tingkat Penyelesaian</span>
                <span className="kpi-icon">✅</span>
              </div>
              <div className="kpi-value">{s.completionRate ?? 0}%</div>
              <div className="kpi-foot">
                <span className="muted small">
                  {s.completedBookings || 0} selesai dari {s.totalBookings || 0} reservasi
                </span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Tingkat Pembatalan</span>
                <span className="kpi-icon">🚫</span>
              </div>
              <div className="kpi-value">{s.cancellationRate ?? 0}%</div>
              <div className="kpi-foot">
                <span className="muted small">{s.cancelledBookings || 0} reservasi dibatalkan</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Pelanggan &amp; Repeat Order</span>
                <span className="kpi-icon">🤝</span>
              </div>
              <div className="kpi-value">{s.uniqueCustomers || 0} Pelanggan</div>
              <div className="kpi-foot">
                <span className="muted small">{s.repeatCustomers || 0} pelanggan kembali ≥ 2x</span>
              </div>
            </div>
          </div>

          <div className="analytics-charts-grid">
            <TrendAreaChart data={data.dailyTrend || []} />
            <StatusDonutChart
              breakdown={data.statusBreakdown || []}
              total={s.totalBookings || 0}
            />
            <ServiceBarChart services={data.topServices || []} />
            <PeakHoursChart hours={data.hourlyDistribution || []} />
            <WeekdayChart weekdays={data.weekdayDistribution || []} />

            <div className="analytics-chart-card">
              <div className="analytics-chart-head">
                <div>
                  <h3>Pelanggan Terloyal</h3>
                  <p className="muted small">Pelanggan dengan kunjungan terbanyak pada periode ini</p>
                </div>
              </div>

              {(data.topCustomers || []).length === 0 ? (
                <p className="muted small" style={{ padding: '24px 0' }}>
                  Belum ada data pelanggan pada periode ini.
                </p>
              ) : (
                <div className="table-scroll">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Pelanggan</th>
                        <th>Booking</th>
                        <th>Belanja</th>
                        <th>Terakhir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topCustomers.map((cust, i) => (
                        <tr key={`${cust.phone}-${i}`}>
                          <td>
                            <div className="cust-cell-name">
                              <span className="service-rank">#{i + 1}</span>
                              <div>
                                <strong>{cust.name}</strong>
                                <div className="muted small">{cust.phone}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <strong>{cust.bookings}x</strong>{' '}
                            <span className="muted small">({cust.completedBookings} selesai)</span>
                          </td>
                          <td>
                            <strong>{rupiah(cust.totalSpent)}</strong>
                          </td>
                          <td className="muted small">{cust.lastVisit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
