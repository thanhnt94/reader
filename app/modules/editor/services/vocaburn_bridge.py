import os
import json
import sqlite3
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class VocaburnBridgeService:
    """
    Bridge service connecting Reader LMS with the Vocaburn Flashcard FSRS platform.
    Allows students to capture any vocabulary, Kanji or sentence directly from Reader
    and save it into Vocaburn for Spaced Repetition (FSRS v6) study.
    """

    @classmethod
    def get_vocaburn_db_path(cls) -> Optional[str]:
        # Check standard ecosystem paths
        candidates = [
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", "Storage", "database", "Vocaburn.db")),
            os.path.abspath(os.path.join(os.getcwd(), "..", "Storage", "database", "Vocaburn.db")),
            "/var/www/Storage/database/Vocaburn.db"
        ]
        for p in candidates:
            if os.path.exists(p):
                return p
        return None

    @classmethod
    def save_flashcard(
        cls,
        front: str,
        back: str,
        reading: Optional[str] = None,
        context: Optional[str] = None,
        lesson_title: Optional[str] = None,
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        db_path = cls.get_vocaburn_db_path()
        if not db_path:
            raise FileNotFoundError("Vocaburn.db database file not found in Storage directory")

        front_clean = front.strip()
        back_clean = back.strip() if back else ""
        reading_clean = reading.strip() if reading else ""
        context_clean = context.strip() if context else ""

        if not front_clean:
            raise ValueError("Mặt trước thẻ từ vựng (Front) không được để trống")

        # Open SQLite connection with timeout & WAL compatibility
        conn = sqlite3.connect(db_path, timeout=10.0)
        try:
            cursor = conn.cursor()

            # 1. Ensure Category "Reader LMS" exists
            cursor.execute("SELECT id FROM categories WHERE name = ?", ("Reader LMS",))
            row_cat = cursor.fetchone()
            if row_cat:
                cat_id = row_cat[0]
            else:
                now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
                cursor.execute(
                    "INSERT INTO categories (name, description, created_at) VALUES (?, ?, ?)",
                    ("Reader LMS", "Từ vựng được tạo tự động từ Reader LMS", now_str)
                )
                cat_id = cursor.lastrowid

            # 2. Ensure Flashcard Deck "Sổ từ vựng Reader LMS" exists
            deck_title = "Sổ từ vựng Reader LMS"
            cursor.execute("SELECT id FROM flashcard_decks WHERE title = ? AND category_id = ?", (deck_title, cat_id))
            row_deck = cursor.fetchone()
            if row_deck:
                deck_id = row_deck[0]
            else:
                now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
                cursor.execute(
                    """
                    INSERT INTO flashcard_decks (title, description, category_id, creator_id, is_active, is_public, created_at)
                    VALUES (?, ?, ?, ?, 1, 1, ?)
                    """,
                    (deck_title, "Các từ vựng và mẫu câu được lưu khi học trên Reader LMS", cat_id, user_id, now_str)
                )
                deck_id = cursor.lastrowid

            # 3. Check for duplicates in deck
            cursor.execute("SELECT id FROM flashcards WHERE deck_id = ? AND front = ?", (deck_id, front_clean))
            existing_card = cursor.fetchone()
            if existing_card:
                # Update meaning / example if new
                others_data = {
                    "reading": reading_clean,
                    "example": context_clean,
                    "source": lesson_title or "Reader LMS",
                    "updated_at": datetime.utcnow().isoformat()
                }
                cursor.execute(
                    "UPDATE flashcards SET explanation = ?, others = ? WHERE id = ?",
                    (back_clean or "Chưa có giải nghĩa", json.dumps(others_data, ensure_ascii=False), existing_card[0])
                )
                conn.commit()
                return {
                    "success": True,
                    "card_id": existing_card[0],
                    "deck_id": deck_id,
                    "deck_title": deck_title,
                    "action": "updated",
                    "message": f"Đã cập nhật từ '{front_clean}' trong {deck_title}!"
                }

            # 4. Insert new Flashcard
            others_data = {
                "reading": reading_clean,
                "example": context_clean,
                "source": lesson_title or "Reader LMS",
                "created_at": datetime.utcnow().isoformat()
            }
            cursor.execute(
                """
                INSERT INTO flashcards (deck_id, front, question_type, explanation, others)
                VALUES (?, ?, 'flashcard', ?, ?)
                """,
                (deck_id, front_clean, back_clean or "Chưa có giải nghĩa", json.dumps(others_data, ensure_ascii=False))
            )
            card_id = cursor.lastrowid
            conn.commit()

            return {
                "success": True,
                "card_id": card_id,
                "deck_id": deck_id,
                "deck_title": deck_title,
                "action": "created",
                "message": f"Đã lưu '{front_clean}' vào {deck_title} của Vocaburn!"
            }
        finally:
            conn.close()
