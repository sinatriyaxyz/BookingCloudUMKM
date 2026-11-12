# Sesi 11 — Frontend dasar + autentikasi

```
Di /frontend (Vite + React): pasang react-router-dom.
- `src/api/client.js`: fetch wrapper (base URL `/api`, menyisipkan token JWT dari localStorage, menangani error format AGENTS.md).
- Layout sederhana (CSS biasa, bersih, responsif mobile-first), proxy dev Vite ke backend :3000.
- Halaman: /owner/register, /owner/login, route terlindungi /owner/* (redirect ke login jika tidak ada token), tombol logout.
- Teks UI Bahasa Indonesia. Tangani status loading dan error di form.
Selesai bila: register → login → masuk halaman /owner (placeholder) berjalan melawan backend; `npm run build` sukses.
```

Setelah selesai: pastikan tes lulus, centang sesi 11 di PROGRESS.md, git commit. Jangan lanjut ke sesi berikutnya.
