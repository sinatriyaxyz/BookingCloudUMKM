# Sesi 16 — Deploy server + Nginx

```
Buat panduan dan konfigurasi deploy ke Ubuntu Server (Oracle Cloud Free Tier), simpan di /deploy dan /docs/deploy.md.
- docs/deploy.md: langkah berurutan — update sistem, buat user non-root, hardening SSH (kunci saja, matikan password), UFW (izinkan 22, 80, 443, dan 53 tcp/udp), pasang Docker + Compose, clone repo, isi .env, `docker compose up -d --build`. Sertakan catatan membuka port di Security List/NSG Oracle Cloud (selain UFW).
- deploy/nginx/bookingcloud.conf: server block untuk domain (variabel/placeholder), root ke /var/www/bookingcloud dengan fallback SPA (try_files ... /index.html), proxy `location /api/` ke 127.0.0.1:3000, header proxy standar, gzip, cache aset statis.
- deploy/scripts/deploy.sh: git pull → build frontend → docker compose up -d --build → nginx -t && systemctl reload nginx.
- (Opsional) langkah HTTPS dengan certbot, ditandai opsional.
Setiap langkah ditulis sebagai perintah yang bisa disalin, dengan perintah verifikasi (mis. curl ke /api/health).
Selesai bila: dokumen lengkap dan berkas konfigurasi lolos `nginx -t` (jika bisa diuji) atau terverifikasi sintaksnya.
```

Setelah selesai: pastikan tes lulus, centang sesi 16 di PROGRESS.md, git commit. Jangan lanjut ke sesi berikutnya.
