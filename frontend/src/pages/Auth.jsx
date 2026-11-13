import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api, TOKEN_KEY } from '../api/client.js'
import { CATEGORIES, getCategoryMeta } from '../api/public.js'
import { AuthLayout } from '../components/Layout.jsx'
import { Alert, Button, Field } from '../components/ui.jsx'

const CATEGORY_OPTIONS = Object.entries(CATEGORIES).map(([k, label]) => [
  k,
  `${getCategoryMeta(k).icon} ${label}`,
])

async function doLogin(email, password) {
  const { token } = await api('/auth/login', { method: 'POST', body: { email, password } })
  localStorage.setItem(TOKEN_KEY, token)
}

export function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (localStorage.getItem(TOKEN_KEY)) return <Navigate to="/owner" replace />

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await doLogin(form.email, form.password)
      navigate('/owner')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Masuk Pemilik UMKM"
      subtitle="Kelola jadwal, layanan, dan reservasi pelanggan Anda di satu dashboard."
    >
      <form onSubmit={submit}>
        <Alert error={error} />
        <Field label="Email" id="email" type="email" placeholder="nama@umkm.id" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Field label="Password" id="password" type="password" placeholder="Masukkan password" required value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Button type="submit" loading={loading} style={{ width: '100%', marginTop: '.25rem' }}>
          Masuk ke Dashboard →
        </Button>
      </form>
      <p className="auth-footer">
        Belum punya akun usaha? <Link to="/owner/register"><strong>Daftar UMKM Baru</strong></Link>
      </p>
    </AuthLayout>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ businessName: '', category: 'barbershop', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const meta = getCategoryMeta(form.category)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api('/auth/register', { method: 'POST', body: form })
      await doLogin(form.email, form.password)
      navigate('/owner')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Daftar Pemilik UMKM"
      subtitle={meta.tagline}
      category={form.category}
    >
      <form onSubmit={submit}>
        <Alert error={error} />
        <Field label="Nama usaha" id="businessName" placeholder="Contoh: Barbershop Rapi Jaya" required value={form.businessName} onChange={set('businessName')} />
        <Field label="Kategori usaha" id="category">
          <select id="category" value={form.category} onChange={set('category')}>
            {CATEGORY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Email" id="email" type="email" placeholder="pemilik@umkm.id" required value={form.email} onChange={set('email')} />
        <Field label="Password (min. 8 karakter)" id="password" type="password" minLength={8} placeholder="Minimal 8 karakter" required
          value={form.password} onChange={set('password')} />
        <Button type="submit" loading={loading} style={{ width: '100%', marginTop: '.25rem' }}>
          Buat Akun UMKM →
        </Button>
      </form>
      <p className="auth-footer">
        Sudah punya akun? <Link to="/owner/login"><strong>Masuk di sini</strong></Link>
      </p>
    </AuthLayout>
  )
}
