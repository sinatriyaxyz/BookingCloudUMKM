# Panduan Deploy Server & Nginx — BookingCloud UMKM

Dokumen ini memandu langkah demi langkah proses instalasi dan deployment **BookingCloud UMKM** pada **Ubuntu Server (22.04 / 24.04 / 26.04 LTS)**, baik di **Oracle Cloud Free Tier (VPS)** maupun di **VM lokal** untuk pengujian pra-produksi.

Arsitektur sesuai spesifikasi proyek:
- **MariaDB & Backend Express API**: berjalan di dalam container Docker (`docker compose`), dengan port API `127.0.0.1:3000` hanya terekspos ke localhost server.
- **Nginx**: dipasang **langsung di host server** (bukan container) sebagai web server aset statis React (`/var/www/bookingcloud`) sekaligus reverse proxy untuk `/api/` ke `127.0.0.1:3000`.
- **BIND9**: dipasang **langsung di host server** (lihat [docs/dns.md](./dns.md)).

---

## 1. Pembaruan Sistem & Paket Dasar

Masuk ke server melalui SSH, lalu perbarui daftar paket dan sistem operasi:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ca-certificates gnupg lsb-release ufw
```

**Verifikasi:**
```bash
lsb_release -a
uname -r
```

---

## 2. Membuat User Non-Root

Jika Anda masuk sebagai `root`, buat user administrator non-root (misalnya `deploy` atau `sinatriya`) dan berikan akses `sudo`:

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
```

Salin kunci SSH publik ke user baru tersebut:

```bash
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

**Verifikasi:** Buka terminal baru dari komputer lokal Anda dan uji login:
```bash
ssh deploy@IP_SERVER
sudo whoami
# Output yang diharapkan: root
```

---

## 3. Hardening SSH (Kunci Publik Saja, Matikan Password)

> **Peringatan:** Pastikan Anda **sudah berhasil masuk menggunakan SSH Key** sebelum mematikan autentikasi password agar tidak terkunci dari server.

Salin kunci SSH dari laptop Anda (jalankan di laptop lokal jika belum):
```bash
ssh-copy-id deploy@IP_SERVER
```

Di server, sunting konfigurasi daemon SSH `/etc/ssh/sshd_config`:

```bash
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
```

Uji sintaks konfigurasi SSH dan muat ulang layanan:

```bash
sudo sshd -t && sudo systemctl reload ssh
```

**Verifikasi:**
```bash
sudo sshd -T | grep -E "passwordauthentication|permitrootlogin|pubkeyauthentication"
# Output yang diharapkan:
# permitrootlogin no
# pubkeyauthentication yes
# passwordauthentication no
```

---

## 4. Konfigurasi Firewall (UFW) & Oracle Cloud Security List

### 4.1 Konfigurasi UFW di Ubuntu

Izinkan port **22/tcp** (SSH), **80/tcp** (HTTP), **443/tcp** (HTTPS), serta **53/tcp** dan **53/udp** (DNS BIND9):

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP Nginx'
sudo ufw allow 443/tcp comment 'HTTPS Nginx'
sudo ufw allow 53/tcp comment 'DNS BIND9 TCP'
sudo ufw allow 53/udp comment 'DNS BIND9 UDP'
sudo ufw --force enable
```

**Verifikasi:**
```bash
sudo ufw status numbered
```

### 4.2 Catatan Khusus Oracle Cloud Free Tier (Security List / NSG & iptables)

Pada **Oracle Cloud Infrastructure (OCI)**, membuka port di UFW saja **belum cukup** karena trafik disaring di tingkat jaringan virtual (VCN):

1. Masuk ke **Oracle Cloud Console** → **Networking** → **Virtual Cloud Networks (VCN)** → pilih VCN instance Anda → **Subnets** → pilih Subnet publik → **Security Lists** → **Default Security List** (atau **Network Security Group / NSG** yang terpasang pada VNIC).
2. Tambahkan **Ingress Rules** berikut untuk Source CIDR `0.0.0.0/0`:
   - Protocol **TCP**, Destination Port Range: `80` (HTTP)
   - Protocol **TCP**, Destination Port Range: `443` (HTTPS)
   - Protocol **TCP**, Destination Port Range: `53` (DNS TCP)
   - Protocol **UDP**, Destination Port Range: `53` (DNS UDP)
3. Image Ubuntu bawaan Oracle Cloud sering memiliki aturan `iptables` ketat (`REJECT` di `INPUT`) yang mendahului UFW. Jika port masih terblokir dari luar, bersihkan aturan `REJECT` bawaan OCI dan simpan:
   ```bash
   sudo iptables -D INPUT -j REJECT --reject-with icmp-host-prohibited 2>/dev/null || true
   sudo iptables -D FORWARD -j REJECT --reject-with icmp-host-prohibited 2>/dev/null || true
   sudo netfilter-persistent save 2>/dev/null || true
   ```

---

## 5. Instalasi Docker Engine, Docker Compose, Node.js, dan Nginx

### 5.1 Pasang Docker & Docker Compose Plugin

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

> **Catatan:** Jika repositori resmi `docker-ce` belum menyediakan paket untuk rilis Ubuntu terbaru (mis. Ubuntu 26.04), gunakan paket resmi distro:
> ```bash
> sudo apt install -y docker.io docker-compose-v2
> ```

Tambahkan user Anda ke grup `docker` agar bisa menjalankan `docker` tanpa `sudo`:

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

**Verifikasi:**
```bash
docker --version
docker compose version
```

### 5.2 Pasang Node.js LTS (untuk Build Frontend Statis) & Nginx

```bash
sudo apt install -y nginx nodejs npm
```

**Verifikasi:**
```bash
node -v
npm -v
nginx -v
```

---

## 6. Clone Repositori & Konfigurasi `.env`

Clone repositori ke `/opt/bookingcloud` (atau direktori home user):

```bash
sudo mkdir -p /opt/bookingcloud
sudo chown "$USER:$USER" /opt/bookingcloud
git clone https://github.com/USERNAME/BookingCloudUMKM.git /opt/bookingcloud
cd /opt/bookingcloud
```

Salin `.env.example` menjadi `.env` dan sesuaikan password database serta `JWT_SECRET`:

```bash
cp .env.example .env
```

Contoh isi `.env` produksi (buat secret acak dengan `openssl rand -hex 32`):

```ini
DB_HOST=localhost
DB_PORT=3306
DB_USER=bookingcloud
DB_PASSWORD=GantiPasswordDBKuat123!
DB_NAME=bookingcloud
JWT_SECRET=ganti_dengan_hasil_openssl_rand_hex_32_karakter_acak
PORT=3000
TZ=Asia/Jakarta
```

Amankan izin berkas `.env`:

```bash
chmod 600 .env
```

---

## 7. Menjalankan Container Database & Backend (`docker compose`)

Jalankan MariaDB dan Backend API di latar belakang:

```bash
cd /opt/bookingcloud
docker compose up -d --build
```

Container `api` secara otomatis akan menunggu `db` berstatus `healthy`, menjalankan migrasi SQL (`db/migrations/*.sql`), lalu menjalankan server Express pada `127.0.0.1:3000`.

*(Opsional)* Jika ingin mengisi data contoh awal (seed UMKM sampel):
```bash
docker compose exec api npm run seed
```

**Verifikasi:**
```bash
docker compose ps
curl -i http://127.0.0.1:3000/api/health
# Output yang diharapkan: HTTP/1.1 200 OK -> {"status":"ok"}
```

---

## 8. Build Frontend & Konfigurasi Nginx

### 8.1 Build Aset Statis React ke `/var/www/bookingcloud`

Jalankan skrip `build-frontend.sh`:

```bash
cd /opt/bookingcloud
bash deploy/scripts/build-frontend.sh
```

**Verifikasi:**
```bash
ls -la /var/www/bookingcloud
# Harus menampilkan index.html dan folder assets/
```

### 8.2 Pasang Konfigurasi Server Block Nginx

Salin berkas `deploy/nginx/bookingcloud.conf` ke `/etc/nginx/sites-available/bookingcloud`:

```bash
sudo cp /opt/bookingcloud/deploy/nginx/bookingcloud.conf /etc/nginx/sites-available/bookingcloud
```

Jika Anda menggunakan nama domain khusus, sesuaikan baris `server_name` di `/etc/nginx/sites-available/bookingcloud`:

```bash
sudo sed -i 's/bookingcloud.example.id/domain-anda.id/g' /etc/nginx/sites-available/bookingcloud
```

Aktifkan site `bookingcloud`, hapus site `default` bawaan, uji konfigurasi, dan muat ulang Nginx:

```bash
sudo ln -sf /etc/nginx/sites-available/bookingcloud /etc/nginx/sites-enabled/bookingcloud
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

**Verifikasi:**
```bash
# 1. Cek endpoint API melalui reverse proxy Nginx (port 80)
curl -i http://127.0.0.1/api/health

# 2. Cek halaman utama SPA & fallback rute React Router
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/cek
```

---

## 9. Pembaruan Otomatis dengan `deploy.sh`

Untuk pembaruan berikutnya setelah ada perubahan kode, cukup jalankan satu perintah:

```bash
cd /opt/bookingcloud
bash deploy/scripts/deploy.sh
```

Skrip `deploy/scripts/deploy.sh` akan menjalankan urutan:
1. `git pull --ff-only`
2. Build ulang frontend ke `/var/www/bookingcloud`
3. `docker compose up -d --build`
4. `sudo nginx -t && sudo systemctl reload nginx`
5. Verifikasi `http://127.0.0.1/api/health`

---

## 10. (Opsional) Mengaktifkan HTTPS dengan Certbot (Let's Encrypt)

> **Catatan:** Langkah ini bersifat **opsional** dan hanya dapat dijalankan apabila server memiliki IP publik serta domain publik yang A record-nya sudah mengarah ke IP publik server di internet.

1. Pasang Certbot dan plugin Nginx:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   ```
2. Pastikan `server_name` pada `/etc/nginx/sites-available/bookingcloud` memuat domain publik Anda, lalu jalankan Certbot:
   ```bash
   sudo certbot --nginx -d bookingcloud.example.id -d www.bookingcloud.example.id --redirect --agree-tos -m admin@bookingcloud.example.id
   ```
3. **Verifikasi pembaruan otomatis sertifikat:**
   ```bash
   sudo certbot renew --dry-run
   curl -I https://bookingcloud.example.id/api/health
   ```

