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

for path in (PROJECT_DIR, BACKEND_DIR, APP_DIR):
    path_text = str(path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)

from api.auth.auth_api import router as auth_router
from api.seller.seller_api import router as seller_router
from api.seller.seller_product_api import router as seller_product_router
from api.seller.seller_order_api import router as seller_order_router
from api.admin.admin_api import router as admin_router
from api.catalog.product_api import router as product_router
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
import services.search.search_service as search_svc
from services.search.search_helpers import (
    fetch_all_active_products_for_indexing,
    fetch_all_approved_shops_for_indexing,
)
from core.database import AsyncSessionLocal
from services.common.websocket_manager import manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    # Initialize Elasticsearch (product listing falls back to MySQL if ES is down at request time)
    try:
        await search_svc.create_products_index()
        async with AsyncSessionLocal() as db:
            products = await fetch_all_active_products_for_indexing(db)
            await search_svc.bulk_index_products(products)
            shops = await fetch_all_approved_shops_for_indexing(db)
            await search_svc.bulk_index_shops(shops)
    except Exception as e:
        logging.getLogger(__name__).exception(
            "Elasticsearch init failed — public product search will fall back to MySQL: %s",
            e,
        )
    yield
    stop_scheduler()
    await manager.shutdown()
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

from api.catalog.category_api import router as category_router
from api.cart.cart_api import router as cart_router
from api.order.order_api import router as order_router
from api.payment.payment_api import router as payment_router
from api.user.user_address_api import router as user_address_router
from api.chat.chat_ai_api import router as chat_ai_router
from api.catalog.review_api import router as review_router
from api.moderation.violation_report_api import router as violation_report_router
from api.chat.support_chat_api import router as support_chat_router
from api.chat.seller_chat_api import router as seller_chat_router
from api.engagement.notification_api import router as notifications_router
from api.search.search_api import router as search_router

from api.common.upload_api import router as upload_router
from api.shipping.shipping_api import router as shipping_router

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
app.include_router(upload_router, prefix="/api")
app.include_router(shipping_router)



@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "env": settings.APP_ENV,
    }


