#!/bin/bash
# ==============================================================================
# Renew SSL Certificate (chạy thủ công hoặc qua cron)
# Usage: sudo ./renew-ssl.sh
# ==============================================================================
set -euo pipefail

cd "$(dirname "$0")"

echo "[SSL Renew] Renewing certificates..."
docker compose run --rm certbot renew --quiet

echo "[SSL Renew] Reloading nginx..."
docker compose exec nginx nginx -s reload

echo "[SSL Renew] Done."
