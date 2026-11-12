# Sesi 2 — Backend dasar + autentikasi (F-01)

```
Kerjakan F-01.
- Middleware: error handler (format error AGENTS.md), validasi zod, requireAuth (verifikasi JWT, isi req.businessId).
- POST /api/auth/register {email, password, businessName, category} → buat UMKM + slug unik dari nama; password min 8 karakter; email unik.
- POST /api/auth/login → JWT (berlaku 8 jam) berisi businessId.
- GET /api/me → data UMKM milik token (tanpa password_hash).
- Tes vitest+supertest: register sukses, email ganda ditolak, login salah ditolak, /api/me tanpa token → 401.
Selesai bila: semua tes lulus.
```

Setelah selesai: pastikan tes lulus, centang sesi 2 di PROGRESS.md, git commit. Jangan lanjut ke sesi berikutnya.
