import { useState } from 'react'
import { api } from '../api/client.js'
import { Button, DataTable, rupiah } from '../components/ui.jsx'

export const STATUS_LABEL = {
  menunggu: 'Menunggu',
  dikonfirmasi: 'Dikonfirmasi',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}

const STATUS_ICON = {
  menunggu: '⏳',
  dikonfirmasi: '✅',
  selesai: '🎉',
  dibatalkan: '❌',
}

// Aksi valid per status (sesuai aturan transisi backend)
const ACTIONS = {
  menunggu: [
    { key: 'confirm', label: '✓ Konfirmasi', variant: 'success' },
    { key: 'cancel', label: '✕ Batalkan', variant: 'danger' },
  ],
  dikonfirmasi: [
    { key: 'complete', label: '★ Selesai', variant: '' },
    { key: 'cancel', label: '✕ Batalkan', variant: 'danger' },
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
        { header: 'Kode', render: (b) => <span className="code-pill">{b.code}</span> },
        { header: 'Waktu (WIB)', render: (b) => <strong>{b.startAt.slice(0, 16)}</strong> },
        {
          header: 'Pelanggan',
          render: (b) => (
            <>
              <strong>{b.customerName}</strong>
              <br />
              <span className="muted">📞 {b.customerPhone}</span>
            </>
          ),
        },
        {
          header: 'Layanan',
          render: (b) => {
            const shownPrice = b.finalPrice != null ? b.finalPrice : b.price
            const hasDiscount = Number(b.discountAmount || 0) > 0
            return (
              <>
                <strong>{b.serviceName}</strong>
                {shownPrice != null && (
                  <>
                    <br />
                    <span className="muted">
                      {hasDiscount && (
                        <span style={{ textDecoration: 'line-through', marginRight: 5 }}>
                          {rupiah(b.originalPrice || b.price)}
                        </span>
                      )}
                      {rupiah(shownPrice)}
                    </span>
                    {hasDiscount && (
                      <span className="discount-tag" style={{ marginLeft: 5 }}>
                        -{rupiah(b.discountAmount)}
                      </span>
                    )}
                    {Number(b.pointsEarned || 0) > 0 && (
                      <span className="points-earned-pill" style={{ marginLeft: 5 }}>
                        +{b.pointsEarned} Poin
                      </span>
                    )}
                  </>
                )}
              </>
            )
          },
        },
        {
          header: 'Status',
          render: (b) => (
            <span className={`badge ${b.status}`}>
              {STATUS_ICON[b.status] || ''} {STATUS_LABEL[b.status] || b.status}
            </span>
          ),
        },
        {
          header: 'Aksi',
          render: (b) =>
            (ACTIONS[b.status] || []).length === 0 ? (
              <span className="muted">—</span>
            ) : (
              (ACTIONS[b.status] || []).map((a) => (
                <Button key={a.key} small variant={a.variant} disabled={busy === b.id} onClick={() => act(b, a)}>
                  {a.label}
                </Button>
              ))
            ),
        },
      ]}
    />
  )
}
