import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cancelBookingByCode, formatWib, getBookingByCode, getCategoryMeta } from '../../api/public.js'
import { Alert, Button, Field } from '../../components/ui.jsx'
import { STATUS_LABEL } from '../../components/BookingTable.jsx'
import { BusinessLocation } from '../../components/Maps.jsx'

const CANCELLABLE = ['menunggu', 'dikonfirmasi']

const STATUS_ICON = {
  menunggu: '⏳',
  dikonfirmasi: '✅',
  selesai: '🎉',
  dibatalkan: '❌',
}

export default function CheckStatus() {
  const [params, setParams] = useSearchParams()
  const [code, setCode] = useState(params.get('kode') || '')
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const meta = getCategoryMeta('')
    document.body.dataset.category = 'all'
    document.body.className = meta.themeClass
    return () => {
      delete document.body.dataset.category
      document.body.className = ''
    }
  }, [])

  const lookup = useCallback(async (c) => {
    const k = c.trim().toUpperCase()
    if (!k) return
    setLoading(true)
    setError('')
    setSuccess('')
    setBooking(null)
    try {
      setBooking(await getBookingByCode(k))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const k = params.get('kode')
    if (k) lookup(k)
  }, [params, lookup])

  function submit(e) {
    e.preventDefault()
    setParams({ kode: code.trim().toUpperCase() })
  }

  async function cancel() {
    if (!window.confirm(`Batalkan reservasi ${booking.code}?`)) return
    setCancelling(true)
    setError('')
    setSuccess('')
    try {
      const res = await cancelBookingByCode(booking.code)
      setBooking({ ...booking, status: res.status })
      setSuccess(res.message || 'Reservasi berhasil dibatalkan.')
    } catch (e) {
      setError(e.message)
    } finally {
      setCancelling(false)
    }
  }

  const heroMeta = getCategoryMeta('')

  return (
    <>
      <section
        className="hero-banner compact-hero"
        style={{ backgroundImage: `url('${heroMeta.image}')` }}
      >
        <div className="hero-overlay">
          <span className="hero-pill">🔍 Lacak Reservasi</span>
          <h1>Cek Status Booking</h1>
          <p>Masukkan 8 karakter kode booking Anda untuk melihat detail jadwal atau membatalkan reservasi.</p>
        </div>
      </section>

      <form className="card lookup-card" onSubmit={submit}>
        <div className="lookup-row">
          <Field
            label="Kode Booking"
            id="code"
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Contoh: AB23CD45"
            maxLength={20}
            autoCapitalize="characters"
            required
          />
          <Button type="submit" loading={loading}>
            🔍 Cek Status
          </Button>
        </div>
      </form>

      <Alert error={error} success={success} />

      {booking && (
        <div className="card ticket-card">
          <div className="ticket-header">
            <div>
              <span className="muted" style={{ fontSize: '.82rem', fontWeight: 600 }}>KODE RESERVASI</span>
              <div className="code-big small">{booking.code}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="muted" style={{ display: 'block', fontSize: '.82rem', fontWeight: 600, marginBottom: '.35rem' }}>
                STATUS SAAT INI
              </span>
              <span className={`badge status-lg ${booking.status}`}>
                {STATUS_ICON[booking.status] || '📌'} {STATUS_LABEL[booking.status] || booking.status}
              </span>
            </div>
          </div>

          <div className="ticket-divider" />

          <dl className="details ticket-details">
            <dt>🏪 UMKM</dt><dd><strong>{booking.businessName}</strong></dd>
            <dt>✨ Layanan</dt><dd>{booking.serviceName}</dd>
            <dt>👤 Pemesan</dt><dd>{booking.customerName}</dd>
            <dt>🗓️ Waktu</dt><dd><strong>{formatWib(booking.startAt)}</strong></dd>
          </dl>

          <BusinessLocation
            name={booking.businessName}
            address={booking.businessAddress}
            latitude={booking.businessLatitude}
            longitude={booking.businessLongitude}
          />

          {CANCELLABLE.includes(booking.status) && (
            <div className="ticket-actions">
              <Button variant="danger" loading={cancelling} onClick={cancel}>
                ✕ Batalkan Reservasi
              </Button>
              <p className="muted" style={{ margin: '.5rem 0 0', fontSize: '.85rem' }}>
                ℹ️ Pembatalan hanya bisa dilakukan paling lambat 2 jam sebelum jam reservasi dimulai.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
