# PROGRESS

## Status sesi
| Sesi | Isi | Status |
|---|---|---|
| 0 | Fondasi repo | ✅ |
| 1 | Skema database | ✅ |
| 2 | Backend dasar + auth (F-01) | ✅ |
| 3 | Profil UMKM (F-02) | ⬜ |
| 4 | Layanan (F-03) | ⬜ |
| 5 | Jam operasional + libur (F-04) | ⬜ |
| 6 | Jam kosong (F-05) | ⬜ |
| 7 | Booking + anti-bentrok (F-06) | ⬜ |
| 8 | Cek status + batal pelanggan (F-07, F-10) | ⬜ |
| 9 | Kelola reservasi + dashboard (F-08, F-09) | ⬜ |
| 10 | Tes isolasi & konkurensi (F-11) | ⬜ |
| 11 | Frontend dasar + auth | ⬜ |
| 12 | Frontend pemilik: profil, layanan, jam | ⬜ |
| 13 | Frontend pemilik: dashboard | ⬜ |
| 14 | Frontend publik: booking | ⬜ |
| 15 | Dockerisasi | ⬜ |
| 16 | Deploy server + Nginx | ⬜ |
| 17 | BIND9 | ⬜ |
| 18 | Pengujian akhir + dokumentasi | ⬜ |

## Keputusan
- Sesi 0: bcrypt native build (node-gyp) tidak diapprove via npm install-scripts; tes health tidak memerlukan bcrypt, jadi tidak masalah untuk sesi ini.
- Sesi 2: Zod v4 menggunakan `.issues` bukan `.errors` untuk akses error pertama. Mock pool.query di tes harus mencakup semua query termasuk `uniqueSlug` (3 call untuk register sukses).

## Catatan / masalah terbuka
(kosong)

## Cara menjalankan
```bash
# MariaDB
cp .env.example .env  # isi nilai sesuai kebutuhan
docker compose up -d

# Backend
cd backend && npm test       # jalankan tes
cd backend && npm start      # jalankan server

# Frontend
cd frontend && npm install && npm run dev
```
