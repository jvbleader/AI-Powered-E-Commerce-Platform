"""remove_product_view_count

Revision ID: b9e8d7c6f5a4
Revises: 7a8b9c0d1e2f
Create Date: 2026-07-23 22:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = 'b9e8d7c6f5a4'
down_revision: Union[str, Sequence[str], None] = '7a8b9c0d1e2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop check constraint if present and drop view_count column from products table
    try:
        op.drop_constraint('ck_products_view_count', 'products', type_='check')
    except Exception:
        pass

    op.drop_column('products', 'view_count')


def downgrade() -> None:
    op.add_column(
        'products',
        sa.Column(
            'view_count',
            mysql.INTEGER(unsigned=True),
            nullable=False,
            server_default=sa.text('0')
        )
    )
    op.create_check_constraint('ck_products_view_count', 'products', 'view_count >= 0')
