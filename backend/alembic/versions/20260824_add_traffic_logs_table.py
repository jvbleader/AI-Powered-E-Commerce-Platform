"""add_traffic_logs_table

Revision ID: d1e2f3a4b5c6
Revises: c1d2e3f4a5b6
Create Date: 2026-08-24 14:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, Sequence[str], None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "traffic_logs" not in existing_tables:
        op.create_table(
            "traffic_logs",
            sa.Column("id", mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("user_id", mysql.BIGINT(unsigned=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("session_id", sa.String(length=64), nullable=True),
            sa.Column("path", sa.String(length=255), nullable=False),
            sa.Column("referrer", sa.String(length=500), nullable=True),
            sa.Column("source_channel", sa.String(length=50), nullable=False, server_default="DIRECT"),
            sa.Column("device_type", sa.String(length=20), nullable=False, server_default="DESKTOP"),
            sa.Column("ip_address", sa.String(length=45), nullable=True),
            sa.Column("user_agent", sa.String(length=500), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_traffic_logs_created_at", "traffic_logs", ["created_at"], unique=False)
        op.create_index("ix_traffic_logs_source_channel", "traffic_logs", ["source_channel"], unique=False)
        op.create_index("ix_traffic_logs_device_type", "traffic_logs", ["device_type"], unique=False)
        op.create_index("ix_traffic_logs_user_id", "traffic_logs", ["user_id"], unique=False)
        op.create_index("ix_traffic_logs_session_id", "traffic_logs", ["session_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "traffic_logs" in existing_tables:
        op.drop_index("ix_traffic_logs_session_id", table_name="traffic_logs")
        op.drop_index("ix_traffic_logs_user_id", table_name="traffic_logs")
        op.drop_index("ix_traffic_logs_device_type", table_name="traffic_logs")
        op.drop_index("ix_traffic_logs_source_channel", table_name="traffic_logs")
        op.drop_index("ix_traffic_logs_created_at", table_name="traffic_logs")
        op.drop_table("traffic_logs")
