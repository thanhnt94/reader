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
    tts_wake_lock = Column(Boolean, default=True)
    tts_auto_advance = Column(Boolean, default=False)
    tts_sentence_delay = Column(Float, default=0.5)
    tts_lesson_delay = Column(Integer, default=2)
    show_furigana = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "reading_theme": self.reading_theme,
            "font_size": self.font_size,
            "line_spacing": self.line_spacing,
            "audio_speed": self.audio_speed,
            "auto_scroll": self.auto_scroll,
            "tts_wake_lock": bool(self.tts_wake_lock) if self.tts_wake_lock is not None else True,
            "tts_auto_advance": bool(self.tts_auto_advance) if self.tts_auto_advance is not None else False,
            "tts_sentence_delay": float(self.tts_sentence_delay) if self.tts_sentence_delay is not None else 0.5,
            "tts_lesson_delay": int(self.tts_lesson_delay) if self.tts_lesson_delay is not None else 2,
            "show_furigana": bool(self.show_furigana) if self.show_furigana is not None else True,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
