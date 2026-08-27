import redis.asyncio as redis

from core.config import settings

REDIS_URL = settings.REDIS_URL

_redis_client: redis.Redis | None = None

async def get_redis_client() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client
