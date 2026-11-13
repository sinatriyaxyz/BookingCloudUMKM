import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { customerLogin, customerRegister, getCustomerToken } from '../../api/customer.js'
import { PublicTopbar, RouteProgressBar } from '../../components/Layout.jsx'
import { Alert } from '../../components/ui.jsx'
import { useSwipe } from '../../hooks/useSwipe.js'

function safeRedirect(raw) {
  if (!raw || typeof raw !== 'string') return '/'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}

function passwordStrength(pwd) {
  if (!pwd) return { score: 0, label: '', cls: '' }
  let score = 0
  if (pwd.length >= 8) score += 1
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1
  if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1
  if (pwd.length < 8) return { score: 1, label: 'Minimal 8 karakter', cls: 'weak' }
  if (score === 1) return { score: 2, label: 'Cukup', cls: 'fair' }
  if (score === 2) return { score: 3, label: 'Kuat', cls: 'good' }
  return { score: 4, label: 'Sangat kuat', cls: 'strong' }
}

const IconMail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="3" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
)

const IconLock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

const IconUser = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
)

const IconPhone = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

const IconEye = ({ open }) =>
  open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )

export default function CustomerAuth({ mode = 'login' }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirectParam = params.get('redirect')
  const redirectTo = useMemo(() => safeRedirect(redirectParam), [redirectParam])
  const isRegister = mode === 'register'

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const previewRef = useRef(null)

  useEffect(() => {
    document.body.className = 'customer-auth-body'
    return () => {
      document.body.className = ''
    }
  }, [])

  const switchPath = (targetMode) => {
    const base = targetMode === 'register' ? '/daftar' : '/masuk'
    return redirectParam ? `${base}?redirect=${encodeURIComponent(redirectTo)}` : base
  }

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => {
      if (!isRegister) {
        setError('')
        navigate(switchPath('register'))
      }
    },
    onSwipeRight: () => {
      if (isRegister) {
        setError('')
        navigate(switchPath('login'))
      }
    },
  })

  if (getCustomerToken()) {
    return <Navigate to={redirectTo} replace />
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const strength = passwordStrength(form.password)

  function handlePreviewMove(e) {
    const el = previewRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    const ry = ((px - 0.5) * 14).toFixed(2)
    const rx = ((0.5 - py) * 12).toFixed(2)
    el.style.setProperty('--rx', `${rx}deg`)
    el.style.setProperty('--ry', `${ry}deg`)
    el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`)
    el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`)
  }

  function handlePreviewLeave() {
    const el = previewRef.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--gx', '50%')
    el.style.setProperty('--gy', '50%')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isRegister) {
        await customerRegister({
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
        })
      } else {
        await customerLogin({
          email: form.email,
          password: form.password,
        })
      }
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cauth-shell">
      <RouteProgressBar />
      <PublicTopbar />

      <div className="cauth-stage">
        <div className="cauth-orb cauth-orb-1" aria-hidden="true" />
        <div className="cauth-orb cauth-orb-2" aria-hidden="true" />
        <div className="cauth-orb cauth-orb-3" aria-hidden="true" />
        <div className="cauth-grid-bg" aria-hidden="true" />

        <div className="cauth-container">
          {/* Left Visual Showcase */}
          <section className="cauth-showcase">
            <span className="cauth-eyebrow">
              <span className="cauth-dot" /> Platform Reservasi UMKM Lokal
            </span>

            <h1 className="cauth-headline">
              Booking Layanan Favorit,{' '}
              <span className="cauth-gradient-text">Cepat &amp; Tanpa Antre.</span>
            </h1>

            <p className="cauth-lead">
              Masuk dengan akun pelangganmu untuk memilih jadwal kosong secara real-time,
              menyimpan semua riwayat booking, dan memantau konfirmasi langsung dari UMKM.
            </p>

            {/* Floating Interactive 3D Preview Ticket */}
            <div
              ref={previewRef}
              className="cauth-preview-card"
              onPointerMove={handlePreviewMove}
              onPointerLeave={handlePreviewLeave}
              aria-hidden="true"
            >
              <div className="cauth-preview-glare" />
              <div className="cauth-preview-top">
                <div className="cauth-preview-biz">
                  <span className="cauth-preview-avatar">💈</span>
                  <div>
                    <strong>Barbershop Rapi Jaya</strong>
                    <span>Haircut &amp; Styling · 30 menit</span>
                  </div>
                </div>
                <span className="cauth-preview-status">✓ Dikonfirmasi</span>
              </div>
              <div className="cauth-preview-divider" />
              <div className="cauth-preview-bottom">
                <div>
                  <small>KODE BOOKING</small>
                  <div className="cauth-preview-code">AB7K9M2P</div>
                </div>
                <div className="cauth-preview-time">
                  <small>JADWAL WIB</small>
                  <strong>Hari ini · 14.00 WIB</strong>
                </div>
              </div>
            </div>

            <div className="cauth-perks">
              <div className="cauth-perk">
                <span className="cauth-perk-icon">⚡</span>
                <div>
                  <strong>Booking 1-Klik</strong>
                  <span>Nama &amp; nomor HP otomatis terisi dari akunmu.</span>
                </div>
              </div>
              <div className="cauth-perk">
                <span className="cauth-perk-icon">📅</span>
                <div>
                  <strong>Riwayat Terpusat</strong>
                  <span>Semua kode booking &amp; status tersimpan di Booking Saya.</span>
                </div>
              </div>
              <div className="cauth-perk">
                <span className="cauth-perk-icon">🛡️</span>
                <div>
                  <strong>Slot Anti-Bentrok</strong>
                  <span>Jadwal terkunci aman sesuai jam operasional WIB.</span>
                </div>
              </div>
            </div>

            <div className="cauth-cat-strip">
              <span>💈 Barbershop</span>
              <span>💇‍♀️ Salon</span>
              <span>💆‍♀️ Klinik Kecantikan</span>
              <span>🧖‍♂️ Spa &amp; Pijat</span>
              <span>🦷 Klinik Gigi</span>
              <span>🔧 Bengkel</span>
              <span>📱 Servis Elektronik</span>
              <span>🐾 Pet Grooming</span>
              <span>🏸 Sewa Lapangan</span>
              <span>+6 Lainnya</span>
            </div>
          </section>

          {/* Right Auth Card */}
          <section className="cauth-panel">
            <div className="cauth-card" {...swipeHandlers}>
              <div className="cauth-card-accent" />

              <div className="cauth-tabs" role="tablist" aria-label="Pilih mode autentikasi">
                <span
                  className={`cauth-tab-slider ${isRegister ? 'right' : 'left'}`}
                  aria-hidden="true"
                />
                <Link
                  to={switchPath('login')}
                  role="tab"
                  aria-selected={!isRegister}
                  className={`cauth-tab ${!isRegister ? 'active' : ''}`}
                  onClick={() => setError('')}
                >
                  Masuk Akun
                </Link>
                <Link
                  to={switchPath('register')}
                  role="tab"
                  aria-selected={isRegister}
                  className={`cauth-tab ${isRegister ? 'active' : ''}`}
                  onClick={() => setError('')}
                >
                  Buat Akun Baru
                </Link>
              </div>

              <div
                key={mode}
                className={`cauth-form-stage ${isRegister ? 'slide-right' : 'slide-left'}`}
              >
                <div className="cauth-card-head">
                <h2>{isRegister ? 'Daftar Akun Pelanggan' : 'Selamat Datang Kembali'}</h2>
                <p>
                  {isRegister
                    ? 'Buat akun gratis dalam 30 detik untuk mulai memesan layanan.'
                    : 'Masuk untuk melanjutkan pemesanan dan melihat jadwal bookingmu.'}
                </p>
              </div>

              {redirectParam && (
                <div className="cauth-redirect-notice">
                  <span>🔐</span>
                  <span>
                    Silakan <strong>masuk</strong> atau <strong>buat akun</strong> terlebih dahulu untuk melanjutkan pemesanan layanan.
                  </span>
                </div>
              )}

              <Alert error={error} />

              <form onSubmit={submit} className="cauth-form">
                {isRegister && (
                  <>
                    <div className="cauth-field">
                      <label htmlFor="cust-name">Nama Lengkap</label>
                      <div className="cauth-input-wrap">
                        <span className="cauth-input-icon"><IconUser /></span>
                        <input
                          id="cust-name"
                          type="text"
                          placeholder="Contoh: Budi Santoso"
                          value={form.name}
                          onChange={set('name')}
                          autoComplete="name"
                          required
                        />
                      </div>
                    </div>

                    <div className="cauth-field">
                      <label htmlFor="cust-phone">Nomor WhatsApp / Telepon</label>
                      <div className="cauth-input-wrap">
                        <span className="cauth-input-icon"><IconPhone /></span>
                        <input
                          id="cust-phone"
                          type="tel"
                          inputMode="tel"
                          placeholder="081234567890"
                          value={form.phone}
                          onChange={set('phone')}
                          autoComplete="tel"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="cauth-field">
                  <label htmlFor="cust-email">Email</label>
                  <div className="cauth-input-wrap">
                    <span className="cauth-input-icon"><IconMail /></span>
                    <input
                      id="cust-email"
                      type="email"
                      placeholder="nama@email.com"
                      value={form.email}
                      onChange={set('email')}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="cauth-field">
                  <label htmlFor="cust-password">
                    Password {isRegister && <span className="cauth-label-hint">(min. 8 karakter)</span>}
                  </label>
                  <div className="cauth-input-wrap">
                    <span className="cauth-input-icon"><IconLock /></span>
                    <input
                      id="cust-password"
                      type={showPwd ? 'text' : 'password'}
                      placeholder={isRegister ? 'Buat password minimal 8 karakter' : 'Masukkan password Anda'}
                      value={form.password}
                      onChange={set('password')}
                      minLength={isRegister ? 8 : undefined}
                      autoComplete={isRegister ? 'new-password' : 'current-password'}
                      required
                    />
                    <button
                      type="button"
                      className="cauth-eye-btn"
                      onClick={() => setShowPwd((v) => !v)}
                      aria-label={showPwd ? 'Sembunyikan password' : 'Lihat password'}
                      title={showPwd ? 'Sembunyikan password' : 'Lihat password'}
                    >
                      <IconEye open={showPwd} />
                    </button>
                  </div>

                  {isRegister && form.password && (
                    <div className="cauth-strength">
                      <div className="cauth-strength-bars">
                        {[1, 2, 3, 4].map((lvl) => (
                          <span
                            key={lvl}
                            className={`cauth-strength-bar ${strength.score >= lvl ? strength.cls : ''}`}
                          />
                        ))}
                      </div>
                      <span className={`cauth-strength-text ${strength.cls}`}>{strength.label}</span>
                    </div>
                  )}
                </div>

                <button type="submit" className="cauth-submit" disabled={loading}>
                  {loading
                    ? 'Memproses...'
                    : isRegister
                      ? 'Buat Akun & Lanjutkan →'
                      : 'Masuk Sekarang →'}
                </button>
              </form>

              <div className="cauth-divider">
                <span>atau</span>
              </div>

                <p className="cauth-switch-text">
                  {isRegister ? (
                    <>
                      Sudah punya akun pelanggan?{' '}
                      <Link to={switchPath('login')}>Masuk di sini</Link>
                    </>
                  ) : (
                    <>
                      Baru pertama kali memesan?{' '}
                      <Link to={switchPath('register')}>Daftar akun gratis</Link>
                    </>
                  )}
                </p>
              </div>

              <div className="cauth-owner-box">
                <span>Pemilik usaha UMKM?</span>
                <Link to="/owner/login">Masuk Portal Pemilik →</Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
