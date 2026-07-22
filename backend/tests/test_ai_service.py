import json
import os
import sys
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

# Add backend/app to sys.path
backend_app_dir = Path(__file__).resolve().parent.parent / "app"
if str(backend_app_dir) not in sys.path:
    sys.path.insert(0, str(backend_app_dir))

from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from ai.service import (
    SYSTEM_PROMPT,
    prepare_messages,
    send_chat_message,
    stream_chat_message,
    get_llm,
)


class TestAIService(unittest.IsolatedAsyncioTestCase):
    def test_system_prompt_guardrails(self):
        self.assertIn("Shepoo", SYSTEM_PROMPT)
        self.assertIn("QUY TẮC BẮT BUỘC", SYSTEM_PROMPT)
        self.assertIn("CHỈ tư vấn", SYSTEM_PROMPT)
        self.assertIn("TUYỆT ĐỐI KHÔNG tự bịa", SYSTEM_PROMPT)
        self.assertIn("search_catalog", SYSTEM_PROMPT)
        self.assertIn("get_product_details", SYSTEM_PROMPT)
        self.assertIn("check_inventory", SYSTEM_PROMPT)
        self.assertIn("recommend_similar_products", SYSTEM_PROMPT)

    def test_prepare_messages(self):
        history = [
            {"role": "user", "content": "Chào shop"},
            {"role": "assistant", "content": "Xin chào! Bạn cần tìm sản phẩm gì?"},
        ]
        user_message = "Tìm cho tôi son môi"
        messages = prepare_messages(user_message, history)

        self.assertEqual(len(messages), 4)
        self.assertIsInstance(messages[0], SystemMessage)
        self.assertIn("Shepoo", messages[0].content)
        self.assertIsInstance(messages[1], HumanMessage)
        self.assertEqual(messages[1].content, "Chào shop")
        self.assertIsInstance(messages[2], AIMessage)
        self.assertEqual(messages[2].content, "Xin chào! Bạn cần tìm sản phẩm gì?")
        self.assertIsInstance(messages[3], HumanMessage)
        self.assertEqual(messages[3].content, "Tìm cho tôi son môi")

    @patch("ai.service.get_llm")
    async def test_send_chat_message_without_tool_call(self, mock_get_llm):
        mock_llm = MagicMock()
        mock_response = MagicMock()
        mock_response.content = "Dạ chào bạn, bạn cần hỗ trợ gì ạ?"
        mock_response.tool_calls = []
        mock_llm.ainvoke = AsyncMock(return_value=mock_response)
        mock_get_llm.return_value = mock_llm

        res = await send_chat_message("Xin chào", db=None)

        self.assertEqual(res["reply"], "Dạ chào bạn, bạn cần hỗ trợ gì ạ?")
        self.assertIn("model", res)
        self.assertEqual(res["products"], [])

    @patch("ai.service.get_agent_tools")
    @patch("ai.service.get_llm")
    async def test_send_chat_message_with_tool_call(self, mock_get_llm, mock_get_tools):
        mock_tool = MagicMock()
        mock_tool.name = "search_catalog"
        mock_tool.ainvoke = AsyncMock(
            return_value=json.dumps(
                [
                    {
                        "id": 12,
                        "name": "Son Kem Li A12",
                        "price": 159000.0,
                        "stock": 10,
                        "thumbnail_url": "/img/a12.jpg",
                    }
                ],
                ensure_ascii=False,
            )
        )

        mock_get_tools.return_value = [mock_tool]

        # First LLM invoke returns a tool call, second returns final answer
        mock_response_1 = MagicMock()
        mock_response_1.content = ""
        mock_response_1.tool_calls = [
            {
                "name": "search_catalog",
                "args": {"keyword": "Son"},
                "id": "call_123",
            }
        ]

        mock_response_2 = MagicMock()
        mock_response_2.content = "Shop hiện có Son Kem Li A12 giá 159.000d."
        mock_response_2.tool_calls = []

        mock_llm_with_tools = MagicMock()
        mock_llm_with_tools.ainvoke = AsyncMock(side_effect=[mock_response_1, mock_response_2])

        mock_llm = MagicMock()
        mock_llm.bind_tools.return_value = mock_llm_with_tools
        mock_get_llm.return_value = mock_llm

        mock_db = AsyncMock()
        res = await send_chat_message("Tìm son môi", db=mock_db)

        self.assertEqual(res["reply"], "Shop hiện có Son Kem Li A12 giá 159.000d.")
        self.assertEqual(len(res["products"]), 1)
        self.assertEqual(res["products"][0]["id"], 12)
        mock_tool.ainvoke.assert_called_once_with({"keyword": "Son"})

    @patch("ai.service.get_agent_tools")
    @patch("ai.service.get_llm")
    async def test_stream_chat_message(self, mock_get_llm, mock_get_tools):
        mock_tool = MagicMock()
        mock_tool.name = "search_catalog"
        mock_tool.ainvoke = AsyncMock(
            return_value=json.dumps(
                [{"id": 5, "name": "Ao Thon", "price": 99000.0}], ensure_ascii=False
            )
        )
        mock_get_tools.return_value = [mock_tool]

        mock_response_1 = MagicMock()
        mock_response_1.tool_calls = [
            {"name": "search_catalog", "args": {"keyword": "Ao"}, "id": "call_99"}
        ]

        mock_response_2 = MagicMock()
        mock_response_2.tool_calls = []

        mock_llm_with_tools = MagicMock()
        mock_llm_with_tools.ainvoke = AsyncMock(side_effect=[mock_response_1, mock_response_2])

        mock_chunk = MagicMock()
        mock_chunk.content = "Shop có Áo Thun giá 99k"

        async def fake_astream(msgs):
            yield mock_chunk

        mock_llm = MagicMock()
        mock_llm.bind_tools.return_value = mock_llm_with_tools
        mock_llm.astream = fake_astream
        mock_get_llm.return_value = mock_llm

        mock_db = AsyncMock()
        events = []
        async for event in stream_chat_message("Ao thun", db=mock_db):
            events.append(event)

        # Ensure status, text, products, end events exist in SSE output stream
        self.assertTrue(any("status" in e for e in events))
        self.assertTrue(any("text" in e for e in events))
        self.assertTrue(any("products" in e for e in events))
        self.assertTrue(any("end" in e for e in events))


if __name__ == "__main__":
    unittest.main()
