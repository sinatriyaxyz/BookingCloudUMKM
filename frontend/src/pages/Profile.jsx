import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { CATEGORIES, getCategoryMeta } from '../api/public.js'
import { Alert, Button, Field } from '../components/ui.jsx'
import { LocationPicker } from '../components/Maps.jsx'
import { toLatLng } from '../api/geo.js'

export default function Profile() {
  const [me, setMe] = useState(null)
  const [form, setForm] = useState({ name: '', category: 'barbershop', address: '', phone: '', location: null })
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api('/me').then((d) => {
      setMe(d)
      setForm({
        name: d.name || '',
        category: d.category || 'barbershop',
        address: d.address || '',
        phone: d.phone || '',
        location: toLatLng(d.latitude, d.longitude),
      })
    }).catch((e) => setError(e.message))
  }, [])

  async function submit(e) {
    e.preventDefault()
    setError(''); setOk(''); setLoading(true)
    try {
      const d = await api('/me/profile', {
        method: 'PUT',
        body: {
          name: form.name,
          category: form.category,
          address: form.address || null,
          phone: form.phone || null,
          latitude: form.location ? form.location[0] : null,
          longitude: form.location ? form.location[1] : null,
        },
      })
      setMe(d)
      setOk('Profil disimpan.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const link = me ? `${window.location.origin}/u/${me.slug}` : ''

  return (
    <div className="card">
      <h2>🏪 Profil UMKM</h2>
      <p className="muted" style={{ marginTop: 0 }}>Informasi ini ditampilkan pada halaman booking publik usaha Anda.</p>
      <Alert error={error} success={ok} />
      {me && (
        <div className="public-link-box">
          <span>🌐 Tautan Booking Pelanggan:</span>
          <a href={link} target="_blank" rel="noreferrer"><strong>{link}</strong> ↗</a>
        </div>
      )}
      <form onSubmit={submit}>
        <Field label="Nama Usaha" id="name" required value={form.name} onChange={set('name')} />
        <Field label="Kategori Usaha" id="category">
          <select id="category" value={form.category} onChange={set('category')}>
            {Object.entries(CATEGORIES).map(([k, label]) => (
              <option key={k} value={k}>
                {getCategoryMeta(k).icon} {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Alamat Lengkap" id="address" placeholder="Contoh: Jl. Merdeka No. 10, Bandung" value={form.address} onChange={set('address')} />
        {me && (
          <LocationPicker
            value={form.location}
            address={form.address}
            onChange={(location) => setForm((f) => ({ ...f, location }))}
          />
        )}
        <Field label="Nomor Telepon / WhatsApp" id="phone" placeholder="08xxxxxxxxxx" value={form.phone} onChange={set('phone')} />
        <Button type="submit" loading={loading}>✓ Simpan Profil</Button>
      </form>
    </div>
  )
}
