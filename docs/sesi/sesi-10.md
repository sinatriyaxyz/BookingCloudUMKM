# Sesi 10 — Tes isolasi & ketahanan (F-11)

```
Kerjakan F-11 sebagai tes lintas-tenant, TANPA mengubah fitur (hanya perbaiki bug jika tes menemukannya).
Buat tests/isolation.test.js: siapkan UMKM A dan B dengan data masing-masing. Dengan token A, coba SEMUA endpoint
berparameter id (services, holidays, bookings confirm/complete/cancel) terhadap id milik B → harus 404 dan data B tidak berubah.
Pastikan juga GET list milik A tidak memuat data B.
Tambahkan skrip `npm run test:all`. Catat hasil di PROGRESS.md.
Selesai bila: semua tes backend (`npm run test:all`) lulus.
```

Setelah selesai: pastikan tes lulus, centang sesi 10 di PROGRESS.md, git commit. Jangan lanjut ke sesi berikutnya.
