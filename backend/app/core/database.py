import os
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

load_dotenv()
# Load from parent directory if running from backend/app folder
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

ASYNC_DATABASE_URL = os.getenv("ASYNC_DATABASE_URL") or os.getenv("DATABASE_URL")
if ASYNC_DATABASE_URL:
    if ASYNC_DATABASE_URL.startswith("mysql:asyncmy//"):
        ASYNC_DATABASE_URL = ASYNC_DATABASE_URL.replace("mysql:asyncmy//", "mysql+asyncmy://", 1)

engine = create_async_engine(ASYNC_DATABASE_URL, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


from typing import Annotated
from fastapi import Depends

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


DBSession = Annotated[AsyncSession, Depends(get_db)]

