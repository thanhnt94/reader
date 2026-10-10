from sqlalchemy import Column, Integer, String, Boolean
from app.core.db import Base

class SSOConfig(Base):
    __tablename__ = "sso_settings"

    id = Column(Integer, primary_key=True)
    is_enabled = Column(Boolean, default=True)
    server_url = Column(String(255), default="https://auth.inmind.site")
    client_id = Column(String(100), default="reader-v1")
    client_secret = Column(String(255), default="reader_secret_123")

    def to_dict(self):
        return {
            "id": self.id,
            "is_enabled": self.is_enabled,
            "server_url": self.server_url,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }
