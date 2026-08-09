import asyncio
import json
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, or_, select, update

from core.database import DBSession
from core.redis import get_redis_client
from dependencies.auth import CurrentUser
from models.engagement import Notification

router = APIRouter()


class ReadByUrlRequest(BaseModel):
    action_url: Optional[str] = None
    shop_id: Optional[int] = None


@router.get("/stream")
async def stream_notifications(request: Request, current_user: CurrentUser):
    async def event_generator():
        redis_client = await get_redis_client()
        pubsub = redis_client.pubsub()
        channel = f"channel:notify:user_{current_user.id}"
        await pubsub.subscribe(channel)

        try:
            while True:
                if await request.is_disconnected():
                    break

                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message["type"] == "message":
                    data = message["data"]
                    if isinstance(data, bytes):
                        data = data.decode("utf-8")
                    yield f"data: {data}\n\n"

                await asyncio.sleep(0.1)
        finally:
            await pubsub.unsubscribe(channel)
            await redis_client.aclose()

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/")
async def get_notifications(
    current_user: CurrentUser,
    db: DBSession,
    skip: int = 0,
    limit: int = 20
):
    stmt = select(Notification).where(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    notifications = result.scalars().all()
    return notifications


@router.get("/unread-count")
async def get_unread_count(current_user: CurrentUser, db: DBSession):
    stmt_total = select(func.count(Notification.id)).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    )
    result_total = await db.execute(stmt_total)
    total_count = result_total.scalar_one()

    # Badge Chat:
    # - Support: notification unread (/support hoặc legacy /chat?tab=SUPPORTER)
    # - Seller chat: hội thoại còn tin chưa đọc (không phụ thuộc notification.is_read)
    stmt_support = select(func.count(Notification.id)).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
        or_(
            Notification.action_url.like("/support%"),
            Notification.action_url.like("/chat?tab=SUPPORTER%"),
        ),
    )
    support_count = (await db.execute(stmt_support)).scalar_one() or 0

    from models.chat import SellerConversation, SellerMessage

    seller_unread_stmt = (
        select(func.count(func.distinct(SellerMessage.conversation_id)))
        .select_from(SellerMessage)
        .join(SellerConversation, SellerMessage.conversation_id == SellerConversation.id)
        .where(
            SellerConversation.customer_id == current_user.id,
            SellerMessage.sender_type == "SELLER",
            SellerMessage.status.in_(["SENT", "DELIVERED"]),
        )
    )
    seller_unread = (await db.execute(seller_unread_stmt)).scalar_one() or 0

    chat_count = int(support_count) + int(seller_unread)

    return {"unread_count": total_count, "chat_unread_count": chat_count}


@router.put("/{notif_id}/read")
async def mark_notification_as_read(notif_id: str, current_user: CurrentUser, db: DBSession):
    stmt = select(Notification).where(
        Notification.id == notif_id,
        Notification.user_id == current_user.id
    )
    result = await db.execute(stmt)
    notif = result.scalar_one_or_none()

    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    notif.is_read = True
    await db.commit()
    return {"message": "Notification marked as read"}


@router.put("/read-all")
async def mark_all_as_read(current_user: CurrentUser, db: DBSession):
    stmt = update(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).values(is_read=True)
    await db.execute(stmt)
    await db.commit()
    return {"message": "All notifications marked as read"}


@router.put("/read-by-url")
async def mark_by_url(req: ReadByUrlRequest, current_user: CurrentUser, db: DBSession):
    """
    Đánh dấu đã đọc theo URL chính xác, hoặc toàn bộ thông báo chat seller của một shop_id.
    """
    if req.shop_id is not None:
        # Match shop_id=12 hoặc shop_id=12&... — tránh nhầm shop_id=123
        shop_id = req.shop_id
        stmt = update(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
            (
                (Notification.action_url.like(f"%shop_id={shop_id}"))
                | (Notification.action_url.like(f"%shop_id={shop_id}&%"))
            ),
        ).values(is_read=True)
        await db.execute(stmt)
        await db.commit()
        return {"message": "Shop chat notifications marked as read"}

    if not req.action_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cần action_url hoặc shop_id",
        )

    stmt = update(Notification).where(
        Notification.user_id == current_user.id,
        Notification.action_url == req.action_url,
        Notification.is_read == False
    ).values(is_read=True)
    await db.execute(stmt)
    await db.commit()
    return {"message": "Notifications marked as read"}
