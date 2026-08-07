"""Bootstrap or upgrade the database schema.

The initial Alembic revision is intentionally empty (baseline marker).
Current models are the source of truth for a full schema.

Fresh database (no ``users`` table):
  1. Create all tables from SQLAlchemy models
  2. ``alembic stamp head`` so historical migrations are not re-applied

Existing database:
  1. ``alembic upgrade head`` for incremental changes
"""
from __future__ import annotations

import asyncio
import subprocess
import sys
from pathlib import Path

from sqlalchemy import inspect

BACKEND_DIR = Path(__file__).resolve().parents[1]
APP_DIR = BACKEND_DIR / "app"
for path in (BACKEND_DIR, APP_DIR):
    path_text = str(path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)

from core.database import engine  # noqa: E402


async def _users_table_exists() -> bool:
    async with engine.connect() as conn:

        def _check(sync_conn) -> bool:
            return "users" in inspect(sync_conn).get_table_names()

        return await conn.run_sync(_check)


def _run(*args: str) -> None:
    completed = subprocess.run(args, cwd=BACKEND_DIR, check=False)
    if completed.returncode != 0:
        raise SystemExit(completed.returncode)


async def migrate() -> None:
    fresh = not await _users_table_exists()
    await engine.dispose()

    if fresh:
        print("[migrate] Fresh database detected — creating schema from models...")
        _run(sys.executable, "scripts/init_db.py")
        print("[migrate] Stamping Alembic at head...")
        _run(sys.executable, "-m", "alembic", "stamp", "head")
    else:
        print("[migrate] Existing database — running Alembic upgrade...")
        _run(sys.executable, "-m", "alembic", "upgrade", "head")

    print("[migrate] Done.")


if __name__ == "__main__":
    asyncio.run(migrate())
