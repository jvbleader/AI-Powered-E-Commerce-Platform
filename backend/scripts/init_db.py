"""Ensure SQLAlchemy models are registered and tables exist."""
from __future__ import annotations

import asyncio

import models  # noqa: F401 — loads all domain packages via models/__init__.py
from core.database import engine
from models.base import Base


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(init_db())
