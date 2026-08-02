from typing import List, Dict, Optional, Any
import json
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies.auth import CurrentUserOptional
from core.database import get_db, AsyncSessionLocal
from models.user import User
from ai.ai_chat_service import (
    send_chat_message,
    stream_chat_message,
)
import repositories.chat_repository as chat_repository
import repositories.review_repository as review_repository
from schemas.chat_schema import (
    SendMessageRequest,
    ChatMessageResponse,
    ChatHistoryResponse,
    ChatSessionListResponse,
    ChatSessionSummaryResponse,
)

router = APIRouter(prefix="/ai", tags=["AI Chat"])
logger = logging.getLogger(__name__)


class MessageHistoryItem(dict):
    pass


class LegacyChatRequest(SendMessageRequest):
    history: Optional[List[Dict[str, str]]] = None


@router.post("/chat/message", summary="Send message to AI assistant (SSE streaming with session & message persistence)")
async def stream_chat_message_endpoint(
    request: SendMessageRequest,
    current_user: CurrentUserOptional = None,
    db: AsyncSession = Depends(get_db),
):
    try:
        user_id = current_user.id if current_user else None

        if user_id:
            session = await chat_repository.get_or_create_session(
                session_id=request.session_id,
                user_id=user_id,
                session_token=request.session_token,
                db=db,
            )

            # Persist user message for logged-in user
            await chat_repository.add_chat_message(
                session_id=session.id,
                role="user",
                content=request.message,
                db=db,
            )
            await db.commit()

            # Fetch history records for LLM context
            history_records = await chat_repository.get_chat_history(
                session_id=session.id, limit=20, db=db
            )
            # Exclude the user message we just inserted from history dicts passed to stream_chat_message
            history_dicts = (
                [
                    {"role": msg.role, "content": msg.content}
                    for msg in history_records[:-1]
                ]
                if len(history_records) > 1
                else []
            )
            session_id_str = str(session.id)
        else:
            # Guest mode: DO NOT persist session or messages to DB
            session_id_str = request.session_id or "guest"
            history_dicts = request.history if request.history else []

        async def sse_generator():
            full_text = ""
            collected_products: List[Dict[str, Any]] = []

            try:
                async for chunk in stream_chat_message(
                    request.message, history=history_dicts, db=db
                ):
                    if chunk.startswith("data: "):
                        try:
                            raw_data = chunk[6:].strip()
                            payload = json.loads(raw_data)
                            evt_type = payload.get("type")
                            if evt_type == "text":
                                full_text += payload.get("content", "")
                            elif evt_type == "products":
                                collected_products = payload.get("items", [])
                        except Exception:
                            pass
                    yield chunk
            except Exception as err:
                logger.error(f"Error in SSE generator stream: {err}")
                yield f"data: {json.dumps({'type': 'error', 'message': f'Lỗi kết nối stream AI: {str(err)}'}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'end', 'content': '', 'done': True}, ensure_ascii=False)}\n\n"

            # Persist assistant response after streaming completes ONLY for logged-in users
            if user_id:
                try:
                    metadata_info = {"products": collected_products} if collected_products else None
                    async with AsyncSessionLocal() as save_db:
                        await chat_repository.add_chat_message(
                            session_id=session_id_str,
                            role="assistant",
                            content=full_text,
                            metadata_info=metadata_info,
                            db=save_db,
                        )
                        await save_db.commit()
                except Exception as err:
                    logger.error(f"Error persisting assistant chat message: {err}")

        headers = {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Session-ID": session_id_str,
        }

        return StreamingResponse(
            sse_generator(),
            media_type="text/event-stream",
            headers=headers,
        )

    except Exception as e:
        logger.error(f"Error in stream_chat_message_endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing chat message",
        )


@router.get("/chat/history", response_model=ChatHistoryResponse, summary="Get chat session message history")
async def get_chat_history_endpoint(
    session_id: Optional[str] = Query(None, description="Chat session UUID"),
    limit: int = Query(50, ge=1, le=200, description="Max messages to return"),
    current_user: CurrentUserOptional = None,
    db: AsyncSession = Depends(get_db),
):
    if not current_user:
        # Guests do not have saved chat history on DB
        return ChatHistoryResponse(session_id=session_id or "guest", messages=[])

    session = None
    if session_id:
        session = await chat_repository.get_session_by_id(session_id, db=db)

    if not session and current_user and not session_id:
        sessions = await chat_repository.list_user_sessions(user_id=current_user.id, limit=1, db=db)
        if sessions:
            session = sessions[0]

    if not session:
        return ChatHistoryResponse(session_id=session_id or "guest", messages=[])

    messages = await chat_repository.get_chat_history(session_id=session.id, limit=limit, db=db)
    formatted_messages = [
        ChatMessageResponse.model_validate(msg) for msg in messages
    ]
    return ChatHistoryResponse(session_id=session.id, messages=formatted_messages)

@router.get("/chat/sessions", response_model=ChatSessionListResponse, summary="Get list of AI chat sessions")
async def get_chat_sessions(
    limit: int = Query(20, ge=1, le=50),
    current_user: CurrentUserOptional = None,
    db: AsyncSession = Depends(get_db),
):
    if not current_user:
        return ChatSessionListResponse(sessions=[])
    
    sessions = await chat_repository.list_user_sessions_with_first_message(user_id=current_user.id, limit=limit, db=db)
    
    summary_list = []
    for s in sessions:
        title = "Đoạn chat mới"
        if s.messages:
            title = s.messages[0].content[:50]
            if len(s.messages[0].content) > 50:
                title += "..."
                
        summary_list.append(ChatSessionSummaryResponse(
            session_id=s.id,
            title=title,
            created_at=s.created_at,
            updated_at=s.updated_at or s.created_at
        ))
        
    return ChatSessionListResponse(sessions=summary_list)




# Backward Compatibility Endpoints

@router.post("/chat", summary="Send message to AI assistant (non-streaming)")
async def chat_with_ai(
    request: LegacyChatRequest,
    current_user: CurrentUserOptional = None,
    db: AsyncSession = Depends(get_db),
):
    try:
        history_dicts = request.history if request.history else []
        response = await send_chat_message(request.message, history_dicts, db=db)
        return response
    except httpx.HTTPStatusError as e:
        logger.error(f"AI Service API error: {e.response.text}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Error communicating with AI service",
        )
    except Exception as e:
        logger.error(f"Unexpected error in AI chat: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred",
        )


@router.post("/chat/stream", summary="Stream message from AI assistant (legacy)")
async def stream_chat_with_ai(
    request: LegacyChatRequest,
    current_user: CurrentUserOptional = None,
    db: AsyncSession = Depends(get_db),
):
    history_dicts = request.history if request.history else []
    return StreamingResponse(
        stream_chat_message(request.message, history_dicts, db=db),
        media_type="text/event-stream",
    )
