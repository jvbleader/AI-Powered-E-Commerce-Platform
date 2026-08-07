import redis.asyncio as redis
import os

from core.config import settings

REDIS_URL = settings.REDIS_URL

async def get_redis_client():
    return await redis.from_url(REDIS_URL, decode_responses=True)
