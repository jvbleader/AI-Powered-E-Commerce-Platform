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


def get_agent_tools(
    db: AsyncSession, current_user_id: Optional[int] = None
) -> List[Any]:
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
        - `query`: Từ khóa loại sản phẩm cụ thể (ví dụ: 'áo khoác', 'ghế công thái học', 'nồi lẩu điện', 'tai nghe chống ồn', 'son môi'). Khi người dùng hỏi bằng mục đích/vấn đề/hoàn cảnh sử dụng, hãy phân tích và trích xuất thành tên loại sản phẩm/vật dụng cụ thể để tìm kiếm.
        - `category`: Tên danh mục tiếng Việt (ví dụ: 'Mỹ phẩm & Chăm sóc sắc đẹp', 'Điện thoại & Phụ kiện', 'Thời trang nam') hoặc category slug. QUAN TRỌNG: Chỉ truyền khi người dùng nêu rõ danh mục hoặc khi chắc chắn loại sản phẩm đó thuộc ngành hàng này; nếu không chắc chắn hoặc phân vân, hãy để None để tìm kiếm tự do theo `query`.
        - `min_price`: Mức giá tối thiểu (VND). BẮT BUỘC: Giữ nguyên mức giá người dùng yêu cầu, không tự ý nới lỏng hay thay đổi.
        - `max_price`: Mức giá tối đa (VND). BẮT BUỘC: Giữ nguyên mức giá người dùng yêu cầu (ví dụ khách nói dưới 200k thì max_price=200000), không tự ý tăng giá hay bỏ max_price.
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
                "id": getattr(p, "public_id", str(p.id)),
                "db_id": p.id,
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
    async def check_inventory(variant_id: str) -> str:
        """Kiểm tra chính xác số lượng tồn kho khả dụng hiện tại của một phân loại sản phẩm. Sử dụng khi khách hỏi về số lượng còn hàng. `variant_id` có thể là ID số, public_id chuỗi, hoặc SKU."""
        try:
            var_str = str(variant_id).strip()
            var_filters = [ProductVariant.status != "DELETED"]
            if var_str.isdigit():
                var_filters.append(
                    or_(
                        ProductVariant.id == int(var_str),
                        ProductVariant.public_id == var_str,
                        ProductVariant.sku == var_str,
                    )
                )
            else:
                var_filters.append(
                    or_(
                        ProductVariant.public_id == var_str,
                        ProductVariant.sku == var_str,
                    )
                )

            stmt = (
                select(ProductVariant)
                .options(
                    selectinload(ProductVariant.product),
                    selectinload(ProductVariant.inventory),
                )
                .where(*var_filters)
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
                "variant_id": getattr(v, "public_id", str(v.id)),
                "db_variant_id": v.id,
                "variant_name": v.variant_name or "",
                "product_id": getattr(v.product, "public_id", str(v.product_id)) if getattr(v, "product", None) else str(v.product_id),
                "db_product_id": v.product_id,
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
    async def recommend_similar_products(product_id: str) -> str:
        """Tìm các sản phẩm tương tự cùng danh mục hoặc cùng khoảng giá với sản phẩm cho trước. `product_id` có thể là ID số, public_id chuỗi, hoặc slug sản phẩm."""
        try:
            prod_str = str(product_id).strip()
            prod_filters = [Product.status != "DELETED"]
            if prod_str.isdigit():
                prod_filters.append(
                    or_(
                        Product.id == int(prod_str),
                        Product.public_id == prod_str,
                        Product.slug == prod_str,
                    )
                )
            else:
                prod_filters.append(
                    or_(
                        Product.public_id == prod_str,
                        Product.slug == prod_str,
                    )
                )

            stmt = (
                select(Product)
                .options(
                    selectinload(Product.categories),
                    selectinload(Product.variants),
                )
                .where(*prod_filters)
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
                        Product.id != p.id,
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
                p_db_id = p.id if p else (int(prod_str) if prod_str.isdigit() else -1)
                rec_products = [item for item in all_recs if item.id != p_db_id][:5]

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
                        "id": getattr(item, "public_id", str(item.id)),
                        "db_id": item.id,
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

    @tool
    async def lookup_policy_and_support(
        query: str,
        category: Optional[str] = None,
    ) -> str:
        """Tra cứu quy định, chính sách bán hàng, đổi trả, hoàn tiền, bảo hành, phí ship, phương thức thanh toán, khiếu nại của sàn TMĐT Shepoo.

        Bắt buộc gọi công cụ này khi khách hàng hỏi về:
        - Quy định đổi trả hàng, hoàn tiền, điều kiện trả hàng.
        - Chính sách bảo hành, thời hạn và quy trình yêu cầu bảo hành.
        - Chi phí vận chuyển, biểu phí giao hàng, thời gian giao nhận, chính sách freeship.
        - Phương thức thanh toán hỗ trợ (COD, VNPay, thẻ tín dụng, ví điện tử).
        - Quy trình giải quyết tranh chấp, khiếu nại đơn hàng hoặc báo cáo vi phạm.

        - `query`: Nội dung câu hỏi hoặc từ khóa cần tra cứu chính sách (ví dụ: 'thời hạn đổi trả hàng', 'điều kiện hoàn tiền', 'phí ship đơn hàng').
        - `category`: Danh mục chính sách tùy chọn ('RETURN_REFUND', 'WARRANTY', 'SHIPPING', 'PAYMENT', 'DISPUTE', 'GENERAL').
        """
        try:
            from services.knowledge_base.kb_search_service import search_knowledge_base

            res = await search_knowledge_base(
                query=query,
                category=category,
                limit=4,
            )
            return json.dumps(res, ensure_ascii=False)
        except Exception as e:
            return json.dumps(
                {"chunks": [], "citations": [], "error": str(e)},
                ensure_ascii=False,
            )

    @tool
    async def get_user_order_context(
        order_code: Optional[str] = None,
    ) -> str:
        """Tra cứu thông tin đơn hàng của khách hàng hiện tại trên sàn TMĐT Shepoo để kiểm tra trạng thái đơn, chi tiết sản phẩm và điều kiện đổi trả.

        Sử dụng khi khách hàng hỏi về:
        - Tiến độ xử lý, trạng thái hoặc thời gian giao nhận của đơn hàng.
        - Danh sách các đơn hàng gần đây của khách hàng.
        - Kiểm tra xem đơn hàng đã giao có còn trong thời hạn 7 ngày đổi trả hay không.
        - Xử lý các khiếu nại, sự cố liên quan đến đơn hàng đã đặt.

        - `order_code`: Mã đơn hàng cần tra cứu (ví dụ: 'ORD123456', UUID public_id hoặc ID số). Nếu không cung cấp, công cụ sẽ lấy 3 đơn hàng gần đây nhất của khách hàng.
        """
        if current_user_id is None:
            return json.dumps(
                {
                    "error": "user_not_logged_in",
                    "message": "Khách hàng chưa đăng nhập. Vui lòng hướng dẫn khách hàng đăng nhập tài khoản để tra cứu chi tiết đơn hàng.",
                },
                ensure_ascii=False,
            )

        try:
            from datetime import datetime, timezone
            from models.order import Order

            filters = [Order.user_id == current_user_id]
            if hasattr(Order, "status"):
                filters.append(getattr(Order, "status") != "DELETED")
            elif hasattr(Order, "order_status"):
                filters.append(getattr(Order, "order_status") != "DELETED")

            if order_code and str(order_code).strip():
                code_str = str(order_code).strip()
                code_filters = [
                    Order.order_code == code_str,
                    Order.public_id == code_str,
                ]
                if code_str.isdigit():
                    code_filters.append(Order.id == int(code_str))
                filters.append(or_(*code_filters))
                stmt = (
                    select(Order)
                    .options(
                        selectinload(Order.items),
                        selectinload(Order.return_request),
                    )
                    .where(*filters)
                )
            else:
                stmt = (
                    select(Order)
                    .options(
                        selectinload(Order.items),
                        selectinload(Order.return_request),
                    )
                    .where(*filters)
                    .order_by(desc(Order.created_at))
                    .limit(3)
                )

            res = await db.execute(stmt)
            orders = list(res.scalars().unique().all())

            now = datetime.now(timezone.utc)
            orders_data = []
            for o in orders:
                days_since_delivery: Optional[int] = None
                if o.delivered_at:
                    deliv = o.delivered_at
                    if deliv.tzinfo is None:
                        deliv = deliv.replace(tzinfo=timezone.utc)
                    diff = now - deliv
                    days_since_delivery = max(0, diff.days)

                status_val = getattr(o, "order_status", None) or getattr(o, "status", "")

                ret_req = getattr(o, "return_request", None)
                has_return_request = ret_req is not None
                return_status = getattr(ret_req, "return_status", None) if ret_req else None
                return_code = getattr(ret_req, "return_code", None) if ret_req else None

                # An order is only eligible for a NEW return request if:
                # 1. Status is DELIVERED
                # 2. Delivered within 7 days
                # 3. No existing return request was already created
                # 4. Status is not already RETURNED
                is_returnable = bool(
                    status_val == "DELIVERED"
                    and days_since_delivery is not None
                    and days_since_delivery <= 7
                    and not has_return_request
                    and status_val != "RETURNED"
                )

                items_data = []
                for item in (o.items or []):
                    items_data.append(
                        {
                            "item_name": getattr(item, "product_name_snapshot", "") or getattr(item, "name", ""),
                            "variant_name": getattr(item, "variant_name_snapshot", ""),
                            "quantity": getattr(item, "quantity", 1),
                            "unit_price": float(getattr(item, "unit_price", 0.0) or 0.0),
                        }
                    )

                orders_data.append(
                    {
                        "order_code": o.order_code or o.public_id or str(o.id),
                        "status": status_val,
                        "total_amount": float(o.total_amount) if o.total_amount is not None else 0.0,
                        "created_at": o.created_at.isoformat() if o.created_at else None,
                        "delivered_at": o.delivered_at.isoformat() if o.delivered_at else None,
                        "days_since_delivery": days_since_delivery,
                        "is_returnable": is_returnable,
                        "has_return_request": has_return_request,
                        "return_status": return_status,
                        "return_code": return_code,
                        "items": items_data,
                    }
                )

            return json.dumps({"orders": orders_data}, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": str(e), "orders": []}, ensure_ascii=False)

    return [
        search_catalog,
        get_product_details,
        check_inventory,
        recommend_similar_products,
        lookup_policy_and_support,
        get_user_order_context,
    ]
