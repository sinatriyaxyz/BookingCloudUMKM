import { api } from './client.js'

export const CATEGORIES = {
  barbershop: 'Barbershop',
  salon: 'Salon',
  bengkel: 'Bengkel',
  studio_foto: 'Studio Foto',
  lainnya: 'Lainnya',
}

export const listBusinesses = (category) => api('/public/businesses', { query: { category } })
export const getBusiness = (slug) => api(`/public/businesses/${encodeURIComponent(slug)}`)
export const getAvailability = (slug, serviceId, date) =>
  api(`/public/businesses/${encodeURIComponent(slug)}/availability`, { query: { serviceId, date } })
export const createBooking = (slug, body) =>
  api(`/public/businesses/${encodeURIComponent(slug)}/bookings`, { method: 'POST', body })
export const getBookingByCode = (code) => api(`/public/bookings/${encodeURIComponent(code)}`)
export const cancelBookingByCode = (code) =>
  api(`/public/bookings/${encodeURIComponent(code)}/cancel`, { method: 'POST' })

// Tanggal hari ini (WIB) dalam format YYYY-MM-DD
export function todayWib() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// "2026-11-12 09:30:00" -> "Kamis, 12 November 2026 pukul 09.30 WIB"
export function formatWib(dt) {
  if (!dt) return ''
  const [d, t = ''] = dt.split(' ')
  const [y, m, day] = d.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, day))
  const tanggal = date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return `${tanggal} pukul ${t.slice(0, 5).replace(':', '.')} WIB`
}

