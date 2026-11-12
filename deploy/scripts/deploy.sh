#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
NGINX_CONF_SRC="$REPO_DIR/deploy/nginx/bookingcloud.conf"
NGINX_AVAILABLE="/etc/nginx/sites-available/bookingcloud"
NGINX_ENABLED="/etc/nginx/sites-enabled/bookingcloud"

cd "$REPO_DIR"

echo "==> [1/4] Memperbarui kode dari repositori Git..."
if git remote get-url origin >/dev/null 2>&1; then
  git pull --ff-only
else
  echo "    (Remote 'origin' belum diatur, melewati git pull)"
fi

echo "==> [2/4] Membangun frontend statis ke /var/www/bookingcloud..."
bash "$REPO_DIR/deploy/scripts/build-frontend.sh"

echo "==> [3/4] Menjalankan container database & backend dengan Docker Compose..."
if [ ! -f "$REPO_DIR/.env" ]; then
  echo "    PERINGATAN: .env belum ada, menyalin dari .env.example..."
  cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
fi
docker compose up -d --build

echo "==> [4/4] Memasang & memuat ulang konfigurasi Nginx..."
if [ -d /etc/nginx/sites-available ]; then
  sudo cp "$NGINX_CONF_SRC" "$NGINX_AVAILABLE"
  sudo ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  if [ -e /etc/nginx/sites-enabled/default ]; then
    sudo rm -f /etc/nginx/sites-enabled/default
  fi
fi

sudo nginx -t
sudo systemctl reload nginx

echo "==> Menunggu API sehat..."
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1/api/health >/dev/null 2>&1; then
    echo "==> Deploy selesai! Respons /api/health:"
    curl -s http://127.0.0.1/api/health
    echo ""
    exit 0
  fi
  sleep 2
done

echo "GAGAL: /api/health tidak merespons setelah 60 detik." >&2
exit 1

