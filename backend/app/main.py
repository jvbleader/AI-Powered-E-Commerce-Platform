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


from core.config import settings

def csv_env(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


logging.basicConfig(
    level=settings.LOG_LEVEL.upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

from contextlib import asynccontextmanager
from core.scheduler import start_scheduler, stop_scheduler
from core.elasticsearch import close_es_client
import services.search_service as search_svc
from services.search_helpers import fetch_all_active_products_for_indexing
from core.database import AsyncSessionLocal


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    # Initialize Elasticsearch
    try:
        await search_svc.create_products_index()
        async with AsyncSessionLocal() as db:
            products = await fetch_all_active_products_for_indexing(db)
            await search_svc.bulk_index_products(products)
    except Exception as e:
        logging.getLogger(__name__).exception(
            f"Elasticsearch init failed — search will fall back to MySQL: {e}"
        )
    yield
    stop_scheduler()
    await close_es_client()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.middleware("http")(validate_auth_cookie_middleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=csv_env(settings.CORS_ORIGINS),
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?",
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
from api.violation_report_api import router as violation_report_router
from api.support_chat_api import router as support_chat_router
from api.seller_chat_api import router as seller_chat_router
from api.notification_api import router as notifications_router
from api.search_api import router as search_router

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
app.include_router(violation_report_router)
app.include_router(support_chat_router, prefix="/api/support-chat")
app.include_router(seller_chat_router, prefix="/api/seller-chat")
app.include_router(notifications_router, prefix="/notifications", tags=["notifications"])
app.include_router(search_router)



@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "env": settings.APP_ENV,
    }


