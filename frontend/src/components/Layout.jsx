import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api, TOKEN_KEY } from '../api/client.js'
import { clearCustomerAuth, getCustomerToken, getStoredCustomer } from '../api/customer.js'
import { CATEGORIES, getCategoryMeta } from '../api/public.js'

export function RouteProgressBar() {
  const { pathname } = useLocation()
  return <div key={pathname} className="route-progress-bar" aria-hidden="true" />
}

export function ProtectedLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const hasToken = Boolean(localStorage.getItem(TOKEN_KEY))
  const [me, setMe] = useState(null)

  useEffect(() => {
    if (!hasToken) return
    let alive = true
    api('/me')
      .then((d) => {
        if (!alive) return
        setMe(d)
        const meta = getCategoryMeta(d.category)
        document.body.dataset.category = d.category
        document.body.className = meta.themeClass
      })
      .catch(() => {})
    return () => {
      alive = false
      delete document.body.dataset.category
      document.body.className = ''
    }
  }, [hasToken])

  if (!hasToken) return <Navigate to="/owner/login" replace />

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    navigate('/owner/login')
  }

  const meta = me ? getCategoryMeta(me.category) : getCategoryMeta('')

  return (
    <>
      <RouteProgressBar />
      <header className="topbar">
        <div className="container">
          <NavLink to="/owner" className="brand" end>
            ☁️ BookingCloud <span className="brand-sub">Panel UMKM</span>
          </NavLink>
          <NavLink to="/owner" end>📊 Dashboard</NavLink>
          <NavLink to="/owner/analisis">📈 Analisis</NavLink>
          <NavLink to="/owner/riwayat">📋 Riwayat</NavLink>
          <NavLink to="/owner/layanan">✂️ Layanan</NavLink>
          <NavLink to="/owner/jam">🕒 Jam &amp; Libur</NavLink>
          <NavLink to="/owner/profil">🏪 Profil</NavLink>
          <button className="btn secondary small" onClick={logout}>Keluar</button>
        </div>
      </header>
      <main className="container">
        {me && (
          <div
            className="owner-strip"
            style={{ backgroundImage: `url('${meta.image}')` }}
          >
            <div className="owner-strip-overlay">
              <div>
                <span className={`badge cat-badge cat-${me.category}`}>
                  {meta.icon} {CATEGORIES[me.category] || me.category}
                </span>
                <strong className="owner-biz-name">{me.name}</strong>
              </div>
              <Link className="btn small btn-light" to={`/u/${me.slug}`} target="_blank" rel="noreferrer">
                🌐 Lihat Halaman Publik ↗
              </Link>
            </div>
          </div>
        )}
        <div key={pathname} className="page-transition">
          <Outlet context={{ me, setMe }} />
        </div>
      </main>
    </>
  )
}

export function PublicTopbar() {
  const navigate = useNavigate()
  useLocation()
  const loggedIn = Boolean(getCustomerToken())
  const customer = loggedIn ? getStoredCustomer() : null

  function handleCustomerLogout() {
    clearCustomerAuth()
    navigate('/')
  }

  return (
    <header className="topbar">
      <div className="container">
        <NavLink to="/" className="brand" end>☁️ BookingCloud</NavLink>
        <NavLink to="/" end>🏠 Beranda</NavLink>
        <NavLink to="/cek">🔍 Cek Booking</NavLink>
        {loggedIn ? (
          <>
            <NavLink to="/booking-saya">📅 Booking Saya</NavLink>
            <NavLink to="/poin-voucher">🎁 Poin</NavLink>
            <span className="nav-user-pill" title={customer?.email || ''}>
              👤 {customer?.name || 'Pelanggan'}
            </span>
            <button type="button" className="btn secondary small" onClick={handleCustomerLogout}>
              Keluar
            </button>
          </>
        ) : (
          <>
            <NavLink to="/masuk">Masuk</NavLink>
            <NavLink to="/daftar" className="nav-cta-pill">Daftar</NavLink>
          </>
        )}
        <NavLink to="/owner" className="nav-owner-link">🔐 Pemilik UMKM</NavLink>
      </div>
    </header>
  )
}

export function PublicLayout() {
  const { pathname } = useLocation()
  return (
    <>
      <RouteProgressBar />
      <PublicTopbar />
      <main className="container">
        <div key={pathname} className="page-transition">
          <Outlet />
        </div>
      </main>
    </>
  )
}

export function AuthLayout({ title, subtitle, category = '', children }) {
  const meta = getCategoryMeta(category)

  useEffect(() => {
    document.body.dataset.category = category || 'all'
    document.body.className = meta.themeClass
    return () => {
      delete document.body.dataset.category
      document.body.className = ''
    }
  }, [category, meta.themeClass])

  return (
    <>
      <RouteProgressBar />
      <header className="topbar">
        <div className="container">
          <NavLink to="/" className="brand" end>☁️ BookingCloud</NavLink>
          <NavLink to="/" end>🏠 Beranda</NavLink>
          <NavLink to="/cek">🔍 Cek Booking</NavLink>
          <NavLink to="/owner/login">🔐 Pemilik UMKM</NavLink>
        </div>
      </header>
      <main className="container">
        <div className="card auth-box auth-card">
          <div
            className="auth-cover"
            style={{ backgroundImage: `url('${meta.image}')` }}
          >
            <div className="auth-cover-overlay">
              <span className="hero-pill">{meta.icon} Portal Pemilik UMKM</span>
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
          <div className="auth-body">
            {children}
          </div>
        </div>
      </main>
    </>
  )
}
