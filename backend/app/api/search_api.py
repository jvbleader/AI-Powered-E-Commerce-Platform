from __future__ import annotations

import logging

from fastapi import APIRouter, Query, Depends
from core.database import DBSession
from schemas.search import ShopSearchRequest, ShopSearchResponse
import services.search_service as search_svc
import services.search_log_service as search_log_svc

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Search"])

@router.get("/products/autocomplete")
async def autocomplete(
    q: str = Query(..., min_length=1, max_length=255, description="Search query"),
):
    """Return keyword suggestions for autocomplete dropdown (Shopee-style)."""
    result = await search_svc.search_autocomplete(query=q, limit=8)
    return result

@router.get("/search/hot-keywords")
async def hot_keywords(db: DBSession):
    """Return trending search keywords from the last 24 hours."""
    keywords = await search_log_svc.get_hot_keywords(db=db, hours=24, limit=8)
    return {"keywords": keywords}

@router.get("/search/shops", response_model=ShopSearchResponse)
async def search_shops(
    q: str = Query(None, description="Shop name or description"),
    min_rating: float = Query(None, description="Minimum average rating"),
    sort: str = Query("relevance", description="Sort by relevance, newest, rating, product_count"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100)
):
    """Search for shops using Elasticsearch."""
    req = ShopSearchRequest(
        q=q,
        min_rating=min_rating,
        sort=sort,
        page=page,
        limit=size
    )
    return await search_svc.search_shops(req)
