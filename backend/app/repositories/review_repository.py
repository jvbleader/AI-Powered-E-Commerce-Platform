from typing import Optional, List, Tuple
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from models.product_review import ProductReview
from models.order_item import OrderItem
from models.order import Order
from models.product import Product

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
    comment: Optional[str]
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
    await db.refresh(review)
    return review

async def get_product_reviews(
    db: AsyncSession,
    product_identifier: str,
    skip: int = 0,
    limit: int = 20
) -> Tuple[List[ProductReview], int, float]:
    if str(product_identifier).isdigit():
        product_id = int(product_identifier)
    else:
        prod_res = await db.execute(select(Product.id).where(Product.public_id == str(product_identifier)))
        product_id = prod_res.scalar_one_or_none()

    if not product_id:
        return [], 0, 0.0

    total_query = select(func.count(ProductReview.id)).where(ProductReview.product_id == product_id)
    total_res = await db.execute(total_query)
    total = total_res.scalar() or 0

    avg_query = select(func.avg(ProductReview.rating)).where(ProductReview.product_id == product_id)
    avg_res = await db.execute(avg_query)
    avg_rating = round(float(avg_res.scalar() or 0), 2)

    query = (
        select(ProductReview)
        .options(selectinload(ProductReview.user))
        .where(ProductReview.product_id == product_id)
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
