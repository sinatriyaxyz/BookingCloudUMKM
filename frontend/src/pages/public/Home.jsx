import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, listBusinesses } from '../../api/public.js'
import { Alert } from '../../components/ui.jsx'

export default function Home() {
  const [category, setCategory] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    listBusinesses(category)
      .then((rows) => alive && setItems(rows))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [category])

  return (
    <>
      <h2>Reservasi UMKM tanpa antre</h2>
      <p className="muted">Pilih UMKM, pilih jam kosong, dan dapatkan kode booking. Tanpa perlu akun.</p>
      <div className="chips" role="group" aria-label="Filter kategori">
        <button className={`chip ${category === '' ? 'active' : ''}`} onClick={() => setCategory('')}>
          Semua
        </button>
        {Object.entries(CATEGORIES).map(([k, v]) => (
          <button key={k} className={`chip ${category === k ? 'active' : ''}`} onClick={() => setCategory(k)}>
            {v}
          </button>
        ))}
      </div>
      <Alert error={error} />
      {loading ? (
        <p className="muted">Memuat...</p>
      ) : items.length === 0 ? (
        <p className="muted">Belum ada UMKM di kategori ini.</p>
      ) : (
        <div className="grid">
          {items.map((b) => (
            <Link key={b.slug} to={`/u/${b.slug}`} className="card biz-card">
              <span className="badge">{CATEGORIES[b.category] || b.category}</span>
              <h3>{b.name}</h3>
              {b.address && <p className="muted">{b.address}</p>}
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

