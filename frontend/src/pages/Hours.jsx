import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { Alert, Button, DataTable, Field } from '../components/ui.jsx'

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export default function Hours() {
  const [hours, setHours] = useState([])
  const [holidays, setHolidays] = useState([])
  const [hForm, setHForm] = useState({ date: '', note: '' })
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [saving, setSaving] = useState(false)

  const loadHolidays = useCallback(() => {
    api('/holidays').then(setHolidays).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    api('/operating-hours').then(setHours).catch((e) => setError(e.message))
    loadHolidays()
  }, [loadHolidays])

  const update = (i, patch) => setHours(hours.map((h, idx) => (idx === i ? { ...h, ...patch } : h)))

  async function saveHours() {
    setError(''); setOk(''); setSaving(true)
    try {
      const d = await api('/operating-hours', { method: 'PUT', body: hours })
      setHours(d)
      setOk('Jam operasional disimpan.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function addHoliday(e) {
    e.preventDefault()
    setError(''); setOk('')
    try {
      await api('/holidays', { method: 'POST', body: { date: hForm.date, note: hForm.note } })
      setHForm({ date: '', note: '' })
      loadHolidays()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeHoliday(h) {
    if (!window.confirm(`Hapus libur ${h.date}?`)) return
    setError('')
    try {
      await api(`/holidays/${h.id}`, { method: 'DELETE' })
      loadHolidays()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="card">
        <h2>Jam operasional</h2>
        <Alert error={error} success={ok} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Hari</th><th>Buka</th><th>Tutup</th><th>Libur</th></tr>
            </thead>
            <tbody>
              {hours.map((h, i) => (
                <tr key={h.weekday}>
                  <td>{DAYS[h.weekday]}</td>
                  <td>
                    <input type="time" aria-label={`Buka ${DAYS[h.weekday]}`} value={h.open_time}
                      disabled={h.is_closed} onChange={(e) => update(i, { open_time: e.target.value })} />
                  </td>
                  <td>
                    <input type="time" aria-label={`Tutup ${DAYS[h.weekday]}`} value={h.close_time}
                      disabled={h.is_closed} onChange={(e) => update(i, { close_time: e.target.value })} />
                  </td>
                  <td>
                    <input type="checkbox" aria-label={`Libur ${DAYS[h.weekday]}`} checked={h.is_closed}
                      onChange={(e) => update(i, { is_closed: e.target.checked })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button onClick={saveHours} loading={saving}>Simpan jam operasional</Button>
      </div>

      <div className="card">
        <h3>Tanggal libur</h3>
        <form onSubmit={addHoliday}>
          <div className="row">
            <Field label="Tanggal" id="hdate" type="date" required value={hForm.date}
              onChange={(e) => setHForm({ ...hForm, date: e.target.value })} />
            <Field label="Catatan" id="hnote" maxLength={255} value={hForm.note}
              onChange={(e) => setHForm({ ...hForm, note: e.target.value })} />
          </div>
          <Button type="submit">Tambah libur</Button>
        </form>
        <DataTable
          rows={holidays}
          empty="Belum ada tanggal libur."
          columns={[
            { header: 'Tanggal', render: (h) => h.date },
            { header: 'Catatan', render: (h) => h.note || '-' },
            { header: 'Aksi', render: (h) => <Button small variant="danger" onClick={() => removeHoliday(h)}>Hapus</Button> },
          ]}
        />
      </div>
    </>
  )
}
