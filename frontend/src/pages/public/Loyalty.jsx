import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  CUSTOMER_INFO_KEY,
  getCustomerLoyalty,
  getCustomerToken,
  getStoredCustomer,
  redeemVoucher,
} from '../../api/customer.js'
import { Alert, Button, rupiah } from '../../components/ui.jsx'

function formatVoucherBenefit(v) {
  if (v.discountType === 'percent') {
    return `Diskon ${Number(v.discountValue)}%`
  }
  return `Potongan ${rupiah(v.discountValue)}`
}

export default function Loyalty() {
  const token = getCustomerToken()
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('katalog')
  const [loading, setLoading] = useState(true)
  const [redeemingId, setRedeemingId] = useState(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const loadLoyalty = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await getCustomerLoyalty()
      setData(res)
      const stored = getStoredCustomer()
      if (stored) {
        localStorage.setItem(CUSTOMER_INFO_KEY, JSON.stringify({ ...stored, points: res.points }))
      }
    } catch (e) {
      setErr(e.message || 'Gagal memuat informasi poin dan voucher.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token) {
      loadLoyalty()
    }
  }, [token, loadLoyalty])

  if (!token) {
    return <Navigate to="/masuk" replace state={{ from: '/poin-voucher' }} />
  }

  async function handleRedeem(voucher) {
    setErr('')
    setMsg('')
    setRedeemingId(voucher.id)
    try {
      const res = await redeemVoucher(voucher.id)
      setMsg(`${res.message} Kode voucher: ${res.customerVoucher?.code}`)
      await loadLoyalty()
      setTab('milik')
    } catch (e) {
      setErr(e.message || 'Gagal menukarkan poin.')
    } finally {
      setRedeemingId(null)
    }
  }

  const points = Number(data?.points || 0)
  const lifetime = Number(data?.lifetimePoints || 0)
  const tier = data?.tier || { name: 'Bronze', icon: '🥉', nextTier: 'Silver', nextThreshold: 200 }
  const progressPct = tier.nextThreshold
    ? Math.min(100, Math.round((lifetime / tier.nextThreshold) * 100))
    : 100

  const catalog = data?.catalog || []
  const myVouchers = data?.myVouchers || []
  const history = data?.history || []
  const availableCount = myVouchers.filter((v) => v.status === 'tersedia').length

  return (
    <div className="loyalty-page">
      <div className="loyalty-hero">
        <div className="loyalty-hero-main">
          <div className="loyalty-tier-badge">
            <span>{tier.icon}</span> Tier {tier.name}
          </div>
          <h1 className="loyalty-points-title">
            {points.toLocaleString('id-ID')} <span>Poin</span>
          </h1>
          <p className="loyalty-sub">
            Selesaikan reservasi di UMKM mana saja untuk mengumpulkan poin (minimal +10 poin / transaksi, kelipatan Rp 1.000 = 1 poin).
          </p>
        </div>

        <div className="loyalty-progress-box">
          <div className="loyalty-progress-meta">
            <span>Total Poin Terkumpul: <strong>{lifetime.toLocaleString('id-ID')}</strong></span>
            <span>
              {tier.nextTier
                ? `Menuju ${tier.nextTier}: ${tier.nextThreshold.toLocaleString('id-ID')} poin`
                : 'Tier Tertinggi Tercapai! 🎉'}
            </span>
          </div>
          <div className="loyalty-progress-track">
            <div className="loyalty-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="loyalty-hero-actions">
            <Link to="/" className="btn btn-light small">✨ Pesan Sekarang</Link>
            <Link to="/booking-saya" className="btn small loyalty-outline-btn">📅 Booking Saya</Link>
          </div>
        </div>
      </div>

      <Alert error={err} success={msg} />

      <div className="loyalty-tabs" role="tablist">
        <button
          type="button"
          className={`loyalty-tab ${tab === 'katalog' ? 'is-active' : ''}`}
          onClick={() => setTab('katalog')}
        >
          🎁 Tukar Voucher ({catalog.length})
        </button>
        <button
          type="button"
          className={`loyalty-tab ${tab === 'milik' ? 'is-active' : ''}`}
          onClick={() => setTab('milik')}
        >
          🎟️ Voucher Saya ({availableCount} Aktif)
        </button>
        <button
          type="button"
          className={`loyalty-tab ${tab === 'riwayat' ? 'is-active' : ''}`}
          onClick={() => setTab('riwayat')}
        >
          📜 Riwayat Poin
        </button>
      </div>

      {loading && !data ? (
        <div className="card">
          <p className="muted">Memuat poin dan daftar voucher...</p>
        </div>
      ) : null}

      {!loading && tab === 'katalog' && (
        <div className="voucher-grid">
          {catalog.map((v) => {
            const enough = points >= Number(v.pointsCost)
            return (
              <div key={v.id} className="voucher-card">
                <div className="voucher-card-left">
                  <span className="voucher-value-pill">{formatVoucherBenefit(v)}</span>
                  <h3>{v.title}</h3>
                  <p className="muted small">{v.description}</p>
                  <div className="voucher-rules">
                    <span>Min. transaksi: {rupiah(v.minSpend || 0)}</span>
                    {v.maxDiscount != null && <span>Maks. diskon: {rupiah(v.maxDiscount)}</span>}
                  </div>
                </div>

                <div className="voucher-card-divider" aria-hidden="true" />

                <div className="voucher-card-right">
                  <div className="voucher-cost">
                    <strong>{v.pointsCost}</strong>
                    <span>Poin</span>
                  </div>
                  <Button
                    className="small"
                    disabled={!enough || redeemingId === v.id}
                    onClick={() => handleRedeem(v)}
                  >
                    {redeemingId === v.id
                      ? 'Menukar...'
                      : enough
                        ? 'Tukar Voucher'
                        : `Kurang ${v.pointsCost - points}`}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && tab === 'milik' && (
        myVouchers.length === 0 ? (
          <div className="card empty-loyalty-card">
            <h3>Belum ada voucher</h3>
            <p className="muted">Kumpulkan poin dari reservasi selesai dan tukarkan di tab Tukar Voucher.</p>
            <Button className="small" onClick={() => setTab('katalog')}>Lihat Katalog Voucher</Button>
          </div>
        ) : (
          <div className="voucher-grid">
            {myVouchers.map((mv) => {
              const isUsed = mv.status !== 'tersedia'
              return (
                <div key={mv.id} className={`voucher-card ${isUsed ? 'is-used' : ''}`}>
                  <div className="voucher-card-left">
                    <div className="voucher-top-badges">
                      <span className="voucher-value-pill">{formatVoucherBenefit(mv)}</span>
                      <span className={`badge ${isUsed ? 'batal' : 'selesai'}`}>
                        {isUsed ? 'Sudah Dipakai' : 'Tersedia'}
                      </span>
                    </div>
                    <h3>{mv.title}</h3>
                    <div className="voucher-code-box">
                      <span>Kode:</span>
                      <code>{mv.code}</code>
                    </div>
                    <div className="voucher-rules">
                      <span>Min. transaksi: {rupiah(mv.minSpend || 0)}</span>
                      {mv.maxDiscount != null && <span>Maks. diskon: {rupiah(mv.maxDiscount)}</span>}
                    </div>
                  </div>

                  <div className="voucher-card-divider" aria-hidden="true" />

                  <div className="voucher-card-right">
                    {isUsed ? (
                      <span className="muted small">Terpakai pada {mv.usedAt?.slice(0, 10) || '-'}</span>
                    ) : (
                      <Link to="/" className="btn small">
                        Pakai Sekarang
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {!loading && tab === 'riwayat' && (
        <div className="card">
          {history.length === 0 ? (
            <p className="muted">Belum ada riwayat transaksi poin. Poin akan bertambah setelah pemilik UMKM menandai reservasi Anda Selesai.</p>
          ) : (
            <div className="point-history-list">
              {history.map((item) => {
                const isEarn = item.points >= 0
                return (
                  <div key={item.id} className="point-history-row">
                    <div>
                      <strong>{item.description}</strong>
                      <div className="muted small">{item.createdAt} WIB</div>
                    </div>
                    <span className={`point-delta ${isEarn ? 'is-earn' : 'is-redeem'}`}>
                      {isEarn ? `+${item.points}` : item.points} Poin
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
