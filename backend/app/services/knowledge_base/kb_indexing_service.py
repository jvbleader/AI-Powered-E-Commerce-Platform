from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from elasticsearch import AsyncElasticsearch
from elasticsearch.helpers import async_bulk
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai.embeddings import generate_query_embedding
from core.elasticsearch import get_es_client
from models.knowledge_base.knowledge_base_article import KnowledgeBaseArticle
from search.indices_kb import KB_INDEX_ALIAS
from services.knowledge_base.chunking_service import chunk_pdf_document, extract_pdf_pages

logger = logging.getLogger(__name__)


async def index_article_chunks(
    chunks: List[Dict[str, Any]],
    es: AsyncElasticsearch | None = None,
) -> None:
    """Index a list of document chunks into Elasticsearch."""
    if not chunks:
        return

    client = es or get_es_client()
    actions: List[Dict[str, Any]] = []

    for chunk in chunks:
        chunk_text = chunk.get("chunk_text", "")
        vector = chunk.get("chunk_vector")
        if vector is None:
            vector = await generate_query_embedding(chunk_text)

        updated_at = chunk.get("updated_at")
        if updated_at is None:
            updated_at = datetime.now(timezone.utc).isoformat()
        elif isinstance(updated_at, datetime):
            updated_at = updated_at.isoformat()

        doc = {
            "chunk_id": str(chunk.get("chunk_id", "")),
            "article_id": str(chunk.get("article_id", "")),
            "article_public_id": str(chunk.get("article_public_id", "")),
            "article_title": chunk.get("article_title", ""),
            "section_title": chunk.get("section_title", ""),
            "category": chunk.get("category", ""),
            "slug": chunk.get("slug", ""),
            "page_number": int(chunk.get("page_number", 1)),
            "file_url": chunk.get("file_url", ""),
            "chunk_text": chunk_text,
            "chunk_vector": vector,
            "is_published": bool(chunk.get("is_published", True)),
            "updated_at": updated_at,
        }

        actions.append({
            "_index": KB_INDEX_ALIAS,
            "_id": str(chunk["chunk_id"]),
            "_source": doc,
        })

    if actions:
        try:
            await async_bulk(client, actions)
            logger.info("Indexed %d knowledge base chunks into '%s'", len(actions), KB_INDEX_ALIAS)
        except Exception:
            logger.exception("Failed to bulk index knowledge base chunks into '%s'", KB_INDEX_ALIAS)
            raise


async def delete_article_chunks(
    article_id: str | int,
    es: AsyncElasticsearch | None = None,
) -> None:
    """Delete all knowledge base chunks for a specific document from Elasticsearch."""
    client = es or get_es_client()
    try:
        await client.delete_by_query(
            index=KB_INDEX_ALIAS,
            query={"term": {"article_id": str(article_id)}},
            conflicts="proceed",
        )
        logger.info("Deleted knowledge base chunks for article_id '%s' from '%s'", article_id, KB_INDEX_ALIAS)
    except Exception:
        logger.exception("Failed to delete knowledge base chunks for article_id '%s'", article_id)
        raise


async def reindex_all_articles(
    db: AsyncSession,
    es: AsyncElasticsearch | None = None,
) -> int:
    """Fetch all published knowledge base PDF documents, re-chunk and reindex into Elasticsearch."""
    client = es or get_es_client()

    stmt = (
        select(KnowledgeBaseArticle)
        .where(KnowledgeBaseArticle.is_published.is_(True))
        .order_by(KnowledgeBaseArticle.id.asc())
    )
    result = await db.execute(stmt)
    articles = result.scalars().all()

    if not articles:
        logger.info("No published knowledge base articles found to reindex.")
        return 0

    all_chunks: List[Dict[str, Any]] = []
    for article in articles:
        # If extracted text or file exists
        pages = [{"page_number": 1, "text": article.extracted_text or article.summary or article.title}]
        chunks = chunk_pdf_document(
            article_id=article.id,
            article_public_id=article.public_id,
            article_title=article.title,
            slug=article.slug,
            category=article.category,
            file_url=article.file_url,
            pages=pages,
        )
        for c in chunks:
            c["updated_at"] = article.updated_at or article.created_at
            c["is_published"] = article.is_published
        all_chunks.extend(chunks)

    if all_chunks:
        await index_article_chunks(all_chunks, es=client)

    logger.info("Reindexed %d chunks across %d knowledge base articles.", len(all_chunks), len(articles))
    return len(all_chunks)
