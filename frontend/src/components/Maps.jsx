import { lazy, Suspense } from 'react'
import { directionsUrl, toLatLng } from '../api/geo.js'

// Komponen peta dimuat terpisah (code-splitting) agar bundle utama tetap kecil.
const load = (name) =>
  lazy(() => import('./LocationMap.jsx').then((m) => ({ default: m[name] })))

const MapViewLazy = load('MapView')
const LocationPickerLazy = load('LocationPicker')
const BusinessesMapLazy = load('BusinessesMap')

const Fallback = ({ height = 280 }) => (
  <div className="map-box map-loading" style={{ height }}>Memuat peta...</div>
)

export function MapView(props) {
  return <Suspense fallback={<Fallback height={props.height} />}><MapViewLazy {...props} /></Suspense>
}

export function LocationPicker(props) {
  return <Suspense fallback={<Fallback height={320} />}><LocationPickerLazy {...props} /></Suspense>
}

export function BusinessesMap(props) {
  return <Suspense fallback={<Fallback height={props.height || 420} />}><BusinessesMapLazy {...props} /></Suspense>
}

/** Kartu lokasi UMKM: alamat + peta + tombol petunjuk arah. Tidak tampil jika belum ada titik. */
export function BusinessLocation({ name, address, latitude, longitude, height = 240 }) {
  const position = toLatLng(latitude, longitude)
  if (!position) return null
  return (
    <div className="biz-location">
      <h3>📍 Lokasi {name}</h3>
      {address && <p className="muted" style={{ marginTop: 0 }}>{address}</p>}
      <MapView position={position} label={name} height={height} />
      <a className="btn small" style={{ marginTop: '.75rem' }} href={directionsUrl(position)} target="_blank" rel="noreferrer">
        🧭 Petunjuk Arah (Google Maps)
      </a>
    </div>
  )
}
