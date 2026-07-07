from datetime import UTC, datetime

from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from jwt_service import (
    create_access_token,
    create_refresh_token,
    decode_jwt_token,
    jwt_token_expires_at,
)
from models.user import User
from repositories.user_repositoriy import (
    create_user,
    get_user_by_email,
    get_user_by_id,
    get_user_by_phone,
    get_user_by_user_name,
)
from repositories.user_session_repository import (
    create_session,
    get_session_by_refresh_token_hash,
    revoke_session,
)
from schemas.auth_schema import (
    LoginReponse,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
)
from schemas.user_schema import UserMeResponse
from utils.hash_and_verify import hash_password, hash_token, verify_password


async def register_user(data: RegisterRequest, db: AsyncSession):
    email = data.email
    phone = data.phone
    user_name = data.user_name

    if await get_user_by_email(email=email, db=db) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email này đã được sử dụng."
        )

    if await get_user_by_phone(phone=phone, db=db) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Số điện thoại này đã được sử dụng.",
        )

    if await get_user_by_user_name(user_name=user_name, db=db) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="user_name này đã được sử dụng.",
        )

    user = await create_user(
        {
            "full_name": data.full_name,
            "user_name": data.user_name,
            "email": data.email,
            "phone": data.phone,
            "password_hash": hash_password(data.password),
        },
        db=db,
        roles=["CUSTOMER"],
    )

    return RegisterResponse(
        full_name=user.full_name,
        user_name=user.full_name,
        email=user.email,
        phone=user.phone,
    )


async def login(
    payload: LoginRequest, request: Request, db: AsyncSession
) -> LoginReponse:
    identifier = payload.identifier
    password = payload.password

    user = await get_user_by_email(email=identifier, db=db)
    if not user:
        user = await get_user_by_phone(phone=identifier, db=db)
    if not user:
        user = await get_user_by_user_name(user_name=identifier, db=db)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tồn tại."
        )

    if not verify_password(password=password, password_hash=user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Mật khẩu không chính xác."
        )

    if user.status == "LOCKED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản đã bị khoá."
        )

    access_token = create_access_token(public_id=user.public_id)
    refresh_token = create_refresh_token(public_id=user.public_id)

    session = await create_session(
        {
            "user_id": user.id,
            "refresh_token_hash": hash_token(refresh_token),
            "expires_at": jwt_token_expires_at(refresh_token, db),
            "user_agent": request.headers.get("user-agent"),  ########################
            "ip_address": _request_ip(request=request),
            # "device_name":
        },
        db=db,
    )

    return LoginReponse(access_token=access_token, refresh_token=refresh_token)


def _request_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else None


async def refresh(refresh_token: str | None, db: AsyncSession) -> str:
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Vui lòng đăng nhập."
        )

    payload = decode_jwt_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không phải là refresh token.",
        )

    session = await get_session_by_refresh_token_hash(hash_token(refresh_token), db)

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Vui lòng đăng nhập."
        )

    if session.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Phiên đăng nhập đã hết hạn."
        )

    now = datetime.now(UTC).replace(tzinfo=None)
    expires_at = session.expires_at
    if expires_at.tzinfo is not None:
        expires_at = expires_at.astimezone(UTC).replace(tzinfo=None)
    if expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Phiên đăng nhập đã hết hạn."
        )

    user = await get_user_by_id(id=session.user_id, db=db)
    if user is None or user.public_id != payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token không hợp lệ.",
        )

    new_access_token = create_access_token(public_id=user.public_id)
    session.last_used_at = now
    await db.flush()

    return new_access_token


async def logout(refresh_token: str | None, db: AsyncSession):
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Vui lòng đăng nhập."
        )

    session = await get_session_by_refresh_token_hash(hash_token(refresh_token), db)

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Vui lòng đăng nhập."
        )

    await revoke_session(
        session.id, datetime.now(UTC).replace(tzinfo=None), "logout", db
    )


def user_to_response(user: User, roles: list[str]) -> UserMeResponse:
    return UserMeResponse(
        public_id=user.public_id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        avatar_url=user.avatar_url,
        gender=user.gender,
        date_of_birth=user.date_of_birth,
        email_verified_at=user.email_verified_at,
        phone_verified_at=user.phone_verified_at,
        status=user.status,
        locked_until=user.locked_until,
        lock_reason=user.lock_reason,
        roles=roles,
    )
