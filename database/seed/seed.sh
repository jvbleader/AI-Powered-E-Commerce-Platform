#!/bin/bash
set -euo pipefail

SEED_SQL_PATH="${SEED_SQL_PATH:-/seed/backup.sql}"

echo "[db-seed] Waiting for MySQL at ${MYSQL_HOST}:${MYSQL_PORT}..."
until mysqladmin \
  --protocol=TCP \
  -h"${MYSQL_HOST}" \
  -P"${MYSQL_PORT}" \
  -u"${MYSQL_USER}" \
  -p"${MYSQL_PASSWORD}" \
  ping --silent
do
  sleep 2
done

echo "[db-seed] Checking whether seed data is needed..."
USER_COUNT="$(
  mysql \
    --protocol=TCP \
    -h"${MYSQL_HOST}" \
    -P"${MYSQL_PORT}" \
    -u"${MYSQL_USER}" \
    -p"${MYSQL_PASSWORD}" \
    "${MYSQL_DATABASE}" \
    -N -e "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0"
)"

if [ "${USER_COUNT}" = "0" ]; then
  echo "[db-seed] Importing ${SEED_SQL_PATH}..."
  mysql \
    --protocol=TCP \
    -h"${MYSQL_HOST}" \
    -P"${MYSQL_PORT}" \
    -u"${MYSQL_USER}" \
    -p"${MYSQL_PASSWORD}" \
    "${MYSQL_DATABASE}" < "${SEED_SQL_PATH}"
  echo "[db-seed] Seed completed."
else
  echo "[db-seed] Data already present (users=${USER_COUNT}); skipping seed."
fi
