import json
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from dependencies.auth import get_current_user
from models.base import utc_now
from models.chat import SellerConversation, SellerConversationUserSettings, SellerMessage
from models.seller import SellerProfile
from models.user import User
import services.auth.jwt_service as jwt_service
import repositories.user.user_repository as user_repository
from services.chat.seller_chat_ws import (
    cleanup_multiplex_connection,
    handle_multiplex_command,
    presence_key,
    resolve_inbox_context,
    send_inbox_bootstrap,
)
from services.common.websocket_manager import manager

router = APIRouter(tags=["seller_chat"])
logger = logging.getLogger(__name__)


class SellerMessageResponse(BaseModel):
    id: int
    conversation_id: str
    sender_type: str
    content: str
    attachment_type: Optional[str] = None
    attachment_id: Optional[str] = None
    reply_to_id: Optional[int] = None
    status: str = "SENT"
    created_at: datetime

    class Config:
        from_attributes = True


class SellerConversationResponse(BaseModel):
    id: str
    customer_id: Optional[int]
    shop_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: Optional[datetime]
    messages: List[SellerMessageResponse] = []

    class Config:
        from_attributes = True


class SellerConversationListResponse(BaseModel):
    id: str
    status: str
    customer_id: Optional[int]
    shop_id: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]
    last_message: Optional[str]
    has_unread: bool
    unread_count: int = 0
    is_pinned: bool = False
    is_muted: bool = False
    shop_name: Optional[str]
    shop_avatar: Optional[str]
    customer_name: Optional[str]
    customer_avatar: Optional[str]

    class Config:
        from_attributes = True


class ConversationSettingsAction(BaseModel):
    action: str


ATTACHMENT_PREVIEW_LABELS = {
    "PRODUCT": "[Sản phẩm]",
    "ORDER": "[Đơn hàng]",
    "IMAGE": "[Hình ảnh]",
    "VIDEO": "[Video]",
}


def _preview_text(content: str) -> str:
    text = (content or "").strip() or "Chưa có tin nhắn"
    return text[:45] + "..." if len(text) > 45 else text


def _message_preview(msg: SellerMessage) -> str:
    if msg.attachment_type and msg.attachment_type in ATTACHMENT_PREVIEW_LABELS:
        return ATTACHMENT_PREVIEW_LABELS[msg.attachment_type]
    return _preview_text(msg.content)


def _get_last_message(messages: list[SellerMessage]) -> Optional[SellerMessage]:
    if not messages:
        return None
    return max(messages, key=lambda m: (m.created_at, m.id))


async def _get_conversation_settings(
    db: AsyncSession,
    conversation_id: str,
    user_id: int,
) -> Optional[SellerConversationUserSettings]:
    stmt = select(SellerConversationUserSettings).where(
        SellerConversationUserSettings.conversation_id == conversation_id,
        SellerConversationUserSettings.user_id == user_id,
    )
    result = await db.execute(stmt)
    return result.scalars().first()


async def _get_or_create_conversation_settings(
    db: AsyncSession,
    conversation_id: str,
    user_id: int,
) -> SellerConversationUserSettings:
    settings = await _get_conversation_settings(db, conversation_id, user_id)
    if settings:
        return settings
    settings = SellerConversationUserSettings(
        conversation_id=conversation_id,
        user_id=user_id,
    )
    db.add(settings)
    await db.flush()
    return settings


def _serialize_conversation_list_item(
    conv: SellerConversation,
    viewer_type: str,
    settings: Optional[SellerConversationUserSettings] = None,
) -> dict:
    sorted_messages = sorted(conv.messages, key=lambda m: (m.created_at, m.id)) if conv.messages else []
    last_msg_obj = _get_last_message(sorted_messages)
    last_msg = _message_preview(last_msg_obj) if last_msg_obj else "Chưa có tin nhắn"

    has_unread = any(
        m.sender_type != viewer_type and m.status in ("SENT", "DELIVERED")
        for m in sorted_messages
    )
    unread_count = sum(
        1
        for m in sorted_messages
        if m.sender_type != viewer_type and m.status in ("SENT", "DELIVERED")
    )
    if settings and settings.marked_unread:
        has_unread = True
        if unread_count == 0:
            unread_count = 1

    return {
        "id": conv.id,
        "status": conv.status,
        "customer_id": conv.customer_id,
        "shop_id": conv.shop_id,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "updated_at": (conv.updated_at or conv.created_at).isoformat() if (conv.updated_at or conv.created_at) else None,
        "last_message": last_msg,
        "has_unread": has_unread,
        "unread_count": unread_count,
        "is_pinned": bool(settings.is_pinned) if settings else False,
        "is_muted": bool(settings.is_muted) if settings else False,
        "shop_name": conv.shop.shop_name if conv.shop else "Shop",
        "shop_avatar": conv.shop.shop_logo_url if conv.shop else None,
        "customer_name": conv.customer.full_name if conv.customer else "Khách hàng",
        "customer_avatar": conv.customer.avatar_url if conv.customer else None,
    }


async def _load_conversation_full(
    db: AsyncSession,
    conversation_id: str,
) -> Optional[SellerConversation]:
    stmt = (
        select(SellerConversation)
        .options(
            selectinload(SellerConversation.customer),
            selectinload(SellerConversation.shop),
            selectinload(SellerConversation.messages),
        )
        .where(SellerConversation.id == conversation_id)
    )
    result = await db.execute(stmt)
    return result.scalars().first()


async def _count_unread_conversations(
    db: AsyncSession,
    *,
    viewer_type: str,
    customer_id: Optional[int] = None,
    shop_id: Optional[int] = None,
) -> int:
    if viewer_type == "SELLER":
        if not shop_id:
            return 0
        conv_stmt = select(SellerConversation.id).where(SellerConversation.shop_id == shop_id)
    else:
        if not customer_id:
            return 0
        conv_stmt = select(SellerConversation.id).where(SellerConversation.customer_id == customer_id)

    conv_ids = (await db.execute(conv_stmt)).scalars().all()
    if not conv_ids:
        return 0

    other_type = "CUSTOMER" if viewer_type == "SELLER" else "SELLER"
    unread_stmt = (
        select(func.count(func.distinct(SellerMessage.conversation_id)))
        .where(
            SellerMessage.conversation_id.in_(conv_ids),
            SellerMessage.sender_type == other_type,
            SellerMessage.status.in_(["SENT", "DELIVERED"]),
        )
    )
    return int((await db.execute(unread_stmt)).scalar() or 0)


async def _publish_inbox_snapshot(
    db: AsyncSession,
    conversation: SellerConversation,
):
    """Push INBOX_UPSERT + UNREAD_COUNT to both customer and shop inboxes."""
    if not conversation.messages:
        return

    if conversation.customer_id:
        customer_settings = await _get_conversation_settings(
            db, conversation.id, conversation.customer_id
        )
        if customer_settings and customer_settings.is_hidden:
            pass
        else:
            customer_item = _serialize_conversation_list_item(
                conversation, "CUSTOMER", customer_settings
            )
            unread = await _count_unread_conversations(
                db, viewer_type="CUSTOMER", customer_id=conversation.customer_id
            )
            await manager.broadcast_to_user_inbox(
                conversation.customer_id,
                {"type": "INBOX_UPSERT", "conversation": customer_item},
            )
            await manager.broadcast_to_user_inbox(
                conversation.customer_id,
                {"type": "INBOX_UNREAD_COUNT", "unread_count": unread},
            )

    if conversation.shop_id:
        shop = await _resolve_shop_by_id(db, conversation.shop_id)
        if shop and shop.user_id:
            seller_settings = await _get_conversation_settings(
                db, conversation.id, shop.user_id
            )
            if seller_settings and seller_settings.is_hidden:
                pass
            else:
                seller_item = _serialize_conversation_list_item(
                    conversation, "SELLER", seller_settings
                )
                unread = await _count_unread_conversations(
                    db, viewer_type="SELLER", shop_id=conversation.shop_id
                )
                await manager.broadcast_to_shop_inbox(
                    conversation.shop_id,
                    {"type": "INBOX_UPSERT", "conversation": seller_item},
                )
                await manager.broadcast_to_shop_inbox(
                    conversation.shop_id,
                    {"type": "INBOX_UNREAD_COUNT", "unread_count": unread},
                )


async def _mark_inbound_delivered(
    db: AsyncSession,
    *,
    viewer_type: str,
    customer_id: Optional[int] = None,
    shop_id: Optional[int] = None,
) -> list[dict]:
    """
    Mark SENT messages from the other party as DELIVERED when recipient is online (inbox connected).
    Returns list of {conversation_id, message_ids} for STATUS_UPDATE fan-out.
    """
    other_type = "CUSTOMER" if viewer_type == "SELLER" else "SELLER"

    if viewer_type == "SELLER":
        if not shop_id:
            return []
        conv_filter = SellerConversation.shop_id == shop_id
    else:
        if not customer_id:
            return []
        conv_filter = SellerConversation.customer_id == customer_id

    stmt = (
        select(SellerMessage)
        .join(SellerConversation, SellerMessage.conversation_id == SellerConversation.id)
        .where(
            conv_filter,
            SellerMessage.sender_type == other_type,
            SellerMessage.status == "SENT",
        )
    )
    result = await db.execute(stmt)
    messages = list(result.scalars().all())
    if not messages:
        return []

    grouped: dict[str, list[int]] = {}
    for msg in messages:
        msg.status = "DELIVERED"
        grouped.setdefault(msg.conversation_id, []).append(msg.id)

    await db.commit()
    return [
        {"conversation_id": cid, "message_ids": ids}
        for cid, ids in grouped.items()
    ]


async def _authenticate_websocket(websocket: WebSocket, db: AsyncSession) -> Optional[User]:
    token = websocket.cookies.get("access_token")
    if not token:
        return None
    try:
        payload = jwt_service.decode_jwt_token(token)
        if payload.get("type") != "access":
            return None
        user = await user_repository.get_user_by_public_id(payload["sub"], db)
        if not user or user.status == "DELETED":
            return None
        return user
    except Exception:
        return None


async def _resolve_shop_for_user(db: AsyncSession, user_id: int) -> Optional[SellerProfile]:
    result = await db.execute(select(SellerProfile).where(SellerProfile.user_id == user_id))
    return result.scalars().first()


@router.post("/conversations", response_model=SellerConversationResponse)
async def get_or_create_conversation(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SellerConversation).where(
        SellerConversation.customer_id == current_user.id,
        SellerConversation.shop_id == shop_id,
        SellerConversation.status == "OPEN",
    )
    result = await db.execute(stmt)
    conversation = result.scalars().first()

    if conversation:
        settings = await _get_conversation_settings(db, conversation.id, current_user.id)
        if settings and settings.is_hidden:
            conversation.status = "CLOSED"
            await db.flush()
            conversation = None

    if not conversation:
        conversation = SellerConversation(
            customer_id=current_user.id,
            shop_id=shop_id,
            status="OPEN",
        )
        db.add(conversation)
        await db.commit()

    fetch_stmt = (
        select(SellerConversation)
        .options(selectinload(SellerConversation.messages))
        .where(SellerConversation.id == conversation.id)
    )
    result = await db.execute(fetch_stmt)
    conversation = result.scalars().first()

    settings = await _get_or_create_conversation_settings(
        db, conversation.id, current_user.id
    )
    if settings.is_hidden:
        settings.is_hidden = False
        settings.updated_at = utc_now()
        await db.commit()

    return conversation


@router.get("/conversations/my", response_model=List[SellerConversationListResponse])
async def list_my_conversations(
    as_seller: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hydrate inbox once. Delivery/read realtime is handled by the multiplex WebSocket."""
    if as_seller:
        shop = await _resolve_shop_for_user(db, current_user.id)
        if not shop:
            return []

        stmt = (
            select(SellerConversation)
            .options(
                selectinload(SellerConversation.customer),
                selectinload(SellerConversation.shop),
                selectinload(SellerConversation.messages),
            )
            .where(SellerConversation.shop_id == shop.id)
            .order_by(SellerConversation.updated_at.desc())
        )
        viewer_type = "SELLER"
    else:
        stmt = (
            select(SellerConversation)
            .options(
                selectinload(SellerConversation.customer),
                selectinload(SellerConversation.shop),
                selectinload(SellerConversation.messages),
            )
            .where(SellerConversation.customer_id == current_user.id)
            .order_by(SellerConversation.updated_at.desc())
        )
        viewer_type = "CUSTOMER"

    result = await db.execute(stmt)
    conversations = result.scalars().all()

    viewer_user_id = current_user.id

    settings_map: dict = {}
    if conversations:
        settings_stmt = select(SellerConversationUserSettings).where(
            SellerConversationUserSettings.user_id == viewer_user_id,
            SellerConversationUserSettings.conversation_id.in_([c.id for c in conversations]),
        )
        settings_result = await db.execute(settings_stmt)
        settings_map = {
            s.conversation_id: s for s in settings_result.scalars().all()
        }

    items = []
    for conv in conversations:
        if not conv.messages:
            continue
        settings = settings_map.get(conv.id)
        if settings and settings.is_hidden:
            continue
        items.append(_serialize_conversation_list_item(conv, viewer_type, settings))

    items.sort(
        key=lambda item: (
            not item.get("is_pinned", False),
            -(datetime.fromisoformat(item["updated_at"]).timestamp()
              if item.get("updated_at") else 0),
        )
    )
    return items


@router.get("/conversations/my/unread-count")
async def get_my_unread_count(
    as_seller: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if as_seller:
        shop = await _resolve_shop_for_user(db, current_user.id)
        if not shop:
            return {"unread_count": 0}
        count = await _count_unread_conversations(db, viewer_type="SELLER", shop_id=shop.id)
    else:
        count = await _count_unread_conversations(
            db, viewer_type="CUSTOMER", customer_id=current_user.id
        )
    return {"unread_count": count}


@router.patch("/conversations/{conversation_id}/settings")
async def update_conversation_settings(
    conversation_id: str,
    body: ConversationSettingsAction,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await _load_conversation_full(db, conversation_id)
    if not conv:
        return {"ok": False, "error": "Conversation not found"}

    shop = await _resolve_shop_by_id(db, conv.shop_id) if conv.shop_id else None
    is_customer = conv.customer_id == current_user.id
    is_seller = shop and shop.user_id == current_user.id
    if not is_customer and not is_seller:
        return {"ok": False, "error": "Forbidden"}

    settings = await _get_or_create_conversation_settings(
        db, conversation_id, current_user.id
    )
    action = body.action

    if action == "pin":
        settings.is_pinned = True
    elif action == "unpin":
        settings.is_pinned = False
    elif action == "mute":
        settings.is_muted = True
    elif action == "unmute":
        settings.is_muted = False
    elif action == "mark_unread":
        settings.marked_unread = True
        other_type = "SELLER" if is_customer else "CUSTOMER"
        last_other = None
        for msg in sorted(conv.messages, key=lambda m: (m.created_at, m.id)):
            if msg.sender_type == other_type:
                last_other = msg
        if last_other and last_other.status == "READ":
            last_other.status = "DELIVERED"
    elif action == "mark_read":
        settings.marked_unread = False
    elif action == "delete":
        settings.is_hidden = True
        settings.is_pinned = False
    else:
        return {"ok": False, "error": "Invalid action"}

    settings.updated_at = utc_now()
    await db.commit()

    if action == "delete":
        return {"ok": True, "removed": True}

    await db.refresh(conv)
    full = await _load_conversation_full(db, conversation_id)
    if full and full.messages:
        await _publish_inbox_snapshot(db, full)

    unread = await _count_unread_conversations(
        db,
        viewer_type="CUSTOMER" if is_customer else "SELLER",
        customer_id=current_user.id if is_customer else None,
        shop_id=conv.shop_id if is_seller else None,
    )
    if is_customer:
        await manager.broadcast_to_user_inbox(
            current_user.id,
            {"type": "INBOX_UNREAD_COUNT", "unread_count": unread},
        )
    elif is_seller and conv.shop_id:
        await manager.broadcast_to_shop_inbox(
            conv.shop_id,
            {"type": "INBOX_UNREAD_COUNT", "unread_count": unread},
        )

    return {"ok": True}


@router.get("/conversations/by-shop/{shop_id}", response_model=Optional[SellerConversationListResponse])
async def get_conversation_by_shop(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if an existing conversation with messages exists for a shop."""
    stmt = (
        select(SellerConversation)
        .options(
            selectinload(SellerConversation.customer),
            selectinload(SellerConversation.shop),
            selectinload(SellerConversation.messages),
        )
        .where(
            SellerConversation.customer_id == current_user.id,
            SellerConversation.shop_id == shop_id,
            SellerConversation.status == "OPEN",
        )
    )
    result = await db.execute(stmt)
    conversation = result.scalars().first()
    if not conversation or not conversation.messages:
        return None

    settings = await _get_conversation_settings(db, conversation.id, current_user.id)
    if settings and settings.is_hidden:
        return None

    return _serialize_conversation_list_item(conversation, "CUSTOMER", settings)


@router.get("/conversations/{conversation_id}/messages", response_model=List[SellerMessageResponse])
async def get_messages(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(SellerMessage)
        .where(SellerMessage.conversation_id == conversation_id)
        .order_by(SellerMessage.created_at.asc())
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()
    return [
        {
            "id": msg.id,
            "conversation_id": msg.conversation_id,
            "sender_type": msg.sender_type,
            "content": msg.content,
            "attachment_type": msg.attachment_type,
            "attachment_id": msg.attachment_id,
            "reply_to_id": msg.reply_to_id,
            "status": msg.status,
            "created_at": msg.created_at.isoformat(),
        }
        for msg in messages
    ]


@router.websocket("/ws")
async def multiplex_websocket(
    websocket: WebSocket,
    as_seller: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """
    Unified multiplex WebSocket: inbox + one active conversation on a single connection.
    """
    user = await _authenticate_websocket(websocket, db)
    if not user:
        await websocket.close(code=4401)
        return

    inbox_ctx = await resolve_inbox_context(db, user, as_seller)
    if not inbox_ctx:
        await websocket.close(code=4403)
        return

    inbox_channel = inbox_ctx["inbox_channel"]
    viewer_type = inbox_ctx["viewer_type"]
    active_conversation_id: Optional[str] = None
    active_conversation_viewer_type: Optional[str] = None

    await db.commit()
    await manager.connect(websocket, inbox_channel)

    try:
        await send_inbox_bootstrap(
            websocket,
            db,
            viewer_type=viewer_type,
            customer_id=inbox_ctx["customer_id"],
            shop_id=inbox_ctx["shop_id"],
            as_seller=inbox_ctx["as_seller"],
            mark_delivered_fn=_mark_inbound_delivered,
            count_unread_fn=_count_unread_conversations,
        )

        while True:
            data_text = await websocket.receive_text()
            try:
                data = json.loads(data_text)
            except json.JSONDecodeError:
                continue

            try:
                active_conversation_id, active_conversation_viewer_type, _ = (
                    await handle_multiplex_command(
                        websocket,
                        db,
                        user,
                        data,
                        inbox_ctx=inbox_ctx,
                        active_conversation_id=active_conversation_id,
                        active_conversation_viewer_type=active_conversation_viewer_type,
                    )
                )
            except WebSocketDisconnect:
                raise
            except Exception as command_error:
                # A single failing command must not tear down the socket,
                # otherwise the client reconnects in a loop.
                logger.error(f"Multiplex command failed: {command_error}")
                try:
                    await db.rollback()
                except Exception:
                    pass
                try:
                    await websocket.send_text(
                        json.dumps({
                            "type": "ERROR",
                            "action": data.get("action"),
                            "error": "command_failed",
                        })
                    )
                except Exception:
                    # Client already gone; let the receive loop surface it.
                    break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"Multiplex WebSocket error: {e}")
    finally:
        await cleanup_multiplex_connection(
            websocket,
            active_conversation_id=active_conversation_id,
            active_conversation_viewer_type=active_conversation_viewer_type,
        )


def _customer_action_url(conversation_id: str, shop_id: int | None) -> str:
    base = f"/chat?tab=SELLER&session_id={conversation_id}"
    if shop_id:
        return f"{base}&shop_id={shop_id}"
    return base


def _seller_action_url(conversation_id: str) -> str:
    return f"/seller/chat?session_id={conversation_id}"


async def _resolve_shop_by_id(db: AsyncSession, shop_id: int) -> Optional[SellerProfile]:
    result = await db.execute(select(SellerProfile).where(SellerProfile.id == shop_id))
    return result.scalars().first()


async def _notify_offline_recipient(
    db: AsyncSession,
    *,
    conversation: SellerConversation,
    sender_type: str,
    conversation_id: str,
):
    from services.engagement.notification_service import send_notification

    # Chỉ skip push khi đang mở đúng đoạn chat (subscribe conversation trên multiplex WS).
    # Multiplex WS vẫn bật để DELIVERED — nhưng widget đóng vẫn nhận notification.
    recipient_type = "SELLER" if sender_type == "CUSTOMER" else "CUSTOMER"
    is_viewing_conversation = await manager.redis.get(
        presence_key(conversation_id, recipient_type)
    )
    if is_viewing_conversation:
        return

    recipient_user_id = None
    if sender_type == "SELLER" and conversation.customer_id:
        recipient_user_id = conversation.customer_id
    elif sender_type == "CUSTOMER" and conversation.shop_id:
        shop = await _resolve_shop_by_id(db, conversation.shop_id)
        if shop:
            recipient_user_id = shop.user_id

    if recipient_user_id:
        settings = await _get_conversation_settings(db, conversation_id, recipient_user_id)
        if settings and settings.is_muted:
            return

    # Ensure shop relation for names / user_id (avoid async lazy-load)
    shop = None
    if conversation.shop_id:
        shop = await _resolve_shop_by_id(db, conversation.shop_id)

    if sender_type == "SELLER" and conversation.customer_id:
        shop_name = shop.shop_name if shop else "Shop"
        await send_notification(
            db=db,
            user_id=conversation.customer_id,
            type="seller_chat",
            title="Tin nhắn từ cửa hàng",
            content=f"{shop_name} vừa phản hồi tin nhắn của bạn.",
            action_url=_customer_action_url(conversation_id, conversation.shop_id),
        )
    elif sender_type == "CUSTOMER" and shop and shop.user_id:
        customer_name = "Khách hàng"
        if conversation.customer_id:
            name_res = await db.execute(
                select(User.full_name).where(User.id == conversation.customer_id)
            )
            name = name_res.scalar_one_or_none()
            if name:
                customer_name = name
        await send_notification(
            db=db,
            user_id=shop.user_id,
            type="seller_chat",
            title="Tin nhắn khách hàng mới",
            content=f"{customer_name} vừa gửi tin nhắn cho shop của bạn.",
            action_url=_seller_action_url(conversation_id),
        )
