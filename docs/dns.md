# Panduan Konfigurasi DNS dengan BIND9 — BookingCloud UMKM

Dokumen ini menjelaskan cara memasang dan mengonfigurasi **BIND9** secara langsung di Ubuntu Server (bukan di dalam container) sebagai server DNS otoritatif untuk domain demo **`bookingcloud.example.id`**.

Semua berkas konfigurasi tersimpan di direktori [`deploy/bind9/`](../deploy/bind9/):
- [`deploy/bind9/named.conf.options`](../deploy/bind9/named.conf.options) — opsi keamanan global (`recursion no` untuk mencegah open resolver, `allow-query`, `forwarders`, `listen-on`).
- [`deploy/bind9/named.conf.local`](../deploy/bind9/named.conf.local) — deklarasi zona maju (`bookingcloud.example.id`) dan zona balik (`56.168.192.in-addr.arpa`).
- [`deploy/bind9/db.bookingcloud.example.id`](../deploy/bind9/db.bookingcloud.example.id) — berkas zona maju (`SOA`, `NS`, serta record `A` untuk `@`, `www`, dan `ns1`).
- [`deploy/bind9/db.192.168.56`](../deploy/bind9/db.192.168.56) — berkas zona balik (`PTR`).

---

## 1. Variabel / Placeholder yang Harus Disesuaikan Saat Pindah ke VPS

Secara bawaan, berkas di `deploy/bind9/` telah diisi dengan IP VM lokal **`192.168.56.13`** agar langsung siap diuji. Ketika Anda men-deploy ke VPS final (misalnya IP publik VPS adalah `203.0.113.25`), ganti nilai berikut:

| Bagian / Variabel | Nilai Default (VM Lokal) | Contoh Nilai di VPS | Berkas yang Diubah |
|---|---|---|---|
| **Domain** | `bookingcloud.example.id` | `bookingcloud.example.id` (atau domain Anda) | `named.conf.local`, `db.bookingcloud.example.id`, `db.192.168.56` |
| **IP Server (`A` record)** | `192.168.56.13` | `203.0.113.25` (IP publik VPS) | `db.bookingcloud.example.id` |
| **Serial Zona** | `2026111201` (`YYYYMMDDNN`) | Tanggal hari itu + urutan revisi (`01`, `02`, ...) | `db.bookingcloud.example.id`, `db.192.168.56` |
| **Nama Zona Balik** | `56.168.192.in-addr.arpa` | `113.0.203.in-addr.arpa` (3 oktet pertama IP dibalik) | `named.conf.local` |
| **Oktet Host (`PTR`)** | `13` | `25` (oktet ke-4 dari IP server) | `db.192.168.56` |

> **Tips cepat mengganti IP saat di VPS:**
> ```bash
> export VPS_IP="203.0.113.25"
> sudo sed -i "s/192.168.56.13/$VPS_IP/g" /etc/bind/zones/db.bookingcloud.example.id
> ```

---

## 2. Instalasi BIND9 dan Utilitas DNS

Jalankan perintah berikut di server Ubuntu:

```bash
sudo apt update
sudo apt install -y bind9 bind9utils bind9-doc dnsutils
```

Pastikan port **53/tcp** dan **53/udp** sudah diizinkan di UFW (dan di Security List / NSG Oracle Cloud):

```bash
sudo ufw allow 53/tcp
sudo ufw allow 53/udp
```

---

## 3. Menyalin Berkas Konfigurasi BIND9

Buat direktori `/etc/bind/zones` untuk menyimpan file zona, lalu salin seluruh berkas dari repositori:

```bash
sudo mkdir -p /etc/bind/zones

sudo cp /opt/bookingcloud/deploy/bind9/named.conf.options /etc/bind/named.conf.options
sudo cp /opt/bookingcloud/deploy/bind9/named.conf.local /etc/bind/named.conf.local
sudo cp /opt/bookingcloud/deploy/bind9/db.bookingcloud.example.id /etc/bind/zones/db.bookingcloud.example.id
sudo cp /opt/bookingcloud/deploy/bind9/db.192.168.56 /etc/bind/zones/db.192.168.56

sudo chown -R root:bind /etc/bind/zones
sudo chmod 644 /etc/bind/zones/*
```

---

## 4. Validasi Sintaks Konfigurasi & File Zona

Sebelum me-restart layanan BIND9, **wajib** memastikan tidak ada kesalahan sintaks:

```bash
# 1. Periksa sintaks konfigurasi utama BIND9 (tidak menghasilkan output jika valid)
sudo named-checkconf

# 2. Periksa validitas file zona maju
sudo named-checkzone bookingcloud.example.id /etc/bind/zones/db.bookingcloud.example.id

# 3. Periksa validitas file zona balik
sudo named-checkzone 56.168.192.in-addr.arpa /etc/bind/zones/db.192.168.56
```

**Output yang diharapkan dari `named-checkzone`:**
```text
zone bookingcloud.example.id/IN: loaded serial 2026111201
OK
zone 56.168.192.in-addr.arpa/IN: loaded serial 2026111201
OK
```

---

## 5. Mengaktifkan & Me-restart Layanan BIND9

```bash
sudo systemctl enable --now named
sudo systemctl restart named
sudo systemctl status named --no-pager
```

*(Catatan: Pada Ubuntu 22.04+, unit systemd untuk `bind9` bernama `named.service`, dan alias `bind9` mengarah ke `named`.)*

---

## 6. Pengujian Resolusi DNS dengan `dig`

Gunakan perintah `dig` yang diarahkan langsung ke IP server (`@192.168.56.13` atau `@IP_VPS`):

```bash
# 1. Uji A record domain utama (@)
dig @192.168.56.13 bookingcloud.example.id +short
# Output: 192.168.56.13

# 2. Uji A record subdomain www
dig @192.168.56.13 www.bookingcloud.example.id +short
# Output: 192.168.56.13

# 3. Uji NS record dan SOA record
dig @192.168.56.13 bookingcloud.example.id NS +noall +answer
dig @192.168.56.13 bookingcloud.example.id SOA +noall +answer

# 4. Uji Reverse DNS (PTR record)
dig @192.168.56.13 -x 192.168.56.13 +short
# Output: bookingcloud.example.id.

# 5. Verifikasi keamanan: pastikan rekursi ke domain luar DITOLAK (status: REFUSED)
dig @192.168.56.13 google.com
# Pada bagian HEADER harus tertulis: status: REFUSED (bukan NOERROR)
```

---

## 7. Mengarahkan Resolver Klien (Laptop) ke Server DNS untuk Demo

Karena domain `bookingcloud.example.id` adalah domain demo yang tidak didelegasikan dari registrar publik, perangkat klien (laptop penguji) perlu diarahkan untuk menggunakan IP server (`192.168.56.13` atau `IP_VPS`) sebagai DNS Resolver:

### Opsi A — Pengujian Langsung via PowerShell / Terminal di Laptop (Tanpa Mengubah Pengaturan Jaringan)

Di **Windows PowerShell**:
```powershell
nslookup bookingcloud.example.id 192.168.56.13
Resolve-DnsName -Name bookingcloud.example.id -Server 192.168.56.13
curl.exe -i -H "Host: bookingcloud.example.id" http://192.168.56.13/api/health
```

### Opsi B — Mengubah DNS Adapter di Windows (Agar Browser Langsung Membuka `http://bookingcloud.example.id`)

1. Buka **Settings** → **Network & internet** → pilih koneksi aktif (atau adapter VirtualBox Host-Only Network / Wi-Fi) → **Hardware properties** → **DNS server assignment** → klik **Edit**.
2. Pilih **Manual** → aktifkan **IPv4**:
   - **Preferred DNS**: `192.168.56.13` *(atau IP publik VPS Anda)*
   - **Alternate DNS**: `1.1.1.1` *(agar internet umum tetap berjalan)*
3. Atau jalankan lewat PowerShell (sebagai Administrator):
   ```powershell
   # Bersihkan cache DNS Windows setelah mengubah DNS
   ipconfig /flushdns
   ```
4. Buka browser dan akses: **`http://bookingcloud.example.id`** serta **`http://www.bookingcloud.example.id`**.

### Opsi C — Mengubah DNS di Linux / macOS

- **Linux (`systemd-resolved`):**
  ```bash
  sudo resolvectl dns <nama_interface> 192.168.56.13 1.1.1.1
  sudo resolvectl domain <nama_interface> "~bookingcloud.example.id"
  ```
- **macOS:**
  ```bash
  sudo networksetup -setdnsservers Wi-Fi 192.168.56.13 1.1.1.1
  ```

