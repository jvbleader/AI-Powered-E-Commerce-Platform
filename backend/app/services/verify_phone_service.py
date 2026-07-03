import jwt_service
import uuid
import secrets
from datetime import datetime, timedelta, UTC
from schemas.auth_schema import *
from sqlalchemy.ext.asyncio import AsyncSession
from repositories.user_repositoriy import *
from repositories.user_session_repository import *
from fastapi import HTTPException, status, Depends
from utils.hash_and_verify import *

def generate_otp(length: int = 6) -> str:
    return "".join(secrets.choice("0123456789") for _ in range(6))

async def verify_phone(token: str):
    pass

async def send_phone_otp():
    pass