from datetime import datetime
from sqlalchemy import or_, and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.phone_verifycation_otp import PhoneVerificationOtp