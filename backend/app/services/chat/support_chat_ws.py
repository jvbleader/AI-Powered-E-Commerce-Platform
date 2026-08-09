"""Shared WebSocket action handlers for support chat multiplex endpoint."""

import json
from typing import Optional

from fastapi import WebSocket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.base import utc_now
from models.chat import SupportConversation, SupportMessage
from models.user import User
from services.common.websocket_manager import (
    conversation_channel,
    manager,
    support_inbox_customer_channel,
    support_inbox_guest_channel,
    support_inbox_queue_channel,
    support_inbox_supporter_channel,
)

PRESENCE_KEY_PREFIX = "presence:"
PRESENCE_TTL_SEC = 45


def presence_key(conversation_id: str, viewer_type: str) -> str:
    return f"{PRESENCE_KEY_PREFIX}{conversation_id}:{viewer_type}"


async def _is_support_staff(db: AsyncSession, user: User) -> bool:
    from repositories.user.user_role_repository import get_role_list_by_user_id

    user_roles = await get_role_list_by_user_id(user.id, db)
    return any(role in user_roles for role in ["ADMIN", "MANAGER", "SUPPORTER"])


async def resolve_inbox_context(
    db: AsyncSession,
    user: Optional[User],
    guest_id: Optional[str],
    *,
    as_customer: bool = False,
) -> Optional[dict]:
    """Return inbox channel metadata or None if forbidden."""
    if user:
        if await _is_support_staff(db, user) and not as_customer:
            return {
                "viewer_type": "SUPPORTER",
                "inbox_channels": [
                    support_inbox_queue_channel(),
                    support_inbox_supporter_channel(user.id),
                ],
                # Keep guest_id for subscribe access to guest-owned sessions (e.g. /support?session_id=...)
                "guest_id": guest_id,
                "customer_id": None,
                "supporter_id": user.id,
            }
        return {
            "viewer_type": "CUSTOMER",
            "inbox_channels": [support_inbox_customer_channel(user.id)],
            "guest_id": guest_id,
            "customer_id": user.id,
            "supporter_id": None,
        }

    if guest_id:
        return {
            "viewer_type": "CUSTOMER",
            "inbox_channels": [support_inbox_guest_channel(guest_id)],
            "guest_id": guest_id,
            "customer_id": None,
            "supporter_id": None,
        }
    return None


def resolve_ws_guest_id(inbox_ctx: dict, data: dict) -> Optional[str]:
    """Prefer guest_id from command payload, fall back to WS handshake context."""
    payload_guest = data.get("guest_id")
    if isinstance(payload_guest, str) and payload_guest.strip():
        return payload_guest.strip()
    ctx_guest = inbox_ctx.get("guest_id")
    if isinstance(ctx_guest, str) and ctx_guest.strip():
        return ctx_guest.strip()
    return None


async def ensure_fresh_db_read(db: AsyncSession) -> None:
    """End any open WS transaction so subsequent reads see newly committed rows."""
    try:
        await db.commit()
    except Exception:
        await db.rollback()


async def resolve_conversation_access(
    db: AsyncSession,
    conversation_id: str,
    user: Optional[User],
    guest_id: Optional[str] = None,
) -> Optional[tuple[SupportConversation, str]]:
    stmt = (
        select(SupportConversation)
        .options(
            selectinload(SupportConversation.customer),
            selectinload(SupportConversation.supporter),
        )
        .where(SupportConversation.id == conversation_id)
    )
    result = await db.execute(stmt)
    conversation = result.scalars().first()
    if not conversation:
        return None

    if user:
        if conversation.customer_id == user.id:
            return conversation, "CUSTOMER"
        # Guest-owned session in this browser — treat as customer on /support.
        if guest_id and conversation.guest_id == guest_id:
            return conversation, "CUSTOMER"
        if await _is_support_staff(db, user):
            return conversation, "SUPPORTER"
        return None

    if guest_id and conversation.guest_id == guest_id:
        return conversation, "CUSTOMER"

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
    guest_id: Optional[str],
    count_unread_fn,
):
    if viewer_type == "CUSTOMER" and customer_id:
        unread = await count_unread_fn(db, customer_id=customer_id)
        await websocket.send_text(
            json.dumps({"type": "INBOX_UNREAD_COUNT", "unread_count": unread})
        )

    await websocket.send_text(json.dumps({"type": "INBOX_READY"}))


async def set_conversation_presence(conversation_id: str, viewer_type: str):
    await manager.redis.set(
        presence_key(conversation_id, viewer_type), "1", ex=PRESENCE_TTL_SEC
    )


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


async def handle_send_message(
    db: AsyncSession,
    *,
    conversation_id: str,
    viewer_type: str,
    content: str,
    attachment_type: Optional[str] = None,
    attachment_id: Optional[str] = None,
    attachments_payload: Optional[list] = None,
) -> Optional[dict]:
    from api.chat.support_chat_api import (
        ATTACHMENT_PLACEHOLDERS,
        _publish_support_inbox_snapshot,
        serialize_support_message,
    )

    attachments_json = None
    if isinstance(attachments_payload, list) and attachments_payload:
        valid_attachments = []
        for item in attachments_payload:
            if not isinstance(item, dict):
                continue
            item_type = item.get("type")
            item_url = item.get("url")
            if item_type in ["IMAGE", "VIDEO", "FILE"] and item_url:
                valid_attachments.append({"type": item_type, "url": item_url})
        if not valid_attachments:
            return None
        attachments_json = json.dumps(valid_attachments)
        attachment_type = None
        attachment_id = None

    if attachment_type and attachment_type not in ["IMAGE", "VIDEO", "FILE"]:
        return None

    has_single_attachment = bool(attachment_type and attachment_id)
    has_multi_attachments = bool(attachments_json)
    if not content and not has_single_attachment and not has_multi_attachments:
        return None

    if not content:
        if has_multi_attachments:
            count = len(json.loads(attachments_json))
            content = f"[{count} tệp đính kèm]"
        else:
            content = ATTACHMENT_PLACEHOLDERS.get(attachment_type, "[Tệp đính kèm]")

    conv_result = await db.execute(
        select(SupportConversation)
        .options(selectinload(SupportConversation.supporter))
        .where(SupportConversation.id == conversation_id)
    )
    conversation = conv_result.scalars().first()
    if not conversation:
        return None

    sender_type = viewer_type

    # Khách mở lại hội thoại CLOSED
    if sender_type == "CUSTOMER" and conversation.status == "CLOSED":
        conversation.status = "OPEN"
        conversation.supporter_id = None
        sys_msg = SupportMessage(
            conversation_id=conversation_id,
            sender_type="SYSTEM",
            content="Khách hàng đã mở lại yêu cầu hỗ trợ.",
        )
        db.add(sys_msg)
        conversation.updated_at = utc_now()
        await db.commit()
        await db.refresh(sys_msg)

        sys_ws_message = serialize_support_message(sys_msg)
        await manager.broadcast_to_conversation(conversation_id, sys_ws_message)

        full = await _load_conversation_full(db, conversation_id)
        if full:
            await _publish_support_inbox_snapshot(db, full)

    message = SupportMessage(
        conversation_id=conversation_id,
        sender_type=sender_type,
        content=content,
        attachment_type=attachment_type,
        attachment_id=attachment_id,
        attachments=attachments_json,
    )
    db.add(message)
    conversation.updated_at = utc_now()
    await db.commit()
    await db.refresh(message)

    if sender_type == "SUPPORTER" and conversation.customer_id:
        is_online = await manager.redis.get(
            presence_key(conversation_id, "CUSTOMER")
        )
        if not is_online:
            supporter_name = "Nhân viên hỗ trợ"
            if conversation.supporter_id:
                supporter_result = await db.execute(
                    select(User.full_name).where(User.id == conversation.supporter_id)
                )
                name = supporter_result.scalar_one_or_none()
                if name:
                    supporter_name = name
            from services.engagement.notification_service import send_notification

            await send_notification(
                db=db,
                user_id=conversation.customer_id,
                type="support",
                title="Tin nhắn CSKH mới",
                content=f"Nhân viên {supporter_name} vừa phản hồi tin nhắn của bạn.",
                action_url=f"/support?session_id={conversation_id}",
            )

    ws_message = serialize_support_message(message)
    await manager.broadcast_to_conversation(conversation_id, ws_message)

    full = await _load_conversation_full(db, conversation_id)
    if full:
        await _publish_support_inbox_snapshot(db, full)

    return ws_message


async def _load_conversation_full(
    db: AsyncSession,
    conversation_id: str,
) -> Optional[SupportConversation]:
    stmt = (
        select(SupportConversation)
        .options(
            selectinload(SupportConversation.customer),
            selectinload(SupportConversation.supporter),
            selectinload(SupportConversation.messages),
        )
        .where(SupportConversation.id == conversation_id)
    )
    result = await db.execute(stmt)
    return result.scalars().first()


async def handle_multiplex_command(
    websocket: WebSocket,
    db: AsyncSession,
    user: Optional[User],
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
    guest_id = resolve_ws_guest_id(inbox_ctx, data)

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

        await ensure_fresh_db_read(db)
        access = await resolve_conversation_access(
            db, conversation_id, user, guest_id=guest_id
        )
        if not access:
            await websocket.send_text(
                json.dumps({
                    "type": "ERROR",
                    "action": action,
                    "error": "Forbidden",
                    "conversation_id": conversation_id,
                })
            )
            return active_conversation_id, active_conversation_viewer_type, True

        _conv, derived_type = access

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
                access = await resolve_conversation_access(
                    db, target, user, guest_id=guest_id
                )
                derived_type = (
                    access[1] if access else active_conversation_viewer_type or inbox_ctx["viewer_type"]
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

    if action == "SEND_MESSAGE":
        conversation_id = data.get("conversation_id")
        if not conversation_id:
            await websocket.send_text(
                json.dumps({"type": "ERROR", "action": action, "error": "conversation_id required"})
            )
            return active_conversation_id, active_conversation_viewer_type, True

        await ensure_fresh_db_read(db)
        access = await resolve_conversation_access(
            db, conversation_id, user, guest_id=guest_id
        )
        if not access:
            await websocket.send_text(
                json.dumps({"type": "ERROR", "action": action, "error": "Forbidden"})
            )
            return active_conversation_id, active_conversation_viewer_type, True

        _conv, derived_type = access

        msg = await handle_send_message(
            db,
            conversation_id=conversation_id,
            viewer_type=derived_type,
            content=data.get("content") or "",
            attachment_type=data.get("attachment_type"),
            attachment_id=data.get("attachment_id"),
            attachments_payload=data.get("attachments"),
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
