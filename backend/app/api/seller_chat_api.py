import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from datetime import datetime
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dependencies.auth import get_current_user_optional, get_current_user
from core.database import get_db
from models.seller_chat import SellerConversation, SellerMessage
from models.user import User
from models.seller_profile import SellerProfile
from services.websocket_manager import manager
from models.base import utc_now

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
    shop_name: Optional[str]
    shop_avatar: Optional[str]
    customer_name: Optional[str]
    customer_avatar: Optional[str]

    class Config:
        from_attributes = True

@router.post("/conversations", response_model=SellerConversationResponse)
async def get_or_create_conversation(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Tạo hoặc lấy hội thoại giữa khách hàng hiện tại và shop.
    """
    stmt = select(SellerConversation).where(
        SellerConversation.customer_id == current_user.id,
        SellerConversation.shop_id == shop_id,
        SellerConversation.status == "OPEN",
    )
    result = await db.execute(stmt)
    conversation = result.scalars().first()

    if not conversation:
        conversation = SellerConversation(
            customer_id=current_user.id,
            shop_id=shop_id,
            status="OPEN",
        )
        db.add(conversation)
        await db.commit()
        
    fetch_stmt = select(SellerConversation).options(
        selectinload(SellerConversation.messages)
    ).where(SellerConversation.id == conversation.id)
    result = await db.execute(fetch_stmt)
    conversation = result.scalars().first()
        
    return conversation

@router.get("/conversations/my", response_model=List[SellerConversationListResponse])
async def list_my_conversations(
    as_seller: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh sách hội thoại của User (là customer) hoặc của Shop (nếu as_seller=True).
    """
    if as_seller:
        # Check if user has a shop
        shop_stmt = select(SellerProfile).where(SellerProfile.user_id == current_user.id)
        shop_result = await db.execute(shop_stmt)
        shop = shop_result.scalars().first()
        if not shop:
            return []
            
        stmt = select(SellerConversation).options(
            selectinload(SellerConversation.customer),
            selectinload(SellerConversation.messages)
        ).where(
            SellerConversation.shop_id == shop.id
        ).order_by(SellerConversation.updated_at.desc())
    else:
        stmt = select(SellerConversation).options(
            selectinload(SellerConversation.shop),
            selectinload(SellerConversation.messages)
        ).where(
            SellerConversation.customer_id == current_user.id
        ).order_by(SellerConversation.updated_at.desc())

    result = await db.execute(stmt)
    conversations = result.scalars().all()
    
    response_list = []
    
    current_type = "SELLER" if as_seller else "CUSTOMER"
    
    updates_to_broadcast = []
    has_updates = False
    
    for conv in conversations:
        sorted_messages = sorted(conv.messages, key=lambda m: m.created_at) if conv.messages else []
        last_msg = sorted_messages[-1].content if sorted_messages else "Chưa có tin nhắn"
        
        shop_name = conv.shop.shop_name if conv.shop else "Shop"
        shop_avatar = conv.shop.shop_logo_url if conv.shop else None
        customer_name = conv.customer.full_name if conv.customer else "Khách hàng"
        customer_avatar = conv.customer.avatar_url if conv.customer else None
        
        # Calculate has_unread and update DELIVERED status
        has_unread = False
        updated_message_ids = []
        
        for m in sorted_messages:
            if m.sender_type != current_type:
                if m.status in ["SENT", "DELIVERED"]:
                    has_unread = True
                # If the recipient is polling their list, it means the message has been delivered to their device
                if m.status == "SENT":
                    m.status = "DELIVERED"
                    updated_message_ids.append(m.id)
                    has_updates = True
                    
        if updated_message_ids:
            updates_to_broadcast.append({
                "conversation_id": conv.id,
                "message_ids": updated_message_ids
            })
        
        response_list.append({
            "id": conv.id,
            "status": conv.status,
            "customer_id": conv.customer_id,
            "shop_id": conv.shop_id,
            "created_at": conv.created_at.isoformat(),
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else conv.created_at.isoformat(),
            "last_message": last_msg[:45] + "..." if len(last_msg) > 45 else last_msg,
            "has_unread": has_unread,
            "shop_name": shop_name,
            "shop_avatar": shop_avatar,
            "customer_name": customer_name,
            "customer_avatar": customer_avatar,
        })
        
    if has_updates:
        await db.commit()
        for update in updates_to_broadcast:
            await manager.broadcast_to_conversation(update["conversation_id"], {
                "type": "STATUS_UPDATE",
                "status": "DELIVERED",
                "message_ids": update["message_ids"],
                "conversation_id": update["conversation_id"]
            })
        
    return response_list

@router.get("/conversations/{conversation_id}/messages", response_model=List[SellerMessageResponse])
async def get_messages(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SellerMessage).where(SellerMessage.conversation_id == conversation_id).order_by(SellerMessage.created_at.asc())
    result = await db.execute(stmt)
    messages = result.scalars().all()
    return [{
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_type": msg.sender_type,
        "content": msg.content,
        "attachment_type": msg.attachment_type,
        "attachment_id": msg.attachment_id,
        "reply_to_id": msg.reply_to_id,
        "status": msg.status,
        "created_at": msg.created_at.isoformat(),
    } for msg in messages]

@router.websocket("/ws/{conversation_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SellerConversation).where(SellerConversation.id == conversation_id)
    result = await db.execute(stmt)
    conversation = result.scalars().first()
    
    if not conversation:
        await websocket.close(code=4004)
        return
        
    await db.commit() # End the initial transaction so future queries see fresh data

    await manager.connect(websocket, conversation_id)
    try:
        while True:
            data_text = await websocket.receive_text()
            try:
                data = json.loads(data_text)
                
                if data.get("action") == "ping":
                    continue
                
                if data.get("action") in ["MARK_READ", "MARK_DELIVERED"]:
                    new_status = "READ" if data.get("action") == "MARK_READ" else "DELIVERED"
                    sender_type = data.get("sender_type") # CURRENT user type (CUSTOMER or SELLER)
                    target_sender_type = "SELLER" if sender_type == "CUSTOMER" else "CUSTOMER"
                    
                    await db.commit() # Ensure fresh transaction to see messages inserted by the other party
                    
                    # Update status in db for messages sent by the OTHER party that are not yet in the new status
                    # To be precise, if action=MARK_READ, we update SENT or DELIVERED to READ
                    # If action=MARK_DELIVERED, we update SENT to DELIVERED
                    stmt = select(SellerMessage).where(
                        SellerMessage.conversation_id == conversation_id,
                        SellerMessage.sender_type == target_sender_type
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
                        await manager.broadcast_to_conversation(conversation_id, {
                            "type": "STATUS_UPDATE",
                            "status": new_status,
                            "message_ids": updated_ids,
                            "conversation_id": conversation_id
                        })
                    continue
                
                content = data.get("content")
                sender_type = data.get("sender_type") # "CUSTOMER" or "SELLER"
                attachment_type = data.get("attachment_type")
                attachment_id = data.get("attachment_id")
                reply_to_id = data.get("reply_to_id")
                
                if not content or sender_type not in ["CUSTOMER", "SELLER"]:
                    continue
                
                message = SellerMessage(
                    conversation_id=conversation_id,
                    sender_type=sender_type,
                    content=content,
                    attachment_type=attachment_type,
                    attachment_id=attachment_id,
                    reply_to_id=reply_to_id,
                    status="SENT"
                )
                db.add(message)
                conversation.updated_at = utc_now()
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
                    "created_at": message.created_at.isoformat()
                }
                
                await manager.broadcast_to_conversation(conversation_id, ws_message)
                
            except json.JSONDecodeError:
                logger.error("Invalid JSON received from websocket")
    except WebSocketDisconnect:
        manager.disconnect(websocket, conversation_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, conversation_id)
