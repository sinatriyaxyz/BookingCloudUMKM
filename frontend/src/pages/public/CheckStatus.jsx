import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cancelBookingByCode, formatWib, getBookingByCode } from '../../api/public.js'
import { Alert, Button, Field } from '../../components/ui.jsx'
import { STATUS_LABEL } from '../../components/BookingTable.jsx'

const CANCELLABLE = ['menunggu', 'dikonfirmasi']

export default function CheckStatus() {
  const [params, setParams] = useSearchParams()
  const [code, setCode] = useState(params.get('kode') || '')
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const lookup = useCallback(async (c) => {
    const k = c.trim().toUpperCase()
    if (!k) return
    setLoading(true)
    setError('')
    setSuccess('')
    setBooking(null)
    try {
      setBooking(await getBookingByCode(k))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const k = params.get('kode')
    if (k) lookup(k)
  }, [params, lookup])

  function submit(e) {
    e.preventDefault()
    setParams({ kode: code.trim().toUpperCase() })
  }

  async function cancel() {
    if (!window.confirm(`Batalkan reservasi ${booking.code}?`)) return
    setCancelling(true)
    setError('')
    setSuccess('')
    try {
      const res = await cancelBookingByCode(booking.code)
      setBooking({ ...booking, status: res.status })
      setSuccess(res.message || 'Reservasi berhasil dibatalkan.')
    } catch (e) {
      setError(e.message)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
      <h2>Cek Status Booking</h2>
      <form className="card" onSubmit={submit}>
        <Field
          label="Kode booking"
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Contoh: AB23CD45"
          maxLength={20}
          autoCapitalize="characters"
          required
        />
        <Button type="submit" loading={loading}>Cek</Button>
      </form>
      <Alert error={error} success={success} />
      {booking && (
        <div className="card">
          <div className="code-big small">{booking.code}</div>
          <p>
            Status: <span className={`badge ${booking.status}`}>{STATUS_LABEL[booking.status] || booking.status}</span>
          </p>
          <dl className="details">
            <dt>UMKM</dt><dd>{booking.businessName}</dd>
            <dt>Layanan</dt><dd>{booking.serviceName}</dd>
            <dt>Nama</dt><dd>{booking.customerName}</dd>
            <dt>Waktu</dt><dd>{formatWib(booking.startAt)}</dd>
          </dl>
          {CANCELLABLE.includes(booking.status) && (
            <>
              <Button variant="danger" loading={cancelling} onClick={cancel}>Batalkan</Button>
              <p className="muted">Pembatalan hanya bisa dilakukan paling lambat 2 jam sebelum jam reservasi.</p>
            </>
          )}
        </div>
      )}
    </>
  )
}

