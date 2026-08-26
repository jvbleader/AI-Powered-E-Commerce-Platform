from __future__ import annotations

import secrets
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import utc_now
from models.order.order import Order
from models.seller.seller_payout import SellerPayout
from models.seller.seller_profile import SellerProfile
from models.seller.seller_wallet import SellerWallet
from models.seller.seller_wallet_transaction import SellerWalletTransaction
import repositories.seller.seller_wallet_repository as wallet_repo
from services.engagement.notification_service import send_notification
from services.platform.platform_finance_service import (
    record_escrow_settlement,
    record_payout_disbursed,
)


PAYMENT_FEE_RATE = Decimal("0.02")  # 2%
COMMISSION_FEE_RATE = Decimal("0.03")  # 3%
MIN_WITHDRAWAL_AMOUNT = Decimal("50000.00")


async def get_or_create_seller_wallet(
    db: AsyncSession, seller_id: int
) -> SellerWallet:
    wallet = await wallet_repo.get_wallet_by_seller_id(seller_id, db)
    if not wallet:
        wallet = SellerWallet(
            seller_id=seller_id,
            available_balance=Decimal("0.00"),
            pending_balance=Decimal("0.00"),
            total_withdrawn=Decimal("0.00"),
        )
        wallet = await wallet_repo.create_wallet(wallet, db)

    # Check for any completed orders that have not been settled into this wallet yet
    completed_orders_res = await db.execute(
        select(Order)
        .where(
            Order.seller_id == seller_id,
            Order.order_status == "COMPLETED",
        )
        .order_by(Order.completed_at.asc(), Order.id.asc())
    )
    completed_orders = list(completed_orders_res.scalars().all())

    for order in completed_orders:
        existing_tx = await wallet_repo.get_transaction_by_order_id(order.id, db)
        if not existing_tx:
            gross = Decimal(str(order.subtotal_amount or 0))
            if gross < Decimal("0.00"):
                gross = Decimal("0.00")
            pay_fee = round(gross * PAYMENT_FEE_RATE, 2)
            comm_fee = round(gross * COMMISSION_FEE_RATE, 2)
            net = gross - pay_fee - comm_fee

            bal_before = wallet.available_balance
            bal_after = bal_before + net
            wallet.available_balance = bal_after

            tx = SellerWalletTransaction(
                wallet_id=wallet.id,
                seller_id=seller_id,
                transaction_type="ORDER_SETTLEMENT",
                amount=net,
                balance_before=bal_before,
                balance_after=bal_after,
                gross_amount=gross,
                payment_fee=pay_fee,
                commission_fee=comm_fee,
                order_id=order.id,
                description=f"Quyết toán đơn hàng {order.order_code}",
                created_at=order.completed_at or order.created_at,
            )
            await wallet_repo.add_wallet_transaction(tx, db)

    # Calculate pending balance dynamically from active orders
    active_orders_res = await db.execute(
        select(Order).where(
            Order.seller_id == seller_id,
            Order.order_status.in_(["PLACED", "CONFIRMED", "PROCESSING", "READY_TO_SHIP", "SHIPPING", "DELIVERED"]),
        )
    )
    active_orders = list(active_orders_res.scalars().all())
    pending_total = Decimal("0.00")
    for order in active_orders:
        gross = Decimal(str(order.subtotal_amount or 0))
        if gross > Decimal("0.00"):
            net = gross - round(gross * PAYMENT_FEE_RATE, 2) - round(gross * COMMISSION_FEE_RATE, 2)
            pending_total += net

    wallet.pending_balance = pending_total
    await db.flush()

    return wallet


async def sync_all_seller_wallets(db: AsyncSession) -> None:
    """Synchronizes and initializes wallets and settlements for all sellers in the database."""
    sellers_res = await db.execute(select(SellerProfile.id))
    seller_ids = list(sellers_res.scalars().all())
    for s_id in seller_ids:
        await get_or_create_seller_wallet(db, s_id)
    await db.flush()


async def settle_order_to_wallet(
    db: AsyncSession, order: Order
) -> SellerWalletTransaction | None:
    """Settles a completed order into the seller's wallet. Idempotent."""
    # Check if already settled
    existing_tx = await wallet_repo.get_transaction_by_order_id(order.id, db)
    if existing_tx:
        return existing_tx

    wallet = await wallet_repo.get_wallet_for_update(order.seller_id, db)
    if not wallet:
        wallet = await get_or_create_seller_wallet(db, order.seller_id)
        # Lock after creation
        wallet = await wallet_repo.get_wallet_for_update(order.seller_id, db)

    gross_amount = Decimal(str(order.subtotal_amount or 0))
    if gross_amount < Decimal("0.00"):
        gross_amount = Decimal("0.00")

    payment_fee = round(gross_amount * PAYMENT_FEE_RATE, 2)
    commission_fee = round(gross_amount * COMMISSION_FEE_RATE, 2)
    total_fee = payment_fee + commission_fee
    net_credit = gross_amount - total_fee

    balance_before = wallet.available_balance
    balance_after = balance_before + net_credit
    wallet.available_balance = balance_after

    tx = SellerWalletTransaction(
        wallet_id=wallet.id,
        seller_id=order.seller_id,
        transaction_type="ORDER_SETTLEMENT",
        amount=net_credit,
        balance_before=balance_before,
        balance_after=balance_after,
        gross_amount=gross_amount,
        payment_fee=payment_fee,
        commission_fee=commission_fee,
        order_id=order.id,
        description=f"Quyết toán đơn hàng {order.order_code}",
    )
    await wallet_repo.add_wallet_transaction(tx, db)

    # Record platform escrow release & revenue collection in platform ledger
    shipping_fee = Decimal(str(order.shipping_fee or 0))
    await record_escrow_settlement(
        db=db,
        order=order,
        gross_amount=gross_amount,
        payment_fee=payment_fee,
        commission_fee=commission_fee,
        shipping_fee=shipping_fee,
    )

    # Send notification
    seller_profile = await db.get(SellerProfile, order.seller_id)
    if seller_profile and seller_profile.user_id:
        formatted_credit = f"{int(net_credit):,}đ".replace(",", ".")
        await send_notification(
            db=db,
            user_id=seller_profile.user_id,
            type="finance",
            title="Doanh thu đơn hàng đã vào ví",
            content=f"Đơn hàng {order.order_code} đã hoàn tất. Số dư ví đã được cộng +{formatted_credit} (sau khi trừ 5% phí sàn).",
            action_url="/seller/finance",
        )

    return tx


async def request_withdrawal(
    db: AsyncSession,
    seller: SellerProfile,
    amount: Decimal,
    bank_name: str | None = None,
    bank_account_number: str | None = None,
    bank_account_name: str | None = None,
) -> SellerPayout:
    """Processes an instant withdrawal from the seller's available balance."""
    if amount < MIN_WITHDRAWAL_AMOUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Số tiền rút tối thiểu là {int(MIN_WITHDRAWAL_AMOUNT):,} VNĐ".replace(",", "."),
        )

    b_name = bank_name or seller.bank_name
    b_acc_num = bank_account_number or seller.bank_account_number
    b_acc_name = bank_account_name or seller.bank_account_name

    if not b_name or not b_acc_num or not b_acc_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng cung cấp đầy đủ thông tin tài khoản ngân hàng thụ hưởng",
        )

    wallet = await wallet_repo.get_wallet_for_update(seller.id, db)
    if not wallet:
        wallet = await get_or_create_seller_wallet(db, seller.id)
        wallet = await wallet_repo.get_wallet_for_update(seller.id, db)

    if wallet.available_balance < amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Số dư khả dụng ({int(wallet.available_balance):,}đ) không đủ để rút {int(amount):,}đ".replace(",", "."),
        )

    balance_before = wallet.available_balance
    balance_after = balance_before - amount
    wallet.available_balance = balance_after
    wallet.total_withdrawn += amount

    payout_code = f"WD-{secrets.token_hex(4).upper()}"
    now = utc_now()

    payout = SellerPayout(
        payout_code=payout_code,
        seller_id=seller.id,
        amount=amount,
        payout_status="PAID",
        bank_name=b_name,
        bank_account_number=b_acc_num,
        bank_account_name=b_acc_name,
        note=f"Rút tiền từ ví về {b_name} ({b_acc_num})",
        paid_at=now,
        created_at=now,
    )
    payout = await wallet_repo.create_seller_payout(payout, db)

    tx = SellerWalletTransaction(
        wallet_id=wallet.id,
        seller_id=seller.id,
        transaction_type="WITHDRAWAL",
        amount=-amount,
        balance_before=balance_before,
        balance_after=balance_after,
        payout_id=payout.id,
        description=f"Rút tiền về {b_name} ({b_acc_num})",
        created_at=now,
    )
    await wallet_repo.add_wallet_transaction(tx, db)

    # Record platform payout disbursement in platform ledger
    await record_payout_disbursed(
        db=db,
        payout=payout,
        amount=amount,
    )

    if seller.user_id:
        formatted_amount = f"{int(amount):,}đ".replace(",", ".")
        await send_notification(
            db=db,
            user_id=seller.user_id,
            type="finance",
            title="Rút tiền thành công",
            content=f"Lệnh rút tiền {payout_code} thành công. Số tiền {formatted_amount} đã được chuyển tới {b_name} - {b_acc_num}.",
            action_url="/seller/finance",
        )

    return payout


async def update_seller_bank_account(
    db: AsyncSession,
    seller: SellerProfile,
    bank_name: str,
    bank_account_number: str,
    bank_account_name: str,
) -> SellerProfile:
    if not bank_name.strip() or not bank_account_number.strip() or not bank_account_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thông tin ngân hàng không được để trống",
        )

    seller.bank_name = bank_name.strip()
    seller.bank_account_number = bank_account_number.strip()
    seller.bank_account_name = bank_account_name.strip().upper()
    await db.flush()
    return seller
