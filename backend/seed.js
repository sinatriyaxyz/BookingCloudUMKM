#!/usr/bin/env node
/**
 * seed.js — Isi data contoh: 2 UMKM, masing-masing 2 layanan dan jam buka Senin–Sabtu.
 * Aman dijalankan lebih dari sekali (idempoten via INSERT IGNORE / cek duplikat).
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from './src/db/pool.js';

const SALT_ROUNDS = 10;

const businesses = [
  {
    owner_email: 'barber@example.com',
    password: 'password123',
    name: 'Barbershop Bro',
    slug: 'barbershop-bro',
    category: 'barbershop',
    address: 'Jl. Merdeka No. 1, Jakarta',
    phone: '081200000001',
  },
  {
    owner_email: 'salon@example.com',
    password: 'password456',
    name: 'Salon Cantik',
    slug: 'salon-cantik',
    category: 'salon',
    address: 'Jl. Sudirman No. 2, Jakarta',
    phone: '081200000002',
  },
];

const servicesPerBusiness = [
  [
    { name: 'Potong Rambut', price: 35000, duration_min: 30 },
    { name: 'Cukur + Keramas', price: 55000, duration_min: 45 },
  ],
  [
    { name: 'Creambath', price: 80000, duration_min: 60 },
    { name: 'Cat Rambut', price: 150000, duration_min: 90 },
  ],
];

// Senin (1) – Sabtu (6), Minggu (0) = tutup
const OPEN_DAYS = [1, 2, 3, 4, 5, 6];
const CLOSED_DAY = 0;

async function seed() {
  const conn = await pool.getConnection();
  try {
    for (let i = 0; i < businesses.length; i++) {
      const biz = businesses[i];

      // Cek apakah sudah ada
      const [existing] = await conn.query(
        'SELECT id FROM businesses WHERE owner_email = ?',
        [biz.owner_email]
      );

      let bizId;
      if (existing.length > 0) {
        bizId = existing[0].id;
        console.log(`[skip] business: ${biz.slug} (sudah ada, id=${bizId})`);
      } else {
        const hash = await bcrypt.hash(biz.password, SALT_ROUNDS);
        const [result] = await conn.query(
          `INSERT INTO businesses (owner_email, password_hash, name, slug, category, address, phone)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [biz.owner_email, hash, biz.name, biz.slug, biz.category, biz.address, biz.phone]
        );
        bizId = result.insertId;
        console.log(`[ok]   business: ${biz.slug} (id=${bizId})`);
      }

      // Layanan
      for (const svc of servicesPerBusiness[i]) {
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

      // Jam operasional Senin–Sabtu
      for (const day of OPEN_DAYS) {
        const [exOh] = await conn.query(
          'SELECT id FROM operating_hours WHERE business_id = ? AND weekday = ?',
          [bizId, day]
        );
        if (exOh.length > 0) {
          console.log(`[skip]   operating_hours weekday=${day}`);
        } else {
          await conn.query(
            `INSERT INTO operating_hours (business_id, weekday, open_time, close_time, is_closed)
             VALUES (?, ?, '09:00:00', '17:00:00', 0)`,
            [bizId, day]
          );
          console.log(`[ok]     operating_hours weekday=${day}`);
        }
      }

      // Minggu = tutup
      const [exSun] = await conn.query(
        'SELECT id FROM operating_hours WHERE business_id = ? AND weekday = ?',
        [bizId, CLOSED_DAY]
      );
      if (exSun.length > 0) {
        console.log(`[skip]   operating_hours weekday=${CLOSED_DAY} (Minggu)`);
      } else {
        await conn.query(
          `INSERT INTO operating_hours (business_id, weekday, open_time, close_time, is_closed)
           VALUES (?, ?, '09:00:00', '17:00:00', 1)`,
          [bizId, CLOSED_DAY]
        );
        console.log(`[ok]     operating_hours weekday=${CLOSED_DAY} (Minggu, tutup)`);
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
