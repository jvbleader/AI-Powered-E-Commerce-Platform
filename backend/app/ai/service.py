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
    from langchain_openai import ChatOpenAI, AzureChatOpenAI
    from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
except ImportError:
    ChatOpenAI = AzureChatOpenAI = None
    SystemMessage = HumanMessage = AIMessage = ToolMessage = None

from ai.ai_config import ai_settings
from ai.tools import get_agent_tools

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Bạn là Trợ lý Tư vấn Mua sắm AI chuyên nghiệp của sàn TMĐT Shepoo.

NGUYÊN TẮC TƯ DUY & TƯ VẤN BẮT BUỘC:
1. Phân tích Nhu cầu & Chuyển dịch ý định (Intent Decomposition):
   - Khi người dùng hỏi bằng mục đích, vấn đề, thời tiết/mùa, sự kiện hoặc hoàn cảnh sử dụng (ví dụ: 'chuẩn bị đi cắm trại', 'hay bị đau lưng khi làm việc', 'đồ mặc mùa đông', 'nấu lẩu tại nhà', 'quà tặng cho bé'):
   - Luôn tự suy luận: "Những loại sản phẩm/vật dụng vật lý cụ thể nào trên sàn TMĐT giải quyết tốt nhất bài toán này?"
   - Sử dụng tên các loại hàng hóa/mặt hàng cụ thể đó để làm từ khóa khi gọi `search_catalog`.
2. Tự đánh giá & Tìm kiếm linh hoạt (Self-Reflection):
   - Nếu kết quả tìm kiếm lần 1 chưa đúng trọng tâm hoặc còn quá rộng, bạn có thể gọi `search_catalog` thêm lần nữa với từ khóa danh mục hoặc góc nhìn sản phẩm khác.
   - Khi tư vấn, hãy kết nối đặc tính của sản phẩm tìm được với hoàn cảnh sử dụng thực tế của khách hàng để giải thích tại sao món đồ đó phù hợp.
3. Dữ liệu thực tế & Tính trung thực:
   - CHỈ tư vấn và trích dẫn các sản phẩm THỰC TẾ thu được từ việc gọi Tools (search_catalog, get_product_details, check_inventory, recommend_similar_products).
   - TUYỆT ĐỐI KHÔNG tự bịa ra sản phẩm, giá bán, phần trăm giảm giá hoặc số lượng tồn kho.
4. Xử lý kết quả từ `search_catalog`:
   - Nếu `match_type == 'exact'`: Tự tin tư vấn và giới thiệu các sản phẩm tìm thấy phù hợp nhất với nhu cầu của khách.
   - Nếu `match_type == 'relaxed'` hoặc `match_type == 'semantic'`: Khéo léo giải thích là đã nới lỏng khoảng giá/bộ lọc để tìm mẫu tương tự tốt nhất cho khách.
   - Nếu `match_type == 'none'` hoặc `match_type == 'category_popular'`: Lịch sự thông báo sàn chưa có mẫu chính xác đó và nhiệt tình giới thiệu các sản phẩm nổi bật/bán chạy cùng ngành hàng.
5. Ghi nhớ lịch sử cuộc trò chuyện và luôn lưu giữ tất cả thông tin cá nhân khách hàng đã cung cấp (như tên, xưng hô, sở thích, nhu cầu) để xưng hô và trả lời chính xác.
6. Trình bày phản hồi ngắn gọn, thân thiện, sử dụng định dạng Markdown đẹp mắt, không in ra các tham số tìm kiếm JSON hoặc dữ liệu kỹ thuật thô.
"""


def _clean_reasoning_tags(text: Any) -> str:
    if not text:
        return ""
    content_str = str(text)
    cleaned = re.sub(r"<think>.*?</think>", "", content_str, flags=re.DOTALL)
    return cleaned.strip()


def get_llm(streaming: bool = False):
    if ai_settings.IS_AZURE:
        return AzureChatOpenAI(
            azure_endpoint=ai_settings.BASE_URL,
            azure_deployment=ai_settings.MODEL,
            api_key=ai_settings.API_KEY,
            api_version=ai_settings.API_VERSION,
            temperature=0.2,
            streaming=streaming,
            max_retries=2,
        )
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


def _filter_products_mentioned_in_reply(
    reply_text: str, collected_products: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    if not reply_text or not collected_products:
        return []

    reply_lower = reply_text.lower()

    # If the reply explicitly states that no matching products were found on the platform
    no_product_phrases = [
        "chưa tìm thấy sản phẩm",
        "không tìm thấy sản phẩm",
        "chưa có sản phẩm phù hợp",
        "chưa có sản phẩm nào",
        "chưa có mặt hàng",
        "rất tiếc sàn chưa có",
        "chưa có mẫu nào",
    ]
    if any(phrase in reply_lower for phrase in no_product_phrases) and not any(
        kw in reply_lower for kw in ["dưới đây là", "gợi ý cho bạn", "tham khảo một số", "tham khảo các", "gửi bạn một số"]
    ):
        return []

    matched = []
    for p in collected_products:
        name = (p.get("name") or "").strip().lower()
        if not name:
            continue

        # 1. Direct substring match of full name
        if name in reply_lower:
            matched.append(p)
            continue

        # 2. Match by main title segment (before delimiters like -, |, /)
        main_segment = re.split(r"[-–—|/,]", name)[0].strip()
        if len(main_segment) >= 6 and main_segment in reply_lower:
            matched.append(p)
            continue

        # 3. Match by the first 3-5 words of the product name
        words = name.split()
        if len(words) >= 3:
            first_n = " ".join(words[: min(len(words), 4)])
            if len(first_n) >= 8 and first_n in reply_lower:
                matched.append(p)
                continue

        # 4. Check if a 3-word phrase from the product name is in reply
        found_phrase = False
        for i in range(len(words) - 2):
            trigram = " ".join(words[i : i + 3])
            if len(trigram) >= 10 and trigram in reply_lower:
                matched.append(p)
                found_phrase = True
                break
        if found_phrase:
            continue

        # 5. Check slug / ID
        slug = (p.get("slug") or "").strip().lower()
        if slug and len(slug) >= 5 and slug in reply_lower:
            matched.append(p)
            continue

    return matched


def _normalize_extracted_product(item: Dict[str, Any]) -> Dict[str, Any]:
    norm = dict(item)
    variants = norm.get("variants") or []
    if ("price" not in norm or norm["price"] is None) and variants:
        prices = [
            float(v["price"])
            for v in variants
            if isinstance(v, dict) and v.get("price") is not None
        ]
        sale_prices = [
            float(v["sale_price"])
            for v in variants
            if isinstance(v, dict) and v.get("sale_price") is not None
        ]
        norm["price"] = min(prices) if prices else 0.0
        norm["sale_price"] = min(sale_prices) if sale_prices else None

    if ("stock" not in norm or norm["stock"] is None) and variants:
        norm["stock"] = sum(
            int(v.get("available_stock", 0) or 0)
            for v in variants
            if isinstance(v, dict)
        )

    images = norm.get("images") or []
    if not norm.get("thumbnail_url") and images and isinstance(images[0], str):
        norm["thumbnail_url"] = images[0]

    return norm


def _extract_products_from_tool_output(
    tool_output: str, collected_products: List[Dict[str, Any]]
) -> None:
    try:
        parsed = json.loads(tool_output)
        items = []
        if isinstance(parsed, list):
            items = parsed
        elif isinstance(parsed, dict):
            if "items" in parsed and isinstance(parsed["items"], list):
                items = parsed["items"]
            elif "id" in parsed and "name" in parsed:
                items = [parsed]

        for raw_item in items:
            if isinstance(raw_item, dict) and "id" in raw_item and "name" in raw_item:
                item = _normalize_extracted_product(raw_item)
                if not any(p.get("id") == item["id"] for p in collected_products):
                    collected_products.append(item)
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
            filtered_products = _filter_products_mentioned_in_reply(clean_reply, collected_products)
            return {
                "reply": clean_reply,
                "model": ai_settings.MODEL,
                "products": filtered_products,
            }

    last_content = _clean_reasoning_tags(messages[-1].content) if messages else ""
    filtered_products = _filter_products_mentioned_in_reply(last_content, collected_products)
    return {
        "reply": last_content,
        "model": ai_settings.MODEL,
        "products": filtered_products,
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

            filtered_products = _filter_products_mentioned_in_reply(final_text, collected_products)
            if filtered_products:
                yield f"data: {json.dumps({'type': 'products', 'items': filtered_products}, ensure_ascii=False)}\n\n"

            yield f"data: {json.dumps({'type': 'end', 'content': '', 'done': True}, ensure_ascii=False)}\n\n"
            return

    yield f"data: {json.dumps({'type': 'end', 'content': '', 'done': True}, ensure_ascii=False)}\n\n"


