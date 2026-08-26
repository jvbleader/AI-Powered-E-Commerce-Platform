import asyncio
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

SYSTEM_PROMPT = """Bạn là Trợ lý Tư vấn Mua sắm & Chăm sóc Khách hàng AI chuyên nghiệp của sàn TMĐT Shepoo.

NGUYÊN TẮC TƯ DUY & TƯ VẤN BẮT BUỘC:
1. Phân tích Nhu cầu & Chuyển dịch ý định (Intent Decomposition):
   - Khi người dùng hỏi bằng mục đích, vấn đề, thời tiết/mùa, sự kiện hoặc hoàn cảnh sử dụng (ví dụ: 'chuẩn bị đi cắm trại', 'hay bị đau lưng khi làm việc', 'đồ mặc mùa đông', 'nấu lẩu tại nhà', 'quà tặng cho bé'):
   - Luôn tự suy luận: "Những loại sản phẩm/vật dụng vật lý cụ thể nào trên sàn TMĐT giải quyết tốt nhất bài toán này?"
   - Sử dụng tên các loại hàng hóa/mặt hàng cụ thể đó để làm từ khóa khi gọi `search_catalog`.
2. Tự đánh giá & Tìm kiếm linh hoạt (Self-Reflection & Parameter Constraints):
   - TUÂN THỦ NGÂN SÁCH: Khi người dùng đưa ra giới hạn ngân sách (ví dụ: 'dưới 200k', 'từ 500k đến 1 triệu', 'tầm 100k'), BẮT BUỘC truyền đúng `max_price` hoặc `min_price` tương ứng vào `search_catalog`. Tuyệt đối không tự ý tăng ngân sách hoặc bỏ qua `max_price`.
   - THẬN TRỌNG VỚI DANH MỤC: Chỉ truyền tham số `category` khi người dùng nêu rõ hoặc khi loại sản phẩm chắc chắn 100% thuộc ngành hàng đó. Nếu không chắc chắn, hãy để `category=None` để tìm kiếm tự do theo `query`.
   - Nếu kết quả tìm kiếm lần 1 chưa đúng trọng tâm hoặc còn quá rộng, bạn có thể gọi `search_catalog` thêm lần nữa với từ khóa danh mục hoặc góc nhìn sản phẩm khác.
   - Khi tư vấn, hãy kết nối đặc tính của sản phẩm tìm được với hoàn cảnh sử dụng thực tế của khách hàng để giải thích tại sao món đồ đó phù hợp.
3. Dữ liệu thực tế & Tính trung thực:
   - CHỈ tư vấn và trích dẫn các sản phẩm THỰC TẾ thu được từ việc gọi Tools (search_catalog, get_product_details, check_inventory, recommend_similar_products).
   - TUYỆT ĐỐI KHÔNG tự bịa ra sản phẩm, giá bán, phần trăm giảm giá hoặc số lượng tồn kho.
4. Xử lý kết quả từ `search_catalog`:
   - Nếu `match_type == 'exact'`: Tự tin tư vấn và giới thiệu các sản phẩm tìm thấy phù hợp nhất với nhu cầu và ngân sách của khách.
   - Nếu `match_type == 'relaxed'` hoặc `match_type == 'semantic'`: Khéo léo giải thích là đã nới lỏng khoảng giá/bộ lọc để tìm mẫu tương tự tốt nhất cho khách tham khảo.
   - Nếu `match_type == 'none'` hoặc `match_type == 'category_popular'`: Lịch sự thông báo sàn chưa có mẫu chính xác trong khoảng giá/yêu cầu đó và nhiệt tình giới thiệu các sản phẩm nổi bật/bán chạy cùng ngành hàng để khách tham khảo.
5. Quy định, Chính sách & Hỗ trợ khách hàng (Policy & Support RAG):
   - Khi khách hàng hỏi về quy định, chính sách, đổi trả, hoàn tiền, bảo hành, phí ship, phương thức thanh toán, khiếu nại hoặc tranh chấp: Bắt buộc gọi `lookup_policy_and_support`.
   - Khi khách hàng hỏi về một đơn hàng cụ thể hoặc sự cố đơn hàng (hàng hỏng, giao chậm, muốn trả hàng): Bắt buộc gọi `get_user_order_context` kết hợp `lookup_policy_and_support` để đối chiếu thực tế đơn hàng với quy định sàn.
   - Nếu đơn hàng ĐÃ CÓ yêu cầu đổi trả đang xử lý (`has_return_request == true` hoặc có `return_status` như `REQUESTED`, `SELLER_APPROVED`, `RETURNING`, `DISPUTED`, v.v.): Hãy thông báo rõ cho khách biết đơn hàng đã có yêu cầu đổi trả đang được xử lý ở trạng thái hiện tại (ví dụ: Chờ người bán duyệt, Đang vận chuyển trả hàng, Đang khiếu nại), tuyệt đối không hướng dẫn gửi thêm yêu cầu mới mà hướng dẫn theo dõi tiến độ.
   - Tuyệt đối trung thực, trích dẫn chính xác nguồn chính sách và thông tin đơn hàng thực tế, không tự hứa hẹn hay phỏng đoán ngoài chính sách.
6. Ghi nhớ lịch sử cuộc trò chuyện và luôn lưu giữ tất cả thông tin cá nhân khách hàng đã cung cấp (như tên, xưng hô, sở thích, nhu cầu) để xưng hô và trả lời chính xác.
7. Trình bày phản hồi ngắn gọn, thân thiện, sử dụng định dạng Markdown đẹp mắt, không in ra các tham số tìm kiếm JSON hoặc dữ liệu kỹ thuật thô.
"""


def _clean_reasoning_tags(text: Any) -> str:
    if not text:
        return ""
    content_str = str(text)
    cleaned = re.sub(r"<think>.*?</think>", "", content_str, flags=re.DOTALL)
    return cleaned.strip()


class StreamingReasoningFilter:
    """Loại bỏ thẻ <think>...</think> khi stream token từ các reasoning models."""

    def __init__(self):
        self.in_think = False
        self.buffer = ""

    def process_chunk(self, chunk_text: str) -> str:
        if not chunk_text:
            return ""
        self.buffer += chunk_text

        output = ""
        while self.buffer:
            if not self.in_think:
                if "<think>" in self.buffer:
                    prefix, _, rest = self.buffer.partition("<think>")
                    output += prefix
                    self.buffer = rest
                    self.in_think = True
                elif "<" in self.buffer and not any(tag in self.buffer for tag in ["<think>", "</think>"]):
                    # Giữ lại buffer nếu nghi ngờ bắt đầu thẻ <think>
                    break
                else:
                    output += self.buffer
                    self.buffer = ""
            else:
                if "</think>" in self.buffer:
                    _, _, rest = self.buffer.partition("</think>")
                    self.buffer = rest
                    self.in_think = False
                else:
                    self.buffer = ""
                    break
        return output

    def flush(self) -> str:
        if not self.in_think and self.buffer:
            res = self.buffer
            self.buffer = ""
            return res
        return ""


def get_llm(streaming: bool = False):
    if ai_settings.IS_AZURE:
        return AzureChatOpenAI(
            azure_endpoint=ai_settings.BASE_URL,
            azure_deployment=ai_settings.MODEL,
            api_key=ai_settings.API_KEY,
            api_version=ai_settings.API_VERSION,
            temperature=0.0,
            streaming=streaming,
            max_retries=2,
        )
    return ChatOpenAI(
        openai_api_base=ai_settings.BASE_URL,
        openai_api_key=ai_settings.API_KEY,
        model_name=ai_settings.MODEL,
        temperature=0.0,
        streaming=streaming,
        max_retries=2,
    )


def prepare_messages(
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    current_user_id: Optional[int] = None,
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


def _is_same_product(p1: Dict[str, Any], p2: Dict[str, Any]) -> bool:
    """Check if two product dictionaries refer to the exact same product."""
    if not isinstance(p1, dict) or not isinstance(p2, dict):
        return False

    # 1. Match by primary ID (UUID or numeric ID string)
    id1 = str(p1.get("id") or "").strip()
    id2 = str(p2.get("id") or "").strip()
    if id1 and id2 and id1 == id2:
        return True

    # 2. Match by db_id
    db_id1 = p1.get("db_id")
    db_id2 = p2.get("db_id")
    if db_id1 is not None and db_id2 is not None and str(db_id1) == str(db_id2):
        return True

    # 3. Cross match: id vs db_id
    if db_id1 is not None and id2 and str(db_id1) == id2:
        return True
    if db_id2 is not None and id1 and str(db_id2) == id1:
        return True

    # 4. Match by slug (unique per product)
    slug1 = (p1.get("slug") or "").strip().lower()
    slug2 = (p2.get("slug") or "").strip().lower()
    if slug1 and slug2 and slug1 == slug2:
        return True

    # 5. Match by exact product name (case-insensitive)
    name1 = (p1.get("name") or "").strip().lower()
    name2 = (p2.get("name") or "").strip().lower()
    if name1 and name2 and name1 == name2:
        return True

    return False


def _filter_products_mentioned_in_reply(
    reply: str, collected_products: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    if not reply or not collected_products:
        return []

    reply_lower = reply.lower()
    matched = []

    for p in collected_products:
        name = (p.get("name") or "").strip().lower()
        if not name:
            continue

        is_match = False
        # 1. Direct substring match of full name
        if name in reply_lower:
            is_match = True
        else:
            # 2. Match by main title segment (before delimiters like -, |, /, [, ], (, ))
            main_segment = re.split(r"[-–—|/,\(\)\[\]]", name)[0].strip()
            if len(main_segment) >= 5 and main_segment in reply_lower:
                is_match = True
            else:
                # 3. Match by the first 3-5 words of the product name
                words = name.split()
                if len(words) >= 2:
                    first_n = " ".join(words[: min(len(words), 4)])
                    if len(first_n) >= 5 and first_n in reply_lower:
                        is_match = True
                if not is_match:
                    # 4. Check if a 3-word phrase from the product name is in reply
                    for i in range(len(words) - 2):
                        trigram = " ".join(words[i : i + 3])
                        if len(trigram) >= 8 and trigram in reply_lower:
                            is_match = True
                            break
                if not is_match:
                    # 5. Check slug
                    slug = (p.get("slug") or "").strip().lower()
                    if slug and len(slug) >= 5 and slug in reply_lower:
                        is_match = True

        # 6. Match by prominent brand name if brand is in reply and product type matches
        if not is_match and p.get("brand"):
            brand_l = str(p["brand"]).strip().lower()
            if len(brand_l) >= 3 and brand_l in reply_lower:
                # If any significant word in product name (length >= 3) is in reply
                if any(w in reply_lower for w in name.split() if len(w) >= 3):
                    is_match = True

        if is_match and not any(_is_same_product(m, p) for m in matched):
            matched.append(p)

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
            elif ("id" in parsed or "db_id" in parsed) and "name" in parsed:
                items = [parsed]

        for raw_item in items:
            if isinstance(raw_item, dict) and ("id" in raw_item or "db_id" in raw_item) and "name" in raw_item:
                item = _normalize_extracted_product(raw_item)
                existing_idx = next(
                    (idx for idx, p in enumerate(collected_products) if _is_same_product(p, item)),
                    None,
                )
                if existing_idx is not None:
                    # Merge info: keep richer details
                    existing = collected_products[existing_idx]
                    for key, val in item.items():
                        if val is not None and (existing.get(key) is None or existing.get(key) == "" or (key == "variants" and val)):
                            existing[key] = val
                else:
                    collected_products.append(item)
    except Exception:
        pass


def _extract_citations_from_tool_output(
    tool_output: str, collected_citations: List[Dict[str, Any]]
) -> None:
    try:
        parsed = json.loads(tool_output)
        if isinstance(parsed, dict) and "citations" in parsed and isinstance(parsed["citations"], list):
            for cit in parsed["citations"]:
                if isinstance(cit, dict):
                    article_key = str(cit.get("article_id") or cit.get("article_public_id") or cit.get("title") or "")
                    sec_key = str(cit.get("section_title") or "")
                    page_num = int(cit.get("page_number") or 1)
                    dedup_key = (article_key, sec_key, page_num)
                    existing_keys = {
                        (
                            str(c.get("article_id") or c.get("article_public_id") or c.get("title") or ""),
                            str(c.get("section_title") or ""),
                            int(c.get("page_number") or 1),
                        )
                        for c in collected_citations
                    }
                    if dedup_key not in existing_keys:
                        collected_citations.append(cit)
    except Exception:
        pass


def _extract_order_context_from_tool_output(tool_output: str) -> Optional[Any]:
    try:
        parsed = json.loads(tool_output)
        if isinstance(parsed, dict):
            if "orders" in parsed:
                return parsed["orders"]
            return parsed
        elif isinstance(parsed, list):
            return parsed
    except Exception:
        pass
    return None


async def send_chat_message(
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    db: Optional[AsyncSession] = None,
    current_user_id: Optional[int] = None,
) -> Dict[str, Any]:
    llm = get_llm(streaming=False)
    messages = prepare_messages(message, history, current_user_id=current_user_id)

    tool_map = {}
    if db is not None:
        tools = get_agent_tools(db, current_user_id=current_user_id)
        tool_map = {t.name: t for t in tools}
        llm_with_tools = llm.bind_tools(tools)
    else:
        llm_with_tools = llm

    collected_products: List[Dict[str, Any]] = []
    collected_citations: List[Dict[str, Any]] = []
    collected_order_context: Optional[Any] = None

    for _ in range(5):
        response = None
        for retry_attempt in range(3):
            try:
                response = await llm_with_tools.ainvoke(messages)
                break
            except Exception as err:
                err_str = str(err).lower()
                is_rate_limit = (
                    "429" in err_str
                    or "rate limit" in err_str
                    or "quota" in err_str
                    or "tpm" in err_str
                    or "rpm" in err_str
                    or "resource_exhausted" in err_str
                )
                if is_rate_limit and retry_attempt < 2:
                    wait_seconds = 5.0 * (retry_attempt + 1)
                    match = re.search(r"try again in (\d+(\.\d+)?)s", err_str)
                    if match:
                        try:
                            wait_seconds = max(wait_seconds, float(match.group(1)) + 1.0)
                        except Exception:
                            pass
                    logger.warning(f"Rate limit hit in send_chat_message, waiting {wait_seconds:.1f}s before retry {retry_attempt + 1}...")
                    await asyncio.sleep(wait_seconds)
                else:
                    raise err

        if response is None:
            break

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
                        _extract_citations_from_tool_output(tool_output, collected_citations)
                        extracted_order = _extract_order_context_from_tool_output(tool_output)
                        if extracted_order is not None and tool_name == "get_user_order_context":
                            collected_order_context = extracted_order
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
                "citations": collected_citations,
                "order_context": collected_order_context,
            }

    last_content = _clean_reasoning_tags(messages[-1].content) if messages else ""
    filtered_products = _filter_products_mentioned_in_reply(last_content, collected_products)
    return {
        "reply": last_content,
        "model": ai_settings.MODEL,
        "products": filtered_products,
        "citations": collected_citations,
        "order_context": collected_order_context,
    }


async def stream_chat_message(
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    db: Optional[AsyncSession] = None,
    current_user_id: Optional[int] = None,
) -> AsyncGenerator[str, None]:
    llm = get_llm(streaming=True)
    messages = prepare_messages(message, history, current_user_id=current_user_id)

    tool_map = {}
    if db is not None:
        tools = get_agent_tools(db, current_user_id=current_user_id)
        tool_map = {t.name: t for t in tools}
        llm_with_tools = llm.bind_tools(tools)
    else:
        llm_with_tools = llm

    collected_products: List[Dict[str, Any]] = []
    collected_citations: List[Dict[str, Any]] = []
    collected_order_context: Optional[Any] = None
    full_generated_text = ""

    for _ in range(5):
        stream_success = False
        last_exception = None
        accumulated_chunk = None
        current_turn_text = ""

        for retry_attempt in range(3):
            accumulated_chunk = None
            tag_filter = StreamingReasoningFilter()
            current_turn_text = ""
            try:
                async for chunk in llm_with_tools.astream(messages):
                    accumulated_chunk = (
                        chunk if accumulated_chunk is None else accumulated_chunk + chunk
                    )

                    # Nếu chunk chứa content text và chưa phát sinh tool call
                    if chunk.content and not getattr(accumulated_chunk, "tool_calls", None):
                        raw_text = str(chunk.content) if isinstance(chunk.content, str) else ""
                        clean_chunk = tag_filter.process_chunk(raw_text)
                        if clean_chunk:
                            current_turn_text += clean_chunk
                            yield f"data: {json.dumps({'type': 'text', 'content': clean_chunk, 'done': False}, ensure_ascii=False)}\n\n"

                # Flush nốt phần buffer text còn lại nếu có
                remaining_text = tag_filter.flush()
                if remaining_text:
                    current_turn_text += remaining_text
                    yield f"data: {json.dumps({'type': 'text', 'content': remaining_text, 'done': False}, ensure_ascii=False)}\n\n"

                stream_success = True
                break
            except Exception as err:
                last_exception = err
                err_str = str(err).lower()
                is_rate_limit = (
                    "429" in err_str
                    or "rate limit" in err_str
                    or "quota" in err_str
                    or "tpm" in err_str
                    or "rpm" in err_str
                    or "resource_exhausted" in err_str
                )

                if is_rate_limit and retry_attempt < 2:
                    wait_seconds = 5.0 * (retry_attempt + 1)
                    match = re.search(r"try again in (\d+(\.\d+)?)s", err_str)
                    if match:
                        try:
                            wait_seconds = min(max(float(match.group(1)) + 1.0, 2.0), 25.0)
                        except Exception:
                            pass
                    logger.warning(
                        f"[AI Rate Limit] Bị giới hạn hạn mức API (lần {retry_attempt + 1}/3). Đang tự động đợi {wait_seconds:.1f}s trước khi thử lại ngầm..."
                    )
                    await asyncio.sleep(wait_seconds)
                else:
                    logger.error(f"Error streaming from LLM in stream_chat_message: {err}")
                    break

        if not stream_success:
            err_msg = f"Sự cố phản hồi dịch vụ AI: {str(last_exception)}"
            yield f"data: {json.dumps({'type': 'error', 'message': err_msg}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'end', 'content': '', 'done': True}, ensure_ascii=False)}\n\n"
            return

        tool_calls = getattr(accumulated_chunk, "tool_calls", None) if accumulated_chunk else None

        if tool_calls:
            messages.append(accumulated_chunk)

            for tool_call in tool_calls:
                tool_name = tool_call.get("name")
                tool_args = tool_call.get("args", {})
                tool_call_id = tool_call.get("id")

                if tool_name == "lookup_policy_and_support":
                    status_content = "Đang tra cứu chính sách sàn..."
                elif tool_name == "get_user_order_context":
                    status_content = "Đang kiểm tra thông tin đơn hàng..."
                else:
                    status_content = "Đang tìm kiếm thông tin..."
                yield f"data: {json.dumps({'type': 'status', 'content': status_content}, ensure_ascii=False)}\n\n"

                if tool_name in tool_map:
                    try:
                        logger.info(f"[AI Tool Call] Executing '{tool_name}' with args: {tool_args}")
                        tool_func = tool_map[tool_name]
                        tool_output = await tool_func.ainvoke(tool_args)
                        _extract_products_from_tool_output(tool_output, collected_products)
                        _extract_citations_from_tool_output(tool_output, collected_citations)
                        extracted_order = _extract_order_context_from_tool_output(tool_output)
                        if extracted_order is not None and tool_name == "get_user_order_context":
                            collected_order_context = extracted_order
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
            # Không có tool call -> Đây là lượt sinh phản hồi văn bản cuối cùng
            full_generated_text = current_turn_text
            filtered_products = _filter_products_mentioned_in_reply(full_generated_text, collected_products)
            if filtered_products:
                yield f"data: {json.dumps({'type': 'products', 'items': filtered_products}, ensure_ascii=False)}\n\n"

            if collected_citations:
                yield f"data: {json.dumps({'type': 'citations', 'citations': collected_citations}, ensure_ascii=False)}\n\n"

            if collected_order_context is not None:
                yield f"data: {json.dumps({'type': 'order_context', 'order': collected_order_context}, ensure_ascii=False)}\n\n"

            yield f"data: {json.dumps({'type': 'end', 'content': '', 'done': True}, ensure_ascii=False)}\n\n"
            return

    # Kết thúc vòng lặp tối đa 5 lượt gọi tool
    filtered_products = _filter_products_mentioned_in_reply(full_generated_text, collected_products)
    if filtered_products:
        yield f"data: {json.dumps({'type': 'products', 'items': filtered_products}, ensure_ascii=False)}\n\n"

    if collected_citations:
        yield f"data: {json.dumps({'type': 'citations', 'citations': collected_citations}, ensure_ascii=False)}\n\n"

    if collected_order_context is not None:
        yield f"data: {json.dumps({'type': 'order_context', 'order': collected_order_context}, ensure_ascii=False)}\n\n"

    yield f"data: {json.dumps({'type': 'end', 'content': '', 'done': True}, ensure_ascii=False)}\n\n"


