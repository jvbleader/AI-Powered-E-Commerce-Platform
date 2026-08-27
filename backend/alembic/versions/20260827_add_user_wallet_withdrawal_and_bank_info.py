"""add_user_wallet_withdrawal_and_bank_info

Revision ID: a7b8c9d0e1f2
Revises: f3a4b5c6d7e8
Create Date: 2026-08-27 10:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "f3a4b5c6d7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    # 1. Add bank account columns to wallets table
    if "wallets" in existing_tables:
        columns = [col["name"] for col in inspector.get_columns("wallets")]
        if "bank_name" not in columns:
            op.add_column("wallets", sa.Column("bank_name", sa.String(100), nullable=True))
        if "bank_account_number" not in columns:
            op.add_column("wallets", sa.Column("bank_account_number", sa.String(50), nullable=True))
        if "bank_account_name" not in columns:
            op.add_column("wallets", sa.Column("bank_account_name", sa.String(150), nullable=True))

    # 2. Update check constraint on wallet_transactions table
    if "wallet_transactions" in existing_tables:
        try:
            op.drop_constraint("ck_wallet_transactions_type", "wallet_transactions", type_="check")
        except Exception:
            pass
        try:
            op.create_check_constraint(
                "ck_wallet_transactions_type",
                "wallet_transactions",
                "transaction_type IN ('TOPUP', 'ORDER_PAYMENT', 'REFUND_ORDER', 'WITHDRAWAL')",
            )
        except Exception:
            pass


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "wallets" in existing_tables:
        columns = [col["name"] for col in inspector.get_columns("wallets")]
        if "bank_account_name" in columns:
            op.drop_column("wallets", "bank_account_name")
        if "bank_account_number" in columns:
            op.drop_column("wallets", "bank_account_number")
        if "bank_name" in columns:
            op.drop_column("wallets", "bank_name")

    if "wallet_transactions" in existing_tables:
        try:
            op.drop_constraint("ck_wallet_transactions_type", "wallet_transactions", type_="check")
        except Exception:
            pass
        try:
            op.create_check_constraint(
                "ck_wallet_transactions_type",
                "wallet_transactions",
                "transaction_type IN ('TOPUP', 'ORDER_PAYMENT', 'REFUND_ORDER')",
            )
        except Exception:
            pass
