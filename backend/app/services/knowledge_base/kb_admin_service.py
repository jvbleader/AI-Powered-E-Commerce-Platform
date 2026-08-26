from __future__ import annotations

import logging
import os
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from elasticsearch import AsyncElasticsearch
from sqlalchemy.ext.asyncio import AsyncSession

from models.knowledge_base.knowledge_base_article import KnowledgeBaseArticle
from repositories.knowledge_base import kb_repository
from schemas.knowledge_base.kb_schema import ArticleCreateRequest, ArticleUpdateRequest
from services.knowledge_base.chunking_service import (
    chunk_pdf_document,
    extract_pdf_pages,
    parse_pages_from_extracted_text,
)
from services.knowledge_base.kb_indexing_service import (
    delete_article_chunks,
    index_article_chunks,
    reindex_all_articles,
)

logger = logging.getLogger(__name__)

# Base storage directory for uploaded PDF policies
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "policies"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def generate_slug(text: str) -> str:
    """Generate a clean, URL-safe slug from a string (handles Vietnamese/Unicode)."""
    if not text or not isinstance(text, str):
        return "document"

    text = text.replace("đ", "d").replace("Đ", "d")
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("utf-8")
    slug = re.sub(r"[^\w\s-]", "", normalized).strip().lower()
    slug = re.sub(r"[-\s]+", "-", slug).strip("-")
    return slug or "document"


async def ensure_unique_slug(
    db: AsyncSession,
    base_slug: str,
    exclude_id: Optional[int] = None,
) -> str:
    """Ensure a unique slug by appending incremental numeric suffixes if necessary."""
    slug = base_slug
    counter = 1

    while True:
        existing = await kb_repository.get_article_by_slug(db, slug)
        if not existing or (exclude_id is not None and existing.id == exclude_id):
            return slug
        counter += 1
        slug = f"{base_slug}-{counter}"


from core.config import settings
from services.common.azure_blob_service import azure_blob_service


async def save_pdf_to_storage(file_bytes: bytes, file_name: str, slug: str) -> Tuple[str, str, int]:
    """Uploads PDF file directly to Azure Blob Storage in 'policies/' folder."""
    clean_name = re.sub(r"[^\w\s.-]", "", file_name).strip()
    if not clean_name.lower().endswith(".pdf"):
        clean_name = f"{slug}.pdf"

    saved_file_name = f"{slug}_{clean_name}"
    file_size = len(file_bytes)
    blob_name = f"policies/{saved_file_name}"

    azure_url = await azure_blob_service.upload_bytes(
        file_bytes,
        blob_name=blob_name,
        content_type="application/pdf",
    )
    return saved_file_name, azure_url, file_size


def save_pdf_to_disk(file_bytes: bytes, file_name: str, slug: str) -> Tuple[str, str, int]:
    """Deprecated legacy helper: alias to extract metadata."""
    clean_name = re.sub(r"[^\w\s.-]", "", file_name).strip()
    if not clean_name.lower().endswith(".pdf"):
        clean_name = f"{slug}.pdf"
    saved_file_name = f"{slug}_{clean_name}"
    file_size = len(file_bytes)
    return saved_file_name, f"/policies/pdf/{saved_file_name}", file_size


async def process_and_create_pdf_document(
    db: AsyncSession,
    title: str,
    category: str,
    file_bytes: bytes,
    file_name: str,
    slug: Optional[str] = None,
    summary: Optional[str] = None,
    is_published: bool = True,
    es: Optional[AsyncElasticsearch] = None,
) -> KnowledgeBaseArticle:
    """Uploads PDF, extracts pages, chunks text, saves to database, and indexes into Elasticsearch."""
    raw_slug = slug.strip() if slug and slug.strip() else title
    clean_slug = generate_slug(raw_slug)
    unique_slug = await ensure_unique_slug(db, clean_slug)

    # 1. Extract PDF text per page (validates readability before storage)
    pages = extract_pdf_pages(file_bytes)
    page_count = max(1, len(pages))
    extracted_text = "\n\n".join(
        [f"[Trang {p['page_number']}]\n{p['text']}" for p in pages if p.get("text")]
    )

    # 2. Save file to storage (Azure Blob if available, else local disk)
    saved_name, file_url, file_size = await save_pdf_to_storage(file_bytes, file_name, unique_slug)

    # 3. Save to database
    article = await kb_repository.create_article(
        db,
        title=title.strip(),
        slug=unique_slug,
        category=category.strip() if category else "GENERAL",
        summary=summary.strip() if summary else None,
        file_name=saved_name,
        file_url=file_url,
        file_size=file_size,
        page_count=page_count,
        extracted_text=extracted_text,
        is_published=is_published,
    )
    await db.flush()
    await db.refresh(article)

    # 4. Chunk & Index into Elasticsearch
    if article.is_published:
        try:
            chunks = chunk_pdf_document(
                article_id=article.id,
                article_public_id=article.public_id,
                article_title=article.title,
                slug=article.slug,
                category=article.category,
                file_url=article.file_url,
                pages=pages,
            )
            for chunk in chunks:
                chunk["updated_at"] = article.updated_at or article.created_at
                chunk["is_published"] = article.is_published

            await index_article_chunks(chunks, es=es)
        except Exception:
            logger.exception("Failed to index chunks for uploaded PDF %s", article.id)
            raise

    return article


async def create_article(
    db: AsyncSession,
    data: ArticleCreateRequest,
    es: Optional[AsyncElasticsearch] = None,
) -> KnowledgeBaseArticle:
    """Create a new PDF article record, save to DB, and index into Elasticsearch."""
    raw_slug = data.slug.strip() if data.slug and data.slug.strip() else data.title
    clean_slug = generate_slug(raw_slug)
    unique_slug = await ensure_unique_slug(db, clean_slug)

    article = await kb_repository.create_article(
        db,
        title=data.title.strip(),
        slug=unique_slug,
        category=data.category.strip() if data.category else "GENERAL",
        summary=data.summary.strip() if data.summary else None,
        file_name=data.file_name.strip(),
        file_url=data.file_url.strip(),
        file_size=data.file_size,
        page_count=data.page_count,
        extracted_text=data.extracted_text,
        is_published=data.is_published,
    )
    await db.flush()
    await db.refresh(article)

    if article.is_published:
        try:
            pages = parse_pages_from_extracted_text(article.extracted_text)
            if not pages:
                pages = [{"page_number": 1, "text": article.summary or article.title}]

            chunks = chunk_pdf_document(
                article_id=article.id,
                article_public_id=article.public_id,
                article_title=article.title,
                slug=article.slug,
                category=article.category,
                file_url=article.file_url,
                pages=pages,
            )
            for chunk in chunks:
                chunk["updated_at"] = article.updated_at or article.created_at
                chunk["is_published"] = article.is_published

            await index_article_chunks(chunks, es=es)
        except Exception:
            logger.exception("Failed to index chunks for created article %s", article.id)
            raise

    return article


async def update_article(
    db: AsyncSession,
    article: KnowledgeBaseArticle,
    data: ArticleUpdateRequest,
    es: Optional[AsyncElasticsearch] = None,
) -> KnowledgeBaseArticle:
    """Update a PDF document record, refresh DB, and synchronize chunks in Elasticsearch."""
    fields_to_update: Dict[str, Any] = {}

    if data.title is not None:
        fields_to_update["title"] = data.title.strip()

    if data.slug is not None and data.slug.strip():
        new_slug = await ensure_unique_slug(
            db, generate_slug(data.slug.strip()), exclude_id=article.id
        )
        fields_to_update["slug"] = new_slug

    if data.category is not None:
        fields_to_update["category"] = data.category.strip()

    if data.summary is not None:
        fields_to_update["summary"] = data.summary.strip() if data.summary else None

    if data.file_name is not None:
        fields_to_update["file_name"] = data.file_name.strip()

    if data.file_url is not None:
        fields_to_update["file_url"] = data.file_url.strip()

    if data.file_size is not None:
        fields_to_update["file_size"] = data.file_size

    if data.page_count is not None:
        fields_to_update["page_count"] = data.page_count

    if data.extracted_text is not None:
        fields_to_update["extracted_text"] = data.extracted_text

    if data.is_published is not None:
        fields_to_update["is_published"] = data.is_published

    updated_article = await kb_repository.update_article(
        db, article, **fields_to_update
    )
    await db.flush()
    await db.refresh(updated_article)

    # Elastic synchronization
    try:
        await delete_article_chunks(updated_article.id, es=es)
        if updated_article.is_published:
            pages = parse_pages_from_extracted_text(updated_article.extracted_text)
            if not pages:
                pages = [{"page_number": 1, "text": updated_article.summary or updated_article.title}]

            chunks = chunk_pdf_document(
                article_id=updated_article.id,
                article_public_id=updated_article.public_id,
                article_title=updated_article.title,
                slug=updated_article.slug,
                category=updated_article.category,
                file_url=updated_article.file_url,
                pages=pages,
            )
            for chunk in chunks:
                chunk["updated_at"] = updated_article.updated_at or updated_article.created_at
                chunk["is_published"] = updated_article.is_published

            await index_article_chunks(chunks, es=es)
    except Exception:
        logger.exception("Failed to update ES index for article %s", updated_article.id)
        raise

    return updated_article


async def delete_article(
    db: AsyncSession,
    article: KnowledgeBaseArticle,
    es: Optional[AsyncElasticsearch] = None,
) -> None:
    """Delete an article from DB, remove its PDF file from disk, and delete chunks from ES."""
    article_id = article.id
    if article.file_url and "blob.core.windows.net" in article.file_url:
        try:
            await azure_blob_service.delete_blob_by_url(article.file_url)
        except Exception:
            logger.warning("Failed to delete Azure blob for article %s", article_id)

    if article.file_name:
        file_path = UPLOAD_DIR / article.file_name
        if file_path.is_file():
            try:
                os.remove(file_path)
            except Exception:
                logger.warning("Failed to remove local PDF file %s", file_path)

    await kb_repository.delete_article(db, article)
    await db.flush()

    try:
        await delete_article_chunks(article_id, es=es)
    except Exception:
        logger.exception("Failed to delete ES chunks for article %s", article_id)
        raise


async def reindex_knowledge_base(
    db: AsyncSession,
    es: Optional[AsyncElasticsearch] = None,
) -> int:
    """Reindex all published articles into Elasticsearch."""
    return await reindex_all_articles(db, es=es)
