import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api, TOKEN_KEY } from '../api/client.js'
import { AuthLayout } from '../components/Layout.jsx'
import { Alert, Button, Field } from '../components/ui.jsx'

const CATEGORIES = [
  ['barbershop', 'Barbershop'],
  ['salon', 'Salon'],
  ['bengkel', 'Bengkel'],
  ['studio_foto', 'Studio Foto'],
  ['lainnya', 'Lainnya'],
]

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
    <AuthLayout title="Masuk Pemilik UMKM">
      <form onSubmit={submit}>
        <Alert error={error} />
        <Field label="Email" id="email" type="email" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Field label="Password" id="password" type="password" required value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Button type="submit" loading={loading}>Masuk</Button>
      </form>
      <p>Belum punya akun? <Link to="/owner/register">Daftar</Link></p>
    </AuthLayout>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ businessName: '', category: 'barbershop', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

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
    <AuthLayout title="Daftar Pemilik UMKM">
      <form onSubmit={submit}>
        <Alert error={error} />
        <Field label="Nama usaha" id="businessName" required value={form.businessName} onChange={set('businessName')} />
        <Field label="Kategori" id="category">
          <select id="category" value={form.category} onChange={set('category')}>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Email" id="email" type="email" required value={form.email} onChange={set('email')} />
        <Field label="Password (min. 8 karakter)" id="password" type="password" minLength={8} required
          value={form.password} onChange={set('password')} />
        <Button type="submit" loading={loading}>Daftar</Button>
      </form>
      <p>Sudah punya akun? <Link to="/owner/login">Masuk</Link></p>
    </AuthLayout>
  )
}

