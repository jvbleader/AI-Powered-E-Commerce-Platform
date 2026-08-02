import json
from sqlalchemy.ext.asyncio import AsyncSession
from models.notification import Notification
from core.redis import get_redis_client

async def send_notification(db: AsyncSession, user_id: str, type: str, title: str, content: str, action_url: str = None):
    # 1. Save to DB
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        content=content,
        action_url=action_url
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)
    
    # 2. Publish to Redis
    redis_client = await get_redis_client()
    channel = f"channel:notify:user_{user_id}"
    payload = {
        "id": notif.id,
        "type": type,
        "title": title,
        "content": content,
        "action_url": action_url,
        "created_at": notif.created_at.isoformat() if notif.created_at else None
    }
    await redis_client.publish(channel, json.dumps(payload))
    await redis_client.aclose()
    
    return notif
