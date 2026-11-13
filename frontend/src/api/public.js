import { api } from './client.js'
import { customerApi } from './customer.js'

export const CATEGORIES = {
  barbershop: 'Barbershop',
  salon: 'Salon',
  bengkel: 'Bengkel',
  studio_foto: 'Studio Foto',
  klinik_kecantikan: 'Klinik Kecantikan',
  spa_pijat: 'Spa & Pijat',
  klinik_gigi: 'Klinik Gigi',
  laundry: 'Laundry & Sepatu',
  service_elektronik: 'Servis Elektronik',
  pet_shop: 'Pet Grooming',
  kursus_les: 'Bimbingan & Kursus',
  jahit_tailor: 'Penjahit & Tailor',
  olahraga_lapangan: 'Sewa Lapangan',
  katering_kue: 'Katering & Kue',
  lainnya: 'Lainnya',
}

export const CATEGORY_META = {
  '': {
    label: 'Semua Kategori',
    icon: '✨',
    image: '/images/hero-all.svg',
    tagline: 'Pilih UMKM favoritmu, cek jadwal kosong secara instan, masuk dengan akunmu, dan dapatkan kode booking.',
    themeClass: 'theme-all',
  },
  barbershop: {
    label: 'Barbershop',
    icon: '💈',
    image: '/images/cat-barbershop.svg',
    tagline: 'Potong rambut & grooming rapi tanpa perlu antre lama di tempat.',
    themeClass: 'theme-barbershop',
  },
  salon: {
    label: 'Salon',
    icon: '💇‍♀️',
    image: '/images/cat-salon.svg',
    tagline: 'Perawatan rambut & kecantikan terbaik sesuai jadwal pilihanmu.',
    themeClass: 'theme-salon',
  },
  bengkel: {
    label: 'Bengkel',
    icon: '🔧',
    image: '/images/cat-bengkel.svg',
    tagline: 'Servis kendaraan terjadwal, praktis tanpa menunggu lama di bengkel.',
    themeClass: 'theme-bengkel',
  },
  studio_foto: {
    label: 'Studio Foto',
    icon: '📸',
    image: '/images/cat-studio_foto.svg',
    tagline: 'Abadikan momen spesial bersama keluarga dan teman di sesi foto terjadwal.',
    themeClass: 'theme-studio_foto',
  },
  klinik_kecantikan: {
    label: 'Klinik Kecantikan',
    icon: '💆‍♀️',
    image: '/images/cat-klinik_kecantikan.svg',
    tagline: 'Treatment wajah, facial, dan konsultasi kulit terjadwal bersama ahli estetika.',
    themeClass: 'theme-klinik_kecantikan',
  },
  spa_pijat: {
    label: 'Spa & Pijat',
    icon: '🧖‍♂️',
    image: '/images/cat-spa_pijat.svg',
    tagline: 'Relaksasi tubuh, pijat refleksi, dan perawatan spa tenang tanpa antre.',
    themeClass: 'theme-spa_pijat',
  },
  klinik_gigi: {
    label: 'Klinik Gigi',
    icon: '🦷',
    image: '/images/cat-klinik_gigi.svg',
    tagline: 'Periksa gigi, scaling, dan konsultasi dokter gigi lebih nyaman dengan janji temu.',
    themeClass: 'theme-klinik_gigi',
  },
  laundry: {
    label: 'Laundry & Sepatu',
    icon: '🧺',
    image: '/images/cat-laundry.svg',
    tagline: 'Antar-jemput cucian, cuci sepatu, dan dry clean terjadwal tepat waktu.',
    themeClass: 'theme-laundry',
  },
  service_elektronik: {
    label: 'Servis Elektronik',
    icon: '📱',
    image: '/images/cat-service_elektronik.svg',
    tagline: 'Perbaikan HP, laptop, dan perangkat elektronik dengan slot konsultasi teknisi.',
    themeClass: 'theme-service_elektronik',
  },
  pet_shop: {
    label: 'Pet Grooming',
    icon: '🐾',
    image: '/images/cat-pet_shop.svg',
    tagline: 'Mandi, cukur bulu, dan perawatan hewan kesayangan tanpa stres menunggu.',
    themeClass: 'theme-pet_shop',
  },
  kursus_les: {
    label: 'Bimbingan & Kursus',
    icon: '📚',
    image: '/images/cat-kursus_les.svg',
    tagline: 'Booking sesi les privat, kursus bahasa, musik, atau latihan mengemudi.',
    themeClass: 'theme-kursus_les',
  },
  jahit_tailor: {
    label: 'Penjahit & Tailor',
    icon: '🧵',
    image: '/images/cat-jahit_tailor.svg',
    tagline: 'Ukur badan, fitting busana, dan konsultasi jahit custom lebih teratur.',
    themeClass: 'theme-jahit_tailor',
  },
  olahraga_lapangan: {
    label: 'Sewa Lapangan',
    icon: '🏸',
    image: '/images/cat-olahraga_lapangan.svg',
    tagline: 'Pesan lapangan futsal, badminton, atau sesi latihan olahraga favoritmu.',
    themeClass: 'theme-olahraga_lapangan',
  },
  katering_kue: {
    label: 'Katering & Kue',
    icon: '🎂',
    image: '/images/cat-katering_kue.svg',
    tagline: 'Jadwalkan konsultasi menu acara, tasting, dan pemesanan kue custom.',
    themeClass: 'theme-katering_kue',
  },
  lainnya: {
    label: 'Lainnya',
    icon: '🏪',
    image: '/images/cat-lainnya.svg',
    tagline: 'Berbagai layanan jasa UMKM lokal siap dipesan kapan saja.',
    themeClass: 'theme-lainnya',
  },
}

export const getCategoryMeta = (cat) => CATEGORY_META[cat] || CATEGORY_META.lainnya

export const listBusinesses = (category, near) =>
  api('/public/businesses', { query: { category, lat: near?.[0], lng: near?.[1] } })
export const getBusiness = (slug) => api(`/public/businesses/${encodeURIComponent(slug)}`)
export const getAvailability = (slug, serviceId, date) =>
  api(`/public/businesses/${encodeURIComponent(slug)}/availability`, { query: { serviceId, date } })
export const createBooking = (slug, body) =>
  customerApi(`/public/businesses/${encodeURIComponent(slug)}/bookings`, { method: 'POST', body })
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

