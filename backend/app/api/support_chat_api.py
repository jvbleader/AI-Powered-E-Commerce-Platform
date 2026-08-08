import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, UploadFile, File
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dependencies.auth import get_current_user_optional, get_current_user
from core.database import get_db
from models.chat import SupportConversation, SupportMessage
from models.user import User
from schemas.support_chat import (
    SupportConversationListResponse,
    SupportConversationResponse,
    SupportMessageResponse,
    SupportMessageSendRequest,
)
from services.support_chat_ws import (
    cleanup_multiplex_connection,
    handle_multiplex_command,
    handle_send_message,
    resolve_conversation_access,
    resolve_inbox_context,
    send_inbox_bootstrap,
)
from repositories import user_repositoriy
from services import jwt_service
from services.websocket_manager import manager
from services.azure_blob_service import azure_blob_service

router = APIRouter(tags=["support_chat"])
logger = logging.getLogger(__name__)

ATTACHMENT_PLACEHOLDERS = {
    "IMAGE": "[Hình ảnh]",
    "VIDEO": "[Video]",
    "FILE": "[Tệp đính kèm]",
}


def serialize_support_message(message: SupportMessage) -> dict:
    attachments = []
    if message.attachments:
        try:
            parsed = json.loads(message.attachments)
            if isinstance(parsed, list):
                attachments = parsed
        except json.JSONDecodeError:
            attachments = []
    elif message.attachment_type and message.attachment_id:
        attachments = [{"type": message.attachment_type, "url": message.attachment_id}]

    payload = {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_type": message.sender_type,
        "content": message.content,
        "attachment_type": message.attachment_type,
        "attachment_id": message.attachment_id,
        "created_at": message.created_at.isoformat(),
    }
    if attachments:
        payload["attachments"] = attachments
    return payload


async def _assert_support_conversation_access(
    conversation: SupportConversation,
    current_user: Optional[User],
    guest_id: Optional[str],
    db: AsyncSession,
) -> None:
    if current_user:
        if conversation.customer_id == current_user.id:
            return
        if guest_id and conversation.guest_id == guest_id:
            return

        from repositories.user_role_repository import get_role_list_by_user_id

        user_roles = await get_role_list_by_user_id(current_user.id, db)
        if any(role in user_roles for role in ["ADMIN", "MANAGER", "SUPPORTER"]):
            return

        raise HTTPException(status_code=403, detail="Không có quyền truy cập hội thoại này")

    if guest_id and conversation.guest_id == guest_id:
        return

    raise HTTPException(status_code=403, detail="Không có quyền truy cập hội thoại này")


async def _authenticate_websocket(websocket: WebSocket, db: AsyncSession) -> Optional[User]:
    token = websocket.cookies.get("access_token")
    if not token:
        return None
    try:
        payload = jwt_service.decode_jwt_token(token)
        if payload.get("type") != "access":
            return None
        user = await user_repositoriy.get_user_by_public_id(payload["sub"], db)
        if not user or user.status == "DELETED":
            return None
        return user
    except Exception:
        return None


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


def _serialize_supporter_user(user: Optional[User]) -> Optional[dict]:
    if not user:
        return None
    return {
        "id": user.id,
        "public_id": user.public_id,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url,
    }


async def _serialize_support_session_summary(
    db: AsyncSession,
    conv: SupportConversation,
    *,
    for_viewer: str = "CUSTOMER",
) -> dict:
    sorted_messages = sorted(conv.messages, key=lambda m: m.created_at) if conv.messages else []
    customer_msgs = [m for m in sorted_messages if m.sender_type == "CUSTOMER"]
    if customer_msgs:
        first_msg_content = customer_msgs[0].content
        title = first_msg_content[:45] + "..." if len(first_msg_content) > 45 else first_msg_content
    else:
        title = "Yêu cầu hỗ trợ mới"

    has_unread = False
    if for_viewer == "CUSTOMER" and conv.customer_id:
        from models.engagement import Notification

        notif_stmt = select(func.count()).select_from(Notification).where(
            Notification.user_id == conv.customer_id,
            Notification.is_read == False,
            or_(
                Notification.action_url.like(f"/support?session_id={conv.id}%"),
                Notification.action_url.like(f"/chat?tab=SUPPORTER&session_id={conv.id}%"),
            ),
        )
        has_unread = bool((await db.execute(notif_stmt)).scalar())

    return {
        "id": conv.id,
        "status": conv.status,
        "customer_id": conv.customer_id,
        "guest_id": conv.guest_id,
        "supporter_id": conv.supporter_id,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "updated_at": (conv.updated_at or conv.created_at).isoformat()
        if (conv.updated_at or conv.created_at)
        else None,
        "supporter": _serialize_supporter_user(conv.supporter),
        "last_message": title,
        "has_unread": has_unread,
    }


async def _count_unread_support_conversations(
    db: AsyncSession,
    *,
    customer_id: int,
) -> int:
    from models.engagement import Notification

    stmt = select(func.count()).select_from(Notification).where(
        Notification.user_id == customer_id,
        Notification.is_read == False,
        or_(
            Notification.action_url.like("/support?session_id=%"),
            Notification.action_url.like("/chat?tab=SUPPORTER&session_id=%"),
        ),
    )
    return int((await db.execute(stmt)).scalar() or 0)


async def _publish_support_inbox_snapshot(
    db: AsyncSession,
    conversation: SupportConversation,
    *,
    queue_remove: bool = False,
):
    """Push inbox/queue events to support chat multiplex channels."""
    customer_item = await _serialize_support_session_summary(
        db, conversation, for_viewer="CUSTOMER"
    )
    supporter_item = await _serialize_support_session_summary(
        db, conversation, for_viewer="SUPPORTER"
    )

    if conversation.customer_id:
        await manager.broadcast_to_support_customer_inbox(
            conversation.customer_id,
            {"type": "INBOX_UPSERT", "conversation": customer_item},
        )
        unread = await _count_unread_support_conversations(
            db, customer_id=conversation.customer_id
        )
        await manager.broadcast_to_support_customer_inbox(
            conversation.customer_id,
            {"type": "INBOX_UNREAD_COUNT", "unread_count": unread},
        )
    elif conversation.guest_id:
        await manager.broadcast_to_support_guest_inbox(
            conversation.guest_id,
            {"type": "INBOX_UPSERT", "conversation": customer_item},
        )

    if conversation.supporter_id:
        await manager.broadcast_to_support_supporter_inbox(
            conversation.supporter_id,
            {"type": "INBOX_UPSERT", "conversation": supporter_item},
        )

    if queue_remove:
        await manager.broadcast_to_support_queue(
            {"type": "QUEUE_REMOVE", "conversation_id": conversation.id}
        )
    elif conversation.status == "OPEN" and conversation.supporter_id is None:
        await manager.broadcast_to_support_queue(
            {"type": "QUEUE_UPSERT", "conversation": supporter_item}
        )


async def _upload_support_attachment(file: UploadFile) -> tuple[str, str]:
    content_type = file.content_type or ""
    filename = (file.filename or "").lower()

    if content_type.startswith("image/"):
        return "IMAGE", await azure_blob_service.upload_image(file)
    if content_type.startswith("video/"):
        return "VIDEO", await azure_blob_service.upload_video(file)

    if (
        content_type in {"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"}
        or filename.endswith((".pdf", ".docx", ".txt"))
    ):
        return "FILE", await azure_blob_service.upload_document(file)

    raise HTTPException(status_code=400, detail="Chỉ hỗ trợ ảnh, video, PDF, DOCX hoặc TXT.")


@router.post("/conversations/{conversation_id}/upload", response_model=dict)
async def upload_support_attachment(
    conversation_id: str,
    guest_id: Optional[str] = None,
    file: UploadFile = File(...),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SupportConversation).where(SupportConversation.id == conversation_id)
    result = await db.execute(stmt)
    conversation = result.scalars().first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Không tìm thấy hội thoại")

    await _assert_support_conversation_access(conversation, current_user, guest_id, db)
    attachment_type, url = await _upload_support_attachment(file)
    return {"url": url, "attachment_type": attachment_type}

@router.post("/conversations", response_model=SupportConversationListResponse)
async def get_or_create_conversation(
    guest_id: Optional[str] = None,
    create: Optional[bool] = True,
    force_new: Optional[bool] = False,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Tạo hoặc lấy hội thoại hiện tại. User có thể đăng nhập hoặc khách vãng lai (dùng guest_id).
    """
    if current_user:
        stmt = select(SupportConversation).options(
            selectinload(SupportConversation.customer),
            selectinload(SupportConversation.supporter)
        ).where(
            SupportConversation.customer_id == current_user.id,
            SupportConversation.status == "OPEN",
        )
    elif guest_id:
        stmt = select(SupportConversation).options(
            selectinload(SupportConversation.customer),
            selectinload(SupportConversation.supporter)
        ).where(
            SupportConversation.guest_id == guest_id,
            SupportConversation.status == "OPEN",
        )
    else:
        raise HTTPException(status_code=400, detail="Cần cung cấp user hoặc guest_id")

    if force_new:
        conversation = None
    else:
        result = await db.execute(stmt)
        conversation = result.scalars().first()

    if not conversation:
        if not create:
            raise HTTPException(status_code=404, detail="Không có cuộc hội thoại nào đang mở")
            
        conversation = SupportConversation(
            customer_id=current_user.id if current_user else None,
            guest_id=guest_id or None,
            status="OPEN",
        )
        db.add(conversation)
        await db.commit()
        
        # Re-fetch to load relationships eagerly
        fetch_stmt = select(SupportConversation).options(
            selectinload(SupportConversation.customer),
            selectinload(SupportConversation.supporter),
            selectinload(SupportConversation.messages),
        ).where(SupportConversation.id == conversation.id)
        result = await db.execute(fetch_stmt)
        conversation = result.scalars().first()

        if conversation:
            await _publish_support_inbox_snapshot(db, conversation)
        
    return conversation


@router.get("/conversations", response_model=List[SupportConversationListResponse])
async def list_conversations(
    unassigned: Optional[bool] = False,
    active: Optional[bool] = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh sách các cuộc hội thoại. Chỉ dành cho SUPPORTER/ADMIN.
    """
    from repositories.user_role_repository import get_role_list_by_user_id
    user_roles = await get_role_list_by_user_id(current_user.id, db)
    if not any(role in user_roles for role in ["ADMIN", "MANAGER", "SUPPORTER"]):
        raise HTTPException(status_code=403, detail="Không có quyền truy cập")
        
    stmt = select(SupportConversation).options(
        selectinload(SupportConversation.customer),
        selectinload(SupportConversation.supporter)
    )
    
    if unassigned:
        stmt = stmt.where(SupportConversation.status == "OPEN", SupportConversation.supporter_id == None)
    elif active:
        stmt = stmt.where(SupportConversation.status == "OPEN", SupportConversation.supporter_id == current_user.id)
        
    stmt = stmt.order_by(SupportConversation.updated_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/conversations/my", response_model=List[SupportConversationListResponse])
async def list_my_conversations(
    guest_id: Optional[str] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh sách các cuộc hội thoại của khách hàng hiện tại (Customer hoặc Guest).
    """
    if current_user:
        stmt = select(SupportConversation).options(
            selectinload(SupportConversation.supporter),
            selectinload(SupportConversation.messages)
        ).where(
            SupportConversation.customer_id == current_user.id
        ).order_by(SupportConversation.updated_at.desc())
    elif guest_id:
        stmt = select(SupportConversation).options(
            selectinload(SupportConversation.supporter),
            selectinload(SupportConversation.messages)
        ).where(
            SupportConversation.guest_id == guest_id
        ).order_by(SupportConversation.updated_at.desc())
    else:
        return []

    result = await db.execute(stmt)
    conversations = result.scalars().all()
    
    response_list = []
    
    # Pre-fetch all unread chat notifications for this user
    unread_chat_notifs = set()
    if current_user:
        from models.engagement import Notification
        notif_stmt = select(Notification.action_url).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
            or_(
                Notification.action_url.like('/support?session_id=%'),
                Notification.action_url.like('/chat?tab=SUPPORTER&session_id=%'),
            ),
        )
        notif_result = await db.execute(notif_stmt)
        for url in notif_result.scalars().all():
            if url:
                session_id = url.split('session_id=')[-1]
                unread_chat_notifs.add(session_id)

    for conv in conversations:
        # Sort messages by created_at ascending
        sorted_messages = sorted(conv.messages, key=lambda m: m.created_at) if conv.messages else []
        
        # Find the first message sent by the CUSTOMER to use as the title/summary
        customer_msgs = [m for m in sorted_messages if m.sender_type == "CUSTOMER"]
        if customer_msgs:
            first_msg_content = customer_msgs[0].content
            # Truncate to ~45 chars and add ellipsis if longer
            title = first_msg_content[:45] + "..." if len(first_msg_content) > 45 else first_msg_content
        else:
            title = "Yêu cầu hỗ trợ mới"
        
        has_unread = conv.id in unread_chat_notifs
        
        response_list.append({
            "id": conv.id,
            "status": conv.status,
            "customer_id": conv.customer_id,
            "guest_id": conv.guest_id,
            "supporter_id": conv.supporter_id,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "supporter": conv.supporter,
            "last_message": title,
            "has_unread": has_unread
        })
        
    return response_list


@router.get("/conversations/{conversation_id}", response_model=SupportConversationResponse)
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SupportConversation).options(
        selectinload(SupportConversation.customer),
        selectinload(SupportConversation.supporter),
        selectinload(SupportConversation.messages)
    ).where(SupportConversation.id == conversation_id)
    result = await db.execute(stmt)
    conversation = result.scalars().first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Không tìm thấy hội thoại")
    return conversation


@router.post("/conversations/{conversation_id}/join")
async def join_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from repositories.user_role_repository import get_role_list_by_user_id
    user_roles = await get_role_list_by_user_id(current_user.id, db)
    if not any(role in user_roles for role in ["ADMIN", "MANAGER", "SUPPORTER"]):
        raise HTTPException(status_code=403, detail="Không có quyền truy cập")

    stmt = select(SupportConversation).where(SupportConversation.id == conversation_id)
    result = await db.execute(stmt)
    conversation = result.scalars().first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Không tìm thấy hội thoại")
    
    if conversation.supporter_id:
        if conversation.supporter_id != current_user.id:
            raise HTTPException(status_code=400, detail="Hội thoại này đã được nhận bởi nhân viên khác")
    else:
        conversation.supporter_id = current_user.id
        
        # Send system message
        message = SupportMessage(
            conversation_id=conversation_id,
            sender_type="SYSTEM",
            content=f"Nhân viên {current_user.full_name} đã tham gia hỗ trợ."
        )
        db.add(message)
        from models.base import utc_now
        conversation.updated_at = utc_now()
        await db.commit()
        await db.refresh(message)
        
        ws_message = serialize_support_message(message)
        await manager.broadcast_to_conversation(conversation_id, ws_message)

        full = await _load_conversation_full(db, conversation_id)
        if full:
            await _publish_support_inbox_snapshot(db, full, queue_remove=True)
        
    return {"status": "success"}


@router.post("/conversations/{conversation_id}/close")
async def close_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SupportConversation).where(SupportConversation.id == conversation_id)
    result = await db.execute(stmt)
    conversation = result.scalars().first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Không tìm thấy hội thoại")
        
    if conversation.supporter_id and conversation.supporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Chỉ nhân viên đang hỗ trợ mới có quyền kết thúc")
        
    conversation.status = "CLOSED"
    was_in_queue = conversation.supporter_id is None
    
    message = SupportMessage(
        conversation_id=conversation_id,
        sender_type="SYSTEM",
        content="Hội thoại đã được kết thúc."
    )
    db.add(message)
    from models.base import utc_now
    conversation.updated_at = utc_now()
    await db.commit()
    await db.refresh(message)
    
    ws_message = serialize_support_message(message)
    await manager.broadcast_to_conversation(conversation_id, ws_message)

    full = await _load_conversation_full(db, conversation_id)
    if full:
        await _publish_support_inbox_snapshot(
            db, full, queue_remove=was_in_queue
        )
    
    return {"status": "success"}


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SupportMessage).where(SupportMessage.conversation_id == conversation_id).order_by(SupportMessage.created_at.asc())
    result = await db.execute(stmt)
    return [serialize_support_message(message) for message in result.scalars().all()]


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: SupportMessageSendRequest,
    guest_id: Optional[str] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Gửi tin qua HTTP — tin vẫn được broadcast qua WebSocket."""
    access = await resolve_conversation_access(
        db, conversation_id, current_user, guest_id=guest_id
    )
    if not access:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập hội thoại này")

    _conv, viewer_type = access
    msg = await handle_send_message(
        db,
        conversation_id=conversation_id,
        viewer_type=viewer_type,
        content=body.content or "",
        attachment_type=body.attachment_type,
        attachment_id=body.attachment_id,
        attachments_payload=body.attachments,
    )
    if not msg:
        raise HTTPException(
            status_code=400,
            detail="Nội dung tin nhắn hoặc tệp đính kèm không hợp lệ",
        )
    return msg


@router.websocket("/ws")
async def multiplex_websocket(
    websocket: WebSocket,
    guest_id: Optional[str] = Query(None),
    as_customer: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """
    Unified multiplex WebSocket: inbox + one active conversation on a single connection.
    """
    user = await _authenticate_websocket(websocket, db)
    if not user and not guest_id:
        await websocket.close(code=4401)
        return

    inbox_ctx = await resolve_inbox_context(db, user, guest_id, as_customer=as_customer)
    if not inbox_ctx:
        await websocket.close(code=4403)
        return

    active_conversation_id: Optional[str] = None
    active_conversation_viewer_type: Optional[str] = None

    await db.commit()
    for channel in inbox_ctx["inbox_channels"]:
        await manager.connect(websocket, channel)

    try:
        await send_inbox_bootstrap(
            websocket,
            db,
            viewer_type=inbox_ctx["viewer_type"],
            customer_id=inbox_ctx.get("customer_id"),
            guest_id=inbox_ctx.get("guest_id"),
            count_unread_fn=_count_unread_support_conversations,
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
                logger.error(f"Support multiplex command failed: {command_error}")
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
                    break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"Support multiplex WebSocket error: {e}")
    finally:
        await cleanup_multiplex_connection(
            websocket,
            active_conversation_id=active_conversation_id,
            active_conversation_viewer_type=active_conversation_viewer_type,
        )
