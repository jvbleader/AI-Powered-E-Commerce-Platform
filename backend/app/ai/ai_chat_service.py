import json
from typing import AsyncGenerator, Dict, Any, List
from .ai_config import ai_settings

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

def get_llm(streaming: bool = False):
    return ChatOpenAI(
        openai_api_base=ai_settings.OPENROUTER_BASE_URL,
        openai_api_key=ai_settings.OPENROUTER_API_KEY,
        model_name=ai_settings.OPENROUTER_MODEL,
        streaming=streaming,
    )

def prepare_messages(message: str, history: List[Dict[str, str]] = None):
    if history is None:
        history = []
        
    messages = [
        SystemMessage(content="Bạn là trợ lý AI của Shepoo — nền tảng thương mại điện tử. Hãy hỗ trợ khách hàng tìm sản phẩm, giải đáp thắc mắc về đơn hàng, và tư vấn mua sắm một cách ngắn gọn, súc tích và thân thiện. Chỉ trả lời dựa trên các kiến thức về shepoo mà bạn được tiếp cận, nếu bạn không có kiến thức về vấn đề nào, từ chối trả lời nó!")
    ]
    
    for h in history:
        role = h.get("role")
        content = h.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))
            
    messages.append(HumanMessage(content=message))
    return messages

async def send_chat_message(message: str, history: List[Dict[str, str]] = None) -> Dict[str, Any]:
    llm = get_llm(streaming=False)
    messages = prepare_messages(message, history)
    
    response = await llm.ainvoke(messages)
    
    return {
        "reply": response.content,
        "model": ai_settings.OPENROUTER_MODEL
    }

async def stream_chat_message(message: str, history: List[Dict[str, str]] = None) -> AsyncGenerator[str, None]:
    llm = get_llm(streaming=True)
    messages = prepare_messages(message, history)
    
    async for chunk in llm.astream(messages):
        if chunk.content:
            yield f"data: {json.dumps({'content': chunk.content, 'done': False})}\n\n"
            
    yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"
