#!/usr/bin/env node
/**
 * seed.js — Isi data contoh UMKM lengkap dengan layanan, harga, lokasi peta, dan jam buka.
 * Aman dijalankan lebih dari sekali (idempoten).
 * Password semua akun baru (dan barber@example.com): password123
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from './src/db/pool.js';

const SALT_ROUNDS = 10;
const DEMO_PASSWORD = 'password123';

const businesses = [
  {
    owner_email: 'barber@example.com',
    password: DEMO_PASSWORD,
    name: 'Barbershop Bro',
    slug: 'barbershop-bro',
    category: 'barbershop',
    address: 'Jl. Merdeka No. 1, Jakarta',
    latitude: -6.175392,
    longitude: 106.827153,
    phone: '081200000001',
    services: [
      { name: 'Potong Rambut', price: 35000, duration_min: 30 },
      { name: 'Cukur + Keramas', price: 55000, duration_min: 45 },
    ],
  },
  {
    owner_email: 'salon@example.com',
    password: 'password456',
    name: 'Salon Cantik',
    slug: 'salon-cantik',
    category: 'salon',
    address: 'Jl. Sudirman No. 2, Jakarta',
    latitude: -6.208763,
    longitude: 106.822579,
    phone: '081200000002',
    services: [
      { name: 'Creambath', price: 80000, duration_min: 60 },
      { name: 'Cat Rambut', price: 150000, duration_min: 90 },
    ],
  },
  // 5 UMKM showcase dengan password seragam (password123)
  {
    owner_email: 'bengkel@example.com',
    password: DEMO_PASSWORD,
    name: 'Bengkel Motor Maju Jaya',
    slug: 'bengkel-motor-maju-jaya',
    category: 'bengkel',
    address: 'Jl. Raya Ngawi - Solo No. 45, Ngawi',
    latitude: -7.406850,
    longitude: 111.438920,
    phone: '081234560001',
    services: [
      { name: 'Ganti Oli Mesin', price: 65000, duration_min: 30 },
      { name: 'Servis Ringan + Tune Up', price: 95000, duration_min: 60 },
      { name: 'Ganti Kampas Rem', price: 55000, duration_min: 30 },
      { name: 'Servis CVT Matic', price: 75000, duration_min: 45 },
    ],
  },
  {
    owner_email: 'glowup@example.com',
    password: DEMO_PASSWORD,
    name: 'Glow Up Beauty Studio',
    slug: 'glow-up-beauty-studio',
    category: 'klinik_kecantikan',
    address: 'Jl. Ir. H. Juanda (Dago) No. 88, Bandung',
    latitude: -6.891480,
    longitude: 107.613060,
    phone: '081234560002',
    services: [
      { name: 'Facial Detox Glowing', price: 175000, duration_min: 60 },
      { name: 'Laser Brightening', price: 350000, duration_min: 45 },
      { name: 'Peeling Acne Care', price: 150000, duration_min: 45 },
      { name: 'Konsultasi Perawatan Kulit', price: 75000, duration_min: 30 },
    ],
  },
  {
    owner_email: 'studio@example.com',
    password: DEMO_PASSWORD,
    name: 'Lensa Cerita Photo Studio',
    slug: 'lensa-cerita-photo-studio',
    category: 'studio_foto',
    address: 'Jl. Malioboro No. 112, Yogyakarta',
    latitude: -7.792580,
    longitude: 110.365840,
    phone: '081234560003',
    services: [
      { name: 'Self Photo Studio (Maks 4 Orang)', price: 85000, duration_min: 30 },
      { name: 'Pas Foto & Edit Profesional', price: 50000, duration_min: 30 },
      { name: 'Foto Keluarga / Wisuda', price: 300000, duration_min: 60 },
      { name: 'Foto Produk Katalog (5 Item)', price: 200000, duration_min: 60 },
    ],
  },
  {
    owner_email: 'petshop@example.com',
    password: DEMO_PASSWORD,
    name: 'Pawfect Care & Pet Grooming',
    slug: 'pawfect-care-pet-grooming',
    category: 'pet_shop',
    address: 'Jl. Kemang Raya No. 24, Jakarta Selatan',
    latitude: -6.260720,
    longitude: 106.814150,
    phone: '081234560004',
    services: [
      { name: 'Grooming Kucing Dasar', price: 90000, duration_min: 60 },
      { name: 'Grooming Kucing Anti Kutu & Jamur', price: 130000, duration_min: 60 },
      { name: 'Grooming Anjing Kecil', price: 120000, duration_min: 60 },
      { name: 'Potong Kuku & Bersih Telinga', price: 35000, duration_min: 30 },
    ],
  },
  {
    owner_email: 'arena@example.com',
    password: DEMO_PASSWORD,
    name: 'Arena Sport Futsal & Badminton',
    slug: 'arena-sport-futsal-badminton',
    category: 'olahraga_lapangan',
    address: 'Jl. Ahmad Yani No. 150, Surabaya',
    latitude: -7.319420,
    longitude: 112.734380,
    phone: '081234560005',
    services: [
      { name: 'Sewa Lapangan Badminton (1 Jam)', price: 60000, duration_min: 60 },
      { name: 'Sewa Lapangan Futsal Vinyl (1 Jam)', price: 140000, duration_min: 60 },
      { name: 'Sewa Lapangan Futsal (2 Jam)', price: 260000, duration_min: 120 },
      { name: 'Paket Sewa Raket & Shuttlecock', price: 35000, duration_min: 60 },
    ],
  },
];

// Senin (1) – Sabtu (6) buka 09:00–20:00, Minggu (0) tutup
const OPEN_DAYS = [1, 2, 3, 4, 5, 6];
const CLOSED_DAY = 0;

async function seed() {
  const conn = await pool.getConnection();
  try {
    for (const biz of businesses) {
      const [existing] = await conn.query(
        'SELECT id, latitude, longitude FROM businesses WHERE owner_email = ?',
        [biz.owner_email]
      );

      let bizId;
      if (existing.length > 0) {
        bizId = existing[0].id;
        // Lengkapi koordinat hanya jika belum diatur pemilik
        if (existing[0].latitude === null && biz.latitude != null) {
          await conn.query(
            'UPDATE businesses SET latitude = ?, longitude = ? WHERE id = ?',
            [biz.latitude, biz.longitude, bizId]
          );
        }
        console.log(`[skip] business: ${biz.slug} (sudah ada, id=${bizId})`);
      } else {
        const hash = await bcrypt.hash(biz.password, SALT_ROUNDS);
        const [result] = await conn.query(
          `INSERT INTO businesses (owner_email, password_hash, name, slug, category, address, latitude, longitude, phone)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [biz.owner_email, hash, biz.name, biz.slug, biz.category, biz.address, biz.latitude, biz.longitude, biz.phone]
        );
        bizId = result.insertId;
        console.log(`[ok]   business: ${biz.slug} (id=${bizId})`);
      }

      for (const svc of biz.services) {
        const [exSvc] = await conn.query(
          'SELECT id FROM services WHERE business_id = ? AND name = ?',
          [bizId, svc.name]
        );
        if (exSvc.length > 0) {
          console.log(`[skip]   service: ${svc.name}`);
        } else {
          await conn.query(
            'INSERT INTO services (business_id, name, price, duration_min) VALUES (?, ?, ?, ?)',
            [bizId, svc.name, svc.price, svc.duration_min]
          );
          console.log(`[ok]     service: ${svc.name}`);
        }
      }

      for (const day of OPEN_DAYS) {
        const [exOh] = await conn.query(
          'SELECT id FROM operating_hours WHERE business_id = ? AND weekday = ?',
          [bizId, day]
        );
        if (exOh.length === 0) {
          await conn.query(
            `INSERT INTO operating_hours (business_id, weekday, open_time, close_time, is_closed)
             VALUES (?, ?, '09:00:00', '20:00:00', 0)`,
            [bizId, day]
          );
        }
      }

      const [exSun] = await conn.query(
        'SELECT id FROM operating_hours WHERE business_id = ? AND weekday = ?',
        [bizId, CLOSED_DAY]
      );
      if (exSun.length === 0) {
        await conn.query(
          `INSERT INTO operating_hours (business_id, weekday, open_time, close_time, is_closed)
           VALUES (?, ?, '09:00:00', '20:00:00', 1)`,
          [bizId, CLOSED_DAY]
        );
      }
    }

    console.log('\nSeed selesai.');
  } finally {
    conn.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed gagal:', err.message);
  process.exit(1);
});
