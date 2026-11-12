import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { Alert, Button, DataTable, Field, rupiah } from '../components/ui.jsx'

const EMPTY = { name: '', price: '', duration_min: '' }

export default function Services() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    api('/services').then(setItems).catch((e) => setError(e.message))
  }, [])
  useEffect(load, [load])

  async function submit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    const body = {
      name: form.name,
      price: Number(form.price),
      duration_min: Number(form.duration_min),
    }
    try {
      if (editId) await api(`/services/${editId}`, { method: 'PUT', body })
      else await api('/services', { method: 'POST', body })
      setForm(EMPTY); setEditId(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function remove(s) {
    if (!window.confirm(`Hapus layanan "${s.name}"?`)) return
    setError('')
    try {
      await api(`/services/${s.id}`, { method: 'DELETE' })
      if (editId === s.id) { setEditId(null); setForm(EMPTY) }
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  function edit(s) {
    setEditId(s.id)
    setForm({ name: s.name, price: String(s.price), duration_min: String(s.duration_min) })
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <>
      <div className="card">
        <h2>Layanan</h2>
        <Alert error={error} />
        <DataTable
          rows={items}
          empty="Belum ada layanan."
          columns={[
            { header: 'Nama', render: (s) => s.name },
            { header: 'Harga', render: (s) => rupiah(s.price) },
            { header: 'Durasi', render: (s) => `${s.duration_min} menit` },
            {
              header: 'Aksi',
              render: (s) => (
                <>
                  <Button small variant="secondary" onClick={() => edit(s)}>Ubah</Button>
                  <Button small variant="danger" onClick={() => remove(s)}>Hapus</Button>
                </>
              ),
            },
          ]}
        />
      </div>
      <div className="card">
        <h3>{editId ? 'Ubah layanan' : 'Tambah layanan'}</h3>
        <form onSubmit={submit}>
          <div className="row">
            <Field label="Nama" id="sname" required value={form.name} onChange={set('name')} />
            <Field label="Harga (Rp)" id="sprice" type="number" min="0" step="1" required
              value={form.price} onChange={set('price')} />
            <Field label="Durasi (menit)" id="sdur" type="number" min="1" step="1" required
              value={form.duration_min} onChange={set('duration_min')} />
          </div>
          <Button type="submit" loading={loading}>{editId ? 'Simpan perubahan' : 'Tambah'}</Button>
          {editId && (
            <Button type="button" variant="secondary" onClick={() => { setEditId(null); setForm(EMPTY) }}>
              Batal
            </Button>
          )}
        </form>
      </div>
    </>
  )
}
