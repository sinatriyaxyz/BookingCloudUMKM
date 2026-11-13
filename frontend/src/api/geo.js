// Helper lokasi/peta (tanpa dependensi Leaflet)

// Ubah nilai DECIMAL dari API (string) menjadi [lat, lng] atau null
export function toLatLng(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null
  const a = Number(lat), b = Number(lng)
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null
}

// Tautan petunjuk arah Google Maps (gratis, tanpa API key)
export function directionsUrl([lat, lng]) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

