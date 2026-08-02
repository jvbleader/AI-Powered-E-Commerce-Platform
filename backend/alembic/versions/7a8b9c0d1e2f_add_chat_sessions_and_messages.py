"""add_chat_sessions_and_messages

Revision ID: 7a8b9c0d1e2f
Revises: 551faf0911c2
Create Date: 2026-07-22 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = '7a8b9c0d1e2f'
down_revision: Union[str, Sequence[str], None] = '551faf0911c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'chat_sessions',
        sa.Column('id', sa.CHAR(length=36), nullable=False),
        sa.Column('user_id', mysql.BIGINT(unsigned=True), nullable=True),
        sa.Column('session_token', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_chat_sessions_user_id', 'chat_sessions', ['user_id'], unique=False)
    op.create_index('ix_chat_sessions_session_token', 'chat_sessions', ['session_token'], unique=False)

    op.create_table(
        'chat_messages',
        sa.Column('id', mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column('session_id', sa.CHAR(length=36), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_chat_messages_session_id', 'chat_messages', ['session_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_chat_messages_session_id', table_name='chat_messages')
    op.drop_table('chat_messages')
    op.drop_index('ix_chat_sessions_session_token', table_name='chat_sessions')
    op.drop_index('ix_chat_sessions_user_id', table_name='chat_sessions')
    op.drop_table('chat_sessions')
