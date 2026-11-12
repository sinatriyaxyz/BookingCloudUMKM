# Sesi 14 — Frontend publik: alur booking pelanggan

```
Halaman publik (tanpa login):
- `/` daftar UMKM dengan filter kategori.
- `/u/:slug` profil UMKM + daftar layanan.
- `/u/:slug/booking`: pilih layanan → pilih tanggal → tampilkan grid jam kosong dari endpoint availability → isi nama & telepon → kirim.
  Jika 409 SLOT_TAKEN: tampilkan pesan, muat ulang jam kosong, minta pilih jam lain.
- Halaman sukses menampilkan kode booking besar + tombol salin + tautan cek status.
- `/cek` : input kode booking → tampil status; tombol "Batalkan" jika diizinkan, tampilkan pesan error aturan batas waktu.
Responsif untuk HP. Selesai bila: alur penuh dari beranda sampai kode booking dan cek status berjalan; build sukses.
```

Setelah selesai: pastikan tes lulus, centang sesi 14 di PROGRESS.md, git commit. Jangan lanjut ke sesi berikutnya.
