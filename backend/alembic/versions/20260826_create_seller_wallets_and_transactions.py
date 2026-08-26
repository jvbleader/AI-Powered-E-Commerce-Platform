"""create_seller_wallets_and_transactions

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-08-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, Sequence[str], None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    # 1. Create seller_wallets table
    if "seller_wallets" not in existing_tables:
        op.create_table(
            "seller_wallets",
            sa.Column("id", mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("seller_id", mysql.BIGINT(unsigned=True), sa.ForeignKey("seller_profiles.id", ondelete="CASCADE"), unique=True, nullable=False),
            sa.Column("available_balance", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
            sa.Column("pending_balance", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
            sa.Column("total_withdrawn", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=True, onupdate=sa.func.now()),
            sa.CheckConstraint("available_balance >= 0", name="ck_seller_wallets_available_balance"),
            sa.CheckConstraint("pending_balance >= 0", name="ck_seller_wallets_pending_balance"),
            sa.CheckConstraint("total_withdrawn >= 0", name="ck_seller_wallets_total_withdrawn"),
        )
        op.create_index("ix_seller_wallets_seller_id", "seller_wallets", ["seller_id"])

    # 2. Update seller_payouts table
    if "seller_payouts" in existing_tables:
        columns = [col["name"] for col in inspector.get_columns("seller_payouts")]
        if "payout_code" not in columns:
            op.add_column("seller_payouts", sa.Column("payout_code", sa.String(50), nullable=True))
            op.create_unique_constraint("uq_seller_payouts_payout_code", "seller_payouts", ["payout_code"])
            op.create_index("ix_seller_payouts_payout_code", "seller_payouts", ["payout_code"])
        if "note" not in columns:
            op.add_column("seller_payouts", sa.Column("note", sa.String(255), nullable=True))
        
        # Modify order_id to be nullable if possible
        try:
            op.alter_column(
                "seller_payouts",
                "order_id",
                existing_type=mysql.BIGINT(unsigned=True),
                nullable=True,
            )
        except Exception:
            pass

    # 3. Create seller_wallet_transactions table
    if "seller_wallet_transactions" not in existing_tables:
        op.create_table(
            "seller_wallet_transactions",
            sa.Column("id", mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("wallet_id", mysql.BIGINT(unsigned=True), sa.ForeignKey("seller_wallets.id", ondelete="CASCADE"), nullable=False),
            sa.Column("seller_id", mysql.BIGINT(unsigned=True), sa.ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False),
            sa.Column("transaction_type", sa.String(30), nullable=False),
            sa.Column("amount", sa.Numeric(14, 2), nullable=False),
            sa.Column("balance_before", sa.Numeric(14, 2), nullable=False),
            sa.Column("balance_after", sa.Numeric(14, 2), nullable=False),
            sa.Column("gross_amount", sa.Numeric(14, 2), nullable=True),
            sa.Column("payment_fee", sa.Numeric(14, 2), nullable=True),
            sa.Column("commission_fee", sa.Numeric(14, 2), nullable=True),
            sa.Column("order_id", mysql.BIGINT(unsigned=True), sa.ForeignKey("orders.id", ondelete="SET NULL"), nullable=True),
            sa.Column("payout_id", mysql.BIGINT(unsigned=True), sa.ForeignKey("seller_payouts.id", ondelete="SET NULL"), nullable=True),
            sa.Column("description", sa.String(255), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint(
                "transaction_type IN ('ORDER_SETTLEMENT', 'WITHDRAWAL', 'REFUND_DEDUCTION', 'ADJUSTMENT')",
                name="ck_seller_wallet_transactions_type",
            ),
        )
        op.create_index("ix_seller_wallet_tx_wallet_id", "seller_wallet_transactions", ["wallet_id"])
        op.create_index("ix_seller_wallet_tx_seller_id", "seller_wallet_transactions", ["seller_id"])
        op.create_index("ix_seller_wallet_tx_order_id", "seller_wallet_transactions", ["order_id"])
        op.create_index("ix_seller_wallet_tx_payout_id", "seller_wallet_transactions", ["payout_id"])
        op.create_index("ix_seller_wallet_tx_created_at", "seller_wallet_transactions", ["created_at"])


def downgrade() -> None:
    op.drop_table("seller_wallet_transactions")
    op.drop_table("seller_wallets")
