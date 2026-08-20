from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status

from core.database import DBSession
from dependencies.auth import CurrentAdmin
from repositories.knowledge_base import kb_repository
from schemas.knowledge_base.kb_schema import (
    ArticleCreateRequest,
    ArticleListResponse,
    ArticleResponse,
    ArticleSummaryResponse,
    ArticleUpdateRequest,
    ReindexResponse,
)
from services.knowledge_base import kb_admin_service

router = APIRouter(prefix="/admin/knowledge-base", tags=["Admin Knowledge Base"])


@router.get("/articles", response_model=ArticleListResponse)
async def list_admin_articles_api(
    user: CurrentAdmin,
    db: DBSession,
    category: Optional[str] = None,
    is_published: Optional[bool] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1, description="Số trang (1-indexed)"),
    size: int = Query(20, ge=1, le=100, description="Kích thước trang"),
) -> ArticleListResponse:
    """Danh sách tất cả các tài liệu tri thức cho Admin (hỗ trợ lọc, tìm kiếm, phân trang)."""
    articles, total = await kb_repository.list_articles(
        db=db,
        category=category,
        is_published=is_published,
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


@router.post("/upload", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def upload_admin_pdf_api(
    user: CurrentAdmin,
    db: DBSession,
    file: UploadFile = File(..., description="File PDF chính sách"),
    title: str = Form(..., min_length=1, max_length=255, description="Tiêu đề tài liệu"),
    category: str = Form("GENERAL", max_length=64, description="Danh mục tài liệu"),
    slug: Optional[str] = Form(None, description="Slug URL (tự sinh nếu để trống)"),
    summary: Optional[str] = Form(None, description="Tóm tắt tài liệu"),
    is_published: bool = Form(True, description="Trạng thái hiển thị"),
) -> ArticleResponse:
    """Tải lên file PDF chính sách/tài liệu, trích xuất text từng trang, lưu trữ và index vào Elasticsearch."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng chỉ tải lên file có định dạng PDF (.pdf).",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File PDF tải lên rỗng.",
        )

    try:
        article = await kb_admin_service.process_and_create_pdf_document(
            db=db,
            title=title,
            category=category,
            file_bytes=file_bytes,
            file_name=file.filename,
            slug=slug,
            summary=summary,
            is_published=is_published,
        )
        await db.commit()
        await db.refresh(article)
        return ArticleResponse.model_validate(article)
    except Exception:
        await db.rollback()
        raise


@router.post("/articles", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_admin_article_api(
    data: ArticleCreateRequest,
    user: CurrentAdmin,
    db: DBSession,
) -> ArticleResponse:
    """Tạo mới bản ghi tài liệu tri thức PDF (JSON payload)."""
    try:
        article = await kb_admin_service.create_article(db=db, data=data)
        await db.commit()
        await db.refresh(article)
        return ArticleResponse.model_validate(article)
    except Exception:
        await db.rollback()
        raise


@router.get("/articles/{id}", response_model=ArticleResponse)
async def get_admin_article_api(
    id: str,
    user: CurrentAdmin,
    db: DBSession,
) -> ArticleResponse:
    """Lấy chi tiết tài liệu tri thức theo ID (số) hoặc public UUID."""
    article = await kb_repository.get_article_by_id_or_public_id(db=db, id_or_uuid=id)
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tài liệu không tồn tại.",
        )
    return ArticleResponse.model_validate(article)


@router.put("/articles/{id}", response_model=ArticleResponse)
async def update_admin_article_api(
    id: str,
    data: ArticleUpdateRequest,
    user: CurrentAdmin,
    db: DBSession,
) -> ArticleResponse:
    """Cập nhật thông tin tài liệu và đồng bộ lại các chunks trên Elasticsearch."""
    article = await kb_repository.get_article_by_id_or_public_id(db=db, id_or_uuid=id)
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tài liệu không tồn tại.",
        )

    try:
        updated = await kb_admin_service.update_article(db=db, article=article, data=data)
        await db.commit()
        await db.refresh(updated)
        return ArticleResponse.model_validate(updated)
    except Exception:
        await db.rollback()
        raise


@router.delete("/articles/{id}", response_model=dict)
async def delete_admin_article_api(
    id: str,
    user: CurrentAdmin,
    db: DBSession,
) -> dict:
    """Xoá tài liệu khỏi database, xoá file PDF và gỡ bỏ tất cả chunks liên quan trên Elasticsearch."""
    article = await kb_repository.get_article_by_id_or_public_id(db=db, id_or_uuid=id)
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tài liệu không tồn tại.",
        )

    try:
        await kb_admin_service.delete_article(db=db, article=article)
        await db.commit()
        return {"message": "Xoá tài liệu thành công.", "id": str(id)}
    except Exception:
        await db.rollback()
        raise


@router.post("/reindex", response_model=ReindexResponse)
async def reindex_knowledge_base_api(
    user: CurrentAdmin,
    db: DBSession,
) -> ReindexResponse:
    """Reindex toàn bộ tài liệu đã publish vào Elasticsearch."""
    try:
        count = await kb_admin_service.reindex_knowledge_base(db=db)
        return ReindexResponse(
            indexed_chunks_count=count,
            message=f"Đã reindex thành công {count} chunks vào Elasticsearch.",
        )
    except Exception:
        await db.rollback()
        raise
