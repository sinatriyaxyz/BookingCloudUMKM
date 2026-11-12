# AGENTS.md — BookingCloud UMKM

## Ringkasan produk
Website reservasi multi-UMKM (barbershop, salon, bengkel, studio foto). Satu platform, banyak UMKM.
Pemilik UMKM: punya akun + dashboard. Pelanggan: booking TANPA akun, dapat kode booking.

## Stack (jangan diganti)
- Frontend: React (Vite), hasil build statis
- Backend: Node.js + Express (JavaScript, ESM)
- Database: MariaDB di Docker, volume persisten
- Library: mysql2 (query SQL langsung, tanpa ORM), bcrypt, jsonwebtoken, zod, dayjs (+ plugin timezone)
- Tes: vitest + supertest (backend)
- Deploy: Docker Compose; Nginx dan BIND9 dipasang LANGSUNG di server (bukan container); akses admin lewat SSH

## Dokumen acuan (di repo ini)
- docs/PRD.md = PRD asli. Jika PRD dan AGENTS.md berbeda, AGENTS.md yang menang (sudah memuat keputusan atas "Pertanyaan Terbuka").
- docs/sesi/sesi-NN.md = instruksi tugas per sesi. Jangan diubah. Kerjakan hanya file sesi yang diminta.
- PROGRESS.md = status terkini. Selalu diperbarui di akhir sesi.

## Struktur repo
```
/backend      (src/routes, src/services, src/middleware, src/db, tests)
/frontend     (src/pages, src/components, src/api)
/db           (migrations/*.sql, seed.sql)
/deploy       (nginx/, bind9/, scripts/)
/docs         (deploy.md, pengujian.md)
docker-compose.yml
AGENTS.md
PROGRESS.md
docs/PRD.md  docs/sesi/
```

## Fitur (ID dipakai di commit dan PROGRESS.md)
F-01 Daftar/login pemilik · F-02 Profil UMKM + halaman publik · F-03 Kelola layanan (nama, harga, durasi) ·
F-04 Jam operasional per hari + tanggal libur · F-05 Lihat jam kosong per layanan & tanggal ·
F-06 Booking tanpa akun → kode booking · F-07 Cek status via kode · F-08 Pemilik konfirmasi/selesai/batal ·
F-09 Dashboard (reservasi hari ini + riwayat) · F-10 Pelanggan batal via kode (sebaiknya) ·
F-11 Isolasi data antar-UMKM · F-12 Notifikasi (TIDAK dikerjakan di MVP).

## Aturan bisnis (WAJIB)
1. Reservasi harus di dalam jam operasional, bukan hari libur, dan tidak boleh di masa lalu.
2. Dua reservasi AKTIF (Menunggu/Dikonfirmasi) tidak boleh bertabrakan waktunya di UMKM yang sama
   (tabrakan = rentang [mulai, selesai) saling beririsan; selesai = mulai + durasi layanan).
3. Status: Menunggu → Dikonfirmasi → Selesai. Dibatalkan hanya dari Menunggu atau Dikonfirmasi.
   Tidak ada transisi lain. Reservasi yang Selesai/Dibatalkan tidak boleh diubah lagi.
4. Kode booking: unik, 8 karakter, huruf besar + angka, hindari karakter mirip (0/O, 1/I).
5. Semua waktu WIB (Asia/Jakarta). Simpan di DB sebagai DATETIME WIB; jangan campur UTC.
6. Slot jam kosong dibuat per interval 30 menit (konstanta SLOT_STEP_MIN = 30).
7. Pelanggan boleh batal jika sisa waktu ke jam mulai >= CANCEL_MIN_HOURS (= 2).
8. Booking baru berstatus Menunggu; pemilik yang mengonfirmasi.
9. Cek bentrok HARUS dilakukan di dalam transaksi DB dengan penguncian (SELECT ... FOR UPDATE
   pada baris UMKM atau pada reservasi aktif tanggal itu), supaya 20 request serentak → hanya 1 berhasil.
10. Multi-tenant: semua query data milik UMKM wajib difilter `business_id` dari token JWT, BUKAN dari
    input klien. Akses data UMKM lain → 404 (bukan 403, agar keberadaan data tidak bocor).

## Konvensi
- Bahasa UI & pesan error: Bahasa Indonesia. Nama kode/variabel/tabel: Inggris.
- Format error API: `{ "error": { "code": "SLOT_TAKEN", "message": "..." } }`
- Validasi input dengan zod di setiap endpoint.
- Rahasia hanya di `.env` (jangan commit); sediakan `.env.example`.
- Commit: `feat(F-06): ...`, `test: ...`, `chore: ...`. Satu commit per sesi minimal.

## Cara bekerja (HEMAT LIMIT)
- Kerjakan HANYA sesi yang diminta. Jangan mengerjakan fitur sesi lain.
- Jangan mencetak ulang isi file utuh di jawaban. Tulis langsung ke file.
- Jangan menjelaskan panjang. Ringkasan akhir maksimal 10 baris: apa yang dibuat, cara menjalankan tes, hasil tes.
- Buka file seperlunya (pakai grep/ls dulu), jangan membaca seluruh repo.
- Buktikan hasil dengan menjalankan tes/perintah, bukan dengan membaca ulang kode.
- Di akhir sesi: jalankan tes yang relevan → update PROGRESS.md → git commit.
- Jika ada keputusan yang tidak ada di dokumen ini, pilih opsi paling sederhana, catat di PROGRESS.md bagian "Keputusan", lalu lanjut. Jangan berhenti untuk bertanya kecuali benar-benar buntu.
- Di luar lingkup (jangan dikerjakan): pembayaran online, banyak karyawan per UMKM, notifikasi WA/Telegram/email, fitur AI di aplikasi.
