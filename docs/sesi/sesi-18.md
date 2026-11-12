# Sesi 18 — Pengujian akhir + dokumentasi

```
Buat /docs/pengujian.md yang memetakan 5 butir pengujian PRD ke bukti:
1) UMKM A tidak bisa melihat/mengubah data UMKM B → nama tes isolasi + cara menjalankan + hasil
2) 20 request serentak ke jam yang sama → hanya 1 berhasil → nama tes + hasil
3) Booking di luar jam buka dan tanggal lampau ditolak → nama tes + hasil
4) Data tetap ada setelah backend di-restart → deploy/scripts/test-restart.sh + hasil
5) Aplikasi bisa dibuka lewat domain BIND9 → langkah manual + perintah `dig` + tempat menaruh tangkapan layar
Jalankan semua tes otomatis dan salin ringkasan hasil nyata (jangan mengarang hasil).
Buat README.md di root: deskripsi singkat, arsitektur (diagram teks: Browser → Nginx → React statis / Express → MariaDB Docker; BIND9 untuk DNS), cara menjalankan lokal, cara deploy (tautan ke docs/deploy.md & dns.md), akun demo dari seed, dan batasan (satu server tanpa HA, satu antrean per UMKM, tanpa pembayaran, tanpa fitur AI di aplikasi).
Tambahkan juga bagian "Pemetaan konsep cloud": IaaS (VM Oracle), SaaS (aplikasi via browser), multi-tenancy (satu infrastruktur banyak UMKM).
Selesai bila: semua tes lulus dan dokumen lengkap; PROGRESS.md semua sesi tercentang.
```

Setelah selesai: pastikan tes lulus, centang sesi 18 di PROGRESS.md, git commit. Jangan lanjut ke sesi berikutnya.
