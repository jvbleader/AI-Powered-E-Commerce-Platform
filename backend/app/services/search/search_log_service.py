from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.engagement import SearchLog

DEFAULT_HOT_KEYWORDS = [
    "iPhone 15 Pro",
    "Tai nghe Bluetooth",
    "Áo Nam Basic",
    "Bàn Phím Cơ",
    "Mỹ Phẩm Korea",
]

async def log_search(
    keyword: str,
    user_id: int | None = None,
    result_count: int | None = None,
    db: AsyncSession | None = None,
) -> None:
    """Log a search query to the SearchLog table."""
    if not keyword or not keyword.strip():
        return
    cleaned_keyword = keyword.strip()[:255]
    if db is None:
        from core.database import async_session_factory
        try:
            async with async_session_factory() as session:
                entry = SearchLog(
                    keyword=cleaned_keyword,
                    user_id=user_id,
                    result_count=result_count,
                )
                session.add(entry)
                await session.commit()
        except Exception:
            pass
    else:
        entry = SearchLog(
            keyword=cleaned_keyword,
            user_id=user_id,
            result_count=result_count,
        )
        db.add(entry)
        await db.flush()

async def get_hot_keywords(
    db: AsyncSession,
    hours: int = 24,
    limit: int = 8,
) -> list[str]:
    """Get the most searched keywords in the last N hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    stmt = (
        select(SearchLog.keyword, func.count().label("cnt"))
        .where(SearchLog.created_at >= cutoff)
        .group_by(SearchLog.keyword)
        .order_by(func.count().desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    keywords = [row.keyword for row in result.all()]

    # Fallback if not enough data
    if len(keywords) < limit:
        for kw in DEFAULT_HOT_KEYWORDS:
            if kw not in keywords:
                keywords.append(kw)
            if len(keywords) >= limit:
                break

    return keywords
