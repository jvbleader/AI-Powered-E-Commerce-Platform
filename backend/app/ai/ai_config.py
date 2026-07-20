import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))

class AISettings(BaseSettings):
    OPENROUTER_API_KEY: str = os.getenv("API_KEY_OPENROUTER", "")
    OPENROUTER_BASE_URL: str = os.getenv("BASE_URL_OPENROUTER", "https://openrouter.ai/api/v1")
    OPENROUTER_MODEL: str = os.getenv("MODEL_OPENROUTER", "openrouter/free")

ai_settings = AISettings()
