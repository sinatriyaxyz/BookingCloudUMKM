import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import BookingTable from '../components/BookingTable.jsx'
import { Alert, Button } from '../components/ui.jsx'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api('/dashboard'))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const c = data?.counts
  return (
    <>
      <div className="section-header">
        <div>
          <h2>📊 Ringkasan Hari Ini</h2>
          <p className="muted" style={{ margin: 0 }}>Pantau dan konfirmasi reservasi pelanggan yang masuk hari ini.</p>
        </div>
        <Button variant="secondary" onClick={load} loading={loading}>↻ Muat ulang</Button>
      </div>
      <Alert error={error} />
      <div className="stats">
        <div className="stat stat-warn">
          <span className="stat-label">⏳ Menunggu Konfirmasi</span>
          <div className="num">{c?.menunggu ?? '-'}</div>
        </div>
        <div className="stat stat-info">
          <span className="stat-label">✅ Dikonfirmasi</span>
          <div className="num">{c?.dikonfirmasi ?? '-'}</div>
        </div>
        <div className="stat stat-primary">
          <span className="stat-label">📅 Total Hari Ini</span>
          <div className="num">{c?.hari_ini ?? '-'}</div>
        </div>
      </div>
      <div className="card">
        <h3>📋 Daftar Reservasi Hari Ini</h3>
        <BookingTable
          rows={data?.today ?? []}
          onChanged={load}
          onError={setError}
          empty="Tidak ada reservasi terjadwal untuk hari ini."
        />
      </div>
    </>
  )
}
