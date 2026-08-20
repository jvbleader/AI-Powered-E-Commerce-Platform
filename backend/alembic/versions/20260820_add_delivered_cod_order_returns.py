"""Add delivered status, COD payment method, and order_returns table.

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f7
Create Date: 2026-08-20 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update orders table: add columns & modify status check constraint
    op.add_column("orders", sa.Column("delivered_at", sa.DateTime(), nullable=True))
    op.add_column("orders", sa.Column("auto_complete_at", sa.DateTime(), nullable=True))
    op.add_column("orders", sa.Column("return_tag", sa.String(length=40), nullable=True))
    op.create_index("ix_orders_auto_complete_at", "orders", ["auto_complete_at"], unique=False)

    op.drop_constraint("ck_orders_order_status", "orders", type_="check")
    op.create_check_constraint(
        "ck_orders_order_status",
        "orders",
        "order_status IN ('PLACED', 'READY_TO_SHIP', 'SHIPPING', 'DELIVERED', 'COMPLETED', 'DELIVERY_FAILED', 'CANCELLED', 'RETURNED')",
    )

    # 2. Update payments table: add COD to payment_method check constraint
    op.drop_constraint("ck_payments_payment_method", "payments", type_="check")
    op.create_check_constraint(
        "ck_payments_payment_method",
        "payments",
        "payment_method IN ('BANK', 'MOMO', 'CREDIT_CARD', 'MOCK', 'VNPAY', 'WALLET', 'COD')",
    )

    # 3. Update order_status_logs table: modify new_status and old_status check constraints
    op.drop_constraint("ck_order_status_logs_new_status", "order_status_logs", type_="check")
    op.create_check_constraint(
        "ck_order_status_logs_new_status",
        "order_status_logs",
        "new_status IN ('PLACED', 'READY_TO_SHIP', 'SHIPPING', 'DELIVERED', 'COMPLETED', 'DELIVERY_FAILED', 'CANCELLED', 'RETURNED')",
    )
    op.drop_constraint("ck_order_status_logs_old_status", "order_status_logs", type_="check")
    op.create_check_constraint(
        "ck_order_status_logs_old_status",
        "order_status_logs",
        "old_status IS NULL OR old_status IN ('PLACED', 'READY_TO_SHIP', 'SHIPPING', 'DELIVERED', 'COMPLETED', 'DELIVERY_FAILED', 'CANCELLED', 'RETURNED')",
    )

    # 4. Create order_returns table
    op.create_table(
        "order_returns",
        sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column("public_id", sa.CHAR(length=36), nullable=False),
        sa.Column("return_code", sa.String(length=50), nullable=False),
        sa.Column("order_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("user_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("seller_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("return_status", sa.String(length=30), nullable=False, server_default="REQUESTED"),
        sa.Column("reason", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("evidence_images", sa.JSON(), nullable=True),
        sa.Column("seller_reject_reason", sa.Text(), nullable=True),
        sa.Column("seller_responded_at", sa.DateTime(), nullable=True),
        sa.Column("return_shipping_provider", sa.String(length=100), nullable=True),
        sa.Column("return_tracking_code", sa.String(length=50), nullable=True),
        sa.Column("pickup_address", sa.Text(), nullable=True),
        sa.Column("return_address", sa.Text(), nullable=True),
        sa.Column("dispute_reason", sa.Text(), nullable=True),
        sa.Column("disputed_at", sa.DateTime(), nullable=True),
        sa.Column("supporter_id", mysql.BIGINT(unsigned=True), nullable=True),
        sa.Column("supporter_decision", sa.String(length=30), nullable=True),
        sa.Column("supporter_note", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint(
            "return_status IN ('REQUESTED', 'SELLER_APPROVED', 'RETURNING', 'COMPLETED', 'SELLER_REJECTED', 'DISPUTED', 'SUPPORT_APPROVED', 'SUPPORT_REJECTED')",
            name="ck_order_returns_status",
        ),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["seller_id"], ["seller_profiles.id"]),
        sa.ForeignKeyConstraint(["supporter_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_id"),
        sa.UniqueConstraint("return_code"),
    )
    op.create_index("ix_order_returns_order_id", "order_returns", ["order_id"], unique=True)
    op.create_index("ix_order_returns_user_id", "order_returns", ["user_id"], unique=False)
    op.create_index("ix_order_returns_seller_id", "order_returns", ["seller_id"], unique=False)
    op.create_index("ix_order_returns_return_status", "order_returns", ["return_status"], unique=False)
    op.create_index("ix_order_returns_created_at", "order_returns", ["created_at"], unique=False)


def downgrade() -> None:
    # 1. Drop order_returns table and indexes
    op.drop_index("ix_order_returns_created_at", table_name="order_returns")
    op.drop_index("ix_order_returns_return_status", table_name="order_returns")
    op.drop_index("ix_order_returns_seller_id", table_name="order_returns")
    op.drop_index("ix_order_returns_user_id", table_name="order_returns")
    op.drop_index("ix_order_returns_order_id", table_name="order_returns")
    op.drop_table("order_returns")

    # 2. Restore order_status_logs check constraints
    op.drop_constraint("ck_order_status_logs_old_status", "order_status_logs", type_="check")
    op.create_check_constraint(
        "ck_order_status_logs_old_status",
        "order_status_logs",
        "old_status IS NULL OR old_status IN ('PLACED', 'READY_TO_SHIP', 'SHIPPING', 'COMPLETED', 'DELIVERY_FAILED', 'CANCELLED')",
    )
    op.drop_constraint("ck_order_status_logs_new_status", "order_status_logs", type_="check")
    op.create_check_constraint(
        "ck_order_status_logs_new_status",
        "order_status_logs",
        "new_status IN ('PLACED', 'READY_TO_SHIP', 'SHIPPING', 'COMPLETED', 'DELIVERY_FAILED', 'CANCELLED')",
    )

    # 3. Restore payments check constraint
    op.drop_constraint("ck_payments_payment_method", "payments", type_="check")
    op.create_check_constraint(
        "ck_payments_payment_method",
        "payments",
        "payment_method IN ('BANK', 'MOMO', 'CREDIT_CARD', 'MOCK', 'VNPAY', 'WALLET')",
    )

    # 4. Restore orders table
    op.drop_constraint("ck_orders_order_status", "orders", type_="check")
    op.create_check_constraint(
        "ck_orders_order_status",
        "orders",
        "order_status IN ('PLACED', 'READY_TO_SHIP', 'SHIPPING', 'COMPLETED', 'DELIVERY_FAILED', 'CANCELLED')",
    )
    op.drop_index("ix_orders_auto_complete_at", table_name="orders")
    op.drop_column("orders", "return_tag")
    op.drop_column("orders", "auto_complete_at")
    op.drop_column("orders", "delivered_at")
