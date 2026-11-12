import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { formatWib } from '../../api/public.js'

export default function BookingSuccess() {
  const { code } = useParams()
  const { state } = useLocation()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      // Fallback untuk browser tanpa Clipboard API (mis. HTTP non-localhost)
      const ta = document.createElement('textarea')
      ta.value = code
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card center">
      <h2>Booking berhasil dikirim 🎉</h2>
      <p>Simpan kode booking Anda:</p>
      <div className="code-big" data-testid="booking-code">{code}</div>
      <button className="btn" onClick={copy}>{copied ? 'Tersalin ✓' : 'Salin kode'}</button>
      {state?.startAt && (
        <p>
          {state.serviceName && <strong>{state.serviceName}</strong>}
          {state.businessName && <> di {state.businessName}</>}
          <br />
          {formatWib(state.startAt)}
        </p>
      )}
      <p className="muted">Status: Menunggu konfirmasi pemilik UMKM.</p>
      <p>
        <Link to={`/cek?kode=${code}`}>Cek status booking</Link> · <Link to="/">Kembali ke beranda</Link>
      </p>
    </div>
  )
}

