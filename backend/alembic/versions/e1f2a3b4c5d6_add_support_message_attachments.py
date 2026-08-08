"""Add attachment fields to support messages

Revision ID: e1f2a3b4c5d6
Revises: d4e5f6a7b8c9
Create Date: 2026-08-08 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "support_messages",
        sa.Column("attachment_type", sa.Enum("IMAGE", "VIDEO", "FILE"), nullable=True),
    )
    op.add_column(
        "support_messages",
        sa.Column("attachment_id", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("support_messages", "attachment_id")
    op.drop_column("support_messages", "attachment_type")
