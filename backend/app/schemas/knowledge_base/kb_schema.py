from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ArticleCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Tiêu đề tài liệu")
    slug: Optional[str] = Field(None, max_length=255, description="Slug định danh URL (tự sinh nếu để trống)")
    category: str = Field("GENERAL", max_length=64, description="Danh mục chính sách/hỗ trợ")
    summary: Optional[str] = Field(None, description="Tóm tắt ngắn gọn tài liệu")
    file_name: str = Field(..., min_length=1, max_length=255, description="Tên file PDF gốc")
    file_url: str = Field(..., min_length=1, max_length=512, description="Đường dẫn file PDF")
    file_size: Optional[int] = Field(None, description="Kích thước file theo bytes")
    page_count: int = Field(1, ge=1, description="Tổng số trang của file PDF")
    extracted_text: Optional[str] = Field(None, description="Toàn văn trích xuất từ PDF")
    is_published: bool = Field(True, description="Trạng thái hiển thị công khai")


class ArticleUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255, description="Tiêu đề tài liệu")
    slug: Optional[str] = Field(None, max_length=255, description="Slug định danh URL")
    category: Optional[str] = Field(None, max_length=64, description="Danh mục chính sách/hỗ trợ")
    summary: Optional[str] = Field(None, description="Tóm tắt ngắn gọn tài liệu")
    file_name: Optional[str] = Field(None, max_length=255, description="Tên file PDF gốc")
    file_url: Optional[str] = Field(None, max_length=512, description="Đường dẫn file PDF")
    file_size: Optional[int] = Field(None, description="Kích thước file theo bytes")
    page_count: Optional[int] = Field(None, ge=1, description="Tổng số trang của file PDF")
    extracted_text: Optional[str] = Field(None, description="Toàn văn trích xuất từ PDF")
    is_published: Optional[bool] = Field(None, description="Trạng thái hiển thị công khai")


class ArticleSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    public_id: str
    title: str
    slug: str
    category: str
    summary: Optional[str] = None
    file_name: str
    file_url: str
    page_count: int
    is_published: bool
    view_count: int
    created_at: datetime
    updated_at: datetime


class ArticleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    public_id: str
    title: str
    slug: str
    category: str
    summary: Optional[str] = None
    file_name: str
    file_url: str
    file_size: Optional[int] = None
    page_count: int
    extracted_text: Optional[str] = None
    is_published: bool
    view_count: int
    created_at: datetime
    updated_at: datetime


class ArticleListResponse(BaseModel):
    items: List[ArticleSummaryResponse]
    total: int
    page: int
    size: int


class ReindexResponse(BaseModel):
    indexed_chunks_count: int
    message: str
