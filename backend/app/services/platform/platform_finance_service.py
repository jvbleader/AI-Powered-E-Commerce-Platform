from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.order.order import Order
from models.payment.refund import Refund
from models.platform.platform_finance_summary import PlatformFinanceSummary
from models.platform.platform_finance_transaction import PlatformFinanceTransaction
from models.seller.seller_payout import SellerPayout
from models.seller.seller_wallet import SellerWallet
from models.seller.seller_wallet_transaction import SellerWalletTransaction
import repositories.platform.platform_finance_repository as platform_repo


PAYMENT_FEE_RATE = Decimal("0.02")
COMMISSION_FEE_RATE = Decimal("0.03")

ACTIVE_ESCROW_STATUSES = [
    "PLACED",
    "CONFIRMED",
    "PROCESSING",
    "READY_TO_SHIP",
    "SHIPPING",
    "DELIVERED",
]


async def reconcile_platform_finance(db: AsyncSession) -> PlatformFinanceSummary:
    """Reconciles the PlatformFinanceSummary singleton with actual ground-truth orders and wallets."""
    # 1. Platform revenue collected from completed order settlements
    rev_res = await db.execute(
        select(
            func.coalesce(func.sum(SellerWalletTransaction.payment_fee), Decimal("0.00")),
            func.coalesce(func.sum(SellerWalletTransaction.commission_fee), Decimal("0.00")),
        ).where(SellerWalletTransaction.transaction_type == "ORDER_SETTLEMENT")
    )
    pay_fee_sum, comm_fee_sum = rev_res.one()
    total_rev = Decimal(str(pay_fee_sum)) + Decimal(str(comm_fee_sum))

    # 2. Active escrow funds for PAID orders currently in active escrow stages (toàn bộ tiền hàng + tiền ship của các đơn đang xử lý/giao)
    active_orders_res = await db.execute(
        select(Order).where(
            Order.order_status.in_(ACTIVE_ESCROW_STATUSES),
            Order.payment_status == "PAID",
        )
    )
    active_orders = list(active_orders_res.scalars().all())
    escrow_total = Decimal("0.00")
    for order in active_orders:
        total_paid = Decimal(str(order.total_amount))
        if total_paid > Decimal("0.00"):
            escrow_total += total_paid

    # 2.1 Shipping fee held from COMPLETED orders (tiền ship cần thanh toán cho DVVC từ các đơn đã hoàn thành)
    completed_shipping_res = await db.execute(
        select(func.coalesce(func.sum(Order.shipping_fee), Decimal("0.00"))).where(
            Order.order_status == "COMPLETED"
        )
    )
    shipping_held_total = completed_shipping_res.scalar() or Decimal("0.00")

    # 3. Seller wallet balances and payouts
    wallets_res = await db.execute(
        select(
            func.coalesce(func.sum(SellerWallet.available_balance), Decimal("0.00")),
            func.coalesce(func.sum(SellerWallet.total_withdrawn), Decimal("0.00")),
        )
    )
    seller_bal_sum, payouts_sum = wallets_res.one()

    # 4. Total refunds
    refund_res = await db.execute(
        select(func.coalesce(func.sum(Refund.amount), Decimal("0.00"))).where(
            Refund.refund_status == "SUCCESS"
        )
    )
    refund_sum = refund_res.scalar() or Decimal("0.00")

    summary = await platform_repo.get_platform_summary_for_update(db)
    if not summary:
        summary = PlatformFinanceSummary(
            escrow_holding_balance=escrow_total,
            total_shipping_fee_held=shipping_held_total,
            total_platform_revenue=total_rev,
            total_commission_fee_collected=Decimal(str(comm_fee_sum)),
            total_payment_fee_collected=Decimal(str(pay_fee_sum)),
            total_seller_balances=Decimal(str(seller_bal_sum)),
            total_payouts_disbursed=Decimal(str(payouts_sum)),
            total_refunded_amount=Decimal(str(refund_sum)),
        )
        summary = await platform_repo.create_platform_summary(summary, db)
    else:
        summary.escrow_holding_balance = escrow_total
        summary.total_shipping_fee_held = shipping_held_total
        summary.total_platform_revenue = total_rev
        summary.total_commission_fee_collected = Decimal(str(comm_fee_sum))
        summary.total_payment_fee_collected = Decimal(str(pay_fee_sum))
        summary.total_seller_balances = Decimal(str(seller_bal_sum))
        summary.total_payouts_disbursed = Decimal(str(payouts_sum))
        summary.total_refunded_amount = Decimal(str(refund_sum))

    held_liquidity = escrow_total + shipping_held_total + Decimal(str(seller_bal_sum)) + total_rev
    tx = PlatformFinanceTransaction(
        transaction_type="ADJUSTMENT",
        amount=held_liquidity,
        escrow_before=escrow_total,
        escrow_after=escrow_total,
        revenue_before=total_rev,
        revenue_after=total_rev,
        description="Đồng bộ hóa & Đối soát toàn diện tài chính sàn (System Reconciliation)",
    )
    await platform_repo.add_platform_transaction(tx, db)
    await db.flush()

    return summary


async def get_or_create_platform_summary(db: AsyncSession) -> PlatformFinanceSummary:
    """Gets the persistent PlatformFinanceSummary singleton row, initializing it only if not present."""
    summary = await platform_repo.get_platform_summary(db)
    if summary:
        return summary

    return await reconcile_platform_finance(db)


async def record_order_payment_inflow(
    db: AsyncSession,
    order: Order,
) -> None:
    """Records the inflow of cash/escrow into the platform when an order is PAID (VNPAY/Wallet or COD on delivery)."""
    total_inflow = Decimal(str(order.total_amount or 0))
    if total_inflow <= Decimal("0.00"):
        return

    summary = await platform_repo.get_platform_summary_for_update(db)
    if not summary:
        summary = await get_or_create_platform_summary(db)

    if not summary:
        return

    escrow_before = Decimal(str(summary.escrow_holding_balance))
    escrow_after = escrow_before + total_inflow

    summary.escrow_holding_balance = escrow_after

    tx = PlatformFinanceTransaction(
        transaction_type="ESCROW_INFLOW",
        amount=total_inflow,
        escrow_before=escrow_before,
        escrow_after=escrow_after,
        revenue_before=summary.total_platform_revenue,
        revenue_after=summary.total_platform_revenue,
        order_id=order.id,
        description=f"Thanh toán đơn hàng {order.order_code}: Tổng ký quỹ vào sàn {total_inflow:,.0f}đ",
    )
    await platform_repo.add_platform_transaction(tx, db)
    await db.flush()


# Alias for backward compatibility
record_order_escrow_inflow = record_order_payment_inflow


async def record_order_refund(
    db: AsyncSession,
    order: Order,
    refund_amount: Decimal,
    reason: str = "",
) -> None:
    """Records a refund to the buyer and deducts the appropriate escrow funds from platform."""
    if refund_amount <= Decimal("0.00"):
        return

    summary = await platform_repo.get_platform_summary_for_update(db)
    if not summary:
        summary = await get_or_create_platform_summary(db)

    if not summary:
        return

    escrow_deduct = min(Decimal(str(summary.escrow_holding_balance)), refund_amount)
    escrow_before = Decimal(str(summary.escrow_holding_balance))
    escrow_after = max(Decimal("0.00"), escrow_before - escrow_deduct)

    summary.escrow_holding_balance = escrow_after
    summary.total_refunded_amount = Decimal(str(summary.total_refunded_amount)) + refund_amount

    tx = PlatformFinanceTransaction(
        transaction_type="ESCROW_REFUND",
        amount=refund_amount,
        escrow_before=escrow_before,
        escrow_after=escrow_after,
        revenue_before=summary.total_platform_revenue,
        revenue_after=summary.total_platform_revenue,
        order_id=order.id,
        description=f"Hoàn tiền đơn {order.order_code}: {reason} ({refund_amount:,.0f}đ)",
    )
    await platform_repo.add_platform_transaction(tx, db)
    await db.flush()


async def record_escrow_settlement(
    db: AsyncSession,
    order: Order,
    gross_amount: Decimal,
    payment_fee: Decimal,
    commission_fee: Decimal,
    shipping_fee: Decimal = Decimal("0.00"),
) -> None:
    """Records the release of escrow funds, crediting seller wallet, platform revenue, and shipping payable fund."""
    summary = await platform_repo.get_platform_summary_for_update(db)
    if not summary:
        summary = await get_or_create_platform_summary(db)

    if not summary:
        return

    escrow_before = Decimal(str(summary.escrow_holding_balance))
    revenue_before = Decimal(str(summary.total_platform_revenue))

    platform_fee = payment_fee + commission_fee
    net_credit = gross_amount - platform_fee
    total_release = gross_amount + shipping_fee

    escrow_after = max(Decimal("0.00"), escrow_before - total_release)
    revenue_after = revenue_before + platform_fee

    summary.escrow_holding_balance = escrow_after
    summary.total_seller_balances = Decimal(str(summary.total_seller_balances)) + net_credit
    summary.total_platform_revenue = revenue_after
    summary.total_payment_fee_collected = Decimal(str(summary.total_payment_fee_collected)) + payment_fee
    summary.total_commission_fee_collected = Decimal(str(summary.total_commission_fee_collected)) + commission_fee
    summary.total_shipping_fee_held = Decimal(str(summary.total_shipping_fee_held)) + shipping_fee

    tx = PlatformFinanceTransaction(
        transaction_type="ESCROW_RELEASE",
        amount=total_release,
        escrow_before=escrow_before,
        escrow_after=escrow_after,
        revenue_before=revenue_before,
        revenue_after=revenue_after,
        order_id=order.id,
        description=f"Quyết toán đơn hàng {order.order_code}: Ví Shop +{net_credit:,.0f}đ, Phí sàn +{platform_fee:,.0f}đ, Quỹ ship +{shipping_fee:,.0f}đ",
    )
    await platform_repo.add_platform_transaction(tx, db)
    await db.flush()


async def record_payout_disbursed(
    db: AsyncSession,
    payout: SellerPayout,
    amount: Decimal,
) -> None:
    """Records the disbursement of seller payout from the platform funds."""
    summary = await platform_repo.get_platform_summary_for_update(db)
    if not summary:
        summary = await get_or_create_platform_summary(db)

    if not summary:
        return

    summary.total_payouts_disbursed = Decimal(str(summary.total_payouts_disbursed)) + amount
    summary.total_seller_balances = max(Decimal("0.00"), Decimal(str(summary.total_seller_balances)) - amount)

    tx = PlatformFinanceTransaction(
        transaction_type="PAYOUT_DISBURSED",
        amount=amount,
        escrow_before=summary.escrow_holding_balance,
        escrow_after=summary.escrow_holding_balance,
        revenue_before=summary.total_platform_revenue,
        revenue_after=summary.total_platform_revenue,
        payout_id=payout.id,
        description=f"Giải ngân rút tiền {payout.payout_code} số tiền {amount:,.0f}đ về ngân hàng {payout.bank_name}",
    )
    await platform_repo.add_platform_transaction(tx, db)
    await db.flush()


async def get_platform_finance_analytics(db: AsyncSession) -> Dict[str, Any]:
    """Generates real-time macro financial metrics and distribution breakdowns for Admin."""
    summary = await get_or_create_platform_summary(db)

    # 1. Active orders in escrow with full details (only paid orders hold cash in escrow)
    active_orders_res = await db.execute(
        select(Order).where(
            Order.order_status.in_(ACTIVE_ESCROW_STATUSES),
            Order.payment_status == "PAID",
        )
    )
    active_orders = list(active_orders_res.scalars().all())

    processing_total = Decimal("0.00")
    in_transit_total = Decimal("0.00")
    delivered_pending_total = Decimal("0.00")

    vnpay_total = Decimal("0.00")
    cod_total = Decimal("0.00")

    for order in active_orders:
        gross = Decimal(str(order.subtotal_amount or 0))
        if gross <= Decimal("0.00"):
            continue

        # By operational stage
        if order.order_status in ["PLACED", "CONFIRMED", "PROCESSING"]:
            processing_total += gross
        elif order.order_status in ["READY_TO_SHIP", "SHIPPING"]:
            in_transit_total += gross
        elif order.order_status == "DELIVERED":
            delivered_pending_total += gross

        # By payment method
        pm = (getattr(order, "preferred_payment_method", None) or getattr(order, "payment_method", None) or "").upper()
        if "VNPAY" in pm or "BANK" in pm or "WALLET" in pm:
            vnpay_total += gross
        else:
            cod_total += gross

    # 2. Count distinct sellers with available balance > 0
    sellers_count_res = await db.execute(
        select(func.count(SellerWallet.id)).where(SellerWallet.available_balance > 0)
    )
    total_sellers_with_balance = sellers_count_res.scalar() or 0

    # 3. Read Total Cash in System in O(1) directly from the persistent Treasury master record
    held_liquidity = (
        Decimal(str(summary.escrow_holding_balance))
        + Decimal(str(summary.total_shipping_fee_held))
        + Decimal(str(summary.total_seller_balances))
        + Decimal(str(summary.total_platform_revenue))
    )
    total_cash_outflow = Decimal(str(summary.total_payouts_disbursed)) + Decimal(str(summary.total_refunded_amount))
    total_cash_inflow = held_liquidity + total_cash_outflow

    return {
        "total_cash_inflow": float(total_cash_inflow),
        "total_cash_outflow": float(total_cash_outflow),
        "total_platform_held_liquidity": float(held_liquidity),
        "escrow_holding_balance": float(summary.escrow_holding_balance),
        "total_shipping_fee_held": float(summary.total_shipping_fee_held),
        "total_seller_available_balance": float(summary.total_seller_balances),
        "total_platform_revenue": float(summary.total_platform_revenue),
        "total_payment_fee_collected": float(summary.total_payment_fee_collected),
        "total_commission_fee_collected": float(summary.total_commission_fee_collected),
        "total_payouts_disbursed": float(summary.total_payouts_disbursed),
        "total_refunded_amount": float(summary.total_refunded_amount),
        "total_sellers_with_balance": total_sellers_with_balance,
        "total_active_escrow_orders": len(active_orders),
        "breakdown": {
            "by_stage": {
                "processing": float(processing_total),
                "in_transit": float(in_transit_total),
                "delivered_pending": float(delivered_pending_total),
            },
            "by_payment_method": {
                "vnpay": float(vnpay_total),
                "cod": float(cod_total),
            },
        },
    }
