from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from sqlalchemy.orm import selectinload
from models.product import Product
from models.product_category import ProductCategory
from models.product_image import ProductImage
from models.product_variant import ProductVariant
from models.inventory import Inventory
from models.inventory_transaction import InventoryTransaction
from schemas.seller_product_schema import ProductCreateRequest, ProductUpdateRequest
from models.base import utc_now

async def create_product(db: AsyncSession, seller_id: int, data: ProductCreateRequest) -> Product:
    # 1. Create Product
    product = Product(
        seller_id=seller_id,
        name=data.name,
        slug=data.slug,
        short_description=data.short_description,
        description=data.description,
        brand=data.brand,
        origin=data.origin,
        warranty_info=data.warranty_info,
        status="ACTIVE"
    )
    db.add(product)
    await db.flush()  # to get product.id

    # 2. Create Product Categories
    for cat_id in data.category_ids:
        pc = ProductCategory(product_id=product.id, category_id=cat_id)
        db.add(pc)

    # 3. Create Product Images
    for img in data.images:
        pi = ProductImage(
            product_id=product.id,
            image_url=img.image_url,
            is_thumbnail=img.is_thumbnail,
            sort_order=img.sort_order
        )
        db.add(pi)

    # 4. Create Product Variants and Inventory
    for variant_req in data.variants:
        variant = ProductVariant(
            product_id=product.id,
            sku=variant_req.sku,
            variant_name=variant_req.variant_name,
            price=variant_req.price,
            sale_price=variant_req.sale_price,
            sale_start_at=variant_req.sale_start_at,
            sale_end_at=variant_req.sale_end_at,
            image_url=variant_req.image_url,
            status="ACTIVE"
        )
        db.add(variant)
        await db.flush() # get variant.id
        
        # Create Inventory
        inventory = Inventory(
            variant_id=variant.id,
            quantity=variant_req.quantity,
            reserved_quantity=0
        )
        db.add(inventory)
        
        # Log Inventory Transaction
        if variant_req.quantity > 0:
            transaction = InventoryTransaction(
                variant_id=variant.id,
                transaction_type="IMPORT",
                quantity_change=variant_req.quantity,
                quantity_before=0,
                quantity_after=variant_req.quantity,
                note="Initial import when creating product"
            )
            db.add(transaction)

    await db.flush()
    
    # Reload product with relationships to avoid MissingGreenlet during serialization
    query = select(Product).options(
        selectinload(Product.images),
        selectinload(Product.variants)
    ).filter(Product.id == product.id)
    result = await db.execute(query)
    product_with_rels = result.scalar_one()
    
    return product_with_rels

async def get_products_by_seller(
    db: AsyncSession, 
    seller_id: int, 
    skip: int = 0, 
    limit: int = 100
) -> tuple[List[Product], int]:
    # Base filter (no eager loading — used for count)
    base_filter = select(Product).filter(
        Product.seller_id == seller_id, 
        Product.status != 'DELETED'
    )
    
    # Get total count
    count_query = select(func.count()).select_from(base_filter.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()
    
    # Get items with eager loading
    items_query = base_filter.options(
        selectinload(Product.images),
        selectinload(Product.variants)
    ).offset(skip).limit(limit)
    items_result = await db.execute(items_query)
    items = list(items_result.scalars().all())
    
    return items, total

async def get_product_by_public_id_and_seller(
    db: AsyncSession, 
    public_id: str, 
    seller_id: int
) -> Optional[Product]:
    query = select(Product).options(
        selectinload(Product.images),
        selectinload(Product.variants)
    ).filter(
        Product.public_id == public_id,
        Product.seller_id == seller_id,
        Product.status != 'DELETED'
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def update_product(
    db: AsyncSession, 
    product: Product, 
    data: ProductUpdateRequest
) -> Product:
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(product, key, value)
    
    await db.flush()
    await db.refresh(product)
    return product

async def soft_delete_product(db: AsyncSession, product: Product) -> Product:
    product.status = "DELETED"
    product.deleted_at = utc_now()
    await db.flush()
    await db.refresh(product)
    return product

async def hide_product(db: AsyncSession, product: Product) -> Product:
    product.status = "HIDDEN"
    await db.flush()
    await db.refresh(product)
    return product
