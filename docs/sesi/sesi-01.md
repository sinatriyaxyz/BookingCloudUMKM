# Sesi 1 — Skema database

```
Buat skema database di /db/migrations dan skrip penerapannya.
Tabel (MariaDB, utf8mb4, semua kolom waktu = DATETIME dalam WIB):
- businesses: id, owner_email (unik), password_hash, name, slug (unik), category (barbershop/salon/bengkel/studio_foto/lainnya), address, phone, created_at
- services: id, business_id (FK), name, price (INT rupiah), duration_min (INT), is_active, created_at
- operating_hours: id, business_id (FK), weekday (0-6), open_time, close_time, is_closed; unik (business_id, weekday)
- holidays: id, business_id (FK), date, note; unik (business_id, date)
- bookings: id, code CHAR(8) UNIK, business_id (FK), service_id (FK), customer_name, customer_phone,
  start_at, end_at, status ENUM('menunggu','dikonfirmasi','selesai','dibatalkan'), created_at, updated_at
  Index: (business_id, start_at), (business_id, status, start_at)
Catatan: satu akun pemilik = satu UMKM (digabung di tabel businesses agar sederhana).
Buat `backend/src/db/pool.js` (pool mysql2, timezone WIB) dan `backend/src/db/migrate.js` yang menjalankan semua .sql berurutan (catat yang sudah dijalankan di tabel `schema_migrations`).
Buat /db/seed.sql berisi 2 UMKM contoh (password hash bcrypt dibuat lewat skrip seed Node, bukan ditulis tangan), tiap UMKM 2 layanan dan jam buka Senin–Sabtu 09:00–17:00.
Selesai bila: `npm run migrate` dan `npm run seed` berhasil di MariaDB Docker dan migrasi aman dijalankan dua kali.
```

Setelah selesai: pastikan tes lulus, centang sesi 1 di PROGRESS.md, git commit. Jangan lanjut ke sesi berikutnya.
