#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BIND_SRC="$REPO_DIR/deploy/bind9"

# IP server dan domain dapat dikirim sebagai argumen:
#   bash deploy/scripts/setup-bind9.sh 203.0.113.25 bookingcloud.example.id
# Jika tidak diisi, otomatis mendeteksi IP lokal (atau default 192.168.56.13)
SERVER_IP="${1:-192.168.56.13}"
DOMAIN="${2:-bookingcloud.example.id}"

echo "==> Mengonfigurasi BIND9 untuk domain=$DOMAIN dengan IP=$SERVER_IP..."

if ! command -v named-checkconf >/dev/null 2>&1; then
  echo "==> Memasang paket bind9 & dnsutils..."
  sudo apt-get update -y
  sudo apt-get install -y bind9 bind9utils dnsutils
fi

sudo mkdir -p /etc/bind/zones
sudo cp "$BIND_SRC/named.conf.options" /etc/bind/named.conf.options
sudo cp "$BIND_SRC/named.conf.local" /etc/bind/named.conf.local
sudo cp "$BIND_SRC/db.bookingcloud.example.id" /etc/bind/zones/db.bookingcloud.example.id
sudo cp "$BIND_SRC/db.192.168.56" /etc/bind/zones/db.192.168.56

# Jika SERVER_IP berbeda dari placeholder default 192.168.56.13, ganti secara otomatis
if [ "$SERVER_IP" != "192.168.56.13" ]; then
  sudo sed -i "s/192.168.56.13/$SERVER_IP/g" /etc/bind/zones/db.bookingcloud.example.id
fi

if [ "$DOMAIN" != "bookingcloud.example.id" ]; then
  sudo sed -i "s/bookingcloud.example.id/$DOMAIN/g" /etc/bind/named.conf.local
  sudo sed -i "s/bookingcloud.example.id/$DOMAIN/g" /etc/bind/zones/db.bookingcloud.example.id
  sudo sed -i "s/bookingcloud.example.id/$DOMAIN/g" /etc/bind/zones/db.192.168.56
fi

sudo chown -R root:bind /etc/bind/zones
sudo chmod 644 /etc/bind/zones/*

echo "==> Memvalidasi konfigurasi BIND9..."
sudo named-checkconf
sudo named-checkzone "$DOMAIN" /etc/bind/zones/db.bookingcloud.example.id
sudo named-checkzone 56.168.192.in-addr.arpa /etc/bind/zones/db.192.168.56

echo "==> Me-restart layanan BIND9 (named)..."
sudo systemctl enable --now named
sudo systemctl restart named

echo "==> Menguji resolusi DNS lokal..."
dig @127.0.0.1 "$DOMAIN" +short
dig @127.0.0.1 "www.$DOMAIN" +short

