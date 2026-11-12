# Sesi 0 — Fondasi repo

```
Siapkan fondasi proyek di repo yang SUDAH di-clone ini.
Aturan khusus sesi ini: JANGAN git init ulang; JANGAN menimpa/menghapus README.md, AGENTS.md, CLAUDE.md, PROGRESS.md, docs/PRD.md, docs/sesi/.
0. Jalankan `ls -la` dan `git status`. Jika ternyata sudah ada kode/stack lain (mis. Laravel, atau backend/frontend yang berbeda dari AGENTS.md), BERHENTI, jangan hapus apa pun, laporkan isinya dalam 5 baris, dan tunggu instruksi.
1. Buat struktur folder sesuai AGENTS.md (backend, frontend, db, deploy, docs).
2. backend/: npm init (ESM), pasang express, mysql2, bcrypt, jsonwebtoken, zod, dayjs, dotenv, cors; dev: vitest, supertest.
   Buat src/app.js (export app Express dengan endpoint GET /api/health -> {status:"ok"}) dan src/server.js (listen).
3. frontend/: scaffold Vite + React (belum ada halaman).
4. docker-compose.yml: HANYA service MariaDB 11 dengan volume persisten bernama `db_data`, variabel dari .env.
5. .env.example (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, PORT, TZ=Asia/Jakarta) dan .gitignore (node_modules, .env, dist).
6. Satu tes vitest untuk /api/health.
Selesai bila: `docker compose up -d` menjalankan MariaDB, `npm test` di backend lulus, commit dibuat.
```

Setelah selesai: pastikan tes lulus, centang sesi 0 di PROGRESS.md, git commit. Jangan lanjut ke sesi berikutnya.
