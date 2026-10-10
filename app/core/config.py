import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Reader"
    PORT: int = int(os.getenv("PORT", "5070"))
    API_V1_STR: str = "/api/v1"
    
    # Paths & Storage
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    STORAGE_DIR: str = os.path.abspath(os.path.join(BASE_DIR, "..", "Storage", "database"))
    READER_STORAGE_DIR: str = os.path.abspath(os.path.join(BASE_DIR, "..", "Storage", "Reader"))
    
    @property
    def DATABASE_URL(self) -> str:
        os.makedirs(self.STORAGE_DIR, exist_ok=True)
        db_path = os.path.join(self.STORAGE_DIR, "Reader.db")
        return f"sqlite+aiosqlite:///{db_path}"

    @property
    def UPLOADS_DIR(self) -> str:
        upload_path = os.path.join(self.READER_STORAGE_DIR, "uploads")
        os.makedirs(upload_path, exist_ok=True)
        return upload_path

    @property
    def AUDIO_DIR(self) -> str:
        audio_path = os.path.join(self.READER_STORAGE_DIR, "uploads", "audio")
        os.makedirs(audio_path, exist_ok=True)
        return audio_path

    # CentralAuth SSO Integration
    SECRET_KEY: str = os.getenv("SECRET_KEY", "reader_inmind_secret_key_prod_2026_xyz987")
    CENTRAL_AUTH_URL: str = os.getenv("CENTRAL_AUTH_URL", "https://inmind.site")
    CENTRALAUTH_INTERNAL_URL: str = os.getenv("CENTRALAUTH_INTERNAL_URL", "https://inmind.site")
    CENTRALAUTH_QUEUE_TOKEN: str = os.getenv("CENTRALAUTH_QUEUE_TOKEN", "super-secret-token-123")
    CLIENT_ID: str = os.getenv("CLIENT_ID", "reader-v1")
    CLIENT_SECRET: str = os.getenv("CLIENT_SECRET", "reader_secret_123")
    APP_BASE_URL: str = os.getenv("APP_BASE_URL", "https://read.inmind.site")

    class Config:
        case_sensitive = True

settings = Settings()
