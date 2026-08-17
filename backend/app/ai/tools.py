import json
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any

# Ensure app root is in sys.path
app_dir = Path(__file__).resolve().parent.parent
if str(app_dir) not in sys.path:
    sys.path.insert(0, str(app_dir))

try:
    from langchain_core.tools import tool
except ImportError:
    def tool(*args, **kwargs):
        def decorator(fn):
            return fn
        if len(args) == 1 and callable(args[0]):
            return args[0]
        return decorator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc
from sqlalchemy.orm import selectinload

from models.catalog import Product
from models.catalog import ProductVariant
from models.catalog import ProductCategory
from models.catalog import Category
from models.seller import SellerProfile
import repositories.catalog.product_repository as product_repository


def get_agent_tools(db: AsyncSession) -> List[Any]:
    """
    Returns a list of LangChain tools bound to the active async database session.
    """

    @tool
    async def search_catalog(
        query: Optional[str] = None,
        category: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        brand: Optional[str] = None,
        sort_by: Optional[str] = None,
        limit: int = 5,
    ) -> str:
        """Tìm kiếm các sản phẩm đang hiển thị bán trên sàn TMĐT Shepoo.

        Sử dụng khi khách hàng hỏi về tìm kiếm, gợi ý sản phẩm, phong cách, tầm giá, hoặc nhu cầu mua sắm.
        - `query`: Từ khóa loại sản phẩm cụ thể (ví dụ: 'áo khoác', 'ghế công thái học', 'nồi lẩu điện', 'tai nghe chống ồn'). Khi người dùng hỏi bằng mục đích/vấn đề/hoàn cảnh sử dụng, hãy phân tích và trích xuất thành tên loại sản phẩm/vật dụng cụ thể để tìm kiếm.
        - `category`: Tên danh mục tiếng Việt (ví dụ: 'Thời trang nam', 'Điện tử', 'Gia dụng') hoặc category slug.
        - `min_price`: Mức giá tối thiểu (VND).
        - `max_price`: Mức giá tối đa (VND).
        - `brand`: Tên thương hiệu.
        - `sort_by`: Tiêu chí sắp xếp ('relevance', 'price_asc', 'price_desc', 'rating', 'best_selling').
        - `limit`: Số lượng sản phẩm muốn lấy (mặc định 5).
        """
        try:
            from ai.catalog_search import execute_multi_tier_catalog_search

            result = await execute_multi_tier_catalog_search(
                db=db,
                query=query,
                category=category,
                min_price=min_price,
                max_price=max_price,
                brand=brand,
                sort_by=sort_by,
                limit=limit,
            )
            return json.dumps(result, ensure_ascii=False)
        except Exception as e:
            return json.dumps(
                {"error": str(e), "match_type": "error", "items": []},
                ensure_ascii=False,
            )

    @tool
    async def get_product_details(product_id: str) -> str:
        """Lấy thông tin chi tiết của một sản phẩm bằng ID (có thể là ID số, public_id chuỗi, hoặc slug sản phẩm). Sử dụng khi khách hàng hỏi về thông số kỹ thuật, mô tả chi tiết hoặc danh sách phân loại (màu sắc, size)."""
        try:
            filters = [Product.status != "DELETED"]
            if str(product_id).isdigit():
                filters.append(
                    or_(
                        Product.id == int(product_id),
                        Product.public_id == str(product_id),
                        Product.slug == str(product_id),
                    )
                )
            else:
                filters.append(
                    or_(
                        Product.public_id == str(product_id),
                        Product.slug == str(product_id),
                    )
                )

            stmt = (
                select(Product)
                .options(
                    selectinload(Product.images),
                    selectinload(Product.variants).selectinload(ProductVariant.inventory),
                    selectinload(Product.categories),
                    selectinload(Product.seller),
                )
                .where(*filters)
            )
            res = await db.execute(stmt)
            p = res.scalar_one_or_none()
            if not p:
                return json.dumps(
                    {"error": f"Product with ID {product_id} not found"}, ensure_ascii=False
                )

            variants_data = []
            prices = []
            sale_prices = []
            total_stock = 0
            for v in p.variants or []:
                if getattr(v, "status", "") == "DELETED":
                    continue
                inv = getattr(v, "inventory", None)
                avail_stock = 0
                if inv:
                    qty = getattr(inv, "quantity", 0) or 0
                    reserved = getattr(inv, "reserved_quantity", 0) or 0
                    avail_stock = max(0, qty - reserved)
                total_stock += avail_stock

                v_price = float(v.price) if getattr(v, "price", None) is not None else None
                v_sale = float(v.sale_price) if getattr(v, "sale_price", None) is not None else None
                if v_price is not None:
                    prices.append(v_price)
                if v_sale is not None:
                    sale_prices.append(v_sale)

                variants_data.append(
                    {
                        "variant_id": v.id,
                        "sku": v.sku or "",
                        "variant_name": v.variant_name or "",
                        "price": v_price if v_price is not None else 0.0,
                        "sale_price": v_sale,
                        "available_stock": avail_stock,
                        "status": getattr(v, "status", "ACTIVE"),
                    }
                )

            thumbnail_url = None
            if p.images:
                for img in p.images:
                    if getattr(img, "is_thumbnail", False):
                        thumbnail_url = img.image_url
                        break
                if not thumbnail_url and len(p.images) > 0:
                    thumbnail_url = p.images[0].image_url

            min_p = min(prices) if prices else 0.0
            min_sale_p = min(sale_prices) if sale_prices else None

            seller = getattr(p, "seller", None)
            shop_slug = getattr(seller, "shop_slug", "shop") if seller else "shop"

            active_vars = [v for v in (p.variants or []) if getattr(v, "status", "") != "DELETED"]
            first_var = active_vars[0] if active_vars else None
            pub_id = getattr(first_var, "public_id", None) if first_var else None
            var_id = getattr(first_var, "id", None) if first_var else None
            primary_var_id = str(pub_id) if pub_id else (str(var_id) if var_id else str(p.id))

            data = {
                "id": p.id,
                "name": p.name,
                "brand": p.brand or "",
                "slug": p.slug or "",
                "shop_slug": shop_slug,
                "price": min_p,
                "sale_price": min_sale_p,
                "stock": total_stock,
                "thumbnail_url": thumbnail_url or "",
                "primary_variant_id": primary_var_id,
                "origin": p.origin or "",
                "warranty_info": p.warranty_info or "",
                "short_description": p.short_description or "",
                "description": p.description or "",
                "average_rating": float(p.average_rating)
                if p.average_rating is not None
                else 0.0,
                "review_count": p.review_count or 0,
                "variants": variants_data,
                "images": [img.image_url for img in (p.images or [])],
                "categories": [c.name for c in (p.categories or [])],
            }
            return json.dumps(data, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    @tool
    async def check_inventory(variant_id: int) -> str:
        """Kiểm tra chính xác số lượng tồn kho khả dụng hiện tại của một phân loại sản phẩm. Sử dụng khi khách hỏi về số lượng còn hàng."""
        try:
            stmt = (
                select(ProductVariant)
                .options(
                    selectinload(ProductVariant.product),
                    selectinload(ProductVariant.inventory),
                )
                .where(ProductVariant.id == variant_id, ProductVariant.status != "DELETED")
            )
            res = await db.execute(stmt)
            v = res.scalar_one_or_none()
            if not v:
                return json.dumps(
                    {"error": f"Variant with ID {variant_id} not found"}, ensure_ascii=False
                )

            inv = getattr(v, "inventory", None)
            qty = getattr(inv, "quantity", 0) if inv else 0
            reserved = getattr(inv, "reserved_quantity", 0) if inv else 0
            avail = max(0, qty - reserved)

            data = {
                "variant_id": v.id,
                "variant_name": v.variant_name or "",
                "product_id": v.product_id,
                "product_name": v.product.name if getattr(v, "product", None) else "",
                "quantity": qty,
                "reserved_quantity": reserved,
                "available_stock": avail,
                "in_stock": avail > 0,
            }
            return json.dumps(data, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    @tool
    async def recommend_similar_products(product_id: int) -> str:
        """Tìm các sản phẩm tương tự cùng danh mục hoặc cùng khoảng giá với sản phẩm cho trước."""
        try:
            stmt = (
                select(Product)
                .options(
                    selectinload(Product.categories),
                    selectinload(Product.variants),
                )
                .where(Product.id == product_id, Product.status != "DELETED")
            )
            res = await db.execute(stmt)
            p = res.scalar_one_or_none()

            rec_products = []
            if p and p.categories:
                cat_ids = [c.id for c in p.categories]
                stmt_rec = (
                    select(Product)
                    .join(ProductCategory, Product.id == ProductCategory.product_id)
                    .join(SellerProfile, Product.seller_id == SellerProfile.id)
                    .where(
                        ProductCategory.category_id.in_(cat_ids),
                        Product.id != product_id,
                        Product.status.in_(["ACTIVE", "OUT_OF_STOCK"]),
                        SellerProfile.status == "APPROVED",
                    )
                    .options(
                        selectinload(Product.images),
                        selectinload(Product.variants).selectinload(ProductVariant.inventory),
                    )
                    .limit(5)
                )
                rec_res = await db.execute(stmt_rec)
                rec_products = list(rec_res.scalars().unique().all())

            if not rec_products:
                all_recs = await product_repository.get_recommended_products(db, limit=6)
                rec_products = [item for item in all_recs if item.id != product_id][:5]

            result = []
            for item in rec_products:
                thumbnail_url = None
                if item.images:
                    for img in item.images:
                        if getattr(img, "is_thumbnail", False):
                            thumbnail_url = img.image_url
                            break
                    if not thumbnail_url and len(item.images) > 0:
                        thumbnail_url = item.images[0].image_url

                active_vars = [
                    v for v in (item.variants or []) if getattr(v, "status", "") != "DELETED"
                ]
                prices = [
                    float(v.price)
                    for v in active_vars
                    if getattr(v, "price", None) is not None
                ]
                sale_prices = [
                    float(v.sale_price)
                    for v in active_vars
                    if getattr(v, "sale_price", None) is not None
                ]

                min_p = min(prices) if prices else 0.0
                min_sale_p = min(sale_prices) if sale_prices else None

                total_stock = 0
                for v in active_vars:
                    inv = getattr(v, "inventory", None)
                    if inv:
                        qty = getattr(inv, "quantity", 0) or 0
                        reserved = getattr(inv, "reserved_quantity", 0) or 0
                        total_stock += max(0, qty - reserved)

                seller = getattr(item, "seller", None)
                seller_slug = getattr(seller, "shop_slug", None) if seller else None
                shop_slug = (
                    str(seller_slug)
                    if (seller_slug and isinstance(seller_slug, (str, int)))
                    else "shop"
                )
                first_var = active_vars[0] if active_vars else None
                pub_id = getattr(first_var, "public_id", None) if first_var else None
                var_id = getattr(first_var, "id", None) if first_var else None

                if pub_id and isinstance(pub_id, (str, int)):
                    primary_variant_id = str(pub_id)
                elif var_id and isinstance(var_id, (str, int)):
                    primary_variant_id = str(var_id)
                else:
                    primary_variant_id = str(item.id)

                result.append(
                    {
                        "id": item.id,
                        "name": item.name,
                        "brand": item.brand or "",
                        "price": min_p,
                        "sale_price": min_sale_p,
                        "stock": total_stock,
                        "average_rating": float(item.average_rating)
                        if item.average_rating is not None
                        else 0.0,
                        "review_count": item.review_count or 0,
                        "thumbnail_url": thumbnail_url or "",
                        "slug": item.slug or "",
                        "shop_slug": shop_slug,
                        "primary_variant_id": primary_variant_id,
                    }
                )

            return json.dumps(result, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    return [search_catalog, get_product_details, check_inventory, recommend_similar_products]
