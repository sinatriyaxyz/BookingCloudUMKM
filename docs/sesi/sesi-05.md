# Sesi 5 — Jam operasional + tanggal libur (F-04)

```
Kerjakan F-04 (auth, filter business_id dari token).
- GET /api/operating-hours → 7 hari (hari yang belum diatur dianggap tutup).
- PUT /api/operating-hours → set 7 hari sekaligus; validasi open_time < close_time; is_closed boleh true.
- GET/POST /api/holidays, DELETE /api/holidays/:id (tanggal tidak boleh duplikat).
- Tes: validasi jam, set lalu baca ulang, libur duplikat ditolak.
```

Setelah selesai: pastikan tes lulus, centang sesi 5 di PROGRESS.md, git commit. Jangan lanjut ke sesi berikutnya.
