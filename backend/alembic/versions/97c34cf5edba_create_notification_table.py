"""create notification table

Revision ID: 97c34cf5edba
Revises: 3bfb83407eba
Create Date: 2026-07-30 16:18:33.193665

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = '97c34cf5edba'
down_revision: Union[str, Sequence[str], None] = '3bfb83407eba'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop existing notifications table if it exists (from the old schema)
    # Using raw SQL to avoid errors if the table doesn't exist
    op.execute("DROP TABLE IF EXISTS notifications")
    
    # Create the new notifications table with the new schema
    op.create_table('notifications',
    sa.Column('id', mysql.CHAR(length=36), nullable=False),
    sa.Column('user_id', mysql.BIGINT(unsigned=True), nullable=False),
    sa.Column('type', sa.String(length=50), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('is_read', sa.Boolean(), nullable=False),
    sa.Column('action_url', sa.String(length=500), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_table('notifications')
