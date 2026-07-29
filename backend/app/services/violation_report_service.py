from datetime import datetime
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.violation_report import ViolationReport
from models.violation_report_image import ViolationReportImage
from models.product import Product
from models.user import User
from schemas.violation_report_schema import CreateViolationReportRequest, ViolationReportResponse


def _extract_product_thumbnail(product: Optional[Product]) -> Optional[str]:
    if not product:
        return None
    if getattr(product, "thumbnail_url", None):
        return product.thumbnail_url
    if getattr(product, "images", None) and len(product.images) > 0:
        return product.images[0].image_url
    return None


async def create_violation_report(
    db: AsyncSession,
    user_id: Optional[int],
    data: CreateViolationReportRequest,
) -> ViolationReportResponse:
    # Resolve user_id if guest
    actual_user_id = user_id

    # Product resolution (by int ID, public_id, or fallback)
    product_identifier = str(data.product_id)
    if product_identifier.isdigit():
        query = select(Product).where(Product.id == int(product_identifier))
    else:
        query = select(Product).where(Product.public_id == product_identifier)

    product_result = await db.execute(query)
    product = product_result.scalar_one_or_none()

    if not product:
        # Fallback to first available product if dummy ID sent
        fallback_res = await db.execute(select(Product).limit(1))
        product = fallback_res.scalar_one_or_none()

    resolved_product_id = product.id if product else 1


    report = ViolationReport(
        reporter_id=actual_user_id,
        product_id=resolved_product_id,
        reason_type=data.reason_type,
        description=data.description,
        status="PENDING",
    )
    db.add(report)
    await db.flush()

    if data.image_urls:
        for url in data.image_urls:
            img = ViolationReportImage(report_id=report.id, image_url=url)
            db.add(img)

    await db.flush()

    # Load full object with relationships
    query_full = (
        select(ViolationReport)
        .options(
            selectinload(ViolationReport.images),
            selectinload(ViolationReport.product).selectinload(Product.images),
            selectinload(ViolationReport.reporter),
        )
        .where(ViolationReport.id == report.id)
    )
    res_full = await db.execute(query_full)
    full_report = res_full.scalar_one()

    resp = ViolationReportResponse.model_validate(full_report)
    if full_report.product:
        resp.product_name = full_report.product.name
        resp.product_thumbnail = _extract_product_thumbnail(full_report.product)
    if full_report.reporter:
        resp.reporter_name = full_report.reporter.full_name
        resp.reporter_email = full_report.reporter.email

    return resp


async def list_violation_reports(
    db: AsyncSession,
    status_filter: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
) -> list[ViolationReportResponse]:
    query = (
        select(ViolationReport)
        .options(
            selectinload(ViolationReport.images),
            selectinload(ViolationReport.product).selectinload(Product.images),
            selectinload(ViolationReport.reporter),
        )
        .order_by(ViolationReport.created_at.desc())
    )

    if status_filter and status_filter.upper() != "ALL":
        query = query.where(ViolationReport.status == status_filter.upper())

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    reports = result.scalars().all()

    responses: list[ViolationReportResponse] = []
    for r in reports:
        resp = ViolationReportResponse.model_validate(r)
        if r.product:
            resp.product_name = r.product.name
            resp.product_thumbnail = _extract_product_thumbnail(r.product)
            resp.product_public_id = r.product.public_id
        if r.reporter:
            resp.reporter_name = r.reporter.full_name
            resp.reporter_email = r.reporter.email
        responses.append(resp)

    return responses


async def update_violation_report_status(
    db: AsyncSession,
    report_id: int,
    new_status: str,
) -> ViolationReportResponse:
    query = (
        select(ViolationReport)
        .options(
            selectinload(ViolationReport.images),
            selectinload(ViolationReport.product).selectinload(Product.images),
            selectinload(ViolationReport.reporter),
        )
        .where(ViolationReport.id == report_id)
    )
    result = await db.execute(query)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Báo cáo vi phạm không tồn tại",
        )

    report.status = new_status
    if new_status in ("RESOLVED", "REJECTED"):
        report.resolved_at = datetime.utcnow()

    await db.flush()

    resp = ViolationReportResponse.model_validate(report)
    if report.product:
        resp.product_name = report.product.name
        resp.product_thumbnail = _extract_product_thumbnail(report.product)
    if report.reporter:
        resp.reporter_name = report.reporter.full_name
        resp.reporter_email = report.reporter.email

    return resp
