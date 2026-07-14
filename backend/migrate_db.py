import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv("c:/AI-Powered-E-Commerce-Platform/backend/.env")


async def migrate():
    engine = create_async_engine(os.getenv("ASYNC_DATABASE_URL"), echo=True)
    async with engine.begin() as conn:
        try:
            await conn.execute(
                text("ALTER TABLE products ADD COLUMN variant_options JSON NULL;")
            )
            print("Added variant_options to products")
        except Exception as e:
            print("Error products:", e)

        try:
            await conn.execute(
                text("ALTER TABLE product_variants ADD COLUMN tier_index JSON NULL;")
            )
            print("Added tier_index to product_variants")
        except Exception as e:
            print("Error variants:", e)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate())
