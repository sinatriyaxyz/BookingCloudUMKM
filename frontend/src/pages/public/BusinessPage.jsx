import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCustomerToken } from '../../api/customer.js'
import { CATEGORIES, getBusiness, getCategoryMeta } from '../../api/public.js'
import { Alert, rupiah } from '../../components/ui.jsx'
import { BusinessLocation } from '../../components/Maps.jsx'
import { toLatLng } from '../../api/geo.js'

export default function BusinessPage() {
  const { slug } = useParams()
  const [biz, setBiz] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setBiz(null)
    setError('')
    getBusiness(slug).then(setBiz).catch((e) => setError(e.message))
  }, [slug])

  useEffect(() => {
    if (!biz) return
    const meta = getCategoryMeta(biz.category)
    document.body.dataset.category = biz.category
    document.body.className = meta.themeClass
    return () => {
      delete document.body.dataset.category
      document.body.className = ''
    }
  }, [biz])

  if (error) return <Alert error={error} />
  if (!biz) return <p className="muted">Memuat...</p>

  const meta = getCategoryMeta(biz.category)
  const location = toLatLng(biz.latitude, biz.longitude)

  return (
    <>
      <p className="back-nav"><Link to="/">← Kembali ke Daftar UMKM</Link></p>
      <div
        className="card biz-hero"
        style={{ backgroundImage: `url('${meta.image}')` }}
      >
        <div className="biz-hero-overlay">
          <span className={`badge cat-badge cat-${biz.category}`}>
            {meta.icon} {CATEGORIES[biz.category] || biz.category}
          </span>
          <h2>{biz.name}</h2>
          <div className="biz-meta-list">
            {biz.address && <span>📍 {biz.address}</span>}
            {biz.phone && <span>📞 {biz.phone}</span>}
          </div>
          <Link className="btn btn-glow" to={`/u/${slug}/booking`}>
            {getCustomerToken() ? 'Booking Sekarang' : 'Masuk & Booking Sekarang'}
          </Link>
          {!getCustomerToken() && (
            <p className="biz-hero-note">
              🔒 Konsumen perlu masuk atau daftar akun gratis terlebih dahulu untuk memesan.
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Daftar Layanan</h3>
        {biz.services.length === 0 ? (
          <p className="muted">Belum ada layanan.</p>
        ) : (
          <ul className="list service-list">
            {biz.services.map((s) => (
              <li key={s.id}>
                <div>
                  <strong>{s.name}</strong>
                  <div className="muted">⏱️ {s.duration_min} menit · 💳 {rupiah(s.price)}</div>
                </div>
                <Link className="btn small" to={`/u/${slug}/booking?layanan=${s.id}`}>
                  Pilih Layanan
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {location && (
        <div className="card">
          <BusinessLocation name={biz.name} address={biz.address} latitude={biz.latitude} longitude={biz.longitude} height={300} />
        </div>
      )}
    </>
  )
}
