from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import DBSession
from dependencies.auth import CurrentAdmin
import repositories.platform.platform_finance_repository as platform_repo
from schemas.admin.platform_finance_schema import (
    PaginatedPlatformFinanceTransactionsResponse,
    PlatformFinanceSummaryResponse,
    PlatformFinanceTransactionResponse,
)
import services.platform.platform_finance_service as platform_finance_svc

router = APIRouter(prefix="/admin/finance", tags=["Admin Finance"])


@router.get("/summary", response_model=PlatformFinanceSummaryResponse)
async def get_admin_finance_summary_api(
    user: CurrentAdmin,
    db: DBSession,
) -> PlatformFinanceSummaryResponse:
    """Lấy số liệu tổng hợp 4 chỉ số tài chính vĩ mô và tỷ trọng dòng tiền sàn đang giữ."""
    analytics = await platform_finance_svc.get_platform_finance_analytics(db)
    await db.commit()
    return PlatformFinanceSummaryResponse(**analytics)


@router.post("/reconcile", response_model=PlatformFinanceSummaryResponse)
async def reconcile_admin_finance_api(
    user: CurrentAdmin,
    db: DBSession,
) -> PlatformFinanceSummaryResponse:
    """Thực hiện đối soát và đồng bộ lại toàn bộ số liệu tài chính sàn với dữ liệu thực tế."""
    await platform_finance_svc.reconcile_platform_finance(db)
    await db.commit()
    analytics = await platform_finance_svc.get_platform_finance_analytics(db)
    return PlatformFinanceSummaryResponse(**analytics)


@router.get("/transactions", response_model=PaginatedPlatformFinanceTransactionsResponse)
async def get_admin_finance_transactions_api(
    user: CurrentAdmin,
    db: DBSession,
    transaction_type: Optional[str] = Query(None, description="Lọc theo loại giao dịch"),
    page: int = Query(1, ge=1, description="Trang hiện tại"),
    page_size: int = Query(20, ge=1, le=100, description="Số bản ghi mỗi trang"),
) -> PaginatedPlatformFinanceTransactionsResponse:
    """Lấy danh sách sổ cái biến động tài chính sàn theo thứ tự thời gian."""
    offset = (page - 1) * page_size
    items, total = await platform_repo.get_platform_transactions(
        db=db,
        tx_type=transaction_type,
        limit=page_size,
        offset=offset,
    )

    response_items = [
        PlatformFinanceTransactionResponse(
            id=tx.id,
            transaction_type=tx.transaction_type,
            amount=float(tx.amount),
            escrow_before=float(tx.escrow_before),
            escrow_after=float(tx.escrow_after),
            revenue_before=float(tx.revenue_before),
            revenue_after=float(tx.revenue_after),
            order_id=tx.order_id,
            payout_id=tx.payout_id,
            description=tx.description,
            created_at=tx.created_at,
        )
        for tx in items
    ]

    return PaginatedPlatformFinanceTransactionsResponse(
        items=response_items,
        total=total,
        page=page,
        page_size=page_size,
    )
