from typing import Annotated, Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import DBSession, get_db
from models.user import User
import repositories.user.user_repository as user_repository
import services.auth.jwt_service as jwt_service
from repositories.user.user_role_repository import get_role_list_by_user_id


async def get_current_user(
    request: Request, db: DBSession
) -> User:
    payload = getattr(request.state, "auth_payload", None)

    if payload is None:
        token = request.cookies.get("access_token")
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Bạn cần đăng nhập để thực hiện hành động này.",
            )
        payload = jwt_service.decode_jwt_token(token)

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không phải là access token.",
        )

    user = await user_repository.get_user_by_public_id(payload["sub"], db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tồn tại."
        )

    if user.status == "DELETED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Người dùng đã bị khoá."
        )

    request.state.current_user = user
    return user


async def get_current_user_optional(
    request: Request, db: DBSession
) -> Optional[User]:
    try:
        return await get_current_user(request, db)
    except HTTPException:
        return None


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentUserOptional = Annotated[Optional[User], Depends(get_current_user_optional)]


async def get_current_admin(
    user: CurrentUser,
    db: DBSession,
) -> User:
    if "ADMIN" not in await get_role_list_by_user_id(user.id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thực hiện hành động này.",
        )

    return user


async def get_current_seller(
    user: CurrentUser,
    db: DBSession,
) -> User:
    if "SELLER" not in await get_role_list_by_user_id(user.id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thực hiện hành động này.",
        )

    return user


CurrentAdmin = Annotated[User, Depends(get_current_admin)]
CurrentSeller = Annotated[User, Depends(get_current_seller)]


async def get_current_supporter(
    user: CurrentUser,
    db: DBSession,
) -> User:
    roles = await get_role_list_by_user_id(user.id, db)
    if not any(role in roles for role in ["ADMIN", "MANAGER", "SUPPORTER"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thực hiện hành động này.",
        )
    return user


CurrentSupporter = Annotated[User, Depends(get_current_supporter)]

