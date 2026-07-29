import json
import logging
import re
import sys
from pathlib import Path
from typing import AsyncGenerator, Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

# Ensure app root is in sys.path
app_dir = Path(__file__).resolve().parent.parent
if str(app_dir) not in sys.path:
    sys.path.insert(0, str(app_dir))

try:
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
except ImportError:
    ChatOpenAI = None
    SystemMessage = HumanMessage = AIMessage = ToolMessage = None

from ai.ai_config import ai_settings
from ai.tools import get_agent_tools

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Bạn là Trợ lý Tư vấn Mua sắm AI chuyên nghiệp của sàn TMĐT Shepoo.

QUY TẮC BẮT BUỘC:
1. CHỈ tư vấn và đưa ra các sản phẩm THỰC TẾ thu được từ việc gọi các Tools (search_catalog, get_product_details, check_inventory, recommend_similar_products).
2. TUYỆT ĐỐI KHÔNG tự bịa ra sản phẩm, giá bán, phần trăm giảm giá hoặc số lượng tồn kho.
3. Nếu kết quả tìm kiếm rỗng (không có sản phẩm nào phù hợp trong hệ thống), hãy thông báo lịch sự cho khách hàng rằng hiện tại sàn chưa có sản phẩm này, và tuyệt đối KHÔNG in ra các tham số tìm kiếm hoặc dữ liệu thô.
4. Ghi nhớ lịch sử cuộc trò chuyện và luôn lưu giữ tất cả thông tin cá nhân khách hàng đã cung cấp (như tên, xưng hô, sở thích, nhu cầu) để xưng hô và trả lời chính xác.
5. Trình bày phản hồi ngắn gọn, thân thiện, sử dụng định dạng Markdown đẹp mắt.
"""


def _clean_reasoning_tags(text: Any) -> str:
    if not text:
        return ""
    content_str = str(text)
    cleaned = re.sub(r"<think>.*?</think>", "", content_str, flags=re.DOTALL)
    return cleaned.strip()


def get_llm(streaming: bool = False) -> ChatOpenAI:
    return ChatOpenAI(
        openai_api_base=ai_settings.BASE_URL,
        openai_api_key=ai_settings.API_KEY,
        model_name=ai_settings.MODEL,
        temperature=0.2,
        streaming=streaming,
        max_retries=2,
    )


def prepare_messages(
    message: str, history: Optional[List[Dict[str, str]]] = None
) -> List[Any]:
    if history is None:
        history = []

    messages: List[Any] = [SystemMessage(content=SYSTEM_PROMPT)]

    for h in history:
        role = h.get("role")
        content = _clean_reasoning_tags(h.get("content", ""))
        if not content:
            continue
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))

    messages.append(HumanMessage(content=message))
    return messages


def _extract_products_from_tool_output(
    tool_output: str, collected_products: List[Dict[str, Any]]
) -> None:
    try:
        parsed = json.loads(tool_output)
        if isinstance(parsed, list):
            for item in parsed:
                if isinstance(item, dict) and "id" in item and "name" in item:
                    if not any(p.get("id") == item["id"] for p in collected_products):
                        collected_products.append(item)
        elif isinstance(parsed, dict) and "id" in parsed and "name" in parsed:
            if not any(p.get("id") == parsed["id"] for p in collected_products):
                collected_products.append(parsed)
    except Exception:
        pass


async def send_chat_message(
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    db: Optional[AsyncSession] = None,
) -> Dict[str, Any]:
    llm = get_llm(streaming=False)
    messages = prepare_messages(message, history)

    tool_map = {}
    if db is not None:
        tools = get_agent_tools(db)
        tool_map = {t.name: t for t in tools}
        llm_with_tools = llm.bind_tools(tools)
        # llm_with_tools = llm
    else:
        llm_with_tools = llm

    collected_products: List[Dict[str, Any]] = []

    for _ in range(5):
        response = await llm_with_tools.ainvoke(messages)
        messages.append(response)

        tool_calls = getattr(response, "tool_calls", None)
        if tool_calls:
            for tool_call in tool_calls:
                tool_name = tool_call.get("name")
                tool_args = tool_call.get("args", {})
                tool_call_id = tool_call.get("id")

                if tool_name in tool_map:
                    try:
                        logger.info(f"[AI Tool Call] Executing '{tool_name}' with args: {tool_args}")
                        tool_func = tool_map[tool_name]
                        tool_output = await tool_func.ainvoke(tool_args)
                        _extract_products_from_tool_output(tool_output, collected_products)
                        logger.info(f"[AI Tool Call] Result for '{tool_name}' successfully received")
                    except Exception as err:
                        logger.error(f"Error executing tool {tool_name}: {err}")
                        tool_output = json.dumps({"error": str(err)}, ensure_ascii=False)
                else:
                    tool_output = json.dumps(
                        {"error": f"Tool {tool_name} not found"}, ensure_ascii=False
                    )

                messages.append(
                    ToolMessage(content=str(tool_output), tool_call_id=tool_call_id)
                )
        else:
            clean_reply = _clean_reasoning_tags(response.content)
            return {
                "reply": clean_reply,
                "model": ai_settings.MODEL,
                "products": collected_products,
            }

    last_content = _clean_reasoning_tags(messages[-1].content) if messages else ""
    return {
        "reply": last_content,
        "model": ai_settings.MODEL,
        "products": collected_products,
    }


async def stream_chat_message(
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    db: Optional[AsyncSession] = None,
) -> AsyncGenerator[str, None]:
    llm = get_llm(streaming=True)
    messages = prepare_messages(message, history)

    tool_map = {}
    if db is not None:
        tools = get_agent_tools(db)
        tool_map = {t.name: t for t in tools}
        llm_with_tools = llm.bind_tools(tools)
        # llm_with_tools = llm
    else:
        llm_with_tools = llm

    collected_products: List[Dict[str, Any]] = []

    for _ in range(5):
        try:
            response = await llm_with_tools.ainvoke(messages)
        except Exception as err:
            logger.error(f"Error calling LLM in stream_chat_message: {err}")
            err_msg = f"Sự cố phản hồi dịch vụ AI: {str(err)}"
            yield f"data: {json.dumps({'type': 'error', 'message': err_msg}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'end', 'content': '', 'done': True}, ensure_ascii=False)}\n\n"
            return

        tool_calls = getattr(response, "tool_calls", None)
        if tool_calls:
            messages.append(response)
            yield f"data: {json.dumps({'type': 'status', 'content': 'Đang tìm kiếm thông tin sản phẩm...'}, ensure_ascii=False)}\n\n"

            for tool_call in tool_calls:
                tool_name = tool_call.get("name")
                tool_args = tool_call.get("args", {})
                tool_call_id = tool_call.get("id")

                if tool_name in tool_map:
                    try:
                        logger.info(f"[AI Tool Call] Executing '{tool_name}' with args: {tool_args}")
                        tool_func = tool_map[tool_name]
                        tool_output = await tool_func.ainvoke(tool_args)
                        _extract_products_from_tool_output(tool_output, collected_products)
                        logger.info(f"[AI Tool Call] Result for '{tool_name}' successfully received")
                    except Exception as err:
                        logger.error(f"Error executing tool {tool_name}: {err}")
                        tool_output = json.dumps({"error": str(err)}, ensure_ascii=False)
                else:
                    tool_output = json.dumps(
                        {"error": f"Tool {tool_name} not found"}, ensure_ascii=False
                    )

                messages.append(
                    ToolMessage(content=str(tool_output), tool_call_id=tool_call_id)
                )
        else:
            # Final text streaming from ainvoke response content (no extra LLM API call)
            raw_content = response.content
            if isinstance(raw_content, list):
                final_text = "".join(
                    [
                        str(item.get("text", item)) if isinstance(item, dict) else str(item)
                        for item in raw_content
                    ]
                )
            else:
                final_text = str(raw_content) if raw_content else ""

            final_text = _clean_reasoning_tags(final_text)

            if final_text:
                chunk_size = 12
                for i in range(0, len(final_text), chunk_size):
                    sub_chunk = final_text[i:i + chunk_size]
                    yield f"data: {json.dumps({'type': 'text', 'content': sub_chunk, 'done': False}, ensure_ascii=False)}\n\n"

            if collected_products:
                yield f"data: {json.dumps({'type': 'products', 'items': collected_products}, ensure_ascii=False)}\n\n"

            yield f"data: {json.dumps({'type': 'end', 'content': '', 'done': True}, ensure_ascii=False)}\n\n"
            return

    yield f"data: {json.dumps({'type': 'end', 'content': '', 'done': True}, ensure_ascii=False)}\n\n"


