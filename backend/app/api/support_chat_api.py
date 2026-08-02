import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dependencies.auth import get_current_user_optional, get_current_user
from core.database import get_db
from models.support_chat import SupportConversation, SupportMessage
from models.user import User
from schemas.support_chat import SupportConversationResponse, SupportMessageResponse, SupportConversationListResponse
from services.websocket_manager import manager

router = APIRouter(tags=["support_chat"])
logger = logging.getLogger(__name__)


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
            guest_id=guest_id if not current_user else None,
            status="OPEN",
        )
        db.add(conversation)
        await db.commit()
        
        # Re-fetch to load relationships eagerly
        fetch_stmt = select(SupportConversation).options(
            selectinload(SupportConversation.customer),
            selectinload(SupportConversation.supporter)
        ).where(SupportConversation.id == conversation.id)
        result = await db.execute(fetch_stmt)
        conversation = result.scalars().first()
        
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
        from models.notification import Notification
        notif_stmt = select(Notification.action_url).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
            Notification.action_url.like('/chat?tab=SUPPORTER&session_id=%')
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
        
        ws_message = {
            "id": message.id,
            "conversation_id": message.conversation_id,
            "sender_type": message.sender_type,
            "content": message.content,
            "created_at": message.created_at.isoformat()
        }
        await manager.broadcast_to_conversation(conversation_id, ws_message)
        
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
    
    ws_message = {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_type": message.sender_type,
        "content": message.content,
        "created_at": message.created_at.isoformat()
    }
    await manager.broadcast_to_conversation(conversation_id, ws_message)
    
    return {"status": "success"}


@router.get("/conversations/{conversation_id}/messages", response_model=List[SupportMessageResponse])
async def get_messages(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SupportMessage).where(SupportMessage.conversation_id == conversation_id).order_by(SupportMessage.created_at.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.websocket("/ws/{conversation_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    # Xác minh conversation tồn tại
    stmt = select(SupportConversation).where(SupportConversation.id == conversation_id)
    result = await db.execute(stmt)
    conversation = result.scalars().first()
    
    if not conversation:
        await websocket.close(code=4004)
        return

    await manager.connect(websocket, conversation_id)
    try:
        while True:
            data_text = await websocket.receive_text()
            try:
                data = json.loads(data_text)
                
                # Check for presence ping
                if data.get("action") == "ping":
                    p_sender = data.get("sender_type")
                    if p_sender:
                        await manager.redis.set(f"presence:{conversation_id}:{p_sender}", "1", ex=10)
                    continue
                
                content = data.get("content")
                sender_type = data.get("sender_type") # "CUSTOMER" or "SUPPORTER"
                
                if not content or sender_type not in ["CUSTOMER", "SUPPORTER"]:
                    continue
                
                # Kiểm tra nếu cuộc gọi từ CUSTOMER mà hội thoại đang CLOSED -> Reopen
                if sender_type == "CUSTOMER" and conversation.status == "CLOSED":
                    conversation.status = "OPEN"
                    conversation.supporter_id = None
                    sys_msg = SupportMessage(
                        conversation_id=conversation_id,
                        sender_type="SYSTEM",
                        content="Khách hàng đã mở lại yêu cầu hỗ trợ."
                    )
                    db.add(sys_msg)
                    
                    # Cập nhật updated_at cho conversation
                    from models.base import utc_now
                    conversation.updated_at = utc_now()
                    await db.commit()
                    await db.refresh(sys_msg)
                    
                    sys_ws_message = {
                        "id": sys_msg.id,
                        "conversation_id": sys_msg.conversation_id,
                        "sender_type": sys_msg.sender_type,
                        "content": sys_msg.content,
                        "created_at": sys_msg.created_at.isoformat()
                    }
                    await manager.broadcast_to_conversation(conversation_id, sys_ws_message)
                
                # Lưu message vào DB
                message = SupportMessage(
                    conversation_id=conversation_id,
                    sender_type=sender_type,
                    content=content
                )
                db.add(message)
                # Cập nhật updated_at cho conversation
                from models.base import utc_now
                conversation.updated_at = utc_now()
                await db.commit()
                await db.refresh(message)
                
                # Nếu SUPPORTER nhắn, check presence của CUSTOMER
                if sender_type == "SUPPORTER" and conversation.customer_id:
                    is_online = await manager.redis.get(f"presence:{conversation_id}:CUSTOMER")
                    if not is_online:
                        # Lấy tên supporter
                        supporter_name = "Nhân viên hỗ trợ"
                        if conversation.supporter_id:
                            supporter_result = await db.execute(
                                select(User.full_name).where(User.id == conversation.supporter_id)
                            )
                            name = supporter_result.scalar_one_or_none()
                            if name:
                                supporter_name = name
                        from services.notification import send_notification
                        await send_notification(
                            db=db,
                            user_id=conversation.customer_id,
                            type="support",
                            title="Tin nhắn CSKH mới",
                            content=f"Nhân viên {supporter_name} vừa phản hồi tin nhắn của bạn.",
                            action_url=f"/chat?tab=SUPPORTER&session_id={conversation_id}"
                        )

                
                # Format tin nhắn để gửi qua websocket
                ws_message = {
                    "id": message.id,
                    "conversation_id": message.conversation_id,
                    "sender_type": message.sender_type,
                    "content": message.content,
                    "created_at": message.created_at.isoformat()
                }
                
                # Broadcast qua Redis Pub/Sub
                await manager.broadcast_to_conversation(conversation_id, ws_message)
                
            except json.JSONDecodeError:
                logger.error("Invalid JSON received from websocket")
    except WebSocketDisconnect:
        manager.disconnect(websocket, conversation_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, conversation_id)
