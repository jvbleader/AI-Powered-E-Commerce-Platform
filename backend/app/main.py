from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
PROJECT_DIR = BACKEND_DIR.parent
SERVICES_DIR = APP_DIR / "services"

for path in (PROJECT_DIR, BACKEND_DIR, APP_DIR, SERVICES_DIR):
    path_text = str(path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)

from api.auth_api import router as auth_router
from api.seller_api import router as seller_router
from api.seller_product_api import router as seller_product_router
from api.seller_order_api import router as seller_order_router
from api.admin_api import router as admin_router
from api.product_api import router as product_router
from middleware.auth_middleware import validate_auth_cookie_middleware


def csv_env(name: str, default: str) -> list[str]:
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

from contextlib import asynccontextmanager
from core.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title=os.getenv("APP_NAME", "Shepoo Ecommerce API"),
    version=os.getenv("APP_VERSION", "0.1.0"),
    lifespan=lifespan,
)

app.middleware("http")(validate_auth_cookie_middleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=csv_env(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.category_api import router as category_router
from api.cart_api import router as cart_router
from api.order_api import router as order_router
from api.payment_api import router as payment_router
from api.user_address_api import router as user_address_router
from api.chat_ai_api import router as chat_ai_router
from api.review_api import router as review_router

app.include_router(auth_router)
app.include_router(seller_router)
app.include_router(seller_product_router)
app.include_router(seller_order_router)
app.include_router(admin_router)
app.include_router(product_router)
app.include_router(category_router)
app.include_router(cart_router)
app.include_router(order_router)
app.include_router(payment_router)
app.include_router(user_address_router)
app.include_router(chat_ai_router)
app.include_router(review_router)



@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "env": os.getenv("APP_ENV", "development"),
    }
