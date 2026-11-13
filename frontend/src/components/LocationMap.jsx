import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

// Perbaiki ikon marker default Leaflet yang hilang saat dibundel Vite
const markerIcon = L.icon({
  iconUrl, iconRetinaUrl, shadowUrl,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const INDONESIA_CENTER = [-2.5, 118]
const DETAIL_ZOOM = 16

// Geocoding gratis via Nominatim (OSM). Dipanggil hanya saat tombol diklik (≤ 1 req/detik).
async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=id&accept-language=id&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('Layanan pencarian alamat sedang tidak tersedia.')
  const data = await res.json()
  if (!data.length) throw new Error('Alamat tidak ditemukan. Coba tulis lebih umum, atau klik langsung pada peta.')
  return [Number(Number(data[0].lat).toFixed(6)), Number(Number(data[0].lon).toFixed(6))]
}

function FlyTo({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.flyTo(position, Math.max(map.getZoom(), DETAIL_ZOOM), { duration: 0.8 })
  }, [map, position])
  return null
}

function ClickToPick({ onPick }) {
  useMapEvents({ click: (e) => onPick(round(e.latlng)) })
  return null
}

const round = ({ lat, lng }) => [Number(lat.toFixed(6)), Number(lng.toFixed(6))]

/** Peta baca-saja untuk halaman publik. */
export function MapView({ position, label, height = 280 }) {
  return (
    <MapContainer center={position} zoom={DETAIL_ZOOM} scrollWheelZoom={false}
      className="map-box" style={{ height }}>
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
      <Marker position={position} icon={markerIcon}>
        {label && <Popup>{label}</Popup>}
      </Marker>
    </MapContainer>
  )
}

const userIcon = L.divIcon({
  className: 'map-user-dot', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9],
})

function FitBounds({ points }) {
  const map = useMap()
  const key = points.map((p) => p.join(',')).join('|')
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 15)
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 15 })
  }, [map, key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/**
 * Peta jelajah banyak UMKM.
 * items: [{ slug, name, position: [lat,lng], subtitle, href, distance }]
 * renderLink: (item) => node — tautan ke halaman UMKM (agar memakai router)
 */
export function BusinessesMap({ items, userPosition, renderLink, height = 420 }) {
  const points = items.map((i) => i.position)
  if (userPosition) points.push(userPosition)
  return (
    <MapContainer center={INDONESIA_CENTER} zoom={5} scrollWheelZoom={false}
      className="map-box" style={{ height }}>
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
      <FitBounds points={points} />
      {items.map((i) => (
        <Marker key={i.slug} position={i.position} icon={markerIcon}>
          <Popup>
            <div className="map-popup">
              <strong>{i.name}</strong>
              {i.subtitle && <div className="muted">{i.subtitle}</div>}
              {i.distance != null && <div className="muted">🚶 {i.distance} km dari Anda</div>}
              {renderLink(i)}
            </div>
          </Popup>
        </Marker>
      ))}
      {userPosition && (
        <Marker position={userPosition} icon={userIcon}>
          <Popup>Lokasi Anda</Popup>
        </Marker>
      )}
    </MapContainer>
  )
}

/** Pemilih lokasi untuk pemilik: klik/geser marker, cari dari alamat, atau lokasi perangkat. */
export function LocationPicker({ value, onChange, address }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [flyTarget, setFlyTarget] = useState(null)
  const markerRef = useRef(null)
  const [initialCenter] = useState(() => value || INDONESIA_CENTER)
  const [initialZoom] = useState(() => (value ? DETAIL_ZOOM : 5))

  const pick = (pos, fly = false) => { setMsg(''); onChange(pos); if (fly) setFlyTarget(pos) }

  const dragHandlers = useMemo(() => ({
    dragend() {
      const m = markerRef.current
      if (m) pick(round(m.getLatLng()))
    },
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  async function searchAddress() {
    if (!address?.trim()) { setMsg('Isi kolom alamat terlebih dahulu.'); return }
    setBusy(true); setMsg('')
    try { pick(await geocode(address), true) }
    catch (e) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setMsg('Browser tidak mendukung deteksi lokasi.'); return }
    setBusy(true); setMsg('')
    navigator.geolocation.getCurrentPosition(
      (p) => { pick(round({ lat: p.coords.latitude, lng: p.coords.longitude }), true); setBusy(false) },
      () => { setMsg('Gagal mengambil lokasi. Pastikan izin lokasi diaktifkan.'); setBusy(false) },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className="field">
      <label>Titik Lokasi di Peta</label>
      <p className="muted map-hint">Klik pada peta atau geser pin untuk menentukan lokasi usaha Anda.</p>
      <div className="map-actions">
        <button type="button" className="btn small secondary" onClick={searchAddress} disabled={busy}>🔎 Cari dari Alamat</button>
        <button type="button" className="btn small secondary" onClick={useMyLocation} disabled={busy}>📍 Gunakan Lokasi Saya</button>
        {value && <button type="button" className="btn small danger" onClick={() => pick(null)} disabled={busy}>✕ Hapus Titik</button>}
      </div>
      {msg && <div className="error" role="alert">{msg}</div>}
      <MapContainer center={initialCenter} zoom={initialZoom} className="map-box" style={{ height: 320 }}>
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        <ClickToPick onPick={(p) => pick(p)} />
        <FlyTo position={flyTarget} />
        {value && <Marker position={value} icon={markerIcon} draggable eventHandlers={dragHandlers} ref={markerRef} />}
      </MapContainer>
      <p className="muted map-coords">
        {value ? `Koordinat: ${value[0]}, ${value[1]}` : 'Belum ada titik lokasi.'}
      </p>
    </div>
  )
}
