import os
import secrets
from urllib.parse import urlencode
from typing import Annotated
from datetime import datetime, timedelta, UTC
from email.message import EmailMessage
import smtplib

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends, status, HTTPException
from dotenv import load_dotenv

from dependencies.auth import get_current_user
from models.user import User
from schemas.auth.auth_schema import ChangePasswordRequest, ResetPasswordRequest
from utils.hash_and_verify import *
from repositories.user.user_repository import *
from repositories.user.password_reset_token_repository import *

load_dotenv()
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL")
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
FRONTEND_URL = os.getenv("FRONTEND_URL")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME")
SMTP_TIMEOUT_SECONDS = int(os.getenv("SMTP_TIMEOUT_SECONDS") or 10)
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT") or 587)
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_USE_TLS = str(os.getenv("SMTP_USE_TLS") or "").lower() == "true"
EMAIL_VERIFYCATION_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("EMAIL_VERIFYCATION_TOKEN_EXPIRE_MINUTES") or 10
)
PASSWORD_RESET_TOKEN_TTL_MINUTES = int(
    os.getenv("PASSWORD_RESET_TOKEN_TTL_MINUTES") or 30
)


async def change_password(user: User, data: ChangePasswordRequest, db: AsyncSession):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Mật khẩu hiện tại không chính xác.",
        )

    if verify_password(data.new_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Mật khẩu mới không được trùng với mật khẩu cũ",
        )

    await change_password_hash_by_user(user, hash_password(data.new_password), db)


def generate_token() -> str:
    return secrets.token_urlsafe(48)


def _clean(value: str | None) -> str:
    return value.strip() if value else ""


def _sender_email() -> str:
    return _clean(SMTP_FROM_EMAIL) or _clean(SMTP_USERNAME)


def email_verification_link(token: str) -> str:
    query = urlencode({"token": token})
    return f"{FRONTEND_URL.rstrip('/')}/reset-password?{query}"


async def send_reset_password_email(email: str, db: AsyncSession):
    user = await get_user_by_email(email, db)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Email này chưa được đăng ký."
        )

    if user.status == "LOCKED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản liên kết với email này đang bị khoá.",
        )

    if not user.email_verified_at:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email này chưa được xác thực.",
        )

    await delete_password_reset_token_by_user_id(user_id=user.id, db=db)

    token = generate_token()

    now = datetime.now(UTC)
    await create_password_reset_token(
        user_id=user.id,
        token_hash=hash_token(token),
        expires_at=now + timedelta(minutes=PASSWORD_RESET_TOKEN_TTL_MINUTES),
        created_at=now,
        db=db,
    )

    full_name = user.full_name
    link = email_verification_link(token=token)
    sender_email = _sender_email()
    sender_name = _clean(SMTP_FROM_NAME)
    sender = f"{sender_name} <{sender_email}>" if sender_name else sender_email

    message = EmailMessage()
    message["Subject"] = "Đặt lại mật khẩu Shepoo"
    message["From"] = sender
    message["To"] = email
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #059669; padding: 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">Shepoo</h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #1f2937; margin-top: 0;">Đặt lại mật khẩu</h2>
                <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
                    Xin chào <strong>{full_name}</strong>,
                </p>
                <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
                    Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Shepoo của bạn. Vui lòng nhấn vào nút bên dưới để tiến hành đặt lại mật khẩu mới.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{link}" style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-size: 16px; font-weight: bold;">Đặt lại Mật khẩu</a>
                </div>
                <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">
                    Nếu nút bấm không hoạt động, bạn có thể copy và dán đường link sau vào trình duyệt:<br>
                    <a href="{link}" style="color: #059669; word-break: break-all;">{link}</a>
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn được bảo mật an toàn.
                </p>
            </div>
        </div>
    </body>
    </html>
    """

    message.set_content(
        f"Xin chào {full_name},\n\nBấm vào link sau để đặt lại mật khẩu Shepoo: {link}\n\nNếu bạn không muốn đặt lại mật khẩu tài khoản Shepoo, vui lòng bỏ qua email này!"
    )
    message.add_alternative(html_content, subtype="html")

    try:
        with smtplib.SMTP(
            host=_clean(SMTP_HOST), port=SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS
        ) as smtp:
            if SMTP_USE_TLS:
                smtp.starttls()
            user_name = _clean(SMTP_USERNAME)
            password = _clean(SMTP_PASSWORD)
            if user_name and password:
                smtp.login(user_name, password)
            smtp.send_message(message)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Gửi email thất bại."
        )


async def reset_pasword(token: str, data: ResetPasswordRequest, db: AsyncSession):
    password_reset_token = await get_password_reset_token_by_token_hash(
        hash_token(token), db
    )
    if not password_reset_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Token không hợp lệ."
        )

    if password_reset_token.expires_at < datetime.now(UTC).replace(tzinfo=None):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yêu cầu đặt lại mật khẩu đã hết hạn.",
        )

    user_id = password_reset_token.user_id

    await change_password_hash_by_user_id(user_id, hash_password(data.new_password), db)
    await delete_password_reset_token_by_user_id(user_id=user_id, db=db)
