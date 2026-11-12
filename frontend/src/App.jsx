import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { ProtectedLayout, PublicLayout } from './components/Layout.jsx'
import { LoginPage, RegisterPage } from './pages/Auth.jsx'
import Dashboard from './pages/Dashboard.jsx'
import History from './pages/History.jsx'
import Profile from './pages/Profile.jsx'
import Services from './pages/Services.jsx'
import Hours from './pages/Hours.jsx'
import Home from './pages/public/Home.jsx'
import BusinessPage from './pages/public/BusinessPage.jsx'
import Booking from './pages/public/Booking.jsx'
import BookingSuccess from './pages/public/BookingSuccess.jsx'
import CheckStatus from './pages/public/CheckStatus.jsx'

function LegacyBizRedirect() {
  const { slug } = useParams()
  return <Navigate to={`/u/${slug}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="/u/:slug" element={<BusinessPage />} />
          <Route path="/u/:slug/booking" element={<Booking />} />
          <Route path="/sukses/:code" element={<BookingSuccess />} />
          <Route path="/cek" element={<CheckStatus />} />
          <Route path="/b/:slug" element={<LegacyBizRedirect />} />
        </Route>
        <Route path="/owner/login" element={<LoginPage />} />
        <Route path="/owner/register" element={<RegisterPage />} />
        <Route path="/owner" element={<ProtectedLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="riwayat" element={<History />} />
          <Route path="profil" element={<Profile />} />
          <Route path="layanan" element={<Services />} />
          <Route path="jam" element={<Hours />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
