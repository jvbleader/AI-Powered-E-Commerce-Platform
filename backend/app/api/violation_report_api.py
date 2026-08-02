from fastapi import APIRouter, HTTPException, status
from core.database import DBSession
from dependencies.auth import CurrentUser
from schemas.violation_report_schema import (
    CreateViolationReportRequest,
    ViolationReportResponse,
)
from services.violation_report_service import create_violation_report

router = APIRouter(prefix="/reports", tags=["Violation Reports"])


@router.post("", response_model=ViolationReportResponse, status_code=status.HTTP_201_CREATED)
async def submit_violation_report_api(
    data: CreateViolationReportRequest,
    user: CurrentUser,
    db: DBSession,
) -> ViolationReportResponse:
    try:
        user_id = user.id if user else None
        report_resp = await create_violation_report(db, user_id=user_id, data=data)
        await db.commit()
        return report_resp
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi gửi báo cáo: {str(e)}",
        )
