#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
FRONTEND_DIR="$REPO_DIR/frontend"
TARGET_DIR="${TARGET_DIR:-/var/www/bookingcloud}"

NPM_CMD="npm"
if ! command -v npm >/dev/null 2>&1 && command -v npm.cmd >/dev/null 2>&1; then
  NPM_CMD="npm.cmd"
fi

echo "==> Membangun frontend di $FRONTEND_DIR..."
cd "$FRONTEND_DIR"
if [ -f package-lock.json ]; then
  "$NPM_CMD" ci
else
  "$NPM_CMD" install
fi
"$NPM_CMD" run build

echo "==> Menyalin hasil build statis ke $TARGET_DIR..."
if [ -w "$TARGET_DIR" ] || { [ ! -e "$TARGET_DIR" ] && [ -w "$(dirname "$TARGET_DIR")" ]; } || [ "$(id -u)" -eq 0 ]; then
  mkdir -p "$TARGET_DIR"
  rm -rf "${TARGET_DIR:?}"/*
  cp -r "$FRONTEND_DIR/dist/." "$TARGET_DIR/"
else
  sudo mkdir -p "$TARGET_DIR"
  sudo rm -rf "${TARGET_DIR:?}"/*
  sudo cp -r "$FRONTEND_DIR/dist/." "$TARGET_DIR/"
fi

echo "==> Selesai: frontend statis siap disajikan Nginx dari $TARGET_DIR"

