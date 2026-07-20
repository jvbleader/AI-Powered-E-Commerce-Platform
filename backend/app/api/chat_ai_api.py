from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
import httpx
import logging

from dependencies.auth import get_current_user_optional
from models.user import User
from ai.ai_chat_service import send_chat_message, stream_chat_message

router = APIRouter(prefix="/ai/chat", tags=["AI Chat"])
logger = logging.getLogger(__name__)

class MessageHistoryItem(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[MessageHistoryItem]] = None

@router.post("", summary="Send message to AI assistant")
async def chat_with_ai(
    request: ChatRequest,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    try:
        history_dicts = [item.model_dump() for item in request.history] if request.history else []
        response = await send_chat_message(request.message, history_dicts)
        return response
    except httpx.HTTPStatusError as e:
        logger.error(f"OpenRouter API error: {e.response.text}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Error communicating with AI service"
        )
    except Exception as e:
        logger.error(f"Unexpected error in AI chat: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )

@router.post("/stream", summary="Stream message from AI assistant")
async def stream_chat_with_ai(
    request: ChatRequest,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    history_dicts = [item.model_dump() for item in request.history] if request.history else []
    
    # Return StreamingResponse with media_type text/event-stream
    return StreamingResponse(
        stream_chat_message(request.message, history_dicts),
        media_type="text/event-stream"
    )
