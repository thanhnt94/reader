import os
import logging
from sqlalchemy import select
from app.core.db import engine, Base, SessionLocal
from app.core.config import settings
from app.modules.auth.models import User
from app.modules.sso_module.models import SSOConfig
from app.modules.course.models import Course, Chapter, Lesson, UserReadProgress, LessonComment, UserLessonNote
from app.modules.settings.models import UserGlobalSettings
from app.modules.auth.routes.auth_routes import hash_pw

logger = logging.getLogger(__name__)

async def init_db():
    logger.info("Initializing Reader Database...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Safely migrate new settings columns for SQLite if table already exists
        try:
            await conn.exec_driver_sql("ALTER TABLE user_global_settings ADD COLUMN tts_wake_lock BOOLEAN DEFAULT 1")
        except Exception:
            pass
        try:
            await conn.exec_driver_sql("ALTER TABLE user_global_settings ADD COLUMN tts_auto_advance BOOLEAN DEFAULT 0")
        except Exception:
            pass
        try:
            await conn.exec_driver_sql("ALTER TABLE user_global_settings ADD COLUMN tts_sentence_delay FLOAT DEFAULT 0.5")
        except Exception:
            pass
        try:
            await conn.exec_driver_sql("ALTER TABLE user_global_settings ADD COLUMN tts_lesson_delay INTEGER DEFAULT 2")
        except Exception:
            pass

    async with SessionLocal() as db:
        # 1. Initialize SSO Settings
        res_sso = await db.execute(select(SSOConfig))
        sso_conf = res_sso.scalar_one_or_none()
        if not sso_conf:
            sso_conf = SSOConfig(
                is_enabled=True,
                server_url=settings.CENTRAL_AUTH_URL,
                client_id=settings.CLIENT_ID,
                client_secret=settings.CLIENT_SECRET
            )
            db.add(sso_conf)

        # 2. Check and Seed Default Admin
        res_user = await db.execute(select(User).where(User.username == "admin"))
        admin_user = res_user.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                username="admin",
                full_name="Administrator",
                hashed_password=hash_pw("admin123"),
                role="admin"
            )
            db.add(admin_user)

        # 3. Check if courses exist; if not, auto-import sample or JSST folder if present
        res_course = await db.execute(select(Course))
        first_course = res_course.scalar_one_or_none()
        if not first_course:
            jsst_path = os.path.abspath(os.path.join(settings.BASE_DIR, "JSST"))
            if os.path.exists(jsst_path):
                logger.info(f"Auto-importing JSST course from {jsst_path}...")
                try:
                    from app.modules.import_export.services.batch_importer import BatchImporter
                    await BatchImporter.import_from_folder(jsst_path, db, course_title="JSST Speaking Mastery")
                except Exception as e:
                    logger.error(f"Failed to auto-import JSST: {e}")
            else:
                # Seed demo course
                demo_course = Course(
                    title="Introduction to Interactive MDX",
                    slug="intro-to-interactive-mdx",
                    description="Welcome to Reader! Explore interactive Markdown, KaTeX, Mermaid diagrams, and Smart Speech Narration.",
                    order_num=1
                )
                db.add(demo_course)
                await db.commit()
                await db.refresh(demo_course)

                demo_chap = Chapter(
                    course_id=demo_course.id,
                    title="Getting Started",
                    slug="intro-to-interactive-mdx-getting-started",
                    order_num=1
                )
                db.add(demo_chap)
                await db.commit()
                await db.refresh(demo_chap)

                demo_md = """# 🚀 Welcome to Reader LMS

This is a demonstration of our **interactive MDX engine**.

> [!NOTE]
> Reader supports GitHub Alerts, KaTeX math formulas, syntax highlighted code, Japanese Furigana, and browser-native Speech Narration.

### 📐 KaTeX Formula Example
Here is the famous mass-energy equivalence equation:
$$E = mc^2$$

And an inline formula: $\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$.

### 🇯🇵 Japanese Furigana (Ruby)
<ruby>私<rt>わたし</rt></ruby>は<ruby>日本語<rt>にほんご</rt></ruby>を<ruby>勉強<rt>べんきょう</rt></ruby>しています。

### 📊 Mermaid Diagram
```mermaid
graph TD
    A[Markdown File .md] --> B[Batch Importer]
    B --> C[Central Database]
    C --> D[Interactive MDX Reader]
    C --> E[Smart Speech Narration]
```

### 💻 Code Highlight Example
```python
def read_along_narration(sentence_index: int):
    # Live narration with browser speech engine
    return f"Active sentence: {sentence_index}"
```

Enjoy learning with Reader!
"""
                from app.modules.import_export.services.batch_importer import BatchImporter
                toc = BatchImporter.extract_toc(demo_md)
                demo_lesson = Lesson(
                    chapter_id=demo_chap.id,
                    title="Welcome to Reader",
                    slug="intro-to-interactive-mdx-getting-started-welcome",
                    raw_markdown=demo_md,
                    toc_data=toc,
                    order_num=1,
                    tts_enabled=True
                )
                db.add(demo_lesson)

        await db.commit()
        logger.info("Reader Database Initialized successfully.")
