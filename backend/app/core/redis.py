import redis.asyncio as redis
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

async def get_redis_client():
    return await redis.from_url(REDIS_URL, decode_responses=True)
