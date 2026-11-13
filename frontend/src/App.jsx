import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { ProtectedLayout, PublicLayout } from './components/Layout.jsx'
import { LoginPage, RegisterPage } from './pages/Auth.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Analytics from './pages/Analytics.jsx'
import History from './pages/History.jsx'
import Profile from './pages/Profile.jsx'
import Services from './pages/Services.jsx'
import Hours from './pages/Hours.jsx'
import Home from './pages/public/Home.jsx'
import BusinessPage from './pages/public/BusinessPage.jsx'
import Booking from './pages/public/Booking.jsx'
import BookingSuccess from './pages/public/BookingSuccess.jsx'
import CheckStatus from './pages/public/CheckStatus.jsx'
import CustomerAuth from './pages/public/CustomerAuth.jsx'
import MyBookings from './pages/public/MyBookings.jsx'
import Loyalty from './pages/public/Loyalty.jsx'

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
          <Route path="/booking-saya" element={<MyBookings />} />
          <Route path="/poin-voucher" element={<Loyalty />} />
          <Route path="/b/:slug" element={<LegacyBizRedirect />} />
        </Route>
        <Route path="/masuk" element={<CustomerAuth mode="login" />} />
        <Route path="/daftar" element={<CustomerAuth mode="register" />} />
        <Route path="/login" element={<Navigate to="/masuk" replace />} />
        <Route path="/register" element={<Navigate to="/daftar" replace />} />
        <Route path="/owner/login" element={<LoginPage />} />
        <Route path="/owner/register" element={<RegisterPage />} />
        <Route path="/owner" element={<ProtectedLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="analisis" element={<Analytics />} />
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
