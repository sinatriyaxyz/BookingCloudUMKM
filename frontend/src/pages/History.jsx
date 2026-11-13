import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import BookingTable, { STATUS_LABEL } from '../components/BookingTable.jsx'
import { Alert, Button, Field } from '../components/ui.jsx'

const LIMIT = 10

export default function History() {
  const [filter, setFilter] = useState({ date: '', status: '' })
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api('/bookings', { query: { ...filter, page, limit: LIMIT } }))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filter, page])

  useEffect(() => { load() }, [load])

  const change = (k) => (e) => { setFilter({ ...filter, [k]: e.target.value }); setPage(1) }
  const totalPages = data?.totalPages || 1

  return (
    <div className="card">
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>📋 Riwayat Reservasi</h2>
          <p className="muted" style={{ margin: '.2rem 0 0' }}>Cari dan filter seluruh riwayat booking berdasarkan tanggal atau status.</p>
        </div>
        <Button variant="secondary" onClick={load} loading={loading}>↻ Muat ulang</Button>
      </div>
      <div className="filter-bar">
        <Field label="📅 Filter Tanggal" id="fdate" type="date" value={filter.date} onChange={change('date')} />
        <Field label="🏷️ Filter Status" id="fstatus">
          <select id="fstatus" value={filter.status} onChange={change('status')}>
            <option value="">Semua Status</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {(filter.date || filter.status) && (
          <div style={{ marginBottom: '.85rem' }}>
            <Button small variant="secondary" onClick={() => { setFilter({ date: '', status: '' }); setPage(1) }}>
              ✕ Reset Filter
            </Button>
          </div>
        )}
      </div>
      <Alert error={error} />
      <BookingTable rows={data?.bookings ?? []} onChanged={load} onError={setError} empty="Tidak ada data reservasi yang cocok." />
      <div className="pager">
        <Button small variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Sebelumnya</Button>
        <span className="pager-info">Halaman <strong>{page}</strong> dari <strong>{totalPages}</strong></span>
        <Button small variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Berikutnya →</Button>
      </div>
    </div>
  )
}
