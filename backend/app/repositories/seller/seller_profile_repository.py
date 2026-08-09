from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from models.seller import SellerProfile


async def get_seller_profile_by_id(
    seller_id: int, db: AsyncSession
) -> SellerProfile:
    result = await db.execute(
        select(SellerProfile).where(SellerProfile.id == seller_id)
    )
    return result.scalar_one_or_none()


async def get_seller_profile_by_user_id(
    user_id: int, db: AsyncSession
) -> SellerProfile:
    result = await db.execute(
        select(SellerProfile).where(SellerProfile.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_seller_profile_by_public_id(
    public_id: str, db: AsyncSession
) -> SellerProfile:
    result = await db.execute(
        select(SellerProfile).where(SellerProfile.public_id == public_id)
    )
    return result.scalar_one_or_none()


async def get_seller_profile_by_shop_name(
    shop_name: str, db: AsyncSession
) -> SellerProfile:
    result = await db.execute(
        select(SellerProfile).where(SellerProfile.shop_name == shop_name)
    )
    return result.scalar_one_or_none()


async def get_seller_profile_by_shop_slug(
    shop_slug: str, db: AsyncSession
) -> SellerProfile:
    result = await db.execute(
        select(SellerProfile).where(SellerProfile.shop_slug == shop_slug)
    )
    return result.scalar_one_or_none()


async def create_seller_profile(
    user_id: str,
    status: str,
    shop_name: str,
    shop_slug: str,
    phone: str,
    email: str,
    pickup_address: str,
    tax_code: str,
    bank_name: str,
    bank_account_number: str,
    bank_account_name: str,
    shipping_fee: float,
    db: AsyncSession,
):
    seller_profile = SellerProfile(
        user_id=user_id,
        status=status,
        shop_name=shop_name,
        shop_slug=shop_slug,
        phone=phone,
        email=email,
        pickup_address=pickup_address,
        tax_code=tax_code,
        bank_name=bank_name,
        bank_account_number=bank_account_number,
        bank_account_name=bank_account_name,
        shipping_fee=shipping_fee,
    )

    db.add(seller_profile)
    await db.flush()

    return seller_profile


async def get_seller_profile_list(
    page: int, limit: int, db: AsyncSession, status: str | None = None
):
    offset = (page - 1) * limit

    result = None
    if status:
        result = await db.execute(
            select(SellerProfile)
            .where(SellerProfile.status == status)
            .order_by(SellerProfile.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
    else:
        result = await db.execute(
            select(SellerProfile)
            .order_by(SellerProfile.created_at.desc())
            .offset(offset)
            .limit(limit)
        )

    seller_profiles = result.scalars().all()
    return seller_profiles


async def get_sellers_by_ids(
    seller_ids: list[int], db: AsyncSession
) -> list[SellerProfile]:
    result = await db.execute(
        select(SellerProfile).where(SellerProfile.id.in_(seller_ids))
    )
    return list(result.scalars().all())


async def get_shop_stats(seller_id: int, db: AsyncSession) -> dict:
    from sqlalchemy import func
    from models.catalog import Product
    from models.catalog import ProductReview
    from models.order import Order
    from models.order import OrderItem

    # 1. Total sold
    sold_query = (
        select(func.coalesce(func.sum(OrderItem.quantity), 0))
        .join(Order, OrderItem.order_id == Order.id)
        .where(Order.seller_id == seller_id, Order.order_status == "COMPLETED")
    )
    total_sold_res = await db.execute(sold_query)
    total_sold = total_sold_res.scalar() or 0

    # 2. Product count
    prod_query = select(func.count(Product.id)).where(Product.seller_id == seller_id, Product.status == "ACTIVE")
    prod_res = await db.execute(prod_query)
    product_count = prod_res.scalar() or 0

    # 3. Rating & Review count
    rating_query = (
        select(
            func.count(ProductReview.id),
            func.coalesce(func.avg(ProductReview.rating), 0)
        )
        .join(Product, ProductReview.product_id == Product.id)
        .where(Product.seller_id == seller_id)
    )
    rating_res = await db.execute(rating_query)
    review_count, avg_rating = rating_res.one()

    return {
        "total_sold": total_sold,
        "product_count": product_count,
        "review_count": review_count or 0,
        "average_rating": round(float(avg_rating or 0), 2)
    }

