from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse

from core.database import DBSession
from repositories.knowledge_base import kb_repository
from schemas.knowledge_base.kb_schema import (
    ArticleListResponse,
    ArticleResponse,
    ArticleSummaryResponse,
)
from services.knowledge_base.kb_admin_service import UPLOAD_DIR

router = APIRouter(prefix="/policies", tags=["Public Policies"])


@router.get("", response_model=ArticleListResponse)
@router.get("/", response_model=ArticleListResponse)
async def list_public_policies_api(
    db: DBSession,
    category: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1, description="Số trang (1-indexed)"),
    size: int = Query(20, ge=1, le=100, description="Kích thước trang"),
) -> ArticleListResponse:
    """Lấy danh sách các tài liệu chính sách/hướng dẫn đã xuất bản công khai."""
    articles, total = await kb_repository.list_articles(
        db=db,
        category=category,
        is_published=True,
        search=search,
        page=page,
        size=size,
    )
    items = [ArticleSummaryResponse.model_validate(art) for art in articles]
    return ArticleListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
    )


@router.get("/pdf/{file_name:path}")
async def serve_public_pdf_file_api(file_name: str) -> FileResponse:
    """Phục vụ file PDF công khai để trình duyệt nhúng trực tiếp vào PDF viewer (inline)."""
    clean_name = Path(file_name).name
    file_path = UPLOAD_DIR / clean_name

    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File PDF '{clean_name}' không tồn tại trên hệ thống.",
        )

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{clean_name}"',
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/{slug}", response_model=ArticleResponse)
async def get_public_policy_by_slug_api(
    slug: str,
    db: DBSession,
) -> ArticleResponse:
    """Lấy chi tiết một tài liệu chính sách theo slug và tăng lượt xem (view_count)."""
    article = await kb_repository.get_article_by_slug(db=db, slug=slug)
    if not article or not article.is_published:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chính sách không tồn tại.",
        )

    try:
        await kb_repository.increment_view_count(db=db, article=article)
        await db.commit()
        await db.refresh(article)
    except Exception:
        # If increment fails, we still return the article without blocking the reader
        await db.rollback()

    return ArticleResponse.model_validate(article)
