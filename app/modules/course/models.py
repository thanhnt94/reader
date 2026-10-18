from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Float, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.db import Base

AUDIO_SLOT_PRESETS = [
    {
        "slot_num": 1,
        "mode_key": "slot_1",
        "title": "Slot 1",
        "description": "Kịch bản âm thanh Slot 1"
    },
    {
        "slot_num": 2,
        "mode_key": "slot_2",
        "title": "Slot 2",
        "description": "Kịch bản âm thanh Slot 2"
    },
    {
        "slot_num": 3,
        "mode_key": "slot_3",
        "title": "Slot 3",
        "description": "Kịch bản âm thanh Slot 3"
    }
]

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(150), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(100), default="fas fa-book-open")
    cover_image = Column(String(500), nullable=True)
    order_num = Column(Integer, default=0, index=True)
    is_published = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "slug": self.slug,
            "title": self.title,
            "description": self.description,
            "icon": self.icon,
            "cover_image": self.cover_image,
            "order_num": self.order_num,
            "is_published": self.is_published,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    slug = Column(String(150), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    order_num = Column(Integer, default=0, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "course_id": self.course_id,
            "slug": self.slug,
            "title": self.title,
            "order_num": self.order_num,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False, index=True)
    slug = Column(String(200), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    order_num = Column(Integer, default=0, index=True)
    raw_markdown = Column(Text, default="", nullable=False)
    clean_text_for_tts = Column(Text, nullable=True)
    audio_url = Column(String(500), nullable=True)
    timestamps_url = Column(String(500), nullable=True)
    duration_seconds = Column(Float, default=0.0)
    tts_enabled = Column(Boolean, default=True)
    tts_generated = Column(Boolean, default=False)
    frontmatter_data = Column(JSON, nullable=True)
    toc_data = Column(JSON, nullable=True)  # List of { id, level, text }
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    audio_tracks = relationship("LessonAudioTrack", back_populates="lesson", cascade="all, delete-orphan", order_by="LessonAudioTrack.slot_num", lazy="selectin")

    def to_dict(self, include_content=False):
        data = {
            "id": self.id,
            "chapter_id": self.chapter_id,
            "slug": self.slug,
            "title": self.title,
            "order_num": self.order_num,
            "audio_url": self.audio_url,
            "timestamps_url": self.timestamps_url,
            "duration_seconds": self.duration_seconds,
            "tts_enabled": self.tts_enabled,
            "tts_generated": self.tts_generated,
            "frontmatter_data": self.frontmatter_data,
            "toc_data": self.toc_data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        if include_content:
            data["raw_markdown"] = self.raw_markdown
        try:
            tracks = getattr(self, "audio_tracks", None)
            if tracks is not None:
                data["audio_tracks"] = [t.to_dict() for t in tracks]
        except Exception:
            pass
        return data

class LessonAudioTrack(Base):
    __tablename__ = "lesson_audio_tracks"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True)
    slot_num = Column(Integer, default=1, nullable=False, index=True)  # 1, 2, 3
    mode_key = Column(String(50), nullable=False, default="bilingual_interleaved")
    title = Column(String(150), nullable=False, default="Slot 1")
    description = Column(String(255), nullable=True)
    audio_script = Column(Text, nullable=True, default="")
    audio_url = Column(String(500), nullable=True)
    duration_seconds = Column(Float, default=0.0)
    tts_provider = Column(String(50), default="edge-tts")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lesson = relationship("Lesson", back_populates="audio_tracks")

    __table_args__ = (
        UniqueConstraint("lesson_id", "slot_num", name="uq_lesson_audio_slot"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "lesson_id": self.lesson_id,
            "slot_num": self.slot_num,
            "mode_key": self.mode_key,
            "title": self.title,
            "description": self.description,
            "audio_script": self.audio_script or "",
            "audio_url": self.audio_url,
            "duration_seconds": self.duration_seconds,
            "tts_provider": self.tts_provider,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class UserReadProgress(Base):
    __tablename__ = "user_read_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True)
    is_completed = Column(Boolean, default=False)
    last_scroll_pos = Column(Float, default=0.0)
    last_audio_pos = Column(Float, default=0.0)
    completed_sections = Column(JSON, default=list, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "lesson_id": self.lesson_id,
            "is_completed": self.is_completed,
            "last_scroll_pos": self.last_scroll_pos,
            "last_audio_pos": self.last_audio_pos,
            "completed_sections": self.completed_sections or [],
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class LessonComment(Base):
    __tablename__ = "lesson_comments"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(Integer, ForeignKey("lesson_comments.id", ondelete="CASCADE"), nullable=True, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, user=None):
        return {
            "id": self.id,
            "lesson_id": self.lesson_id,
            "user_id": self.user_id,
            "parent_id": self.parent_id,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "user": {
                "username": user.username if user else "Anonymous",
                "full_name": user.full_name if user else "",
                "role": user.role if user else "user"
            } if user else None
        }

class UserLessonNote(Base):
    __tablename__ = "user_lesson_notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, default="", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_user_lesson_note"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "lesson_id": self.lesson_id,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

