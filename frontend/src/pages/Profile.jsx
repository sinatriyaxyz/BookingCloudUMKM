import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { Alert, Button, Field } from '../components/ui.jsx'

export default function Profile() {
  const [me, setMe] = useState(null)
  const [form, setForm] = useState({ name: '', address: '', phone: '' })
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api('/me').then((d) => {
      setMe(d)
      setForm({ name: d.name || '', address: d.address || '', phone: d.phone || '' })
    }).catch((e) => setError(e.message))
  }, [])

  async function submit(e) {
    e.preventDefault()
    setError(''); setOk(''); setLoading(true)
    try {
      const d = await api('/me/profile', {
        method: 'PUT',
        body: { name: form.name, address: form.address || null, phone: form.phone || null },
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
  const link = me ? `${window.location.origin}/b/${me.slug}` : ''

  return (
    <div className="card">
      <h2>Profil UMKM</h2>
      <Alert error={error} success={ok} />
      {me && (
        <p>Halaman publik: <a href={link} target="_blank" rel="noreferrer">{link}</a></p>
      )}
      <form onSubmit={submit}>
        <Field label="Nama usaha" id="name" required value={form.name} onChange={set('name')} />
        <Field label="Alamat" id="address" value={form.address} onChange={set('address')} />
        <Field label="Telepon" id="phone" value={form.phone} onChange={set('phone')} />
        <Button type="submit" loading={loading}>Simpan</Button>
      </form>
    </div>
  )
}
