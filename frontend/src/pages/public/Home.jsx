import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, CATEGORY_META, getCategoryMeta, listBusinesses } from '../../api/public.js'
import { Alert } from '../../components/ui.jsx'
import HomeIntro from '../../components/HomeIntro.jsx'
import { BusinessesMap } from '../../components/Maps.jsx'
import { toLatLng } from '../../api/geo.js'
import { useSwipe } from '../../hooks/useSwipe.js'

const CATEGORY_ORDER = ['', ...Object.keys(CATEGORIES)]

export default function Home() {
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [showAllCats, setShowAllCats] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('list') // 'list' | 'map'
  const [userPos, setUserPos] = useState(null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState('')
  const catalogRef = useRef(null)

  function locateMe() {
    if (userPos) { setUserPos(null); return } // matikan urut terdekat
    if (!navigator.geolocation) { setGeoError('Browser tidak mendukung deteksi lokasi.'); return }
    setLocating(true); setGeoError('')
    navigator.geolocation.getCurrentPosition(
      (p) => { setUserPos([Number(p.coords.latitude.toFixed(6)), Number(p.coords.longitude.toFixed(6))]); setLocating(false) },
      () => { setGeoError('Gagal mengambil lokasi. Pastikan izin lokasi diaktifkan.'); setLocating(false) },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  function scrollToCatalog() {
    catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    const meta = CATEGORY_META[category] || CATEGORY_META['']
    document.body.dataset.category = category || 'all'
    document.body.className = meta.themeClass
    return () => {
      delete document.body.dataset.category
      document.body.className = ''
    }
  }, [category])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    listBusinesses(category, userPos)
      .then((rows) => alive && setItems(rows))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [category, userPos])

  const activeMeta = CATEGORY_META[category] || CATEGORY_META['']
  const query = search.trim().toLowerCase()
  const filteredItems = query
    ? items.filter(
        (b) =>
          b.name.toLowerCase().includes(query) ||
          (b.address && b.address.toLowerCase().includes(query)) ||
          (CATEGORIES[b.category] || '').toLowerCase().includes(query),
      )
    : items

  const allCategoryEntries = [
    ['', CATEGORY_META['']],
    ...Object.entries(CATEGORIES).map(([k]) => [k, getCategoryMeta(k)]),
  ]
  const visibleCategories = showAllCats ? allCategoryEntries : allCategoryEntries.slice(0, 8)
  const isSelectedHidden =
    !showAllCats && category !== '' && !visibleCategories.some(([k]) => k === category)
  const displayedCategories = isSelectedHidden
    ? [...visibleCategories.slice(0, 7), [category, getCategoryMeta(category)]]
    : visibleCategories

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => {
      const idx = CATEGORY_ORDER.indexOf(category)
      if (idx < CATEGORY_ORDER.length - 1) setCategory(CATEGORY_ORDER[idx + 1])
    },
    onSwipeRight: () => {
      const idx = CATEGORY_ORDER.indexOf(category)
      if (idx > 0) setCategory(CATEGORY_ORDER[idx - 1])
    },
  })

  return (
    <div {...swipeHandlers}>
      <HomeIntro onStartBooking={scrollToCatalog} />

      <div id="katalog-umkm" ref={catalogRef} className="catalog-anchor">
        <section
          className="hero-banner"
          style={{ backgroundImage: `url('${activeMeta.image}')` }}
        >
        <div className="hero-overlay">
          <span className="hero-pill">
            {activeMeta.icon} {activeMeta.label}
          </span>
          <h1>Reservasi UMKM Tanpa Antre</h1>
          <p>{activeMeta.tagline}</p>

          <div className="hero-search-wrap">
            <span className="hero-search-icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              className="hero-search-input"
              placeholder="Cari nama usaha, layanan, atau lokasi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cari UMKM"
            />
            {search && (
              <button
                type="button"
                className="hero-search-clear"
                onClick={() => setSearch('')}
                aria-label="Hapus pencarian"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </section>
      </div>

      <section className="cat-explorer" aria-label="Jelajahi Kategori Usaha">
        <div className="cat-explorer-head">
          <div>
            <h2>🗂️ Jelajahi Kategori Usaha</h2>
            <p className="muted">Pilih kategori layanan atau geser untuk menemukan UMKM terdekat.</p>
          </div>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => setShowAllCats((v) => !v)}
          >
            {showAllCats ? 'Ringkas ▲' : `Lihat Semua (${Object.keys(CATEGORIES).length}) ▾`}
          </button>
        </div>

        <div className="cat-tile-grid" role="group" aria-label="Filter kategori">
          {displayedCategories.map(([k, meta], idx) => (
            <button
              key={k || 'all'}
              type="button"
              className={`cat-tile ${category === k ? 'active' : ''}`}
              style={{ '--stagger-i': idx }}
              onClick={() => setCategory(k)}
            >
              <span
                className="cat-tile-bg"
                style={{ backgroundImage: `url('${meta.image}')` }}
                aria-hidden="true"
              />
              <span className="cat-tile-icon">{meta.icon}</span>
              <span className="cat-tile-label">{k === '' ? 'Semua' : meta.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="map-toolbar">
        <div className="map-toggle" role="group" aria-label="Tampilan">
          <button type="button" className={`btn small ${view === 'list' ? '' : 'secondary'}`} onClick={() => setView('list')}>☰ Daftar</button>
          <button type="button" className={`btn small ${view === 'map' ? '' : 'secondary'}`} onClick={() => setView('map')}>🗺️ Peta</button>
        </div>
        <button type="button" className={`btn small ${userPos ? 'success' : 'secondary'}`} onClick={locateMe} disabled={locating}>
          {locating ? 'Mencari lokasi...' : userPos ? '✓ Urut Terdekat (matikan)' : '📍 UMKM Terdekat'}
        </button>
      </div>
      <Alert error={geoError} />

      <Alert error={error} />
      {loading ? (
        <p className="muted">Memuat daftar UMKM...</p>
      ) : view === 'map' ? (
        (() => {
          const mapItems = filteredItems
            .map((b) => ({
              slug: b.slug,
              name: b.name,
              position: toLatLng(b.latitude, b.longitude),
              subtitle: `${getCategoryMeta(b.category).icon} ${CATEGORIES[b.category] || b.category}`,
              distance: b.distance_km != null ? Number(b.distance_km) : null,
            }))
            .filter((i) => i.position)
          return (
            <div className="card">
              <BusinessesMap
                items={mapItems}
                userPosition={userPos}
                renderLink={(i) => <Link className="btn small" to={`/u/${i.slug}`}>Lihat &amp; Booking →</Link>}
              />
              <p className="muted map-coords">
                {mapItems.length} dari {filteredItems.length} UMKM memiliki titik lokasi di peta.
              </p>
            </div>
          )
        })()
      ) : filteredItems.length === 0 ? (
        <div className="card center empty-state">
          <p className="muted">
            {query
              ? `Tidak ada UMKM yang cocok dengan "${search}".`
              : 'Belum ada UMKM di kategori ini.'}
          </p>
          {(category || query) && (
            <button
              type="button"
              className="btn secondary small"
              onClick={() => {
                setCategory('')
                setSearch('')
              }}
            >
              Tampilkan Semua UMKM
            </button>
          )}
        </div>
      ) : (
        <div key={`${category || 'all'}-${query}`} className="grid stagger-grid">
          {filteredItems.map((b, idx) => {
            const meta = getCategoryMeta(b.category)
            return (
              <Link
                key={b.slug}
                to={`/u/${b.slug}`}
                className="card biz-card"
                style={{ '--stagger-i': idx }}
              >
                <div
                  className="biz-card-cover"
                  style={{ backgroundImage: `url('${meta.image}')` }}
                >
                  <span className={`badge cat-badge cat-${b.category}`}>
                    {meta.icon} {CATEGORIES[b.category] || b.category}
                  </span>
                </div>
                <div className="biz-card-body">
                  <h3>{b.name}</h3>
                  <p className="muted">
                    {b.address ? `📍 ${b.address}` : '📍 Lokasi tersedia di profil'}
                  </p>
                  {b.distance_km != null && (
                    <p className="biz-distance">🚶 {Number(b.distance_km).toLocaleString('id-ID')} km dari Anda</p>
                  )}
                  <span className="biz-card-cta">Lihat Layanan &amp; Booking →</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
