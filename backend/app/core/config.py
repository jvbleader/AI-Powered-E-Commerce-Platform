import os
from typing import Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Shepoo Ecommerce API"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    
    # Bắt buộc phải có trong .env, không có fallback
    DATABASE_URL: str
    ASYNC_DATABASE_URL: Optional[str] = None
    ACCESS_TOKEN_SECRET: str
    
    # Có thể có fallback cho môi trường dev, nhưng cảnh báo
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    ELASTICSEARCH_URL: str = "http://localhost:9200"
    REDIS_URL: str = "redis://redis:6379/0"
    
    PHONE_OTP_MAX_ATTEMPTS: int = 5
    PHONE_OTP_TTL_MINUTES: int = 5
    
    ACCESS_TOKEN_TTL_MINUTES: int = 1
    REFRESH_TOKEN_TTL_DAYS: int = 30
    
    COOKIE_SECURE: bool = False
    COOKIE_SAME_SITE: Optional[str] = None
    COOKIE_DOMAIN: Optional[str] = None

    @field_validator('COOKIE_SECURE', mode='before')
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
        # Pydantic settings config
        env_file = ".env"
        extra = "ignore"

settings = Settings()
