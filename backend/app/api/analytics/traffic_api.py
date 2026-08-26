from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import DBSession
from dependencies.auth import CurrentUserOptional
from models.engagement.traffic_log import TrafficLog
from models.user import User
from schemas.analytics.traffic_schema import PageViewEventRequest, PageViewEventResponse

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def parse_device_type(user_agent: str | None) -> str:
    if not user_agent:
        return "DESKTOP"
    ua = user_agent.lower()
    if "tablet" in ua or "ipad" in ua:
        return "TABLET"
    if "mobi" in ua or "android" in ua or "iphone" in ua:
        return "MOBILE"
    return "DESKTOP"


def parse_source_channel(referrer: str | None, path: str, host: str | None = None) -> str:
    if not referrer:
        return "DIRECT"
    ref = referrer.lower()

    # Kiểm tra nếu là chuyển trang nội bộ cùng domain hoặc môi trường dev localhost -> Trực tiếp (DIRECT)
    if host and host.lower() in ref:
        return "DIRECT"
    if "localhost" in ref or "127.0.0.1" in ref:
        return "DIRECT"

    # Quảng cáo có gắn UTM parameters / click IDs
    if "utm_source" in ref or "gclid" in ref or "fbclid" in ref or "utm_medium=cpc" in ref or "utm_campaign" in ref:
        return "ADS"

    # Công cụ tìm kiếm
    if any(engine in ref for engine in ["google.", "bing.", "yahoo.", "duckduckgo.", "coccoc.", "ecosia."]):
        return "ORGANIC_SEARCH"

    # Mạng xã hội
    if any(social in ref for social in ["facebook.", "fb.com", "instagram.", "tiktok.", "twitter.", "x.com", "youtube.", "linkedin.", "zalo.", "pinterest.", "threads.net"]):
        return "SOCIAL"

    # Các trang web bên ngoài khác trỏ link về
    return "REFERRAL"


@router.post("/pageview", response_model=PageViewEventResponse)
async def record_pageview_api(
    data: PageViewEventRequest,
    request: Request,
    db: DBSession,
    user: CurrentUserOptional = None,
):
    try:
        user_agent = request.headers.get("user-agent") or None
        ip_address = request.client.host if request.client else None
        host = request.headers.get("host") or None
        
        device_type = data.device_type or parse_device_type(user_agent)
        source_channel = data.source_channel or parse_source_channel(data.referrer, data.path, host)

        log_entry = TrafficLog(
            user_id=user.id if user else None,
            session_id=data.session_id,
            path=data.path[:255],
            referrer=data.referrer[:500] if data.referrer else None,
            source_channel=source_channel,
            device_type=device_type,
            ip_address=ip_address[:45] if ip_address else None,
            user_agent=user_agent[:500] if user_agent else None,
        )
        db.add(log_entry)
        await db.commit()
    except Exception:
        # Analytics ingestion should never break the client
        await db.rollback()

    return PageViewEventResponse(status="success")
