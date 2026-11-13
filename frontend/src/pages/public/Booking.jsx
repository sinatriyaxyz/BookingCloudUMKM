import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  clearCustomerAuth,
  estimateVoucherDiscount,
  getCustomerLoyalty,
  getCustomerMe,
  getCustomerToken,
  getStoredCustomer,
} from '../../api/customer.js'
import { CATEGORIES, createBooking, getAvailability, getBusiness, getCategoryMeta, todayWib } from '../../api/public.js'
import { Alert, Button, Field, rupiah } from '../../components/ui.jsx'

export default function Booking() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const isLoggedIn = Boolean(getCustomerToken())
  const storedCustomer = getStoredCustomer()

  const [biz, setBiz] = useState(null)
  const [customer, setCustomer] = useState(storedCustomer)
  const [serviceId, setServiceId] = useState(params.get('layanan') || '')
  const [date, setDate] = useState(todayWib())
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [time, setTime] = useState('')
  const [name, setName] = useState(storedCustomer?.name || '')
  const [phone, setPhone] = useState(storedCustomer?.phone || '')
  const [myVouchers, setMyVouchers] = useState([])
  const [customerPoints, setCustomerPoints] = useState(storedCustomer?.points || 0)
  const [selectedVoucherId, setSelectedVoucherId] = useState('')
  const [error, setError] = useState('')
  const [slotError, setSlotError] = useState('')
  const [notice, setNotice] = useState('')
  const [sending, setSending] = useState(false)
  const reqId = useRef(0)

  const loginRedirectUrl = `/masuk?redirect=${encodeURIComponent(location.pathname + location.search)}`

  useEffect(() => {
    if (!isLoggedIn) return
    getBusiness(slug).then(setBiz).catch((e) => setError(e.message))
    getCustomerMe()
      .then((me) => {
        if (!me) return
        setCustomer(me)
        setName((prev) => prev || me.name || '')
        setPhone((prev) => prev || me.phone || '')
      })
      .catch((err) => {
        if (err.status === 401) {
          clearCustomerAuth()
          navigate(loginRedirectUrl, { replace: true })
        }
      })
    getCustomerLoyalty()
      .then((res) => {
        setCustomerPoints(Number(res.points || 0))
        setMyVouchers((res.myVouchers || []).filter((v) => v.status === 'tersedia'))
      })
      .catch(() => {})
  }, [slug, isLoggedIn, navigate, loginRedirectUrl])

  useEffect(() => {
    if (!biz) return
    const meta = getCategoryMeta(biz.category)
    document.body.dataset.category = biz.category
    document.body.className = meta.themeClass
    return () => {
      delete document.body.dataset.category
      document.body.className = ''
    }
  }, [biz])

  const loadSlots = useCallback(async () => {
    if (!serviceId || !date) {
      setSlots([])
      return
    }
    const id = ++reqId.current
    setSlotsLoading(true)
    setSlotError('')
    try {
      const res = await getAvailability(slug, serviceId, date)
      if (id === reqId.current) setSlots(res.slots)
    } catch (e) {
      if (id === reqId.current) {
        setSlots([])
        setSlotError(e.message)
      }
    } finally {
      if (id === reqId.current) setSlotsLoading(false)
    }
  }, [slug, serviceId, date])

  useEffect(() => {
    setTime('')
    loadSlots()
  }, [loadSlots])

  async function submit(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    if (!time) {
      setError('Pilih jam terlebih dahulu.')
      return
    }
    setSending(true)
    try {
      const res = await createBooking(slug, {
        serviceId: Number(serviceId),
        date,
        time,
        customerName: name,
        customerPhone: phone,
        customerVoucherId: activeVoucher ? activeVoucher.id : undefined,
      })
      const service = biz.services.find((s) => String(s.id) === String(serviceId))
      navigate(`/sukses/${res.code}`, {
        state: { ...res, businessName: biz.name, serviceName: service?.name },
      })
    } catch (err) {
      if (err.status === 401) {
        clearCustomerAuth()
        navigate(loginRedirectUrl, { replace: true })
        return
      }
      if (err.code === 'SLOT_TAKEN') {
        setNotice(`${err.message} Jam kosong sudah dimuat ulang.`)
        setTime('')
        await loadSlots()
      } else {
        setError(err.message)
      }
    } finally {
      setSending(false)
    }
  }

  if (!isLoggedIn) return <Navigate to={loginRedirectUrl} replace />
  if (!biz) return error ? <Alert error={error} /> : <p className="muted">Memuat...</p>

  const selected = biz.services.find((s) => String(s.id) === String(serviceId))
  const meta = getCategoryMeta(biz.category)
  const stepDone = [Boolean(selected), Boolean(selected && date), Boolean(selected && date && time), Boolean(selected && date && time && name && phone)]
  const rawPrice = Number(selected?.price || 0)
  const chosenVoucher = myVouchers.find((v) => String(v.id) === String(selectedVoucherId)) || null
  const voucherEval = selected && chosenVoucher ? estimateVoucherDiscount(chosenVoucher, rawPrice) : null
  const activeVoucher = voucherEval?.valid ? chosenVoucher : null
  const discountAmount = voucherEval?.valid ? voucherEval.discountAmount : 0
  const finalPrice = voucherEval?.valid ? voucherEval.finalPrice : rawPrice
  const estimatedPoints = selected ? Math.max(10, Math.floor(finalPrice / 1000)) : 0

  return (
    <>
      <p className="back-nav"><Link to={`/u/${slug}`}>← Kembali ke {biz.name}</Link></p>
      <div
        className="card biz-hero compact"
        style={{ backgroundImage: `url('${meta.image}')` }}
      >
        <div className="biz-hero-overlay">
          <span className={`badge cat-badge cat-${biz.category}`}>
            {meta.icon} {CATEGORIES[biz.category] || biz.category}
          </span>
          <h2>Booking di {biz.name}</h2>
          {biz.address && <p className="biz-hero-sub">📍 {biz.address}</p>}
        </div>
      </div>

      <div className="booking-stepper" aria-label="Progres pemesanan">
        {['Layanan', 'Tanggal', 'Jam', 'Konfirmasi'].map((label, i) => (
          <div key={label} className={`step-pill ${stepDone[i] ? 'done' : ''}`}>
            <span className="step-num">{stepDone[i] ? '✓' : i + 1}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <h3>1. Pilih layanan</h3>
          {biz.services.length === 0 && <p className="muted">Belum ada layanan.</p>}
          <div className="options">
            {biz.services.map((s) => (
              <label key={s.id} className={`option ${String(s.id) === String(serviceId) ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="service"
                  value={s.id}
                  checked={String(s.id) === String(serviceId)}
                  onChange={() => setServiceId(String(s.id))}
                />
                <span>
                  <strong>{s.name}</strong>
                  <br />
                  <span className="muted">{s.duration_min} menit · {rupiah(s.price)}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>2. Pilih tanggal</h3>
          <Field
            label="Tanggal"
            id="date"
            type="date"
            min={todayWib()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="card">
          <h3>3. Pilih jam</h3>
          <Alert error={notice} />
          {!selected ? (
            <p className="muted">Pilih layanan terlebih dahulu.</p>
          ) : slotsLoading ? (
            <p className="muted">Memuat jam kosong...</p>
          ) : slotError ? (
            <Alert error={slotError} />
          ) : slots.length === 0 ? (
            <p className="muted">Tidak ada jam kosong pada tanggal ini (tutup, libur, atau penuh). Coba tanggal lain.</p>
          ) : (
            <div className="slots">
              {slots.map((s) => (
                <button
                  type="button"
                  key={s}
                  className={`slot ${time === s ? 'active' : ''}`}
                  onClick={() => setTime(s)}
                  aria-pressed={time === s}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>4. Data pemesan</h3>
          {customer && (
            <div className="customer-booking-banner">
              <span>👤 Memesan sebagai <strong>{customer.name}</strong> ({customer.email})</span>
            </div>
          )}
          <Field label="Nama" id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Field
            label="Nomor telepon"
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="08xxxxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Alert error={error} />

          {selected && (
            <div className="booking-voucher-section">
              <div className="booking-voucher-head">
                <label htmlFor="voucherSelect">🎟️ Gunakan Voucher Diskon</label>
                <Link to="/poin-voucher" className="muted small">
                  Poin Anda: <strong>{customerPoints}</strong> · Tukar Voucher ↗
                </Link>
              </div>
              {myVouchers.length === 0 ? (
                <p className="muted small" style={{ margin: '4px 0 0' }}>
                  Belum ada voucher tersedia. Selesaikan booking untuk kumpulkan poin!
                </p>
              ) : (
                <select
                  id="voucherSelect"
                  className="voucher-select"
                  value={activeVoucher ? String(activeVoucher.id) : ''}
                  onChange={(e) => setSelectedVoucherId(e.target.value)}
                >
                  <option value="">-- Tidak menggunakan voucher --</option>
                  {myVouchers.map((v) => {
                    const check = estimateVoucherDiscount(v, rawPrice)
                    return (
                      <option key={v.id} value={v.id} disabled={!check.valid}>
                        {v.code} — {v.title}{' '}
                        {check.valid ? `(Hemat ${rupiah(check.discountAmount)})` : `(${check.reason})`}
                      </option>
                    )
                  })}
                </select>
              )}

              <div className="booking-price-summary">
                <div className="price-row">
                  <span>Harga Layanan ({selected.name})</span>
                  <span>{rupiah(rawPrice)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="price-row is-discount">
                    <span>Diskon Voucher ({activeVoucher?.code})</span>
                    <span>-{rupiah(discountAmount)}</span>
                  </div>
                )}
                <div className="price-row is-total">
                  <strong>Total Bayar di Tempat</strong>
                  <strong>{rupiah(finalPrice)}</strong>
                </div>
                <div className="price-row is-points">
                  <span>Estimasi Poin Setelah Selesai</span>
                  <span className="points-earned-pill">+{estimatedPoints} Poin</span>
                </div>
              </div>
            </div>
          )}

          {selected && time && (
            <p className="muted">
              {selected.name} · {date} pukul {time} WIB
            </p>
          )}
          <Button type="submit" loading={sending} disabled={!selected || !time}>
            Kirim Booking
          </Button>
        </div>
      </form>
    </>
  )
}

