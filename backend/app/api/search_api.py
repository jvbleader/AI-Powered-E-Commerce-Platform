from __future__ import annotations

import logging

from fastapi import APIRouter, Query
from core.database import DBSession
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
