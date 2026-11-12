# Sesi 4 — Kelola layanan (F-03)

```
Kerjakan F-03. Semua endpoint pakai auth dan SELALU memfilter business_id dari token.
- GET/POST /api/services, PUT/DELETE /api/services/:id (DELETE = soft delete: is_active=false).
- Validasi: nama wajib, harga >= 0, durasi 15–480 menit dan kelipatan 15.
- Layanan milik UMKM lain → 404.
- Tes: CRUD dasar, validasi, dan satu tes bahwa UMKM B tidak bisa mengubah layanan UMKM A (404).
```

Setelah selesai: pastikan tes lulus, centang sesi 4 di PROGRESS.md, git commit. Jangan lanjut ke sesi berikutnya.
