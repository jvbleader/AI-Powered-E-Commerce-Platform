import json
import os
import sys
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

# Add backend/app to sys.path
backend_app_dir = Path(__file__).resolve().parent.parent / "app"
if str(backend_app_dir) not in sys.path:
    sys.path.insert(0, str(backend_app_dir))

# Mock engine creation before importing main to prevent DB connection driver requirements during unit tests
with patch("sqlalchemy.ext.asyncio.create_async_engine"), patch("sqlalchemy.ext.asyncio.async_sessionmaker"):
    from main import app

from httpx import AsyncClient, ASGITransport


class TestChatAIAPI(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.transport = ASGITransport(app=app)
        self.client = AsyncClient(transport=self.transport, base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()

    @patch("api.chat_ai_api.stream_chat_message")
    @patch("api.chat_ai_api.chat_repository.add_chat_message")
    @patch("api.chat_ai_api.chat_repository.get_chat_history")
    @patch("api.chat_ai_api.chat_repository.get_or_create_session")
    async def test_post_chat_message_guest_mode_no_db_persistence(
        self, mock_get_or_create_session, mock_get_chat_history, mock_add_chat_message, mock_stream_chat_message
    ):
        async def fake_stream_generator(msg, history=None, db=None):
            yield f"data: {json.dumps({'type': 'text', 'content': 'Chào bạn'}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'end', 'content': '', 'done': True}, ensure_ascii=False)}\n\n"

        mock_stream_chat_message.side_effect = fake_stream_generator

        response = await self.client.post(
            "/ai/chat/message",
            json={"message": "Xin chào", "session_id": "guest-session-1", "history": [{"role": "user", "content": "Hi"}]},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/event-stream", response.headers.get("content-type", ""))
        self.assertEqual(response.headers.get("X-Session-ID"), "guest-session-1")

        # In guest mode, DB repositories MUST NOT be called to persist session or messages
        mock_get_or_create_session.assert_not_called()
        mock_add_chat_message.assert_not_called()

    @patch("api.chat_ai_api.stream_chat_message")
    @patch("api.chat_ai_api.chat_repository.add_chat_message")
    @patch("api.chat_ai_api.chat_repository.get_chat_history")
    @patch("api.chat_ai_api.chat_repository.get_or_create_session")
    async def test_post_chat_message_logged_in_mode_persists_db(
        self, mock_get_or_create_session, mock_get_chat_history, mock_add_chat_message, mock_stream_chat_message
    ):
        mock_session = MagicMock()
        mock_session.id = "user-session-123"
        mock_get_or_create_session.return_value = mock_session
        mock_get_chat_history.return_value = []
        mock_add_chat_message.return_value = MagicMock()

        async def fake_stream_generator(msg, history=None, db=None):
            yield f"data: {json.dumps({'type': 'text', 'content': 'Son A12'}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'end', 'content': '', 'done': True}, ensure_ascii=False)}\n\n"

        mock_stream_chat_message.side_effect = fake_stream_generator

        # Override current_user dependency to simulate logged in user
        user_mock = MagicMock()
        user_mock.id = 42
        app.dependency_overrides[app.router.routes[0].endpoint] = lambda: None  # reset override

        from dependencies.auth import get_current_user_optional
        app.dependency_overrides[get_current_user_optional] = lambda: user_mock

        try:
            response = await self.client.post(
                "/ai/chat/message",
                json={"message": "Tư vấn son màu đỏ gạch", "session_id": "user-session-123"},
            )

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers.get("X-Session-ID"), "user-session-123")
            mock_get_or_create_session.assert_called_once()
            self.assertEqual(mock_add_chat_message.call_count, 2)
        finally:
            app.dependency_overrides.clear()

    @patch("api.chat_ai_api.chat_repository.get_chat_history")
    @patch("api.chat_ai_api.chat_repository.get_session_by_id")
    async def test_get_chat_history_success(
        self, mock_get_session_by_id, mock_get_chat_history
    ):
        mock_session = MagicMock()
        mock_session.id = "session-1234-5678"
        mock_get_session_by_id.return_value = mock_session

        now = datetime.now(timezone.utc)
        msg1 = MagicMock()
        msg1.id = 1
        msg1.session_id = "session-1234-5678"
        msg1.role = "user"
        msg1.content = "Tư vấn son môi"
        msg1.metadata_info = None
        msg1.created_at = now

        msg2 = MagicMock()
        msg2.id = 2
        msg2.session_id = "session-1234-5678"
        msg2.role = "assistant"
        msg2.content = "Dạ đây là mẫu son môi HOT"
        msg2.metadata_info = {"products": [{"id": 12, "name": "Son A12"}]}
        msg2.created_at = now

        mock_get_chat_history.return_value = [msg1, msg2]

        user_mock = MagicMock()
        user_mock.id = 42
        from dependencies.auth import get_current_user_optional
        app.dependency_overrides[get_current_user_optional] = lambda: user_mock

        try:
            response = await self.client.get(
                "/ai/chat/history",
                params={"session_id": "session-1234-5678"},
            )

            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data.get("sessionId"), "session-1234-5678")
            messages = data.get("messages", [])
            self.assertEqual(len(messages), 2)
        finally:
            app.dependency_overrides.clear()

    @patch("api.chat_ai_api.chat_repository.get_session_by_id")
    async def test_get_chat_history_empty_for_guest(self, mock_get_session_by_id):
        response = await self.client.get(
            "/ai/chat/history",
            params={"session_id": "guest-session-1"},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("messages"), [])
        mock_get_session_by_id.assert_not_called()

    @patch("api.chat_ai_api.send_chat_message")
    async def test_legacy_chat_endpoint(self, mock_send_chat_message):
        mock_send_chat_message.return_value = {
            "reply": "Xin chào! Bạn cần hỗ trợ gì?",
            "model": "openai/gpt-4o-mini",
            "products": [],
        }

        response = await self.client.post(
            "/ai/chat",
            json={"message": "Xin chào"},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["reply"], "Xin chào! Bạn cần hỗ trợ gì?")



if __name__ == "__main__":
    unittest.main()
