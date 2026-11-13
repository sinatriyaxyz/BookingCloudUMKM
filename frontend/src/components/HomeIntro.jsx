import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCustomerToken } from '../api/customer.js'

const INTRO_STEPS = [
  {
    step: '01',
    icon: '👤',
    title: 'Masuk Sekali untuk Semua UMKM',
    desc: 'Buat akun konsumen gratis agar riwayat booking, kode tiket, poin loyalitas, dan voucher diskon tersimpan rapi.',
    image: '/images/cat-barbershop.svg',
    badge: 'Akun Terpadu',
  },
  {
    step: '02',
    icon: '🔍',
    title: 'Jelajahi 15+ Kategori Jasa',
    desc: 'Temukan barbershop, salon, klinik kecantikan, spa, bengkel, laundry, pet shop, hingga studio foto beserta daftar harga.',
    image: '/images/cat-klinik_kecantikan.svg',
    badge: 'Harga Transparan',
  },
  {
    step: '03',
    icon: '🗓️',
    title: 'Pilih Jam Kosong Real-Time',
    desc: 'Sistem otomatis mengecek jam operasional, hari libur, dan jadwal terisi per 30 menit WIB agar bebas antre.',
    image: '/images/cat-salon.svg',
    badge: 'Anti Bentrok',
  },
  {
    step: '04',
    icon: '🎁',
    title: 'Datang, Selesai & Raih Voucher',
    desc: 'Tunjukkan kode booking 8 karakter di lokasi. Setiap transaksi selesai otomatis menghasilkan poin untuk ditukar diskon!',
    image: '/images/cat-spa_pijat.svg',
    badge: 'Poin & Diskon',
  },
]

export default function HomeIntro({ onStartBooking }) {
  const [activeStep, setActiveStep] = useState(0)
  const [paused, setPaused] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const isLoggedIn = Boolean(getCustomerToken())

  useEffect(() => {
    if (paused || collapsed) return undefined
    const id = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % INTRO_STEPS.length)
    }, 4200)
    return () => clearInterval(id)
  }, [paused, collapsed])

  const current = INTRO_STEPS[activeStep]

  if (collapsed) {
    return (
      <div className="intro-collapsed-bar">
        <div className="intro-collapsed-left">
          <span className="intro-spark-pill">✨ BookingCloud Intro</span>
          <span className="muted">Ingin melihat cara kerja &amp; fitur poin aplikasi sebelum reservasi?</span>
        </div>
        <button
          type="button"
          className="btn secondary small"
          onClick={() => setCollapsed(false)}
        >
          Tampilkan Intro ▾
        </button>
      </div>
    )
  }

  return (
    <section
      className="home-intro"
      aria-label="Pengenalan Aplikasi BookingCloud UMKM"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="intro-blob intro-blob-1" aria-hidden="true" />
      <div className="intro-blob intro-blob-2" aria-hidden="true" />

      <div className="intro-top-bar">
        <span className="intro-spark-pill">
          <span className="intro-pulse-dot" /> Kenalan Dulu Sebelum Reservasi
        </span>
        <button
          type="button"
          className="intro-hide-btn"
          onClick={() => setCollapsed(true)}
        >
          Ringkas Intro ▲
        </button>
      </div>

      <div className="intro-grid">
        <div className="intro-copy">
          <h2>
            Reservasi Jasa UMKM Lebih Cepat, <span className="intro-accent-text">Tanpa Antre</span> &amp; Dapat Diskon
          </h2>
          <p className="intro-lead">
            <strong>BookingCloud UMKM</strong> menghubungkan Anda langsung ke jadwal kosong berbagai usaha lokal — mulai dari
            barbershop, klinik, bengkel, hingga studio kreatif. Cukup pilih layanan, kunci jam kedatangan dalam WIB,
            dan kumpulkan poin loyalitas di setiap kunjungan selesai.
          </p>

          <div className="intro-highlights">
            <div className="intro-highlight-item">
              <span className="intro-hi-icon">⚡</span>
              <div>
                <strong>Slot Real-Time 30 Menit</strong>
                <span>Bebas jadwal bentrok &amp; info hari libur otomatis</span>
              </div>
            </div>
            <div className="intro-highlight-item">
              <span className="intro-hi-icon">🎫</span>
              <div>
                <strong>Tiket Kode Booking Unik</strong>
                <span>Cek status kapan saja atau batalkan fleksibel</span>
              </div>
            </div>
            <div className="intro-highlight-item">
              <span className="intro-hi-icon">🪙</span>
              <div>
                <strong>Sistem Poin &amp; Voucher</strong>
                <span>Tukar poin selesai booking jadi potongan hingga 30%</span>
              </div>
            </div>
          </div>

          <div className="intro-cta-row">
            <button
              type="button"
              className="btn intro-primary-btn"
              onClick={onStartBooking}
            >
              🚀 Coba Reservasi Sekarang ↓
            </button>
            {isLoggedIn ? (
              <Link to="/poin-voucher" className="btn secondary">
                🎁 Poin &amp; Voucher Saya
              </Link>
            ) : (
              <Link to="/daftar" className="btn secondary">
                ✨ Daftar Akun Konsumen
              </Link>
            )}
          </div>
        </div>

        <div className="intro-visual-stage">
          <div className="intro-artwork-frame">
            <img
              src="/images/intro-booking.svg"
              alt="Ilustrasi pemesanan jadwal BookingCloud UMKM di ponsel dengan slot waktu dan voucher diskon"
              className="intro-artwork-img"
            />

            <div className="intro-float-badge badge-top-left">
              <span>🕒</span>
              <div>
                <strong>10:00 WIB · Kosong</strong>
                <small>Terkunci otomatis tanpa dobel</small>
              </div>
            </div>

            <div className="intro-float-badge badge-bottom-left">
              <span>🎟️</span>
              <div>
                <strong>Kode: BCK8M2</strong>
                <small>Menunggu konfirmasi UMKM</small>
              </div>
            </div>

            <div className="intro-float-badge badge-top-right">
              <span>🪙</span>
              <div>
                <strong>+60 Poin Loyalitas</strong>
                <small>Siap ditukar voucher diskon</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="intro-steps-wrap">
        <div className="intro-steps-header">
          <span className="intro-steps-label">Alur Singkat Pemesanan:</span>
          <div className="intro-step-dots" aria-label="Navigasi langkah intro">
            {INTRO_STEPS.map((st, idx) => (
              <button
                key={st.step}
                type="button"
                className={`intro-step-dot ${idx === activeStep ? 'is-active' : ''}`}
                onClick={() => setActiveStep(idx)}
                aria-label={`Langkah ${st.step}: ${st.title}`}
              />
            ))}
          </div>
        </div>

        <div className="intro-steps-grid">
          {INTRO_STEPS.map((st, idx) => {
            const isActive = idx === activeStep
            return (
              <button
                key={st.step}
                type="button"
                className={`intro-step-card ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveStep(idx)}
              >
                <div
                  className="intro-step-thumb"
                  style={{ backgroundImage: `url('${st.image}')` }}
                  aria-hidden="true"
                >
                  <span className="intro-step-num">{st.step}</span>
                </div>
                <div className="intro-step-body">
                  <div className="intro-step-title-row">
                    <span>{st.icon}</span>
                    <strong>{st.title}</strong>
                  </div>
                  <p>{st.desc}</p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="intro-active-spotlight" key={current.step}>
          <span className="intro-spotlight-badge">{current.badge}</span>
          <span>
            <strong>Langkah {current.step}:</strong> {current.title} — {current.desc}
          </span>
        </div>
      </div>
    </section>
  )
}

