from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Safe to hardcode
    APP_NAME: str = "Shepoo Ecommerce API"
    APP_VERSION: str = "0.1.0"

    # Required from environment
    APP_ENV: str
    LOG_LEVEL: str
    DATABASE_URL: str
    ACCESS_TOKEN_SECRET: str
    CORS_ORIGINS: str
    ELASTICSEARCH_URL: str
    REDIS_URL: str
    PHONE_OTP_MAX_ATTEMPTS: int
    PHONE_OTP_TTL_MINUTES: int
    ACCESS_TOKEN_TTL_MINUTES: int
    REFRESH_TOKEN_TTL_DAYS: int
    COOKIE_SECURE: bool
    COOKIE_SAME_SITE: str

    # Optional — only used when set
    ASYNC_DATABASE_URL: Optional[str] = None
    COOKIE_DOMAIN: Optional[str] = None
    
    # Azure Blob Storage
    AZURE_STORAGE_CONNECTION_STRING: Optional[str] = None
    AZURE_CONTAINER_NAME: str = None

    # VNPay (optional — required when using VNPay endpoints)
    VNPAY_TMN_CODE: Optional[str] = None
    VNPAY_HASH_SECRET: Optional[str] = None
    VNPAY_PAYMENT_URL: str = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
    VNPAY_API_URL: str = "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction"
    VNPAY_RETURN_URL: str = "http://localhost:8000/payments/vnpay/return?redirect=true"
    VNPAY_IPN_URL: str = "http://localhost:8000/payments/vnpay/ipn"
    VNPAY_VERSION: str = "2.1.0"
    VNPAY_CURR_CODE: str = "VND"
    VNPAY_LOCALE: str = "vn"
    VNPAY_ORDER_TYPE: str = "other"
    VNPAY_HASH_ALGORITHM: str = "SHA512"
    VNPAY_TIMEOUT_MINUTES: int = 15
    FRONTEND_URL: str = "http://localhost:3000"

    @field_validator("COOKIE_SECURE", mode="before")
    @classmethod
    def parse_cookie_secure(cls, v):
        if v == "" or v is None:
            return False
        return v

    @property
    def get_async_database_url(self) -> str:
        url = self.ASYNC_DATABASE_URL or self.DATABASE_URL
        if url and url.startswith("mysql:asyncmy//"):
            url = url.replace("mysql:asyncmy//", "mysql+asyncmy://", 1)
        return url

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
