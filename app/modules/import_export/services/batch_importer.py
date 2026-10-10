import os
import re
import zipfile
import yaml
import shutil
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.modules.course.models import Course, Chapter, Lesson
from app.modules.tts.services.tts_service import TTSService

class BatchImporter:

    @staticmethod
    def slugify(text: str) -> str:
        text = text.lower().strip()
        # Replace non-word chars with -
        text = re.sub(r'[^\w\s-]', '', text)
        text = re.sub(r'[\s_-]+', '-', text)
        return text or "item"

    @staticmethod
    def parse_frontmatter(content: str) -> Tuple[Dict[str, Any], str]:
        """Parses frontmatter and returns (metadata_dict, remaining_markdown)."""
        frontmatter_pattern = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.DOTALL)
        match = frontmatter_pattern.match(content)
        if match:
            raw_yaml = match.group(1)
            try:
                metadata = yaml.safe_load(raw_yaml) or {}
            except Exception:
                metadata = {}
            remaining = content[match.end():]
            return metadata, remaining
        return {}, content

    @staticmethod
    def extract_toc(markdown_text: str) -> List[Dict[str, Any]]:
        """Extracts H2 and H3 headings to construct a Table of Contents."""
        toc = []
        for line in markdown_text.split('\n'):
            line = line.strip()
            # Check H2 or H3
            m = re.match(r'^(#{2,3})\s+(.*)$', line)
            if m:
                hashes = m.group(1)
                title = m.group(2).strip()
                # Clean markdown formatting from title
                clean_title = re.sub(r'[*_~`]', '', title)
                # Clean html ruby tags
                clean_title = re.sub(r'<[^>]+>', '', clean_title)
                anchor = BatchImporter.slugify(clean_title)
                level = len(hashes)
                toc.append({
                    "id": anchor,
                    "level": level,
                    "text": clean_title
                })
        return toc

    @staticmethod
    def extract_title(content: str, fallback: str) -> str:
        """Finds first # Heading 1 in content if no frontmatter title."""
        for line in content.split('\n'):
            line = line.strip()
            if line.startswith('# '):
                clean = line[2:].strip()
                clean = re.sub(r'<[^>]+>', '', clean)
                return clean
        return fallback

    @classmethod
    async def import_from_folder(
        cls,
        folder_path: str,
        db: AsyncSession,
        course_title: Optional[str] = None
    ) -> Dict[str, Any]:
        """Scans a local folder and imports Courses -> Chapters -> Lessons."""
        if not os.path.exists(folder_path):
            raise ValueError(f"Folder does not exist: {folder_path}")

        folder_name = os.path.basename(folder_path.rstrip("/\\"))
        final_course_title = course_title or folder_name.replace("_", " ").replace("-", " ").title()
        course_slug = cls.slugify(final_course_title)

        # Check existing course
        res = await db.execute(select(Course).where(Course.slug == course_slug))
        course = res.scalar_one_or_none()
        if not course:
            course = Course(
                title=final_course_title,
                slug=course_slug,
                description=f"Course generated from {folder_name}",
                order_num=1
            )
            db.add(course)
            await db.commit()
            await db.refresh(course)

        imported_lessons = 0
        imported_chapters = 0

        # Scan folder
        entries = sorted(os.listdir(folder_path))
        subdirs = [e for e in entries if os.path.isdir(os.path.join(folder_path, e))]
        direct_files = [e for e in entries if e.endswith(".md") and os.path.isfile(os.path.join(folder_path, e))]

        if subdirs:
            # 3-level structure: Folder contains Chapters which contain Lessons
            for chap_idx, sdir in enumerate(subdirs, start=1):
                chap_path = os.path.join(folder_path, sdir)
                chap_title = sdir.replace("_", " ").replace("-", " ").title()
                chap_slug = f"{course.slug}-{cls.slugify(chap_title)}"

                res_chap = await db.execute(select(Chapter).where(Chapter.course_id == course.id, Chapter.slug == chap_slug))
                chapter = res_chap.scalar_one_or_none()
                if not chapter:
                    chapter = Chapter(
                        course_id=course.id,
                        title=chap_title,
                        slug=chap_slug,
                        order_num=chap_idx
                    )
                    db.add(chapter)
                    await db.commit()
                    await db.refresh(chapter)
                imported_chapters += 1

                # Read lessons in chapter
                files = sorted([f for f in os.listdir(chap_path) if f.endswith(".md")])
                for les_idx, fname in enumerate(files, start=1):
                    fpath = os.path.join(chap_path, fname)
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        raw_content = f.read()

                    meta, remaining = cls.parse_frontmatter(raw_content)
                    fallback_title = os.path.splitext(fname)[0]
                    les_title = meta.get("title") or cls.extract_title(remaining, fallback_title)
                    les_slug = f"{chapter.slug}-{cls.slugify(fallback_title)}"
                    toc = cls.extract_toc(remaining)

                    res_les = await db.execute(select(Lesson).where(Lesson.chapter_id == chapter.id, Lesson.slug == les_slug))
                    lesson = res_les.scalar_one_or_none()
                    if not lesson:
                        lesson = Lesson(
                            chapter_id=chapter.id,
                            title=les_title,
                            slug=les_slug,
                            order_num=meta.get("order", les_idx),
                            raw_markdown=raw_content,
                            frontmatter_data=meta,
                            toc_data=toc,
                            tts_enabled=meta.get("tts", True)
                        )
                        db.add(lesson)
                    else:
                        lesson.title = les_title
                        lesson.raw_markdown = raw_content
                        lesson.frontmatter_data = meta
                        lesson.toc_data = toc
                        lesson.order_num = meta.get("order", les_idx)

                    imported_lessons += 1
                await db.commit()
        elif direct_files:
            # 2-level structure: Direct markdown files under course folder
            default_chap_title = "General Lessons"
            chap_slug = f"{course.slug}-general"
            res_chap = await db.execute(select(Chapter).where(Chapter.course_id == course.id, Chapter.slug == chap_slug))
            chapter = res_chap.scalar_one_or_none()
            if not chapter:
                chapter = Chapter(
                    course_id=course.id,
                    title=default_chap_title,
                    slug=chap_slug,
                    order_num=1
                )
                db.add(chapter)
                await db.commit()
                await db.refresh(chapter)
            imported_chapters = 1

            for les_idx, fname in enumerate(direct_files, start=1):
                fpath = os.path.join(folder_path, fname)
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    raw_content = f.read()

                meta, remaining = cls.parse_frontmatter(raw_content)
                fallback_title = os.path.splitext(fname)[0]
                les_title = meta.get("title") or cls.extract_title(remaining, fallback_title)
                les_slug = f"{chapter.slug}-{cls.slugify(fallback_title[:50])}"
                toc = cls.extract_toc(remaining)

                res_les = await db.execute(select(Lesson).where(Lesson.chapter_id == chapter.id, Lesson.slug == les_slug))
                lesson = res_les.scalar_one_or_none()
                if not lesson:
                    lesson = Lesson(
                        chapter_id=chapter.id,
                        title=les_title,
                        slug=les_slug,
                        order_num=meta.get("order", les_idx),
                        raw_markdown=raw_content,
                        frontmatter_data=meta,
                        toc_data=toc,
                        tts_enabled=meta.get("tts", True)
                    )
                    db.add(lesson)
                else:
                    lesson.title = les_title
                    lesson.raw_markdown = raw_content
                    lesson.frontmatter_data = meta
                    lesson.toc_data = toc
                    lesson.order_num = meta.get("order", les_idx)

                imported_lessons += 1
            await db.commit()

        return {
            "course_id": course.id,
            "course_title": course.title,
            "chapters_imported": imported_chapters,
            "lessons_imported": imported_lessons
        }

    @classmethod
    async def import_from_zip(
        cls,
        zip_file_bytes: bytes,
        db: AsyncSession,
        course_title: Optional[str] = None
    ) -> Dict[str, Any]:
        """Extracts uploaded zip archive and runs folder import."""
        import tempfile
        import io

        temp_dir = tempfile.mkdtemp(prefix="reader_import_")
        try:
            with zipfile.ZipFile(io.BytesIO(zip_file_bytes)) as zf:
                zf.extractall(temp_dir)
            
            # Check if extracted folder has a single root container
            entries = os.listdir(temp_dir)
            scan_path = temp_dir
            if len(entries) == 1 and os.path.isdir(os.path.join(temp_dir, entries[0])):
                scan_path = os.path.join(temp_dir, entries[0])

            result = await cls.import_from_folder(scan_path, db, course_title)
            return result
        finally:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
