"""Shared WebSocket action handlers for seller chat multiplex endpoint."""

import json
from typing import Optional

from fastapi import WebSocket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.base import utc_now
from models.chat import SellerConversation, SellerMessage
from models.seller import SellerProfile
from models.user import User
from services.websocket_manager import (
    conversation_channel,
    inbox_shop_channel,
    inbox_user_channel,
    manager,
)

PRESENCE_KEY_PREFIX = "presence:seller_chat:"


def presence_key(conversation_id: str, viewer_type: str) -> str:
    return f"{PRESENCE_KEY_PREFIX}{conversation_id}:{viewer_type}"


async def resolve_inbox_context(
    db: AsyncSession,
    user: User,
    as_seller: bool,
) -> Optional[dict]:
    """Return inbox channel metadata or None if forbidden."""
    if as_seller:
        result = await db.execute(
            select(SellerProfile).where(SellerProfile.user_id == user.id)
        )
        shop = result.scalars().first()
        if not shop:
            return None
        return {
            "viewer_type": "SELLER",
            "inbox_channel": inbox_shop_channel(shop.id),
            "customer_id": None,
            "shop_id": shop.id,
            "as_seller": True,
        }
    return {
        "viewer_type": "CUSTOMER",
        "inbox_channel": inbox_user_channel(user.id),
        "customer_id": user.id,
        "shop_id": None,
        "as_seller": False,
    }


async def resolve_conversation_access(
    db: AsyncSession,
    conversation_id: str,
    user: User,
) -> Optional[tuple[SellerConversation, str]]:
    stmt = (
        select(SellerConversation)
        .options(selectinload(SellerConversation.shop))
        .where(SellerConversation.id == conversation_id)
    )
    result = await db.execute(stmt)
    conversation = result.scalars().first()
    if not conversation:
        return None

    if conversation.customer_id == user.id:
        return conversation, "CUSTOMER"
    if conversation.shop and conversation.shop.user_id == user.id:
        return conversation, "SELLER"
    return None


def verify_sender_type(client_sender_type: Optional[str], viewer_type: str) -> bool:
    if not client_sender_type:
        return True
    return client_sender_type == viewer_type


async def send_inbox_bootstrap(
    websocket: WebSocket,
    db: AsyncSession,
    *,
    viewer_type: str,
    customer_id: Optional[int],
    shop_id: Optional[int],
    as_seller: bool,
    mark_delivered_fn,
    count_unread_fn,
):
    from api.seller_chat_api import _load_conversation_full, _publish_inbox_snapshot

    updates = await mark_delivered_fn(
        db,
        viewer_type=viewer_type,
        customer_id=customer_id,
        shop_id=shop_id,
    )
    for update in updates:
        await manager.broadcast_to_conversation(
            update["conversation_id"],
            {
                "type": "STATUS_UPDATE",
                "status": "DELIVERED",
                "message_ids": update["message_ids"],
                "conversation_id": update["conversation_id"],
            },
        )
        full = await _load_conversation_full(db, update["conversation_id"])
        if full:
            await _publish_inbox_snapshot(db, full)

    unread = await count_unread_fn(
        db,
        viewer_type=viewer_type,
        customer_id=customer_id,
        shop_id=shop_id,
    )
    await websocket.send_text(
        json.dumps({"type": "INBOX_UNREAD_COUNT", "unread_count": unread, "as_seller": as_seller})
    )
    await websocket.send_text(json.dumps({"type": "INBOX_READY", "as_seller": as_seller}))


async def set_conversation_presence(conversation_id: str, viewer_type: str):
    await manager.redis.set(presence_key(conversation_id, viewer_type), "1", ex=30)


async def clear_conversation_presence(conversation_id: str, viewer_type: str):
    try:
        await manager.redis.delete(presence_key(conversation_id, viewer_type))
    except Exception:
        pass


async def subscribe_conversation(
    websocket: WebSocket,
    *,
    conversation_id: str,
    viewer_type: str,
    active_conversation_id: Optional[str],
    active_conversation_viewer_type: Optional[str] = None,
) -> str:
    """Subscribe socket to one conversation channel; unsubscribe previous if any."""
    if active_conversation_id and active_conversation_id != conversation_id:
        await unsubscribe_conversation(
            websocket,
            conversation_id=active_conversation_id,
            viewer_type=active_conversation_viewer_type or viewer_type,
        )
    await manager.connect(websocket, conversation_channel(conversation_id))
    await set_conversation_presence(conversation_id, viewer_type)
    return conversation_id


async def unsubscribe_conversation(
    websocket: WebSocket,
    *,
    conversation_id: str,
    viewer_type: str,
):
    await clear_conversation_presence(conversation_id, viewer_type)
    manager.disconnect(websocket, conversation_channel(conversation_id))


async def handle_mark_status(
    db: AsyncSession,
    *,
    conversation_id: str,
    user: User,
    viewer_type: str,
    action: str,
) -> bool:
    from api.seller_chat_api import (
        _get_conversation_settings,
        _load_conversation_full,
        _publish_inbox_snapshot,
    )

    new_status = "READ" if action == "MARK_READ" else "DELIVERED"
    target_sender_type = "SELLER" if viewer_type == "CUSTOMER" else "CUSTOMER"

    await db.commit()

    stmt = select(SellerMessage).where(
        SellerMessage.conversation_id == conversation_id,
        SellerMessage.sender_type == target_sender_type,
    )
    if new_status == "READ":
        stmt = stmt.where(SellerMessage.status.in_(["SENT", "DELIVERED"]))
    else:
        stmt = stmt.where(SellerMessage.status == "SENT")

    result = await db.execute(stmt)
    messages_to_update = result.scalars().all()

    updated_ids = []
    for msg in messages_to_update:
        msg.status = new_status
        updated_ids.append(msg.id)

    if updated_ids:
        await db.commit()
        await manager.broadcast_to_conversation(
            conversation_id,
            {
                "type": "STATUS_UPDATE",
                "status": new_status,
                "message_ids": updated_ids,
                "conversation_id": conversation_id,
            },
        )
        if new_status == "READ":
            viewer_settings = await _get_conversation_settings(db, conversation_id, user.id)
            if viewer_settings and viewer_settings.marked_unread:
                viewer_settings.marked_unread = False
                await db.commit()
        full = await _load_conversation_full(db, conversation_id)
        if full:
            await _publish_inbox_snapshot(db, full)
    return True


async def handle_send_message(
    db: AsyncSession,
    *,
    conversation_id: str,
    viewer_type: str,
    content: str,
    attachment_type: Optional[str] = None,
    attachment_id: Optional[str] = None,
    reply_to_id: Optional[int] = None,
) -> Optional[dict]:
    from api.seller_chat_api import (
        _load_conversation_full,
        _notify_offline_recipient,
        _publish_inbox_snapshot,
    )

    normalized_content = (content or "").strip()
    if not normalized_content and not attachment_type:
        return None

    conv_result = await db.execute(
        select(SellerConversation).where(SellerConversation.id == conversation_id)
    )
    conv = conv_result.scalars().first()
    if not conv:
        return None

    message = SellerMessage(
        conversation_id=conversation_id,
        sender_type=viewer_type,
        content=content or normalized_content or " ",
        attachment_type=attachment_type,
        attachment_id=attachment_id,
        reply_to_id=reply_to_id,
        status="SENT",
    )
    db.add(message)
    conv.updated_at = utc_now()
    await db.commit()
    await db.refresh(message)

    recipient_online = False
    if viewer_type == "CUSTOMER" and conv.shop_id:
        recipient_online = await manager.is_inbox_online(inbox_shop_channel(conv.shop_id))
    elif viewer_type == "SELLER" and conv.customer_id:
        recipient_online = await manager.is_inbox_online(inbox_user_channel(conv.customer_id))

    if recipient_online and message.status == "SENT":
        message.status = "DELIVERED"
        await db.commit()
        await db.refresh(message)

    ws_message = {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_type": message.sender_type,
        "content": message.content,
        "attachment_type": message.attachment_type,
        "attachment_id": message.attachment_id,
        "reply_to_id": message.reply_to_id,
        "status": message.status,
        "created_at": message.created_at.isoformat(),
    }

    await manager.broadcast_to_conversation(conversation_id, ws_message)

    if message.status == "DELIVERED":
        await manager.broadcast_to_conversation(
            conversation_id,
            {
                "type": "STATUS_UPDATE",
                "status": "DELIVERED",
                "message_ids": [message.id],
                "conversation_id": conversation_id,
            },
        )

    full = await _load_conversation_full(db, conversation_id)
    if full:
        await _publish_inbox_snapshot(db, full)

    await _notify_offline_recipient(
        db,
        conversation=conv,
        sender_type=viewer_type,
        conversation_id=conversation_id,
    )
    return ws_message


async def handle_multiplex_command(
    websocket: WebSocket,
    db: AsyncSession,
    user: User,
    data: dict,
    *,
    inbox_ctx: dict,
    active_conversation_id: Optional[str],
    active_conversation_viewer_type: Optional[str],
) -> tuple[Optional[str], Optional[str], bool]:
    """
    Process one multiplex WS command.
    Returns (updated_active_conversation_id, updated_active_viewer_type, should_continue).
    """
    action = data.get("action")
    viewer_type = inbox_ctx["viewer_type"]

    if action == "ping":
        if active_conversation_id and active_conversation_viewer_type:
            await set_conversation_presence(
                active_conversation_id,
                active_conversation_viewer_type,
            )
        await websocket.send_text(json.dumps({"type": "pong"}))
        return active_conversation_id, active_conversation_viewer_type, True

    if action == "SUBSCRIBE_CONVERSATION":
        conversation_id = data.get("conversation_id")
        if not conversation_id:
            await websocket.send_text(
                json.dumps({"type": "ERROR", "action": action, "error": "conversation_id required"})
            )
            return active_conversation_id, active_conversation_viewer_type, True

        access = await resolve_conversation_access(db, conversation_id, user)
        if not access:
            await websocket.send_text(
                json.dumps({"type": "ERROR", "action": action, "error": "Forbidden"})
            )
            return active_conversation_id, active_conversation_viewer_type, True

        _conv, derived_type = access
        if not verify_sender_type(data.get("sender_type"), derived_type):
            await websocket.send_text(
                json.dumps({"type": "ERROR", "action": action, "error": "Invalid sender_type"})
            )
            return active_conversation_id, active_conversation_viewer_type, True

        new_active = await subscribe_conversation(
            websocket,
            conversation_id=conversation_id,
            viewer_type=derived_type,
            active_conversation_id=active_conversation_id,
            active_conversation_viewer_type=active_conversation_viewer_type,
        )
        await websocket.send_text(
            json.dumps({
                "type": "ACK",
                "action": action,
                "conversation_id": conversation_id,
            })
        )
        return new_active, derived_type, True

    if action == "UNSUBSCRIBE_CONVERSATION":
        target = data.get("conversation_id") or active_conversation_id
        if target:
            if target == active_conversation_id and active_conversation_viewer_type:
                derived_type = active_conversation_viewer_type
            else:
                access = await resolve_conversation_access(db, target, user)
                derived_type = (
                    access[1] if access else active_conversation_viewer_type or viewer_type
                )
            await unsubscribe_conversation(
                websocket,
                conversation_id=target,
                viewer_type=derived_type,
            )
            if active_conversation_id == target:
                active_conversation_id = None
                active_conversation_viewer_type = None
        await websocket.send_text(json.dumps({"type": "ACK", "action": action}))
        return active_conversation_id, active_conversation_viewer_type, True

    if action in ("MARK_READ", "MARK_DELIVERED"):
        conversation_id = data.get("conversation_id")
        if not conversation_id:
            await websocket.send_text(
                json.dumps({"type": "ERROR", "action": action, "error": "conversation_id required"})
            )
            return active_conversation_id, active_conversation_viewer_type, True

        access = await resolve_conversation_access(db, conversation_id, user)
        if not access:
            await websocket.send_text(
                json.dumps({"type": "ERROR", "action": action, "error": "Forbidden"})
            )
            return active_conversation_id, active_conversation_viewer_type, True

        _conv, derived_type = access
        if not verify_sender_type(data.get("sender_type"), derived_type):
            await websocket.send_text(
                json.dumps({"type": "ERROR", "action": action, "error": "Invalid sender_type"})
            )
            return active_conversation_id, active_conversation_viewer_type, True

        await handle_mark_status(
            db,
            conversation_id=conversation_id,
            user=user,
            viewer_type=derived_type,
            action=action,
        )
        if action == "MARK_READ":
            await set_conversation_presence(conversation_id, derived_type)
        await websocket.send_text(
            json.dumps({"type": "ACK", "action": action, "conversation_id": conversation_id})
        )
        return active_conversation_id, active_conversation_viewer_type, True

    if action == "SEND_MESSAGE":
        conversation_id = data.get("conversation_id")
        if not conversation_id:
            await websocket.send_text(
                json.dumps({"type": "ERROR", "action": action, "error": "conversation_id required"})
            )
            return active_conversation_id, active_conversation_viewer_type, True

        access = await resolve_conversation_access(db, conversation_id, user)
        if not access:
            await websocket.send_text(
                json.dumps({"type": "ERROR", "action": action, "error": "Forbidden"})
            )
            return active_conversation_id, active_conversation_viewer_type, True

        _conv, derived_type = access
        if not verify_sender_type(data.get("sender_type"), derived_type):
            await websocket.send_text(
                json.dumps({"type": "ERROR", "action": action, "error": "Invalid sender_type"})
            )
            return active_conversation_id, active_conversation_viewer_type, True

        msg = await handle_send_message(
            db,
            conversation_id=conversation_id,
            viewer_type=derived_type,
            content=data.get("content") or "",
            attachment_type=data.get("attachment_type"),
            attachment_id=data.get("attachment_id"),
            reply_to_id=data.get("reply_to_id"),
        )
        if msg:
            await websocket.send_text(
                json.dumps({"type": "ACK", "action": action, "message": msg})
            )
        else:
            await websocket.send_text(
                json.dumps({
                    "type": "ERROR",
                    "action": action,
                    "error": "Message content or attachment required",
                })
            )
        return active_conversation_id, active_conversation_viewer_type, True

    return active_conversation_id, active_conversation_viewer_type, True


async def cleanup_multiplex_connection(
    websocket: WebSocket,
    *,
    active_conversation_id: Optional[str],
    active_conversation_viewer_type: Optional[str],
):
    if active_conversation_id and active_conversation_viewer_type:
        await clear_conversation_presence(
            active_conversation_id,
            active_conversation_viewer_type,
        )
    manager.disconnect_all(websocket)
