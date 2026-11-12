import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CATEGORIES, getBusiness } from '../../api/public.js'
import { Alert, rupiah } from '../../components/ui.jsx'

export default function BusinessPage() {
  const { slug } = useParams()
  const [biz, setBiz] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setBiz(null)
    setError('')
    getBusiness(slug).then(setBiz).catch((e) => setError(e.message))
  }, [slug])

  if (error) return <Alert error={error} />
  if (!biz) return <p className="muted">Memuat...</p>

  return (
    <>
      <div className="card">
        <span className="badge">{CATEGORIES[biz.category] || biz.category}</span>
        <h2>{biz.name}</h2>
        {biz.address && <p>📍 {biz.address}</p>}
        {biz.phone && <p>📞 {biz.phone}</p>}
        <Link className="btn" to={`/u/${slug}/booking`}>Booking Sekarang</Link>
      </div>
      <div className="card">
        <h3>Layanan</h3>
        {biz.services.length === 0 ? (
          <p className="muted">Belum ada layanan.</p>
        ) : (
          <ul className="list">
            {biz.services.map((s) => (
              <li key={s.id}>
                <div>
                  <strong>{s.name}</strong>
                  <div className="muted">{s.duration_min} menit · {rupiah(s.price)}</div>
                </div>
                <Link className="btn small" to={`/u/${slug}/booking?layanan=${s.id}`}>Pilih</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

