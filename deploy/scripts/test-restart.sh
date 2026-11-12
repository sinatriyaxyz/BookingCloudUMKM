#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
API_URL="${API_URL:-http://127.0.0.1:3000}"

cd "$REPO_DIR"

wait_for_api() {
  local retries=30
  local count=0
  while [ $count -lt $retries ]; do
    if curl -fsS "$API_URL/api/health" >/dev/null 2>&1; then
      return 0
    fi
    count=$((count + 1))
    sleep 1
  done
  echo "ERROR: API tidak merespons di $API_URL/api/health setelah ${retries}s" >&2
  return 1
}

echo "==> [1/5] Memastikan layanan api sehat..."
wait_for_api

UNIQUE_ID="$(date +%s)$RANDOM"
EMAIL="restart-test-${UNIQUE_ID}@example.com"
PASSWORD="password123"
CUSTOMER_NAME="Pelanggan Uji Restart ${UNIQUE_ID}"

echo "==> [2/5] Mendaftarkan UMKM, login, & menyiapkan layanan + jam buka..."
REG_RES="$(curl -fsS -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"businessName\":\"UMKM Restart $UNIQUE_ID\",\"category\":\"barbershop\"}")"

SLUG="$(printf '%s' "$REG_RES" | sed -n 's/.*"slug":"\([^"]*\)".*/\1/p')"

LOGIN_RES="$(curl -fsS -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"

TOKEN="$(printf '%s' "$LOGIN_RES" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"

if [ -z "$TOKEN" ] || [ -z "$SLUG" ]; then
  echo "ERROR: Gagal mendapatkan token/slug: reg=$REG_RES login=$LOGIN_RES" >&2
  exit 1
fi

SVC_RES="$(curl -fsS -X POST "$API_URL/api/services" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Potong Rambut Uji","price":40000,"duration_min":30}')"

SERVICE_ID="$(printf '%s' "$SVC_RES" | sed -n 's/.*"id":\([0-9]*\).*/\1/p')"

if [ -z "$SERVICE_ID" ]; then
  echo "ERROR: Gagal membuat layanan: $SVC_RES" >&2
  exit 1
fi

HOURS_PAYLOAD='['
for d in 0 1 2 3 4 5 6; do
  [ "$d" -gt 0 ] && HOURS_PAYLOAD="${HOURS_PAYLOAD},"
  HOURS_PAYLOAD="${HOURS_PAYLOAD}{\"weekday\":$d,\"open_time\":\"08:00\",\"close_time\":\"20:00\",\"is_closed\":false}"
done
HOURS_PAYLOAD="${HOURS_PAYLOAD}]"

curl -fsS -X PUT "$API_URL/api/operating-hours" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$HOURS_PAYLOAD" >/dev/null

BOOKING_DATE="$(date -d "+2 days" +%Y-%m-%d 2>/dev/null || date -v+2d +%Y-%m-%d)"

echo "==> [3/5] Membuat reservasi pada tanggal $BOOKING_DATE..."
BOOK_RES="$(curl -fsS -X POST "$API_URL/api/public/businesses/$SLUG/bookings" \
  -H "Content-Type: application/json" \
  -d "{\"serviceId\":$SERVICE_ID,\"customerName\":\"$CUSTOMER_NAME\",\"customerPhone\":\"081298765432\",\"date\":\"$BOOKING_DATE\",\"time\":\"10:00\"}")"

CODE="$(printf '%s' "$BOOK_RES" | sed -n 's/.*"code":"\([A-Z0-9]\{8\}\)".*/\1/p')"

if [ -z "$CODE" ]; then
  echo "ERROR: Gagal mendapatkan kode booking: $BOOK_RES" >&2
  exit 1
fi
echo "    Kode booking berhasil dibuat: $CODE"

if docker ps >/dev/null 2>&1; then
  DOCKER_CMD="docker"
elif command -v docker.exe >/dev/null 2>&1; then
  DOCKER_CMD="docker.exe"
elif [ -x "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" ]; then
  DOCKER_CMD="/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"
else
  DOCKER_CMD="docker"
fi

echo "==> [4/5] Me-restart container api (docker compose restart api)..."
"$DOCKER_CMD" compose restart api
wait_for_api

echo "==> [5/5] Memverifikasi data reservasi tetap ada setelah restart..."
CHECK_RES="$(curl -fsS "$API_URL/api/public/bookings/$CODE")"

CHECK_CODE="$(printf '%s' "$CHECK_RES" | sed -n 's/.*"code":"\([A-Z0-9]\{8\}\)".*/\1/p')"
if [ "$CHECK_CODE" != "$CODE" ]; then
  echo "ERROR: Kode booking tidak cocok setelah restart! Respons: $CHECK_RES" >&2
  exit 1
fi

if ! printf '%s' "$CHECK_RES" | grep -q "$CUSTOMER_NAME"; then
  echo "ERROR: Nama pelanggan tidak ditemukan setelah restart! Respons: $CHECK_RES" >&2
  exit 1
fi

echo "PASS: Data reservasi ($CODE - $CUSTOMER_NAME) tetap ada setelah docker compose restart api."
