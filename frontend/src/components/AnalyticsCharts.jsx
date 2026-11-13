import { useState } from 'react'
import { rupiah } from './ui.jsx'

function shortDate(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function shortRupiah(val) {
  const n = Number(val || 0)
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.0', '')}jt`
  if (n >= 1000) return `${Math.round(n / 1000)}rb`
  return String(n)
}

export function TrendAreaChart({ data = [] }) {
  const [metric, setMetric] = useState('revenue')
  const [hoverIdx, setHoverIdx] = useState(null)

  const W = 720
  const H = 250
  const padL = 56
  const padR = 20
  const padT = 22
  const padB = 34
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  if (!data.length) {
    return (
      <div className="analytics-chart-card">
        <div className="analytics-chart-head">
          <div>
            <h3>Tren Performa Harian</h3>
            <p className="muted small">Belum ada data pada rentang waktu ini.</p>
          </div>
        </div>
      </div>
    )
  }

  const values = data.map((d) => (metric === 'revenue' ? Number(d.revenue || 0) : Number(d.bookings || 0)))
  const rawMax = Math.max(...values, 0)
  const maxVal = rawMax > 0 ? Math.ceil(rawMax * 1.15) : metric === 'revenue' ? 100000 : 5

  const pts = data.map((d, i) => {
    const x = data.length === 1 ? padL + plotW / 2 : padL + (i / (data.length - 1)) * plotW
    const y = padT + plotH - (values[i] / maxVal) * plotH
    return { x, y, item: d, value: values[i] }
  })

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`

  const ticks = [0, 0.25, 0.5, 0.75, 1]
  const labelStep = data.length <= 10 ? 1 : data.length <= 31 ? 4 : 10
  const activePt = hoverIdx != null && pts[hoverIdx] ? pts[hoverIdx] : null

  const primaryColor = metric === 'revenue' ? '#3D5A45' : '#C46D53'

  return (
    <div className="analytics-chart-card analytics-chart-wide">
      <div className="analytics-chart-head">
        <div>
          <h3>Tren Harian ({data.length} Hari)</h3>
          <p className="muted small">
            {metric === 'revenue'
              ? 'Pendapatan terkonfirmasi selesai (WIB)'
              : 'Total reservasi masuk per hari (WIB)'}
          </p>
        </div>
        <div className="analytics-metric-toggle" role="tablist" aria-label="Pilih metrik grafik tren">
          <button
            type="button"
            className={`analytics-toggle-btn ${metric === 'revenue' ? 'is-active' : ''}`}
            onClick={() => setMetric('revenue')}
          >
            Pendapatan
          </button>
          <button
            type="button"
            className={`analytics-toggle-btn ${metric === 'bookings' ? 'is-active' : ''}`}
            onClick={() => setMetric('bookings')}
          >
            Reservasi
          </button>
        </div>
      </div>

      <div className="analytics-svg-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="analytics-svg" role="img" aria-label="Grafik tren harian">
          <defs>
            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primaryColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={primaryColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {ticks.map((t) => {
            const y = padT + plotH - t * plotH
            const val = Math.round(maxVal * t)
            return (
              <g key={t}>
                <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#E4E1DB" strokeDasharray="3 4" />
                <text x={padL - 8} y={y + 4} textAnchor="end" className="chart-axis-text">
                  {metric === 'revenue' ? shortRupiah(val) : val}
                </text>
              </g>
            )
          })}

          <path d={areaPath} fill="url(#trendGrad)" />
          <path d={linePath} fill="none" stroke={primaryColor} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />

          {pts.map((p, idx) => {
            const showX = idx % labelStep === 0 || idx === pts.length - 1
            const isActive = hoverIdx === idx
            return (
              <g key={p.item.date}>
                {showX && (
                  <text x={p.x} y={H - 10} textAnchor="middle" className="chart-axis-text">
                    {shortDate(p.item.date)}
                  </text>
                )}
                {(data.length <= 31 || p.value > 0 || isActive) && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isActive ? 6 : data.length > 35 ? 2.5 : 3.8}
                    fill={isActive ? '#fff' : primaryColor}
                    stroke={primaryColor}
                    strokeWidth={isActive ? 3 : 1.5}
                  />
                )}
                <rect
                  x={p.x - plotW / (data.length * 2)}
                  y={padT}
                  width={Math.max(plotW / data.length, 8)}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(idx)}
                  onMouseLeave={() => setHoverIdx(null)}
                />
              </g>
            )
          })}

          {activePt && (
            <line
              x1={activePt.x}
              x2={activePt.x}
              y1={padT}
              y2={padT + plotH}
              stroke={primaryColor}
              strokeOpacity="0.35"
              strokeDasharray="4 4"
            />
          )}
        </svg>

        {activePt && (
          <div className="analytics-tooltip-bar">
            <strong>{activePt.item.date}</strong>
            <span>Pendapatan: <b>{rupiah(activePt.item.revenue)}</b></span>
            <span>Reservasi: <b>{activePt.item.bookings}</b> ({activePt.item.completed} selesai)</span>
          </div>
        )}
      </div>
    </div>
  )
}

const STATUS_COLORS = {
  selesai: '#2F6F4E',
  dikonfirmasi: '#3B82F6',
  menunggu: '#D97706',
  dibatalkan: '#DC2626',
}

export function StatusDonutChart({ breakdown = [], total = 0 }) {
  const [hoverStatus, setHoverStatus] = useState(null)
  const radius = 64
  const circumference = 2 * Math.PI * radius
  const safeTotal = total > 0 ? total : 1

  const segments = breakdown.reduce(
    (acc, item) => {
      const pct = total > 0 ? item.count / safeTotal : 0
      const dashLen = pct * circumference
      const seg = {
        ...item,
        color: STATUS_COLORS[item.status] || '#9CA3AF',
        pct: Math.round(pct * 1000) / 10,
        dashArray: `${dashLen} ${circumference}`,
        dashOffset: -acc.offset,
      }
      return {
        offset: acc.offset + dashLen,
        list: [...acc.list, seg],
      }
    },
    { offset: 0, list: [] }
  ).list

  const activeSeg = segments.find((s) => s.status === hoverStatus) || null

  return (
    <div className="analytics-chart-card">
      <div className="analytics-chart-head">
        <div>
          <h3>Komposisi Status Reservasi</h3>
          <p className="muted small">Distribusi status seluruh pesanan periode ini</p>
        </div>
      </div>

      <div className="donut-layout">
        <div className="donut-svg-box">
          <svg viewBox="0 0 180 180" className="donut-svg" role="img" aria-label="Diagram donat status reservasi">
            <circle cx="90" cy="90" r={radius} fill="none" stroke="#EFECE6" strokeWidth="22" />
            {total > 0 &&
              segments.map((seg) =>
                seg.count > 0 ? (
                  <circle
                    key={seg.status}
                    cx="90"
                    cy="90"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={hoverStatus === seg.status ? 26 : 22}
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                    transform="rotate(-90 90 90)"
                    style={{ transition: 'stroke-width 0.2s ease', cursor: 'pointer' }}
                    onMouseEnter={() => setHoverStatus(seg.status)}
                    onMouseLeave={() => setHoverStatus(null)}
                  />
                ) : null
              )}
          </svg>
          <div className="donut-center">
            <strong>{activeSeg ? activeSeg.count : total}</strong>
            <span>{activeSeg ? activeSeg.label : 'Total'}</span>
          </div>
        </div>

        <div className="donut-legend">
          {segments.map((seg) => (
            <div
              key={seg.status}
              className={`donut-legend-row ${hoverStatus === seg.status ? 'is-highlighted' : ''}`}
              onMouseEnter={() => setHoverStatus(seg.status)}
              onMouseLeave={() => setHoverStatus(null)}
            >
              <div className="donut-legend-left">
                <span className="donut-dot" style={{ background: seg.color }} />
                <span>{seg.label}</span>
              </div>
              <div className="donut-legend-right">
                <strong>{seg.count}</strong>
                <span className="muted small">({seg.pct}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ServiceBarChart({ services = [] }) {
  const maxBookings = Math.max(...services.map((s) => s.bookings), 1)
  return (
    <div className="analytics-chart-card">
      <div className="analytics-chart-head">
        <div>
          <h3>Layanan Terlaris</h3>
          <p className="muted small">Ranking berdasarkan jumlah reservasi & omzet</p>
        </div>
      </div>

      {services.length === 0 ? (
        <p className="muted small" style={{ padding: '24px 0' }}>Belum ada reservasi layanan pada periode ini.</p>
      ) : (
        <div className="service-bars">
          {services.map((svc, idx) => {
            const widthPct = Math.max(8, Math.round((svc.bookings / maxBookings) * 100))
            return (
              <div key={svc.serviceId || svc.name} className="service-bar-item">
                <div className="service-bar-meta">
                  <span className="service-bar-name">
                    <span className="service-rank">#{idx + 1}</span>
                    {svc.name}
                  </span>
                  <span className="service-bar-nums">
                    <b>{svc.bookings}x</b> · {rupiah(svc.revenue)}
                  </span>
                </div>
                <div className="service-bar-track">
                  <div
                    className="service-bar-fill"
                    style={{
                      width: `${widthPct}%`,
                      background: idx === 0 ? '#3D5A45' : idx === 1 ? '#577B60' : '#8BA492',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function PeakHoursChart({ hours = [] }) {
  const [hoverHour, setHoverHour] = useState(null)
  const maxBookings = Math.max(...hours.map((h) => h.bookings), 1)
  const peakVal = Math.max(...hours.map((h) => h.bookings), 0)

  return (
    <div className="analytics-chart-card">
      <div className="analytics-chart-head">
        <div>
          <h3>Jam Sibuk Pelanggan</h3>
          <p className="muted small">Kepadatan reservasi per jam (08.00 – 21.00 WIB)</p>
        </div>
      </div>

      <div className="bar-columns-wrap">
        {hours.map((h) => {
          const heightPct = peakVal > 0 ? Math.max(6, Math.round((h.bookings / maxBookings) * 100)) : 4
          const isPeak = peakVal > 0 && h.bookings === peakVal
          const isHovered = hoverHour === h.hour
          return (
            <div
              key={h.hour}
              className="bar-col-item"
              onMouseEnter={() => setHoverHour(h.hour)}
              onMouseLeave={() => setHoverHour(null)}
            >
              <span className={`bar-col-val ${isHovered || isPeak ? 'is-visible' : ''}`}>
                {h.bookings}
              </span>
              <div className="bar-col-track">
                <div
                  className={`bar-col-fill ${isPeak ? 'is-peak' : ''}`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="bar-col-label">{String(h.hour).padStart(2, '0')}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function WeekdayChart({ weekdays = [] }) {
  const maxBookings = Math.max(...weekdays.map((w) => w.bookings), 1)
  const peakVal = Math.max(...weekdays.map((w) => w.bookings), 0)

  return (
    <div className="analytics-chart-card">
      <div className="analytics-chart-head">
        <div>
          <h3>Distribusi Hari Operasional</h3>
          <p className="muted small">Hari tersibuk & kontribusi pendapatan</p>
        </div>
      </div>

      <div className="weekday-bars">
        {weekdays.map((w) => {
          const pct = peakVal > 0 ? Math.max(6, Math.round((w.bookings / maxBookings) * 100)) : 4
          const isPeak = peakVal > 0 && w.bookings === peakVal
          return (
            <div key={w.label} className="weekday-row">
              <span className="weekday-name">{w.label}</span>
              <div className="weekday-track">
                <div
                  className={`weekday-fill ${isPeak ? 'is-peak' : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="weekday-meta">
                <b>{w.bookings}</b> · <span className="muted">{shortRupiah(w.revenue)}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

