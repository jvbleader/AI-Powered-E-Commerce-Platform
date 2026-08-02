import sys
from pathlib import Path

# Ensure app root is in sys.path
app_dir = Path(__file__).resolve().parent.parent
if str(app_dir) not in sys.path:
    sys.path.insert(0, str(app_dir))

from ai.service import (
    SYSTEM_PROMPT,
    get_llm,
    prepare_messages,
    send_chat_message,
    stream_chat_message,
)

LANGCHAIN_AVAILABLE = True

__all__ = [
    "SYSTEM_PROMPT",
    "get_llm",
    "prepare_messages",
    "send_chat_message",
    "stream_chat_message",
    "LANGCHAIN_AVAILABLE",
]

