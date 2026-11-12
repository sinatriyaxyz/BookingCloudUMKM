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
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Dashboard</h2>
        <Button variant="secondary" onClick={load} loading={loading}>Muat ulang</Button>
      </div>
      <Alert error={error} />
      <div className="stats">
        <div className="stat"><div className="num">{c?.menunggu ?? '-'}</div>Menunggu</div>
        <div className="stat"><div className="num">{c?.dikonfirmasi ?? '-'}</div>Dikonfirmasi</div>
        <div className="stat"><div className="num">{c?.hari_ini ?? '-'}</div>Hari ini</div>
      </div>
      <div className="card">
        <h3>Reservasi hari ini</h3>
        <BookingTable
          rows={data?.today ?? []}
          onChanged={load}
          onError={setError}
          empty="Tidak ada reservasi hari ini."
        />
      </div>
    </>
  )
}
