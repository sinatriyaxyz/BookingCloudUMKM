import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { formatWib, getBookingByCode, getCategoryMeta } from '../../api/public.js'
import { rupiah } from '../../components/ui.jsx'
import { BusinessLocation } from '../../components/Maps.jsx'

export default function BookingSuccess() {
  const { code } = useParams()
  const { state } = useLocation()
  const [copied, setCopied] = useState(false)
  const [detail, setDetail] = useState(null)

  // Ambil detail booking (termasuk lokasi UMKM) untuk menampilkan peta
  useEffect(() => {
    let alive = true
    getBookingByCode(code).then((d) => alive && setDetail(d)).catch(() => {})
    return () => { alive = false }
  }, [code])

  useEffect(() => {
    const meta = getCategoryMeta('')
    document.body.dataset.category = 'all'
    document.body.className = meta.themeClass
    return () => {
      delete document.body.dataset.category
      document.body.className = ''
    }
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = code
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card center ticket-card" style={{ maxWidth: 540, margin: '1.5rem auto' }}>
      <div className="success-icon-badge">🎉</div>
      <h2>Booking Berhasil Dikirim!</h2>
      <p className="muted">Simpan kode booking berikut untuk mengecek status atau membatalkan jadwal:</p>
      <div>
        <div className="code-big" data-testid="booking-code">{code}</div>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <button className="btn" onClick={copy}>
          {copied ? '✓ Kode Tersalin' : '📋 Salin Kode Booking'}
        </button>
      </div>

      {state?.startAt && (
        <div className="booking-summary-box">
          {state.serviceName && <strong>✨ {state.serviceName}</strong>}
          {state.businessName && <span> di <strong>{state.businessName}</strong></span>}
          <div className="muted" style={{ marginTop: '.25rem' }}>🗓️ {formatWib(state.startAt)}</div>
          {state.finalPrice != null && (
            <div className="booking-price-receipt">
              {Number(state.discountAmount || 0) > 0 && (
                <span className="muted" style={{ textDecoration: 'line-through', marginRight: 6 }}>
                  {rupiah(state.originalPrice)}
                </span>
              )}
              <strong>{rupiah(state.finalPrice)}</strong>
              {Number(state.discountAmount || 0) > 0 && (
                <span className="discount-tag">Hemat {rupiah(state.discountAmount)}</span>
              )}
            </div>
          )}
        </div>
      )}

      <p className="muted">
        Status saat ini: <span className="badge menunggu">⏳ Menunggu konfirmasi pemilik UMKM</span>
      </p>
      <p className="muted small" style={{ marginTop: '.35rem' }}>
        🎁 Setelah reservasi selesai, Anda otomatis mendapat poin loyalitas untuk ditukar voucher diskon!
      </p>

      <div className="ticket-divider" />

      {detail && (
        <div style={{ textAlign: 'left', marginBottom: '1rem' }}>
          <BusinessLocation
            name={detail.businessName}
            address={detail.businessAddress}
            latitude={detail.businessLatitude}
            longitude={detail.businessLongitude}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link className="btn" to="/booking-saya">📅 Lihat Booking Saya</Link>
        <Link className="btn secondary" to="/poin-voucher">🎁 Poin &amp; Voucher</Link>
        <Link className="btn secondary" to={`/cek?kode=${code}`}>🔍 Cek Status Booking</Link>
        <Link className="btn secondary" to="/">🏠 Beranda</Link>
      </div>
    </div>
  )
}
