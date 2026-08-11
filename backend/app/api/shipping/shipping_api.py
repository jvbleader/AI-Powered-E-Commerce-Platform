from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import DBSession
from schemas.shipping.shipping_provider_schema import ShippingProviderResponse
from repositories.shipping.shipping_provider_repository import get_all_active_shipping_providers

router = APIRouter(prefix="/shipping", tags=["Shipping"])

@router.get("/providers", response_model=list[ShippingProviderResponse])
async def get_active_providers(db: DBSession):
    providers = await get_all_active_shipping_providers(db)
    return providers
