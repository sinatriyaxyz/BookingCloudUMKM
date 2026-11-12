# Sesi 15 — Dockerisasi

```
- backend/Dockerfile (node:20-alpine, multi-stage, user non-root, health check ke /api/health).
- Lengkapi docker-compose.yml: service `db` (MariaDB + volume db_data + healthcheck) dan `api` (build backend, depends_on db healthy, env dari .env, publish port HANYA ke 127.0.0.1:3000). Migrasi dijalankan otomatis saat api start.
- Frontend: tambahkan skrip `deploy/scripts/build-frontend.sh` yang membangun dan menyalin hasil ke /var/www/bookingcloud (dist statis; Nginx yang menyajikan, BUKAN container).
- Tes ketahanan: `docker compose restart api` lalu data reservasi tetap ada (tulis sebagai skrip `deploy/scripts/test-restart.sh`).
Selesai bila: `docker compose up -d --build` menjalankan db+api dan skrip test-restart lulus di lokal.
```

Setelah selesai: pastikan tes lulus, centang sesi 15 di PROGRESS.md, git commit. Jangan lanjut ke sesi berikutnya.
