import { useState } from 'react'
import { api } from '../api/client.js'
import { Button, DataTable, rupiah } from '../components/ui.jsx'

export const STATUS_LABEL = {
  menunggu: 'Menunggu',
  dikonfirmasi: 'Dikonfirmasi',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}

// Aksi valid per status (sesuai aturan transisi backend)
const ACTIONS = {
  menunggu: [
    { key: 'confirm', label: 'Konfirmasi', variant: 'success' },
    { key: 'cancel', label: 'Batalkan', variant: 'danger' },
  ],
  dikonfirmasi: [
    { key: 'complete', label: 'Selesai', variant: '' },
    { key: 'cancel', label: 'Batalkan', variant: 'danger' },
  ],
}

export default function BookingTable({ rows, onChanged, onError, empty }) {
  const [busy, setBusy] = useState(null)

  async function act(b, a) {
    if (a.key === 'cancel' && !window.confirm(`Batalkan reservasi ${b.code}?`)) return
    setBusy(b.id)
    onError('')
    try {
      await api(`/bookings/${b.id}/${a.key}`, { method: 'POST' })
      await onChanged()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <DataTable
      rows={rows}
      empty={empty}
      columns={[
        { header: 'Kode', render: (b) => <strong>{b.code}</strong> },
        { header: 'Waktu', render: (b) => b.startAt.slice(0, 16) },
        { header: 'Pelanggan', render: (b) => <>{b.customerName}<br /><span className="muted">{b.customerPhone}</span></> },
        { header: 'Layanan', render: (b) => <>{b.serviceName}{b.price != null && <><br /><span className="muted">{rupiah(b.price)}</span></>}</> },
        { header: 'Status', render: (b) => <span className={`badge ${b.status}`}>{STATUS_LABEL[b.status] || b.status}</span> },
        {
          header: 'Aksi',
          render: (b) => (ACTIONS[b.status] || []).map((a) => (
            <Button key={a.key} small variant={a.variant} disabled={busy === b.id} onClick={() => act(b, a)}>
              {a.label}
            </Button>
          )),
        },
      ]}
    />
  )
}
