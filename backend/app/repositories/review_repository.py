from typing import Optional, List, Tuple
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from models.catalog import ProductReview, ReviewImage, Product
from models.order import OrderItem, Order

async def get_order_item_for_review(db: AsyncSession, order_item_id: int, user_id: int) -> Optional[OrderItem]:
    query = (
        select(OrderItem)
        .join(Order, OrderItem.order_id == Order.id)
        .where(
            OrderItem.id == order_item_id,
            Order.user_id == user_id,
            Order.order_status == "COMPLETED"
        )
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def get_review_by_order_item_id(db: AsyncSession, order_item_id: int) -> Optional[ProductReview]:
    query = select(ProductReview).where(ProductReview.order_item_id == order_item_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def create_review(
    db: AsyncSession,
    user_id: int,
    product_id: int,
    order_item_id: int,
    rating: int,
    comment: Optional[str],
    images: Optional[List[str]] = None
) -> ProductReview:
    review = ProductReview(
        user_id=user_id,
        product_id=product_id,
        order_item_id=order_item_id,
        rating=rating,
        comment=comment
    )
    db.add(review)
    await db.flush()

    if images:
        for i, img_url in enumerate(images):
            # Limit to 4 images max as requested
            if i >= 4:
                break
            ri = ReviewImage(review_id=review.id, image_url=img_url)
            db.add(ri)

    # Recalculate average_rating and review_count for the product
    query = select(
        func.count(ProductReview.id),
        func.avg(ProductReview.rating)
    ).where(ProductReview.product_id == product_id)
    
    res = await db.execute(query)
    count, avg_rating = res.one()
    
    product_query = select(Product).where(Product.id == product_id)
    product_res = await db.execute(product_query)
    product = product_res.scalar_one_or_none()
    
    if product:
        product.review_count = count or 0
        product.average_rating = round(float(avg_rating or 0), 2)
    
    await db.commit()

    # Re-fetch the review with eager loading for user, order_item, and images
    stmt = select(ProductReview).options(
        selectinload(ProductReview.user),
        selectinload(ProductReview.order_item),
        selectinload(ProductReview.images)
    ).where(ProductReview.id == review.id)
    result = await db.execute(stmt)
    full_review = result.scalar_one()

    return full_review

async def get_product_reviews(
    db: AsyncSession,
    product_identifier: str,
    skip: int = 0,
    limit: int = 20,
    rating: Optional[int] = None,
    has_image: Optional[bool] = None,
    variant_name: Optional[str] = None
) -> Tuple[List[ProductReview], int, float]:
    if str(product_identifier).isdigit():
        product_id = int(product_identifier)
    else:
        prod_res = await db.execute(select(Product.id).where(Product.public_id == str(product_identifier)))
        product_id = prod_res.scalar_one_or_none()

    if not product_id:
        return [], 0, 0.0

    base_filter = [ProductReview.product_id == product_id]

    if rating is not None:
        base_filter.append(ProductReview.rating == rating)
        
    if has_image:
        base_filter.append(ProductReview.images.any())
        
    if variant_name:
        base_filter.append(ProductReview.order_item.has(OrderItem.variant_name_snapshot.ilike(f"%{variant_name}%")))

    total_query = select(func.count(ProductReview.id)).where(*base_filter)
    total_res = await db.execute(total_query)
    total = total_res.scalar() or 0

    avg_query = select(func.avg(ProductReview.rating)).where(ProductReview.product_id == product_id)
    avg_res = await db.execute(avg_query)
    avg_rating = round(float(avg_res.scalar() or 0), 2)

    query = (
        select(ProductReview)
        .options(
            selectinload(ProductReview.user),
            selectinload(ProductReview.images),
            selectinload(ProductReview.order_item)
        )
        .where(*base_filter)
        .order_by(ProductReview.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total, avg_rating

async def get_user_reviews(
    db: AsyncSession,
    user_id: int,
    skip: int = 0,
    limit: int = 20
) -> Tuple[List[ProductReview], int]:
    total_query = select(func.count(ProductReview.id)).where(ProductReview.user_id == user_id)
    total_res = await db.execute(total_query)
    total = total_res.scalar() or 0

    query = (
        select(ProductReview)
        .options(selectinload(ProductReview.product).selectinload(Product.images))
        .where(ProductReview.user_id == user_id)
        .order_by(ProductReview.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total
