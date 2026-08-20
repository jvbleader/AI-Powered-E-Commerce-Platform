from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from core.database import DBSession
from dependencies.auth import CurrentSupporter
from schemas.moderation.dispute_schema import (
    DisputeListResponse,
    DisputeResponse,
    ResolveDisputeRequest,
)
import services.moderation.dispute_service as dispute_service

router = APIRouter(prefix="/api/moderation/disputes", tags=["Moderation Disputes"])


@router.get("", response_model=DisputeListResponse)
async def list_disputes_api(
    user: CurrentSupporter,
    db: DBSession,
    status_filter: Optional[str] = Query(
        None,
        alias="status",
        description="Lọc theo trạng thái hoàn/khiếu nại: DISPUTED, SUPPORT_APPROVED, SUPPORT_REJECTED, etc.",
    ),
    skip: int = Query(0, ge=0, description="Số lượng bỏ qua (phân trang)"),
    limit: int = Query(50, ge=1, le=100, description="Số lượng tối đa trả về"),
) -> DisputeListResponse:
    items, total = await dispute_service.get_disputes(
        user=user,
        db=db,
        status_filter=status_filter,
        skip=skip,
        limit=limit,
    )
    return DisputeListResponse(
        items=[DisputeResponse.model_validate(item) for item in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/{dispute_id}", response_model=DisputeResponse)
async def get_dispute_detail_api(
    dispute_id: str,
    user: CurrentSupporter,
    db: DBSession,
) -> DisputeResponse:
    dispute = await dispute_service.get_dispute_detail(
        user=user,
        dispute_id=dispute_id,
        db=db,
    )
    return DisputeResponse.model_validate(dispute)


@router.post("/{dispute_id}/resolve", response_model=DisputeResponse)
async def resolve_dispute_api(
    dispute_id: str,
    data: ResolveDisputeRequest,
    user: CurrentSupporter,
    db: DBSession,
) -> DisputeResponse:
    try:
        dispute = await dispute_service.resolve_dispute(
            user=user,
            dispute_id=dispute_id,
            decision=data.decision,
            note=data.note,
            db=db,
        )
        await db.commit()
        return DisputeResponse.model_validate(dispute)
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi xử lý khiếu nại: {str(e)}",
        )
