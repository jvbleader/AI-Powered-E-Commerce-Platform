from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from repositories.category_repository import CategoryRepository
from schemas.category_public_schema import CategoryListResponse

router = APIRouter(prefix="/api/v1/categories", tags=["Categories"])


@router.get("", response_model=CategoryListResponse)
async def get_public_categories(db: AsyncSession = Depends(get_db)):
    repo = CategoryRepository(db)
    categories = await repo.get_all_categories()
    return {"categories": categories}
