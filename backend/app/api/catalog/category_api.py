from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import DBSession
from repositories.catalog.category_repository import CategoryRepository
from schemas.catalog.category_public_schema import CategoryListResponse

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=CategoryListResponse)
async def get_public_categories(db: DBSession):
    repo = CategoryRepository(db)
    categories = await repo.get_all_categories()
    return {"categories": categories}

