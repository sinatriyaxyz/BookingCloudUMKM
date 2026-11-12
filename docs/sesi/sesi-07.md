# Sesi 7 — Booking + anti-bentrok (F-06)

```
Kerjakan F-06 — bagian paling kritis.
- `backend/src/services/bookingCode.js`: kode 8 karakter (A-Z tanpa I,O + 2-9), dengan retry jika bentrok UNIQUE.
- POST /api/public/businesses/:slug/bookings {serviceId, date, time, customerName, customerPhone}
  Alur di DALAM satu transaksi DB:
    1) BEGIN; kunci baris UMKM (SELECT ... FOR UPDATE pada businesses WHERE id=?)
    2) validasi: layanan milik UMKM & aktif; di dalam jam operasional; bukan libur; bukan masa lalu (WIB)
    3) cek tabrakan dengan reservasi aktif (menunggu/dikonfirmasi) di rentang [mulai, selesai)
    4) jika bentrok → ROLLBACK, balas 409 {code:"SLOT_TAKEN", message:"Jam sudah terisi, pilih jam lain."}
    5) INSERT status 'menunggu', COMMIT, balas 201 {code, startAt, endAt, status}
- Validasi nama (wajib) dan telepon (format Indonesia 9–15 digit, mulai 0 atau +62).
- Tes wajib:
  a) booking sukses → mendapat kode 8 karakter
  b) di luar jam buka → 422; tanggal lampau → 422; hari libur → 422
  c) booking beririsan → 409
  d) KONKURENSI: kirim 20 request booking serentak (Promise.all) ke jam yang sama → tepat 1 berstatus 201, 19 berstatus 409
Selesai bila: tes (d) lulus konsisten (jalankan 3 kali).
```

Setelah selesai: pastikan tes lulus, centang sesi 7 di PROGRESS.md, git commit. Jangan lanjut ke sesi berikutnya.
