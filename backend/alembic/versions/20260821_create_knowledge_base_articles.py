"""create_knowledge_base_articles

Revision ID: c1d2e3f4a5b6
Revises: b1c2d3e4f5a6
Create Date: 2026-08-21 03:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "knowledge_base_articles" not in existing_tables:
        op.create_table(
            "knowledge_base_articles",
            sa.Column("id", mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("public_id", sa.CHAR(length=36), unique=True, nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("slug", sa.String(length=255), unique=True, nullable=False),
            sa.Column("category", sa.String(length=64), nullable=False, server_default="GENERAL"),
            sa.Column("summary", sa.Text(), nullable=True),
            sa.Column("file_name", sa.String(length=255), nullable=False),
            sa.Column("file_url", sa.String(length=512), nullable=False),
            sa.Column("file_size", sa.Integer(), nullable=True),
            sa.Column("page_count", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("extracted_text", mysql.LONGTEXT(), nullable=True),
            sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        )
        op.create_index("ix_kb_articles_slug", "knowledge_base_articles", ["slug"], unique=True)
        op.create_index("ix_kb_articles_category", "knowledge_base_articles", ["category"], unique=False)
        op.create_index("ix_kb_articles_is_published", "knowledge_base_articles", ["is_published"], unique=False)
        op.create_index("ix_kb_articles_created_at", "knowledge_base_articles", ["created_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "knowledge_base_articles" in existing_tables:
        op.drop_index("ix_kb_articles_created_at", table_name="knowledge_base_articles")
        op.drop_index("ix_kb_articles_is_published", table_name="knowledge_base_articles")
        op.drop_index("ix_kb_articles_category", table_name="knowledge_base_articles")
        op.drop_index("ix_kb_articles_slug", table_name="knowledge_base_articles")
        op.drop_table("knowledge_base_articles")
