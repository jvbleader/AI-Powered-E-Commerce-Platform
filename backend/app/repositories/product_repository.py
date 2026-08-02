from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, or_, desc, delete
from sqlalchemy.orm import selectinload, joinedload
from models.product import Product
from models.product_category import ProductCategory
from models.product_image import ProductImage
from models.product_variant import ProductVariant
from models.inventory import Inventory
from models.inventory_transaction import InventoryTransaction
from models.seller_profile import SellerProfile
from schemas.seller_product_schema import ProductCreateRequest, ProductUpdateRequest
from models.base import utc_now
from models.category import Category
from models.search_log import SearchLog


async def create_product(
    db: AsyncSession, seller_id: int, data: ProductCreateRequest
) -> Product:
    # 1. Create Product
    product = Product(
        seller_id=seller_id,
        name=data.name,
        slug=data.slug,
        short_description=data.short_description,
        description=data.description,
        brand=data.brand,
        origin=data.origin,
        warranty_info=data.warranty_info,
        status="ACTIVE",
        variant_options=data.variant_options,
    )
    db.add(product)
    await db.flush()  # to get product.id

    # 2. Create Product Categories
    for cat_id in data.category_ids:
        pc = ProductCategory(product_id=product.id, category_id=cat_id)
        db.add(pc)

    # 3. Create Product Images
    for img in data.images:
        pi = ProductImage(
            product_id=product.id,
            image_url=img.image_url,
            is_thumbnail=img.is_thumbnail,
            sort_order=img.sort_order,
        )
        db.add(pi)

    # 4. Create Product Variants and Inventory
    for variant_req in data.variants:
        variant = ProductVariant(
            product_id=product.id,
            sku=variant_req.sku,
            variant_name=variant_req.variant_name,
            price=variant_req.price,
            sale_price=variant_req.sale_price,
            sale_start_at=variant_req.sale_start_at,
            sale_end_at=variant_req.sale_end_at,
            image_url=variant_req.image_url,
            status="ACTIVE",
            tier_index=variant_req.tier_index,
        )
        db.add(variant)
        await db.flush()  # get variant.id

        # Create Inventory
        inventory = Inventory(
            variant_id=variant.id, quantity=variant_req.quantity, reserved_quantity=0
        )
        db.add(inventory)

        # Log Inventory Transaction
        if variant_req.quantity > 0:
            transaction = InventoryTransaction(
                variant_id=variant.id,
                transaction_type="IMPORT",
                quantity_change=variant_req.quantity,
                quantity_before=0,
                quantity_after=variant_req.quantity,
                note="Initial import when creating product",
            )
            db.add(transaction)

    await db.flush()

    # Reload product with relationships to avoid MissingGreenlet during serialization
    query = (
        select(Product)
        .options(
            selectinload(Product.images),
            selectinload(Product.variants).selectinload(ProductVariant.inventory),
            selectinload(Product.categories),
        )
        .filter(Product.id == product.id)
    )
    result = await db.execute(query)
    product_with_rels = result.scalar_one()

    return product_with_rels


async def get_products_by_seller(
    db: AsyncSession, seller_id: int, skip: int = 0, limit: int = 100
) -> tuple[List[Product], int]:
    # Base filter (no eager loading — used for count)
    base_filter = select(Product).filter(
        Product.seller_id == seller_id, Product.status != "DELETED"
    )

    # Get total count
    count_query = select(func.count()).select_from(base_filter.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Get items with eager loading
    items_query = (
        base_filter.options(
            selectinload(Product.images),
            selectinload(Product.variants).selectinload(ProductVariant.inventory),
            selectinload(Product.categories),
        )
        .offset(skip)
        .limit(limit)
    )
    items_result = await db.execute(items_query)
    items = list(items_result.scalars().all())

    return items, total


async def get_product_by_public_id_and_seller(
    db: AsyncSession, public_id: str, seller_id: int
) -> Optional[Product]:
    query = (
        select(Product)
        .options(
            selectinload(Product.images),
            selectinload(Product.variants).selectinload(ProductVariant.inventory),
            selectinload(Product.categories),
        )
        .filter(
            Product.public_id == public_id,
            Product.seller_id == seller_id,
            Product.status != "DELETED",
        )
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def update_product(
    db: AsyncSession, product: Product, data: ProductUpdateRequest
) -> Product:
    # 1. Update basic fields
    update_data = data.model_dump(
        exclude_unset=True, exclude={"category_ids", "images", "variants"}
    )
    for key, value in update_data.items():
        setattr(product, key, value)

    # 2. Update Categories
    if data.category_ids is not None:
        await db.execute(
            delete(ProductCategory).where(ProductCategory.product_id == product.id)
        )
        for cat_id in data.category_ids:
            db.add(ProductCategory(product_id=product.id, category_id=cat_id))

    # 3. Update Images
    if data.images is not None:
        await db.execute(
            delete(ProductImage).where(ProductImage.product_id == product.id)
        )
        for img in data.images:
            db.add(
                ProductImage(
                    product_id=product.id,
                    image_url=img.image_url,
                    is_thumbnail=img.is_thumbnail,
                    sort_order=img.sort_order,
                )
            )

    # 4. Update Variants and Inventory (Upsert & Soft-Delete Strategy)
    if data.variants is not None:
        # Load existing variants with their inventory
        stmt = (
            select(ProductVariant)
            .options(selectinload(ProductVariant.inventory))
            .where(
                ProductVariant.product_id == product.id,
                ProductVariant.status != "DELETED",
            )
        )
        existing_variants_result = await db.execute(stmt)
        existing_variants = list(existing_variants_result.scalars().all())
        existing_variant_map = {v.public_id: v for v in existing_variants}

        incoming_public_ids = [v.public_id for v in data.variants if v.public_id]

        # Soft-delete variants that are not in the incoming list
        for ext_v in existing_variants:
            if ext_v.public_id not in incoming_public_ids:
                ext_v.status = "DELETED"
                ext_v.deleted_at = utc_now()

        for variant_req in data.variants:
            if variant_req.public_id and variant_req.public_id in existing_variant_map:
                # Update existing variant
                v = existing_variant_map[variant_req.public_id]
                v.sku = variant_req.sku
                v.variant_name = variant_req.variant_name
                v.price = variant_req.price
                v.sale_price = variant_req.sale_price
                v.sale_start_at = variant_req.sale_start_at
                v.sale_end_at = variant_req.sale_end_at
                v.image_url = variant_req.image_url
                v.tier_index = variant_req.tier_index

                if v.inventory:
                    delta = variant_req.quantity - v.inventory.quantity
                    if delta != 0:
                        qty_before = v.inventory.quantity
                        v.inventory.quantity = variant_req.quantity

                        transaction = InventoryTransaction(
                            variant_id=v.id,
                            transaction_type="IMPORT" if delta > 0 else "ADJUST",
                            quantity_change=abs(delta),
                            quantity_before=qty_before,
                            quantity_after=variant_req.quantity,
                            note="Manual adjustment during product update",
                        )
                        db.add(transaction)
                else:
                    inventory = Inventory(
                        variant_id=v.id,
                        quantity=variant_req.quantity,
                        reserved_quantity=0,
                    )
                    db.add(inventory)
                    v.inventory = inventory
            else:
                # Insert new variant
                new_v = ProductVariant(
                    product_id=product.id,
                    sku=variant_req.sku,
                    variant_name=variant_req.variant_name,
                    price=variant_req.price,
                    sale_price=variant_req.sale_price,
                    sale_start_at=variant_req.sale_start_at,
                    sale_end_at=variant_req.sale_end_at,
                    image_url=variant_req.image_url,
                    tier_index=variant_req.tier_index,
                    status="ACTIVE",
                )
                db.add(new_v)
                await db.flush()  # get new_v.id

                inventory = Inventory(
                    variant_id=new_v.id,
                    quantity=variant_req.quantity,
                    reserved_quantity=0,
                )
                db.add(inventory)
                new_v.inventory = inventory

                if variant_req.quantity > 0:
                    transaction = InventoryTransaction(
                        variant_id=new_v.id,
                        transaction_type="IMPORT",
                        quantity_change=variant_req.quantity,
                        quantity_before=0,
                        quantity_after=variant_req.quantity,
                        note="Initial import for new variant",
                    )
                    db.add(transaction)

    await db.flush()

    # Reload with relationships
    query = (
        select(Product)
        .options(
            selectinload(Product.images),
            selectinload(Product.variants).selectinload(ProductVariant.inventory),
            selectinload(Product.categories),
        )
        .filter(Product.id == product.id)
        .execution_options(populate_existing=True)
    )
    result = await db.execute(query)
    product_with_rels = result.scalar_one()

    return product_with_rels


async def soft_delete_product(db: AsyncSession, product: Product) -> Product:
    product.status = "DELETED"
    product.deleted_at = utc_now()
    await db.flush()
    return product


async def hide_product(db: AsyncSession, product: Product) -> Product:
    product.status = "HIDDEN"
    await db.flush()
    return product


async def unhide_product(db: AsyncSession, product: Product) -> Product:
    product.status = "ACTIVE"
    await db.flush()
    return product



# --- PUBLIC APIS FOR CUSTOMERS ---


async def get_public_products(
    db: AsyncSession,
    keyword: Optional[str] = None,
    category_slug: Optional[str] = None,
    sort_by: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    seller_id: Optional[int] = None,
    shop_slug: Optional[str] = None,
    min_rating: Optional[float] = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[List[Product], int]:
    base_filter = (
        select(Product)
        .join(SellerProfile, Product.seller_id == SellerProfile.id)
        .filter(Product.status.in_(["ACTIVE", "OUT_OF_STOCK"]), SellerProfile.status == "APPROVED")
    )


    if shop_slug:
        base_filter = base_filter.filter(SellerProfile.shop_slug == shop_slug)

    if category_slug:
        base_filter = (
            base_filter.join(ProductCategory)
            .join(Category)
            .filter(Category.slug == category_slug)
        )

    if keyword:
        # Simple LIKE search on name or short_description
        search_pattern = f"%{keyword}%"
        base_filter = base_filter.filter(
            or_(
                Product.name.ilike(search_pattern),
                Product.short_description.ilike(search_pattern),
            )
        )
        
    if min_price is not None or max_price is not None:
        price_filter = (
            select(1)
            .where(ProductVariant.product_id == Product.id)
            .correlate(Product)
        )
        if min_price is not None:
            price_filter = price_filter.where(ProductVariant.price >= min_price)
        if max_price is not None:
            price_filter = price_filter.where(ProductVariant.price <= max_price)
        base_filter = base_filter.filter(price_filter.exists())

    if seller_id is not None:
        base_filter = base_filter.filter(Product.seller_id == seller_id)


    if min_rating is not None:
        base_filter = base_filter.filter(
            or_(Product.average_rating >= min_rating, Product.review_count == 0)
        )

    # Get total count
    count_query = select(func.count()).select_from(base_filter.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Apply sorting
    if sort_by == "price_asc":
        min_price_subq = (
            select(func.min(ProductVariant.price))
            .where(ProductVariant.product_id == Product.id)
            .correlate(Product)
            .scalar_subquery()
        )
        base_filter = base_filter.order_by(min_price_subq.asc())
    elif sort_by == "price_desc":
        max_price_subq = (
            select(func.max(ProductVariant.price))
            .where(ProductVariant.product_id == Product.id)
            .correlate(Product)
            .scalar_subquery()
        )
        base_filter = base_filter.order_by(max_price_subq.desc())
    elif sort_by == "newest":
        base_filter = base_filter.order_by(desc(Product.created_at))
    elif sort_by == "best_selling":
        base_filter = base_filter.order_by(desc(Product.sold_count))
    elif sort_by == "high_rating":
        base_filter = base_filter.order_by(desc(Product.average_rating))
    else:
        # default sort
        base_filter = base_filter.order_by(desc(Product.created_at))

    # Get items with eager loading
    items_query = (
        base_filter.options(
            selectinload(Product.images),
            selectinload(Product.variants).selectinload(ProductVariant.inventory),
            selectinload(Product.seller),
            selectinload(Product.categories),
        )
        .offset(skip)
        .limit(limit)
    )

    items_result = await db.execute(items_query)
    # unique() is required when using join/selectinload
    items = list(items_result.scalars().unique().all())

    return items, total


async def get_public_product_detail(
    db: AsyncSession, shop_slug: str, product_slug: str
) -> Optional[Product]:
    filters = [
        or_(
            Product.slug == product_slug,
            Product.public_id == product_slug,
            Product.id == (int(product_slug) if product_slug.isdigit() else -1),
        ),
        Product.status.in_(["ACTIVE", "OUT_OF_STOCK"]),
        SellerProfile.status == "APPROVED",
    ]
    if shop_slug and shop_slug not in ("shop", "undefined"):
        filters.append(SellerProfile.shop_slug == shop_slug)

    query = (
        select(Product)
        .join(SellerProfile, Product.seller_id == SellerProfile.id)
        .filter(*filters)
        .options(
            selectinload(Product.images),
            selectinload(Product.variants).selectinload(ProductVariant.inventory),
            selectinload(Product.seller),
            selectinload(Product.categories),
        )
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_recommended_products(
    db: AsyncSession, user_id: Optional[int] = None, limit: int = 10
) -> List[Product]:
    base_filter = (
        select(Product)
        .join(SellerProfile, Product.seller_id == SellerProfile.id)
        .filter(Product.status == "ACTIVE", SellerProfile.status == "APPROVED")
    )

    keywords = []
    if user_id:
        # Get recent search logs
        search_query = (
            select(SearchLog.keyword)
            .filter(SearchLog.user_id == user_id)
            .order_by(desc(SearchLog.created_at))
            .limit(5)
        )
        search_result = await db.execute(search_query)
        keywords = list(search_result.scalars().all())

    if keywords:
        # Combine filters
        filters = []
        for kw in set(keywords):
            filters.append(Product.name.ilike(f"%{kw}%"))

        # We find products matching the keywords
        if filters:
            base_filter = base_filter.filter(or_(*filters))
    else:
        # Fallback to top selling
        base_filter = base_filter.order_by(desc(Product.sold_count))

    items_query = base_filter.options(
        selectinload(Product.images),
        selectinload(Product.variants).selectinload(ProductVariant.inventory),
        selectinload(Product.seller),
        selectinload(Product.categories),
    ).limit(limit)

    items_result = await db.execute(items_query)
    items = list(items_result.scalars().unique().all())

    # If not enough, fetch more best selling to fill limit
    if len(items) < limit:
        needed = limit - len(items)
        existing_ids = [item.id for item in items]
        fallback_filter = (
            select(Product)
            .join(SellerProfile, Product.seller_id == SellerProfile.id)
            .filter(Product.status == "ACTIVE", SellerProfile.status == "APPROVED")
        )
        if existing_ids:
            fallback_filter = fallback_filter.filter(Product.id.notin_(existing_ids))

        fallback_query = (
            fallback_filter.order_by(desc(Product.sold_count))
            .options(
                selectinload(Product.images),
                selectinload(Product.variants).selectinload(ProductVariant.inventory),
                selectinload(Product.seller),
                selectinload(Product.categories),
            )
            .limit(needed)
        )

        fallback_result = await db.execute(fallback_query)
        fallback_items = list(fallback_result.scalars().unique().all())
        items.extend(fallback_items)

    return items


async def get_variants_for_checkout(
    db: AsyncSession, variant_ids: list[int]
) -> list[ProductVariant]:
    stmt = (
        select(ProductVariant)
        .options(selectinload(ProductVariant.product))
        .where(ProductVariant.id.in_(variant_ids), ProductVariant.status == "ACTIVE")
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())
