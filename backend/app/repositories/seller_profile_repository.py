from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from models.seller_profile import SellerProfile


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
