from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime
from datetime import datetime
from app.core.db import Base

class UserGlobalSettings(Base):
    __tablename__ = "user_global_settings"

    user_id = Column(Integer, primary_key=True, index=True)
    reading_theme = Column(String(50), default="dark")
    font_size = Column(String(20), default="base")
    line_spacing = Column(String(20), default="relaxed")
    audio_speed = Column(Float, default=1.0)
    auto_scroll = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "reading_theme": self.reading_theme,
            "font_size": self.font_size,
            "line_spacing": self.line_spacing,
            "audio_speed": self.audio_speed,
            "auto_scroll": self.auto_scroll,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
