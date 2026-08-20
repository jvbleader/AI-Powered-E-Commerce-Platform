"""Add wallet and wallet_transactions tables and update payment_method constraint.

Revision ID: a1b2c3d4e5f7
Revises: 8e224512f383
Create Date: 2026-08-20 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, Sequence[str], None] = "8e224512f383"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create wallets table
    op.create_table(
        "wallets",
        sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column("user_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("balance", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("pin_hash", sa.String(length=255), nullable=True),
        sa.Column("pin_set_at", sa.DateTime(), nullable=True),
        sa.Column("pin_failed_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pin_locked_until", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint("balance >= 0", name="ck_wallets_balance"),
        sa.CheckConstraint("status IN ('ACTIVE', 'LOCKED')", name="ck_wallets_status"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_wallets_status", "wallets", ["status"], unique=False)

    # 2. Create wallet_transactions table
    op.create_table(
        "wallet_transactions",
        sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column("wallet_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("transaction_code", sa.String(length=50), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("balance_before", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("balance_after", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("transaction_type", sa.String(length=50), nullable=False),
        sa.Column("reference_type", sa.String(length=50), nullable=True),
        sa.Column("reference_id", mysql.BIGINT(unsigned=True), nullable=True),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "transaction_type IN ('TOPUP', 'ORDER_PAYMENT', 'REFUND_ORDER')",
            name="ck_wallet_transactions_type",
        ),
        sa.ForeignKeyConstraint(["wallet_id"], ["wallets.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("transaction_code"),
    )
    op.create_index("ix_wallet_transactions_wallet_id", "wallet_transactions", ["wallet_id"], unique=False)
    op.create_index("ix_wallet_transactions_transaction_type", "wallet_transactions", ["transaction_type"], unique=False)
    op.create_index("ix_wallet_transactions_created_at", "wallet_transactions", ["created_at"], unique=False)

    # 3. Modify check constraint on payments
    op.drop_constraint("ck_payments_payment_method", "payments", type_="check")
    op.create_check_constraint(
        "ck_payments_payment_method",
        "payments",
        "payment_method IN ('BANK', 'MOMO', 'CREDIT_CARD', 'MOCK', 'VNPAY', 'WALLET')",
    )


def downgrade() -> None:
    # 1. Restore old payments check constraint
    op.drop_constraint("ck_payments_payment_method", "payments", type_="check")
    op.create_check_constraint(
        "ck_payments_payment_method",
        "payments",
        "payment_method IN ('BANK', 'MOMO', 'CREDIT_CARD', 'MOCK', 'VNPAY')",
    )

    # 2. Drop wallet_transactions indexes and table
    op.drop_index("ix_wallet_transactions_created_at", table_name="wallet_transactions")
    op.drop_index("ix_wallet_transactions_transaction_type", table_name="wallet_transactions")
    op.drop_index("ix_wallet_transactions_wallet_id", table_name="wallet_transactions")
    op.drop_table("wallet_transactions")

    # 3. Drop wallets index and table
    op.drop_index("ix_wallets_status", table_name="wallets")
    op.drop_table("wallets")
