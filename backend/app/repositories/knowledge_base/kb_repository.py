from __future__ import annotations

from typing import List, Optional, Tuple

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.knowledge_base.knowledge_base_article import KnowledgeBaseArticle


async def get_article_by_id_or_public_id(
    db: AsyncSession,
    id_or_uuid: int | str,
) -> Optional[KnowledgeBaseArticle]:
    """Retrieve an article by its integer ID or string public UUID."""
    if isinstance(id_or_uuid, int) or (isinstance(id_or_uuid, str) and id_or_uuid.isdigit()):
        stmt = select(KnowledgeBaseArticle).where(KnowledgeBaseArticle.id == int(id_or_uuid))
        result = await db.execute(stmt)
        article = result.scalar_one_or_none()
        if article is not None:
            return article

    stmt = select(KnowledgeBaseArticle).where(KnowledgeBaseArticle.public_id == str(id_or_uuid))
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_article_by_slug(
    db: AsyncSession,
    slug: str,
) -> Optional[KnowledgeBaseArticle]:
    """Retrieve an article by its unique slug."""
    stmt = select(KnowledgeBaseArticle).where(KnowledgeBaseArticle.slug == slug)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_articles(
    db: AsyncSession,
    category: Optional[str] = None,
    is_published: Optional[bool] = None,
    search: Optional[str] = None,
    page: int = 1,
    size: int = 20,
) -> Tuple[List[KnowledgeBaseArticle], int]:
    """List articles with optional filtering, search, and pagination.

    Returns:
        Tuple of (articles_list, total_count)
    """
    filters = []

    if category is not None and category.strip():
        filters.append(KnowledgeBaseArticle.category == category.strip())

    if is_published is not None:
        filters.append(KnowledgeBaseArticle.is_published == is_published)

    if search is not None and search.strip():
        search_term = f"%{search.strip()}%"
        filters.append(
            or_(
                KnowledgeBaseArticle.title.ilike(search_term),
                KnowledgeBaseArticle.summary.ilike(search_term),
                KnowledgeBaseArticle.slug.ilike(search_term),
            )
        )

    count_stmt = select(func.count(KnowledgeBaseArticle.id))
    if filters:
        count_stmt = count_stmt.where(and_(*filters))

    total = (await db.scalar(count_stmt)) or 0

    page_num = max(1, page)
    page_size = max(1, min(size, 100))
    offset = (page_num - 1) * page_size

    stmt = select(KnowledgeBaseArticle)
    if filters:
        stmt = stmt.where(and_(*filters))

    stmt = stmt.order_by(KnowledgeBaseArticle.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(stmt)
    articles = list(result.scalars().all())

    return articles, total


async def create_article(
    db: AsyncSession,
    **fields,
) -> KnowledgeBaseArticle:
    """Create and persist a new article record."""
    article = KnowledgeBaseArticle(**fields)
    db.add(article)
    await db.flush()
    return article


async def update_article(
    db: AsyncSession,
    article: KnowledgeBaseArticle,
    **fields,
) -> KnowledgeBaseArticle:
    """Update fields on an existing article instance."""
    for key, value in fields.items():
        if value is not None:
            setattr(article, key, value)

    await db.flush()
    return article


async def delete_article(
    db: AsyncSession,
    article: KnowledgeBaseArticle,
) -> None:
    """Delete an article record from the database."""
    await db.delete(article)
    await db.flush()


async def increment_view_count(
    db: AsyncSession,
    article: KnowledgeBaseArticle,
) -> None:
    """Atomically increment the view count of an article."""
    article.view_count = KnowledgeBaseArticle.view_count + 1
    await db.flush()
