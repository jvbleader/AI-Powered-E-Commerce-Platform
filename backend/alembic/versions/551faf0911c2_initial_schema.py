"""initial_schema

Revision ID: 551faf0911c2
Revises:
Create Date: 2026-07-20 18:23:01.654780

Baseline marker only. Full schema for new databases is created by
``python scripts/migrate_db.py`` (SQLAlchemy ``create_all`` + ``alembic stamp head``).
Do not put CREATE TABLE DDL here unless it matches the true historical baseline.
"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "551faf0911c2"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No-op baseline — see scripts/migrate_db.py for fresh DB bootstrap."""
    pass


def downgrade() -> None:
    """No-op baseline."""
    pass
