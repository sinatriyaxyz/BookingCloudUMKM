# Sesi 3 — Profil UMKM + halaman publik (F-02)

```
Kerjakan F-02.
- PUT /api/me/profile (auth): ubah name, category, address, phone (validasi zod). Slug tidak berubah.
- GET /api/public/businesses → daftar UMKM (name, slug, category, address); dukung query ?category=
- GET /api/public/businesses/:slug → profil publik + daftar layanan aktif (tanpa data sensitif seperti email/hash).
- Tes: update profil, slug tidak ditemukan → 404, response publik tidak memuat owner_email/password_hash.
```

Setelah selesai: pastikan tes lulus, centang sesi 3 di PROGRESS.md, git commit. Jangan lanjut ke sesi berikutnya.
