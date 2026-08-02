import asyncio
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from dotenv import load_dotenv

from alembic import context

# 1. Setup PYTHONPATH dynamically
alembic_dir = Path(__file__).resolve().parent
backend_dir = alembic_dir.parent
sys.path.insert(0, str(backend_dir))
sys.path.insert(0, str(backend_dir / "app"))

# 2. Load Environment Variables from .env files
load_dotenv(backend_dir / ".env")
load_dotenv(backend_dir.parent / ".env")

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# 3. Dynamic SQLAlchemy URL assignment
database_url = os.getenv("ASYNC_DATABASE_URL") or os.getenv("DATABASE_URL")
if database_url:
    # Standardize connection string schema if there's a typo like "mysql:asyncmy//"
    if database_url.startswith("mysql:asyncmy//"):
        database_url = database_url.replace("mysql:asyncmy//", "mysql+asyncmy://", 1)
    
    # Escape percent sign for ini file configparser interpolation
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 4. Import models and point to metadata
from models.base import Base
import models  # Dynamically loads all model classes to populate Base.metadata

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""

    # Handle event loop selection for async support in different platforms
    try:
        asyncio.run(run_async_migrations())
    except RuntimeError:
        # Fallback if loop is already running (e.g. in some interactive/test environments)
        loop = asyncio.get_event_loop()
        loop.run_until_complete(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
