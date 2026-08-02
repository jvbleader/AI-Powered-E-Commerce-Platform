import os
from dotenv import load_dotenv

load_dotenv()

class AISettings:
    @property
    def API_KEY(self) -> str:
        key = os.getenv("API_KEY")
        if not key or not key.strip():
            raise ValueError("Thiếu cấu hình API_KEY trong biến môi trường (.env)")
        return key.strip()

    @property
    def BASE_URL(self) -> str:
        url = os.getenv("BASE_URL")
        if not url or not url.strip():
            raise ValueError("Thiếu cấu hình BASE_URL trong biến môi trường (.env)")
        return url.strip()

    @property
    def MODEL(self) -> str:
        model = os.getenv("MODEL")
        if model and model.strip():
            return model.strip()
        return model.strip()

ai_settings = AISettings()
