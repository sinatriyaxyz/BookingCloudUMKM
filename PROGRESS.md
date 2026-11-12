# PROGRESS

## Status sesi
| Sesi | Isi | Status |
|---|---|---|
| 0 | Fondasi repo | ✅ |
| 1 | Skema database | ✅ |
| 2 | Backend dasar + auth (F-01) | ✅ |
| 3 | Profil UMKM (F-02) | ✅ |
| 4 | Layanan (F-03) | ✅ |
| 5 | Jam operasional + libur (F-04) | ✅ |
| 6 | Jam kosong (F-05) | ✅ |
| 7 | Booking + anti-bentrok (F-06) | ✅ |
| 8 | Cek status + batal pelanggan (F-07, F-10) | ✅ |
| 9 | Kelola reservasi + dashboard (F-08, F-09) | ✅ |
| 10 | Tes isolasi & konkurensi (F-11) | ✅ |
| 11 | Frontend dasar + auth | ✅ |
| 12 | Frontend pemilik: profil, layanan, jam | ✅ |
| 13 | Frontend pemilik: dashboard | ✅ |
| 14 | Frontend publik: booking | ✅ |
| 15 | Dockerisasi | ✅ |
| 16 | Deploy server + Nginx | ⬜ |
| 17 | BIND9 | ⬜ |
| 18 | Pengujian akhir + dokumentasi | ⬜ |

## Keputusan
- Sesi 0: bcrypt native build (node-gyp) tidak diapprove via npm install-scripts; tes health tidak memerlukan bcrypt, jadi tidak masalah untuk sesi ini.
- Sesi 2: Zod v4 menggunakan `.issues` bukan `.errors` untuk akses error pertama. Mock pool.query di tes harus mencakup semua query termasuk `uniqueSlug` (3 call untuk register sukses).
- Sesi 5: Jam operasional PUT menerima array 7 hari (atau { hours: [...] }), validasi open_time < close_time dengan normalisasi HH:mm. Duplikat tanggal libur mengembalikan status 409 (DUPLICATE_HOLIDAY). Hari yang belum diatur pada GET otomatis default tutup (is_closed: true). Revisi sesi 4–6: semua opsi Zod v4 memakai `error` (pesan tetap Bahasa Indonesia); layanan: nama di-trim, harga wajib bilangan bulat (kolom INT rupiah), `:id` divalidasi zod (422), UPDATE/soft-delete ikut memfilter `business_id`; libur: validasi tanggal ketat via dayjs (2026-02-30 ditolak, sebelumnya lolos `Date.parse`).
- Sesi 6: Response GET /api/public/businesses/:slug/availability mengembalikan `{ date, slots }` dengan slots berupa array jam mulai "HH:mm". Validasi query menggunakan zod (serviceId integer positif, date format YYYY-MM-DD). Booking aktif (status 'menunggu' atau 'dikonfirmasi') difilter dari slot yang tersedia.
- Sesi 7: Validasi input Zod mendukung camelCase & snake_case (serviceId/service_id, customerName/customer_name, customerPhone/customer_phone). Format telepon Indonesia (9-15 digit, diawali 0 atau +62). Anti-bentrok dijamin dengan SELECT ... FOR UPDATE pada baris businesses dan query bookings di dalam satu transaksi InnoDB. Generator kode 8 karakter dengan alfabet A-Z (tanpa I, O) dan angka 2-9 (tanpa 0, 1) dengan mekanisme retry otomatis dan SAVEPOINT saat terjadi bentrok UNIQUE. Revisi: respons 409 hanya `{ error: { code, message } }` (format standar), kunci baris UMKM cukup sekali, opsi Zod v4 memakai `error` (bukan `invalid_type_error`).
- Sesi 8: GET /api/public/bookings/:code menormalisasi input kode ke huruf besar dan mengembalikan data lengkap reservasi beserta nama UMKM dan layanan. POST /api/public/bookings/:code/cancel mengunci baris booking dalam transaksi, memvalidasi status hanya 'menunggu' atau 'dikonfirmasi', dan sisa waktu ke start_at minimal 2 jam (CANCEL_MIN_HOURS = 2) berbasis zona waktu Asia/Jakarta (WIB). Status diperbarui menjadi 'dibatalkan'.
- Sesi 9: Transisi status booking dikontrol fungsi murni `canTransition(from, to)` (hanya izinkan menunggu -> dikonfirmasi/dibatalkan, dikonfirmasi -> selesai/dibatalkan). Endpoint aksi pemilik (/confirm, /complete, /cancel) menggunakan SELECT ... FOR UPDATE berdasar `id` dan `business_id` dari JWT (akses ID UMKM lain mengembalikan 404, transisi tidak sah mengembalikan 422). GET /api/bookings menyediakan filter tanggal, status, paginasi page & limit, serta toleran terhadap query param kosong. GET /api/dashboard mengembalikan `{ today, counts, history }` berbasis waktu WIB. Revisi: respons reservasi pemilik hanya camelCase (`startAt`, `serviceName`, dst.), daftar = `{ bookings, page, limit, total, totalPages }`; dashboard selalu memakai tanggal hari ini WIB (tanpa `?date=`); param `:id` & `:code` (sesi 8) divalidasi zod; opsi Zod v4 memakai `error` sehingga pesan `page`/`limit` berbahasa Indonesia.
- Sesi 10: Pengujian isolasi lintas-tenant (F-11) pada `tests/isolation.test.js` memverifikasi bahwa token UMKM A tidak dapat memodifikasi atau menghapus resource milik UMKM B pada seluruh endpoint berparameter `:id` (`PUT/DELETE /api/services/:id`, `DELETE /api/holidays/:id`, `POST /api/bookings/:id/confirm|complete|cancel` → 404 `NOT_FOUND` dan data B di DB tidak berubah) serta endpoint GET list/dashboard milik A tidak memuat data B. Skrip `npm run test:all` ditambahkan dengan `--no-file-parallelism` agar suite tes integrasi MariaDB berjalan deterministik tanpa saling mengunci tabel antar-file; seluruh 13 file tes (145 pengujian) lulus.
- Sesi 11-13: Frontend (Vite + React + react-router-dom, CSS biasa). Token JWT di localStorage (kunci `token`); proxy dev `/api` -> :3000. Rute: /owner (dashboard), /owner/riwayat, /owner/layanan, /owner/jam, /owner/profil, /owner/login, /owner/register. Link halaman publik di profil memakai `/b/:slug` (rute dibuat di sesi 14). Aksi reservasi hanya yang valid per status; riwayat memakai GET /api/bookings (limit 10). `npm run build` sukses; 150 tes backend lulus.
- Sesi 14: Halaman publik pelanggan dengan `PublicLayout` pada rute `/` (daftar UMKM + filter kategori), `/u/:slug` (profil UMKM & layanan, ditambah redirect dari `/b/:slug` serta pembaruan tautan profil pemilik ke `/u/:slug`), `/u/:slug/booking` (pilih layanan -> pilih tanggal WIB -> grid jam kosong dari endpoint availability -> form nama & telepon -> kirim, termasuk auto-reload slot saat 409 `SLOT_TAKEN`), `/sukses/:code` (tampilan kode booking besar, tombol salin dengan fallback, tautan ke `/cek?kode=...`), dan `/cek` (input kode booking, detail status, tombol batalkan dengan penanganan pesan batas waktu minimal 2 jam).
- Sesi 15: Dockerisasi backend dengan multi-stage `node:20-alpine` (stage builder menginstal dependensi produksi, stage runner berjalan sebagai `USER node`, `TZ=Asia/Jakarta`, healthcheck ke `/api/health`, serta otomatis menjalankan `node src/db/migrate.js` sebelum `node src/server.js`). `docker-compose.yml` dilengkapi healthcheck pada `db` (`healthcheck.sh --connect --innodb_initialized`) dan service `api` (`depends_on` db healthy, env dari `.env` dengan override `DB_HOST=db`, mount `./db:/app/db:ro`, serta bind port khusus `127.0.0.1:3000:3000`). Ditambahkan `deploy/scripts/build-frontend.sh` (build statis ke `/var/www/bookingcloud`) dan `deploy/scripts/test-restart.sh` (uji ketahanan data reservasi setelah `docker compose restart api`).

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

