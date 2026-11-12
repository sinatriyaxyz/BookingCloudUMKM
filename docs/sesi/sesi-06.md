# Sesi 6 — Jam kosong (F-05)

```
Kerjakan F-05 dengan memisahkan logika murni dari HTTP.
- Buat `backend/src/services/availability.js` berisi fungsi murni
  `computeSlots({ date, durationMin, openTime, closeTime, isClosed, isHoliday, activeBookings, now })`
  → daftar jam mulai "HH:mm" dalam interval 30 menit (SLOT_STEP_MIN).
  Aturan: slot + durasi harus <= jam tutup; tidak beririsan dengan booking aktif ([mulai, selesai));
  slot yang sudah lewat dari `now` (WIB) dibuang; hari libur/tutup → [].
- GET /api/public/businesses/:slug/availability?serviceId=&date=YYYY-MM-DD memanggil fungsi itu.
- Tes unit untuk fungsi murni (minimal 8 kasus: hari tutup, libur, slot mepet jam tutup, booking di tengah, booking beririsan sebagian, tanggal lampau, hari ini sebagian lewat, durasi panjang) + 1 tes endpoint.
Selesai bila: tes lulus. Jangan membuat endpoint booking di sesi ini.
```

Setelah selesai: pastikan tes lulus, centang sesi 6 di PROGRESS.md, git commit. Jangan lanjut ke sesi berikutnya.
