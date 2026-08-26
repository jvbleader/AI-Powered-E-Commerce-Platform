import json
import logging
import re
import sys
from pathlib import Path
from typing import Optional, Union, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

# Ensure app root is in sys.path
app_dir = Path(__file__).resolve().parent.parent
if str(app_dir) not in sys.path:
    sys.path.insert(0, str(app_dir))

from models.catalog import Category
import services.catalog.product_public_service as product_public_service
import repositories.catalog.product_repository as product_repository

logger = logging.getLogger(__name__)

VIETNAMESE_FILLERS = [
    r"\btôi muốn tìm mua\b",
    r"\btôi muốn tìm\b",
    r"\btôi muốn mua\b",
    r"\btôi cần mua\b",
    r"\btôi cần tìm\b",
    r"\btìm giúp (em|mình|tôi|bạn)\b",
    r"\bmua giúp (em|mình|tôi|bạn)\b",
    r"\bcho (mình|em|tôi) hỏi\b",
    r"\bshop có bán\b",
    r"\bcó bán\b",
    r"\bcần mua\b",
    r"\bmuốn mua\b",
    r"\btìm kiếm\b",
    r"\bgiá rẻ\b",
    r"\bloại nào tốt\b",
    r"\bxem giúp\b",
    r"\btư vấn giúp\b",
    r"\bở đây có\b",
    r"\bgiúp (mình|em|tôi)\b",
]


def normalize_search_query(query: Optional[str]) -> str:
    """
    Cleans up conversational Vietnamese prefixes, fillers, and extra whitespaces
    to extract core intent keywords.
    """
    if not query:
        return ""
    text = query.strip().lower()
    for pattern in VIETNAMESE_FILLERS:
        text = re.sub(pattern, " ", text, flags=re.IGNORECASE)
    # Remove excessive whitespaces
    text = re.sub(r"\s+", " ", text).strip()
    return text


async def resolve_category_slug(
    db: AsyncSession, category_input: Optional[Union[str, int]]
) -> Optional[str]:
    """
    Resolves category by ID, exact slug/name, or fuzzy ILIKE name into a valid category_slug.
    """
    if not category_input:
        return None

    cat_str = str(category_input).strip()
    if not cat_str:
        return None

    # 1. If numeric integer ID
    if cat_str.isdigit():
        try:
            stmt = select(Category.slug).where(Category.id == int(cat_str))
            res = await db.execute(stmt)
            slug = res.scalar_one_or_none()
            if slug:
                return str(slug)
        except Exception as e:
            logger.debug(f"Error resolving category by id {cat_str}: {e}")

    # 2. Exact match on slug or name (case-insensitive)
    try:
        stmt = select(Category.slug).where(
            or_(
                Category.slug == cat_str.lower(),
                func.lower(Category.name) == cat_str.lower(),
            )
        )
        res = await db.execute(stmt)
        slug = res.scalar_one_or_none()
        if slug:
            return str(slug)
    except Exception as e:
        logger.debug(f"Error resolving category exact match {cat_str}: {e}")

    # 3. Fuzzy search in Category table
    try:
        stmt = (
            select(Category.slug)
            .where(
                or_(
                    Category.name.ilike(f"%{cat_str}%"),
                    Category.slug.ilike(f"%{cat_str}%"),
                )
            )
            .order_by(Category.sort_order.asc(), Category.id.asc())
            .limit(1)
        )
        res = await db.execute(stmt)
        slug = res.scalar_one_or_none()
        if slug:
            return str(slug)
    except Exception as e:
        logger.debug(f"Error resolving category fuzzy match {cat_str}: {e}")

    return None


def _format_product_item(
    p: Any, min_price: Optional[float] = None, max_price: Optional[float] = None
) -> Dict[str, Any]:
    """
    Extracts unified product metadata required by both LLM context and frontend cards.
    """
    active_variants = [
        v
        for v in (getattr(p, "variants", None) or [])
        if getattr(v, "status", "") != "DELETED"
    ]
    first_variant = active_variants[0] if active_variants else None

    prices: List[float] = []
    sale_prices: List[float] = []
    total_stock = 0
    variant_names: List[str] = []

    for v in active_variants:
        if getattr(v, "price", None) is not None:
            try:
                prices.append(float(v.price))
            except (ValueError, TypeError):
                pass
        if getattr(v, "sale_price", None) is not None:
            try:
                sale_prices.append(float(v.sale_price))
            except (ValueError, TypeError):
                pass
        inv = getattr(v, "inventory", None)
        if inv:
            qty = getattr(inv, "quantity", 0) or 0
            reserved = getattr(inv, "reserved_quantity", 0) or 0
            total_stock += max(0, qty - reserved)
        v_name = getattr(v, "variant_name", None)
        if v_name:
            variant_names.append(str(v_name))

    min_p = min(prices) if prices else 0.0
    min_sale_p = min(sale_prices) if sale_prices else None

    thumbnail_url = ""
    images = getattr(p, "images", None) or []
    if images:
        thumb = next((img for img in images if getattr(img, "is_thumbnail", False)), None)
        thumbnail_url = getattr(thumb or images[0], "image_url", "")

    seller = getattr(p, "seller", None)
    shop_slug = getattr(seller, "shop_slug", "shop") if seller else "shop"
    shop_name = getattr(seller, "shop_name", "") if seller else ""

    primary_variant_id = (
        str(getattr(first_variant, "public_id", None) or getattr(first_variant, "id", None))
        if first_variant
        else str(getattr(p, "public_id", getattr(p, "id", "")))
    )

    effective_price = min_sale_p if min_sale_p is not None else min_p
    is_within_budget = True
    if max_price is not None and effective_price > max_price:
        is_within_budget = False
    if min_price is not None and effective_price < min_price:
        is_within_budget = False

    return {
        "id": getattr(p, "public_id", str(getattr(p, "id", ""))),
        "db_id": getattr(p, "id", None),
        "name": getattr(p, "name", ""),
        "price": min_p,
        "sale_price": min_sale_p,
        "is_within_budget": is_within_budget,
        "stock": total_stock,
        "average_rating": float(getattr(p, "average_rating", 0) or 0),
        "review_count": getattr(p, "review_count", 0) or 0,
        "thumbnail_url": thumbnail_url or "",
        "slug": getattr(p, "slug", "") or "",
        "shop_name": shop_name,
        "shop_slug": shop_slug,
        "primary_variant_id": primary_variant_id,
        "variants_summary": ", ".join(variant_names[:5]) if variant_names else "Tiêu chuẩn",
    }


async def execute_multi_tier_catalog_search(
    db: AsyncSession,
    query: Optional[str] = None,
    category: Optional[Union[str, int]] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    brand: Optional[str] = None,
    sort_by: Optional[str] = None,
    limit: int = 5,
) -> Dict[str, Any]:
    """
    Executes a multi-tier self-healing catalog search:
    - Tier 1: Exact search with all strict filters.
    - Tier 2: Auto-relaxation of narrow price filters and long keywords.
    - Tier 3: Semantic suggestions based on keyword concepts.
    - Tier 4: Fallback to best selling / top recommended products.
    """
    limit = max(1, min(limit, 10))
    clean_query = normalize_search_query(query)
    category_slug = await resolve_category_slug(db, category)

    # ----------------------------------------------------
    # TẦNG 1: Tìm kiếm chính xác với toàn bộ bộ lọc
    # ----------------------------------------------------
    try:
        listing = await product_public_service.get_public_product_list(
            db,
            keyword=clean_query or None,
            category_slug=category_slug,
            min_price=min_price,
            max_price=max_price,
            sort_by=sort_by or ("relevance" if clean_query else "best_selling"),
            page=1,
            size=limit,
        )
        if listing and listing.items:
            return {
                "match_type": "exact",
                "search_summary": f"Tìm thấy {len(listing.items)} sản phẩm phù hợp chính xác.",
                "items": [_format_product_item(p, min_price=min_price, max_price=max_price) for p in listing.items],
            }
    except Exception as err:
        logger.warning(f"Error during Tier 1 exact catalog search: {err}")

    # ----------------------------------------------------
    # TẦNG 2: Nới lỏng bộ lọc (Auto-Relaxation)
    # ----------------------------------------------------
    # 2a. Nới lỏng khoảng giá (+30% max_price hoặc bỏ min_price)
    if min_price is not None or max_price is not None:
        try:
            relaxed_max = max_price * 1.3 if max_price else None
            listing = await product_public_service.get_public_product_list(
                db,
                keyword=clean_query or None,
                category_slug=category_slug,
                min_price=None,
                max_price=relaxed_max,
                sort_by="relevance" if clean_query else "best_selling",
                page=1,
                size=limit,
            )
            if listing and listing.items:
                return {
                    "match_type": "relaxed",
                    "search_summary": "Không có sản phẩm chính xác trong khoảng giá yêu cầu. Đã nới lỏng mức giá để tìm sản phẩm phù hợp nhất.",
                    "items": [_format_product_item(p, min_price=min_price, max_price=max_price) for p in listing.items],
                }
        except Exception as err:
            logger.warning(f"Error during Tier 2a price relaxation: {err}")

    # 2b. Nới lỏng từ khóa (tìm theo danh mục nếu từ khóa quá dài / chi tiết)
    if clean_query and category_slug:
        try:
            listing = await product_public_service.get_public_product_list(
                db,
                keyword=None,
                category_slug=category_slug,
                sort_by="best_selling",
                page=1,
                size=limit,
            )
            if listing and listing.items:
                return {
                    "match_type": "relaxed",
                    "search_summary": f"Không tìm thấy sản phẩm chính xác cho '{clean_query}'. Đã gợi ý các sản phẩm hàng đầu trong danh mục liên quan.",
                    "items": [_format_product_item(p, min_price=min_price, max_price=max_price) for p in listing.items],
                }
        except Exception as err:
            logger.warning(f"Error during Tier 2b keyword relaxation: {err}")

    # ----------------------------------------------------
    # TẦNG 3: Gợi ý theo Semantic Keywords (Elasticsearch / Suggestions)
    # ----------------------------------------------------
    if clean_query:
        try:
            tokens = [w for w in clean_query.split() if len(w) > 1]
            if tokens:
                suggestions = await product_public_service.get_today_suggestions(
                    db, keywords=tokens[:3], limit=limit, page=1
                )
                if suggestions and suggestions.items:
                    formatted = [_format_product_item(p, min_price=min_price, max_price=max_price) for p in suggestions.items]
                    has_within_budget = any(it.get("is_within_budget", True) for it in formatted)
                    summary = "Gợi ý các sản phẩm có đặc tính hoặc phong cách tương tự."
                    if max_price is not None and not has_within_budget:
                        summary = f"Chưa có sản phẩm đúng tầm giá dưới {max_price:,.0f}đ. Dưới đây là các gợi ý phong cách tương tự để tham khảo."
                    return {
                        "match_type": "semantic",
                        "search_summary": summary,
                        "items": formatted,
                    }
        except Exception as err:
            logger.warning(f"Error during Tier 3 semantic suggestions: {err}")

    # ----------------------------------------------------
    # TẦNG 4: Fallback Sản phẩm Bán chạy / Nổi bật toàn sàn
    # ----------------------------------------------------
    try:
        all_recs = await product_repository.get_recommended_products(db, limit=limit)
        formatted = [_format_product_item(p, min_price=min_price, max_price=max_price) for p in all_recs[:limit]]
        has_within_budget = any(it.get("is_within_budget", True) for it in formatted)
        summary = "Hiện chưa có sản phẩm khớp trực tiếp với yêu cầu trên sàn. Dưới đây là các sản phẩm nổi bật được yêu thích nhất."
        if max_price is not None and not has_within_budget:
            summary = f"Không có sản phẩm trong mức giá dưới {max_price:,.0f}đ. Dưới đây là các sản phẩm nổi bật để tham khảo."
        return {
            "match_type": "category_popular" if category_slug else "none",
            "search_summary": summary,
            "items": formatted,
        }
    except Exception as err:
        logger.error(f"Error during Tier 4 fallback recommendations: {err}")
        return {
            "match_type": "error",
            "search_summary": "Đã xảy ra lỗi khi tìm kiếm sản phẩm.",
            "items": [],
        }
