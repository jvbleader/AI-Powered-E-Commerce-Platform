from typing import List
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User
from models.user_address import UserAddress
from schemas.user_address_schema import UserAddressCreate, UserAddressUpdate
from repositories import user_address_repository


async def get_my_addresses(user: User, db: AsyncSession) -> List[UserAddress]:
    return await user_address_repository.get_user_addresses(db, user.id)


MAX_ADDRESSES_PER_USER = 10


async def create_address(
    user: User, data: UserAddressCreate, db: AsyncSession
) -> UserAddress:
    existing = await user_address_repository.get_user_addresses(db, user.id)
    if len(existing) >= MAX_ADDRESSES_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bạn chỉ có thể thêm tối đa {MAX_ADDRESSES_PER_USER} địa chỉ. Vui lòng xoá bớt để tiếp tục."
        )

    if data.is_default:
        await user_address_repository.unset_user_default_addresses(db, user.id)

    address = UserAddress(
        user_id=user.id,
        receiver_name=data.receiver_name,
        phone=data.phone,
        province=data.province,
        district=data.district,
        ward=data.ward,
        detail_address=data.detail_address,
        address_type=data.address_type,
        is_default=data.is_default,
    )
    return await user_address_repository.create_user_address(db, address)


async def update_address(
    user: User, address_id: int, data: UserAddressUpdate, db: AsyncSession
) -> UserAddress:
    address = await user_address_repository.get_address_by_id_and_user(
        db, address_id, user.id
    )
    if not address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy địa chỉ"
        )

    if data.is_default:
        await user_address_repository.unset_user_default_addresses(db, user.id)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(address, key, value)

    await db.flush()
    await db.refresh(address)
    return address


async def delete_address(user: User, address_id: int, db: AsyncSession):
    address = await user_address_repository.get_address_by_id_and_user(
        db, address_id, user.id
    )
    if not address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy địa chỉ"
        )
    await user_address_repository.delete_user_address(db, address)
