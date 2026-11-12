# Sesi 9 — Kelola reservasi + dashboard (F-08, F-09)

```
Kerjakan F-08 dan F-09 (auth, filter business_id dari token).
- Buat `backend/src/services/bookingStatus.js`: fungsi murni `canTransition(from, to)` sesuai aturan status AGENTS.md.
- GET /api/bookings?date=&status=&page= → daftar reservasi UMKM (urut start_at), dengan paginasi.
- GET /api/dashboard → {today: [reservasi hari ini WIB], counts: {menunggu, dikonfirmasi, hari_ini}, history: 20 reservasi terakhir selesai/dibatalkan}.
- POST /api/bookings/:id/confirm | /complete | /cancel → pakai canTransition; transisi tidak valid → 422.
  "complete" hanya boleh jika reservasi sudah dikonfirmasi.
- Tes unit canTransition (semua kombinasi) + tes endpoint untuk alur menunggu→dikonfirmasi→selesai dan pembatalan.
```

Setelah selesai: pastikan tes lulus, centang sesi 9 di PROGRESS.md, git commit. Jangan lanjut ke sesi berikutnya.
