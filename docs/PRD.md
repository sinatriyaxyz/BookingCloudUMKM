**Product Requirement Document**** (****PRD****)**

** BookingCloud UMKM**

Mata kuliah Cloud Computing | Kelompok 4 

# 1. Ringkasan

BookingCloud UMKM adalah website reservasi online untuk UMKM jasa seperti barbershop, salon, bengkel, dan studio foto. Satu platform melayani banyak UMKM. Setiap UMKM punya akun dan dashboard sendiri, sedangkan pelanggan bisa booking tanpa membuat akun.

Masalah yang diselesaikan: reservasi lewat chat atau catatan manual sering bentrok (double booking), dan pelanggan harus bertanya dulu apakah jam tertentu kosong.

Proyek ini juga dipakai untuk menerapkan konsep cloud: VPS (IaaS), aplikasi berbasis browser (SaaS), dan banyak UMKM dalam satu infrastruktur.

# 2. Pengguna

- **Pemilik UMKM:** daftar, login, mengatur profil, layanan, jam buka, dan mengelola reservasi.

- **Pelanggan:** melihat UMKM dan layanan, memilih jam kosong, booking, lalu mengecek status dengan kode booking.

# 3. Fitur

| **ID** | **Fitur** | **Prioritas** |
| --- | --- | --- |
| F-01 | Daftar dan login pemilik UMKM | Wajib |
| F-02 | Profil UMKM (nama, kategori, alamat, telepon) dengan halaman publik | Wajib |
| F-03 | Kelola layanan (nama, harga, durasi) | Wajib |
| F-04 | Atur jam operasional per hari dan tanggal libur | Wajib |
| F-05 | Lihat jam kosong per layanan dan tanggal | Wajib |
| F-06 | Booking tanpa akun, dapat kode booking | Wajib |
| F-07 | Cek status reservasi dengan kode booking | Wajib |
| F-08 | Pemilik mengonfirmasi, menyelesaikan, atau membatalkan reservasi | Wajib |
| F-09 | Dashboard sederhana: reservasi hari ini dan riwayat | Wajib |
| F-10 | Pelanggan membatalkan booking dengan kode booking | Sebaiknya |
| F-11 | Data setiap UMKM terpisah dan tidak bisa diakses UMKM lain | Wajib |
| F-12 | Notifikasi otomatis (WhatsApp, Telegram, email) | Tidak di MVP |

# 4. Aturan Utama

- Reservasi harus berada dalam jam operasional dan tidak boleh lewat waktu.

- Dua reservasi aktif (menunggu atau dikonfirmasi) tidak boleh bertabrakan di UMKM yang sama.

- Status reservasi hanya berjalan: Menunggu → Dikonfirmasi → Selesai, atau dibatalkan dari status aktif.

- Kode booking unik, 8 karakter.

- Semua waktu memakai WIB.

# 5. Alur Booking

1. Pelanggan memilih UMKM, layanan, tanggal, dan jam kosong.

2. Pelanggan mengisi nama dan nomor telepon.

3. Backend mengecek ulang jadwal di dalam transaksi database, lalu menyimpan reservasi.

4. Jika jadwal sudah terisi, pelanggan diminta memilih jam lain.

5. Jika berhasil, pelanggan menerima kode booking. Pemilik melihat reservasi baru di dashboard.

# 6. Teknologi

| **Bagian** | **Pilihan** |
| --- | --- |
| Server | Oracle Cloud Free Tier, Ubuntu Server (cadangan: VPS lain min. 1 vCPU/2 GB) + Ubuntu Server LTS |
| Web server dan proxy | Nginx (langsung di server) |
| DNS | BIND9 (langsung di server) |
| Akses admin | SSH |
| Frontend | React (hasil build statis) |
| Backend | Node.js dengan Express |
| Database | MariaDB di Docker, dengan volume persisten |
| Container | Docker dan Docker Compose |
| Kode | GitHub |

# 7. Pengujian

- Akun UMKM A tidak bisa melihat atau mengubah data UMKM B.

- 20 request booking serentak ke jam yang sama: hanya 1 yang berhasil.

- Booking di luar jam buka dan tanggal lampau ditolak.

- Setelah backend di-restart, data reservasi masih ada.

- Aplikasi bisa dibuka lewat nama domain yang dikelola BIND9.

# 8. Batasan

- Satu server, tanpa high availability.

- Satu antrean per UMKM. Belum mendukung banyak karyawan dengan jadwal sendiri.

- Belum ada pembayaran online.

- Tidak ada fitur AI di dalam aplikasi. AI hanya dipakai sebagai alat bantu pengembangan.

# 9. Pertanyaan Terbuka

- Reservasi perlu dikonfirmasi pemilik, atau langsung diterima otomatis?

- Domain apa yang dipakai untuk demo?

- Pelanggan boleh membatalkan kapan saja, atau ada batas waktu?

2