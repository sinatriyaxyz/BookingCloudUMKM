import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedLayout } from './components/Layout.jsx'
import { LoginPage, RegisterPage } from './pages/Auth.jsx'
import Dashboard from './pages/Dashboard.jsx'
import History from './pages/History.jsx'
import Profile from './pages/Profile.jsx'
import Services from './pages/Services.jsx'
import Hours from './pages/Hours.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/owner/login" element={<LoginPage />} />
        <Route path="/owner/register" element={<RegisterPage />} />
        <Route path="/owner" element={<ProtectedLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="riwayat" element={<History />} />
          <Route path="profil" element={<Profile />} />
          <Route path="layanan" element={<Services />} />
          <Route path="jam" element={<Hours />} />
        </Route>
        <Route path="*" element={<Navigate to="/owner" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
