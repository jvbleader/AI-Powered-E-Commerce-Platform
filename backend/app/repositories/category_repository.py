from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.catalog import Category


class CategoryRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all_categories(self) -> list[Category]:
        result = await self.db.execute(
            select(Category).order_by(Category.sort_order.asc(), Category.id.asc())
        )
        return list(result.scalars().all())
