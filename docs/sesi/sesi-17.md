# Sesi 17 — DNS dengan BIND9

```
Buat konfigurasi BIND9 (dipasang langsung di server) di /deploy/bind9 dan panduan di /docs/dns.md.
- named.conf.local: zona maju untuk domain demo (placeholder: bookingcloud.example.id) dan zona balik jika relevan.
- File zona: SOA, NS (ns1), A record untuk @, www, dan ns1 → IP publik server (placeholder IP), serial format YYYYMMDDNN.
- named.conf.options: forwarders, allow-query, matikan recursion untuk klien eksternal (cegah open resolver), listen di IP yang sesuai.
- Panduan: instal bind9, taruh file, `named-checkconf` dan `named-checkzone`, restart, uji dengan `dig @IP-server domain`, dan cara mengarahkan resolver klien ke server untuk demo (mis. ubah DNS di laptop) karena domain asli mungkin tidak didelegasikan.
Selesai bila: dokumen + berkas konfigurasi lengkap, dengan variabel yang jelas bagian mana yang harus diganti.
```

Setelah selesai: pastikan tes lulus, centang sesi 17 di PROGRESS.md, git commit. Jangan lanjut ke sesi berikutnya.
