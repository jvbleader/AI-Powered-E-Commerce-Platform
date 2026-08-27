import json
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from models.base import utc_now
from models.engagement import Notification
from core.redis import get_redis_client

logger = logging.getLogger(__name__)

async def send_notification(db: AsyncSession, user_id: str | int, type: str, title: str, content: str, action_url: str = None):
    # 1. Save to DB (flush only — let caller manage commit/rollback)
    now = utc_now()
    notif = Notification(
        user_id=int(user_id) if isinstance(user_id, str) and user_id.isdigit() else user_id,
        type=type,
        title=title,
        content=content,
        action_url=action_url,
        created_at=now,
    )
    db.add(notif)
    await db.flush()

    # 2. Publish to Redis (best-effort — failure must not crash business transaction)
    try:
        redis_client = await get_redis_client()
        channel = f"channel:notify:user_{user_id}"
        payload = {
            "id": str(notif.id),
            "type": type,
            "title": title,
            "content": content,
            "action_url": action_url,
            "is_read": False,
            "created_at": now.isoformat()
        }
        await redis_client.publish(channel, json.dumps(payload))
    except Exception as e:
        logger.error("Failed to publish notification to Redis for user %s: %s", user_id, e)

    return notif
