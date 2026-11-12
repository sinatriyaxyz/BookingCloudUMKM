import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { TOKEN_KEY } from '../api/client.js'

export function ProtectedLayout() {
  const navigate = useNavigate()
  if (!localStorage.getItem(TOKEN_KEY)) return <Navigate to="/owner/login" replace />

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    navigate('/owner/login')
  }

  return (
    <>
      <header className="topbar">
        <div className="container">
          <span className="brand">BookingCloud</span>
          <NavLink to="/owner" end>Dashboard</NavLink>
          <NavLink to="/owner/riwayat">Riwayat</NavLink>
          <NavLink to="/owner/layanan">Layanan</NavLink>
          <NavLink to="/owner/jam">Jam &amp; Libur</NavLink>
          <NavLink to="/owner/profil">Profil</NavLink>
          <button className="btn secondary small" onClick={logout}>Keluar</button>
        </div>
      </header>
      <main className="container"><Outlet /></main>
    </>
  )
}

export function AuthLayout({ title, children }) {
  return (
    <div className="container">
      <div className="card auth-box">
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}
