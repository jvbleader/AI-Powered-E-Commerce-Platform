import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
sys.path.insert(0, str(APP_DIR))

from sqlalchemy import update
from core.database import AsyncSessionLocal
from models.category import Category


async def fix_categories():
    categories = [
        ("dien-tu", "Điện tử"),
        ("thoi-trang", "Thời trang"),
        ("suc-khoe-sac-dep", "Sức khỏe & Sắc đẹp"),
        ("nha-cua-doi-song", "Nhà cửa & Đời sống"),
        ("do-gia-dung", "Đồ gia dụng"),
    ]

    async with AsyncSessionLocal() as session:
        for slug, name in categories:
            await session.execute(
                update(Category).where(Category.slug == slug).values(name=name)
            )
        await session.commit()
        print("Categories updated successfully.")


if __name__ == "__main__":
    asyncio.run(fix_categories())
