#!/bin/sh
set -e

# Optional local/non-compose bootstrap. In docker-compose.dev.yml,
# schema + seed are handled by db-migrate / db-seed before backend starts.
if [ "${INIT_DB_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] Running database migrate..."
  python scripts/migrate_db.py
fi

exec "$@"
