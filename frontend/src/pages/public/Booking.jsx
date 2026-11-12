import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createBooking, getAvailability, getBusiness, todayWib } from '../../api/public.js'
import { Alert, Button, Field, rupiah } from '../../components/ui.jsx'

export default function Booking() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [biz, setBiz] = useState(null)
  const [serviceId, setServiceId] = useState(params.get('layanan') || '')
  const [date, setDate] = useState(todayWib())
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [time, setTime] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [slotError, setSlotError] = useState('')
  const [notice, setNotice] = useState('')
  const [sending, setSending] = useState(false)
  const reqId = useRef(0)

  useEffect(() => {
    getBusiness(slug).then(setBiz).catch((e) => setError(e.message))
  }, [slug])

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
      })
      const service = biz.services.find((s) => String(s.id) === String(serviceId))
      navigate(`/sukses/${res.code}`, {
        state: { ...res, businessName: biz.name, serviceName: service?.name },
      })
    } catch (err) {
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

  if (!biz) return error ? <Alert error={error} /> : <p className="muted">Memuat...</p>

  const selected = biz.services.find((s) => String(s.id) === String(serviceId))

  return (
    <>
      <p><Link to={`/u/${slug}`}>← {biz.name}</Link></p>
      <h2>Booking di {biz.name}</h2>
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

