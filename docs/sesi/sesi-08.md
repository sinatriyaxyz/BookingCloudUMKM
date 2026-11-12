# Sesi 8 — Cek status + batal oleh pelanggan (F-07, F-10)

```
Kerjakan F-07 dan F-10.
- GET /api/public/bookings/:code → {code, businessName, serviceName, startAt, endAt, status, customerName}. Kode tidak ada → 404. Kode huruf kecil diterima (normalisasi ke huruf besar).
- POST /api/public/bookings/:code/cancel → hanya jika status menunggu/dikonfirmasi DAN sisa waktu >= CANCEL_MIN_HOURS (2 jam, WIB). Selain itu → 422 dengan pesan jelas.
- Tes: cek status, kode salah, batal sukses, batal terlalu mepet ditolak, batal pada status selesai ditolak.
```

Setelah selesai: pastikan tes lulus, centang sesi 8 di PROGRESS.md, git commit. Jangan lanjut ke sesi berikutnya.
