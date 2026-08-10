"""add original_price_snapshot to order_items

Revision ID: a2b3c4d5e6f7
Revises: c8d9e0f1a2b3
Create Date: 2026-08-10 13:25:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'a2b3c4d5e6f7'
down_revision = 'c8d9e0f1a2b3'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('order_items', sa.Column('original_price_snapshot', sa.Numeric(precision=12, scale=2), nullable=True))


def downgrade():
    op.drop_column('order_items', 'original_price_snapshot')
