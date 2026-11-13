import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  clearCustomerAuth,
  getCustomerBookings,
  getCustomerMe,
  getCustomerToken,
  getStoredCustomer,
} from '../../api/customer.js'
import { cancelBookingByCode, formatWib, getCategoryMeta } from '../../api/public.js'
import { Alert, Button, rupiah } from '../../components/ui.jsx'
import { STATUS_LABEL } from '../../components/BookingTable.jsx'
import { useSwipe } from '../../hooks/useSwipe.js'

const STATUS_FILTERS = ['', 'menunggu', 'dikonfirmasi', 'selesai', 'dibatalkan']

const CANCELLABLE = ['menunggu', 'dikonfirmasi']

const STATUS_ICON = {
  menunggu: '⏳',
  dikonfirmasi: '✅',
  selesai: '🎉',
  dibatalkan: '❌',
}

export default function MyBookings() {
  const navigate = useNavigate()
  const hasToken = Boolean(getCustomerToken())
  const [customer, setCustomer] = useState(() => getStoredCustomer())
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancellingCode, setCancellingCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    const meta = getCategoryMeta('')
    document.body.dataset.category = 'all'
    document.body.className = meta.themeClass
    return () => {
      delete document.body.dataset.category
      document.body.className = ''
    }
  }, [])

  const load = useCallback(async () => {
    if (!getCustomerToken()) return
    setLoading(true)
    setError('')
    try {
      const [me, list] = await Promise.all([getCustomerMe(), getCustomerBookings()])
      setCustomer(me)
      setBookings(list.bookings || [])
    } catch (err) {
      if (err.status === 401) {
        clearCustomerAuth()
        navigate('/masuk?redirect=/booking-saya', { replace: true })
        return
      }
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    if (hasToken) load()
  }, [hasToken, load])

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => {
      const idx = STATUS_FILTERS.indexOf(statusFilter)
      if (idx < STATUS_FILTERS.length - 1) setStatusFilter(STATUS_FILTERS[idx + 1])
    },
    onSwipeRight: () => {
      const idx = STATUS_FILTERS.indexOf(statusFilter)
      if (idx > 0) setStatusFilter(STATUS_FILTERS[idx - 1])
    },
  })

  if (!hasToken) {
    return <Navigate to="/masuk?redirect=/booking-saya" replace />
  }

  async function handleCancel(code) {
    if (!window.confirm(`Batalkan reservasi ${code}?`)) return
    setCancellingCode(code)
    setError('')
    setSuccess('')
    try {
      const res = await cancelBookingByCode(code)
      setBookings((prev) =>
        prev.map((b) => (b.code === code ? { ...b, status: res.status } : b)),
      )
      setSuccess(res.message || 'Reservasi berhasil dibatalkan.')
    } catch (err) {
      setError(err.message)
    } finally {
      setCancellingCode('')
    }
  }

  const heroMeta = getCategoryMeta('')
  const filteredBookings = statusFilter
    ? bookings.filter((b) => b.status === statusFilter)
    : bookings

  return (
    <div {...swipeHandlers}>
      <section
        className="hero-banner compact-hero"
        style={{ backgroundImage: `url('${heroMeta.image}')` }}
      >
        <div className="hero-overlay">
          <span className="hero-pill">👤 Akun Pelanggan</span>
          <h1>Halo, {customer?.name || 'Pelanggan'}!</h1>
          <p>
            {customer?.email} {customer?.phone ? `· 📞 ${customer.phone}` : ''}
          </p>
        </div>
      </section>

      <div className="section-header">
        <div>
          <h2>📅 Riwayat Booking Saya</h2>
          <p className="muted" style={{ margin: 0 }}>
            Semua reservasi yang dibuat melalui akun Anda tersimpan otomatis di sini.
          </p>
        </div>
        <div>
          <Button variant="secondary" onClick={load} loading={loading}>
            ↻ Muat ulang
          </Button>
          <Link className="btn" to="/">
            + Booking Baru
          </Link>
        </div>
      </div>

      <Alert error={error} success={success} />

      {!loading && bookings.length > 0 && (
        <div className="chips" role="group" aria-label="Filter status booking">
          {STATUS_FILTERS.map((st) => (
            <button
              key={st || 'all'}
              type="button"
              className={`chip ${statusFilter === st ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st ? `${STATUS_ICON[st]} ${STATUS_LABEL[st]}` : '📋 Semua'}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>Memuat daftar booking Anda...</p></div>
      ) : filteredBookings.length === 0 ? (
        <div className="card center empty-state">
          <p className="muted">
            {bookings.length === 0
              ? 'Anda belum memiliki riwayat booking.'
              : 'Tidak ada booking dengan status ini.'}
          </p>
          <Link className="btn" to="/">Jelajahi UMKM Sekarang →</Link>
        </div>
      ) : (
        <div key={statusFilter || 'all'} className="my-bookings-list stagger-grid">
          {filteredBookings.map((b, idx) => {
            const catMeta = getCategoryMeta(b.category)
            return (
              <div
                key={b.code}
                className="card my-booking-card"
                style={{ '--stagger-i': idx }}
              >
                <div className="my-booking-head">
                  <div>
                    <span className="code-pill">{b.code}</span>
                    <span className={`badge ${b.status}`} style={{ marginLeft: '.5rem' }}>
                      {STATUS_ICON[b.status] || '📌'} {STATUS_LABEL[b.status] || b.status}
                    </span>
                    {Number(b.pointsEarned || 0) > 0 && (
                      <span className="points-earned-pill">+{b.pointsEarned} Poin</span>
                    )}
                  </div>
                  <div className="my-booking-price-col">
                    {Number(b.discountAmount || 0) > 0 && (
                      <span className="muted small" style={{ textDecoration: 'line-through', marginRight: 6 }}>
                        {rupiah(b.originalPrice || b.price)}
                      </span>
                    )}
                    <strong className="my-booking-price">
                      {rupiah(b.finalPrice != null ? b.finalPrice : b.price)}
                    </strong>
                  </div>
                </div>

                <div className="my-booking-body">
                  <h3>
                    <Link to={`/u/${b.businessSlug}`}>
                      {catMeta.icon} {b.businessName}
                    </Link>
                  </h3>
                  <p className="muted" style={{ margin: '.2rem 0' }}>
                    ✨ {b.serviceName} · ⏱️ {b.durationMin} menit
                  </p>
                  <p style={{ margin: '.35rem 0 0' }}>
                    🗓️ <strong>{formatWib(b.startAt)}</strong>
                  </p>
                </div>

                <div className="my-booking-actions">
                  <Link className="btn secondary small" to={`/cek?kode=${b.code}`}>
                    🔍 Detail Tiket
                  </Link>
                  {CANCELLABLE.includes(b.status) && (
                    <Button
                      small
                      variant="danger"
                      loading={cancellingCode === b.code}
                      onClick={() => handleCancel(b.code)}
                    >
                      ✕ Batalkan
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

