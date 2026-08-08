"""Add seller conversation user settings

Revision ID: d4e5f6a7b8c9
Revises: 0b911fc87174
Create Date: 2026-08-08 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "88e7d9612ed6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "seller_conversation_user_settings",
        sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column("conversation_id", sa.CHAR(length=36), nullable=False),
        sa.Column("user_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_muted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("marked_unread", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["conversation_id"], ["seller_conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("conversation_id", "user_id", name="uq_seller_conv_user_settings"),
    )
    op.create_index(
        "ix_seller_conv_settings_user_id",
        "seller_conversation_user_settings",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_seller_conv_settings_user_id", table_name="seller_conversation_user_settings")
    op.drop_table("seller_conversation_user_settings")
