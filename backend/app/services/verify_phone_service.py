import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

import jwt_service
from repositories.user_repositoriy import *
from repositories.user_session_repository import *
from schemas.auth_schema import *
from utils.hash_and_verify import *


def generate_otp(length: int = 6) -> str:
    return "".join(secrets.choice("0123456789") for _ in range(6))


async def verify_phone(token: str):
    pass


async def send_phone_otp():
    pass
