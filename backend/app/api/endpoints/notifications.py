import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, update

from core.database import DBSession
from core.redis import get_redis_client
from dependencies.auth import CurrentUser
from models.notification import Notification

router = APIRouter()

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
                    # ensure it's a string, if it's bytes decode it
                    data = message["data"]
                    if isinstance(data, bytes):
                        data = data.decode("utf-8")
                    yield f"data: {data}\n\n"
                
                await asyncio.sleep(0.1)
        finally:
            await pubsub.unsubscribe(channel)
            await redis_client.aclose()

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/unread-count")
async def get_unread_count(current_user: CurrentUser, db: DBSession):
    stmt = select(func.count(Notification.id)).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    )
    result = await db.execute(stmt)
    count = result.scalar_one()
    return {"unread_count": count}

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
