from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

from models.cart import Cart
from models.cart import CartItem
from models.catalog import ProductVariant
from models.catalog import Product
from models.seller import SellerProfile


async def get_cart_by_user_id(db: AsyncSession, user_id: int) -> Cart | None:
    result = await db.execute(
        select(Cart)
        .options(
            selectinload(Cart.items).selectinload(CartItem.variant).selectinload(ProductVariant.inventory),
            selectinload(Cart.items).selectinload(CartItem.variant).selectinload(ProductVariant.product).selectinload(Product.seller).selectinload(SellerProfile.shipping_providers),
            selectinload(Cart.items).selectinload(CartItem.variant).selectinload(ProductVariant.product).selectinload(Product.images),
            selectinload(Cart.items).selectinload(CartItem.variant).selectinload(ProductVariant.product).selectinload(Product.categories),
            selectinload(Cart.items).selectinload(CartItem.variant).selectinload(ProductVariant.product).selectinload(Product.variants).selectinload(ProductVariant.inventory)
        )
        .where(Cart.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_cart(db: AsyncSession, user_id: int) -> Cart:
    cart = Cart(user_id=user_id)
    db.add(cart)
    await db.flush()
    return cart


async def get_cart_item(
    db: AsyncSession, cart_id: int, variant_id: int
) -> CartItem | None:
    result = await db.execute(
        select(CartItem)
        .where(CartItem.cart_id == cart_id)
        .where(CartItem.variant_id == variant_id)
    )
    return result.scalar_one_or_none()


async def add_item_to_cart(
    db: AsyncSession, cart_id: int, variant_id: int, quantity: int
) -> CartItem:
    item = CartItem(
        cart_id=cart_id, variant_id=variant_id, quantity=quantity, is_selected=True
    )
    db.add(item)
    await db.flush()
    return item


async def update_cart_item(
    db: AsyncSession,
    item: CartItem,
    quantity: int | None = None,
    is_selected: bool | None = None,
) -> CartItem:
    if quantity is not None:
        item.quantity = quantity
    if is_selected is not None:
        item.is_selected = is_selected
    await db.flush()
    return item


async def remove_cart_item(db: AsyncSession, item: CartItem) -> None:
    await db.delete(item)
    await db.flush()


async def select_all_cart_items(
    db: AsyncSession, cart_id: int, is_selected: bool
) -> None:
    await db.execute(
        update(CartItem)
        .where(CartItem.cart_id == cart_id)
        .values(is_selected=is_selected)
    )
    await db.flush()


async def get_cart_items_for_checkout(
    db: AsyncSession, user_id: int, cart_item_ids: list[int]
) -> list[CartItem]:
    from models.catalog import Product, ProductVariant

    stmt = (
        select(CartItem)
        .join(CartItem.variant)
        .join(ProductVariant.product)
        .options(selectinload(CartItem.variant).selectinload(ProductVariant.product))
        .where(
            CartItem.id.in_(cart_item_ids),
            CartItem.cart.has(user_id=user_id),
            ProductVariant.status == "ACTIVE",
            Product.status == "ACTIVE",
        )
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def remove_cart_items_by_ids(db: AsyncSession, cart_item_ids: list[int]) -> None:
    if not cart_item_ids:
        return
    await db.execute(delete(CartItem).where(CartItem.id.in_(cart_item_ids)))
    await db.flush()
