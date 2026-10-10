import os
import re
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.core.db import get_db
from app.modules.course.models import Course, Chapter, Lesson, UserReadProgress
from app.modules.auth.routes.auth_routes import get_current_user_optional, get_current_admin
from app.modules.auth.models import User
from app.modules.import_export.services.batch_importer import BatchImporter
from app.modules.tts.services.tts_service import TTSService

router = APIRouter(prefix="/api/v1", tags=["Courses & Lessons"])

def natural_sort_key(s: str):
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

class CourseCreateRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    icon: Optional[str] = "fas fa-book-open"
    cover_image: Optional[str] = None
    order_num: Optional[int] = 0

class CourseUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    cover_image: Optional[str] = None
    order_num: Optional[int] = None
    is_published: Optional[bool] = None

class ChapterCreateRequest(BaseModel):
    course_id: Optional[int] = None
    title: str
    order_num: Optional[int] = 0

class ChapterUpdateRequest(BaseModel):
    title: Optional[str] = None
    order_num: Optional[int] = None

class LessonCreateRequest(BaseModel):
    chapter_id: int
    title: str
    raw_markdown: str
    order_num: Optional[int] = 0
    tts_enabled: Optional[bool] = True

class LessonUpdateRequest(BaseModel):
    title: Optional[str] = None
    raw_markdown: Optional[str] = None
    order_num: Optional[int] = None
    tts_enabled: Optional[bool] = None
    chapter_id: Optional[int] = None

class ProgressUpdateRequest(BaseModel):
    is_completed: Optional[bool] = None
    last_scroll_pos: Optional[float] = None
    last_audio_pos: Optional[float] = None

# =========================
# COURSES ENDPOINTS
# =========================

@router.get("/courses")
async def list_courses(db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_optional)):
    res = await db.execute(select(Course).order_by(Course.order_num, Course.id))
    courses = res.scalars().all()

    result = []
    for c in courses:
        c_dict = c.to_dict()
        # Count chapters and lessons
        chap_res = await db.execute(select(func.count(Chapter.id)).where(Chapter.course_id == c.id))
        les_res = await db.execute(select(func.count(Lesson.id)).join(Chapter).where(Chapter.course_id == c.id))
        c_dict["chapter_count"] = chap_res.scalar() or 0
        c_dict["lesson_count"] = les_res.scalar() or 0

        # Calculate user completion if logged in
        if current_user:
            comp_res = await db.execute(
                select(func.count(UserReadProgress.id))
                .join(Lesson, UserReadProgress.lesson_id == Lesson.id)
                .join(Chapter, Lesson.chapter_id == Chapter.id)
                .where(Chapter.course_id == c.id, UserReadProgress.user_id == current_user.id, UserReadProgress.is_completed == True)
            )
            c_dict["completed_count"] = comp_res.scalar() or 0
        else:
            c_dict["completed_count"] = 0

        result.append(c_dict)

    return result

@router.post("/courses")
async def create_course(data: CourseCreateRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    slug = BatchImporter.slugify(data.title)
    course = Course(
        title=data.title.strip(),
        slug=slug,
        description=data.description,
        icon=data.icon or "fas fa-book-open",
        cover_image=data.cover_image,
        order_num=data.order_num or 0
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return course.to_dict()

@router.get("/courses/{course_id}")
async def get_course_detail(course_id: int, db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_optional)):
    res = await db.execute(select(Course).where(Course.id == course_id))
    course = res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    c_dict = course.to_dict()

    # Load chapters
    chap_res = await db.execute(select(Chapter).where(Chapter.course_id == course_id).order_by(Chapter.order_num, Chapter.id))
    chapters = chap_res.scalars().all()

    # Load progress map if user logged in
    progress_map = {}
    if current_user:
        prog_res = await db.execute(select(UserReadProgress).where(UserReadProgress.user_id == current_user.id))
        for p in prog_res.scalars().all():
            progress_map[p.lesson_id] = p.to_dict()

    chapters_data = []
    for chap in chapters:
        ch_dict = chap.to_dict()
        les_res = await db.execute(select(Lesson).where(Lesson.chapter_id == chap.id).order_by(Lesson.order_num, Lesson.id))
        lessons = les_res.scalars().all()
        lessons_data = []
        for les in lessons:
            l_dict = les.to_dict(include_content=False)
            l_dict["progress"] = progress_map.get(les.id, None)
            lessons_data.append(l_dict)
        ch_dict["lessons"] = lessons_data
        chapters_data.append(ch_dict)

    c_dict["chapters"] = chapters_data
    return c_dict

@router.put("/courses/{course_id}")
async def update_course(course_id: int, data: CourseUpdateRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    res = await db.execute(select(Course).where(Course.id == course_id))
    course = res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if data.title is not None and data.title.strip():
        course.title = data.title.strip()
    if data.description is not None:
        course.description = data.description
    if data.icon is not None:
        course.icon = data.icon
    if data.cover_image is not None:
        course.cover_image = data.cover_image
    if data.order_num is not None:
        course.order_num = data.order_num
    if data.is_published is not None:
        course.is_published = data.is_published

    await db.commit()
    await db.refresh(course)
    return course.to_dict()

@router.delete("/courses/{course_id}")
async def delete_course(course_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    res = await db.execute(select(Course).where(Course.id == course_id))
    course = res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    chap_res = await db.execute(select(Chapter.id).where(Chapter.course_id == course_id))
    chap_ids = chap_res.scalars().all()
    if chap_ids:
        les_res = await db.execute(select(Lesson.id).where(Lesson.chapter_id.in_(chap_ids)))
        les_ids = les_res.scalars().all()
        if les_ids:
            await db.execute(delete(UserReadProgress).where(UserReadProgress.lesson_id.in_(les_ids)))
            await db.execute(delete(Lesson).where(Lesson.id.in_(les_ids)))
        await db.execute(delete(Chapter).where(Chapter.id.in_(chap_ids)))

    await db.delete(course)
    await db.commit()
    return {"status": "success", "message": "Course deleted"}

# =========================
# CHAPTERS ENDPOINTS
# =========================

@router.post("/courses/{course_id}/chapters")
async def create_chapter(course_id: int, data: ChapterCreateRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    res = await db.execute(select(Course).where(Course.id == course_id))
    course = res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    chap_title = data.title.strip()
    if not chap_title:
        raise HTTPException(status_code=400, detail="Chapter title cannot be empty")

    slug = f"{course.slug}-{BatchImporter.slugify(chap_title)}"
    if not data.order_num:
        cnt_res = await db.execute(select(func.coalesce(func.max(Chapter.order_num), 0)).where(Chapter.course_id == course_id))
        order_num = (cnt_res.scalar() or 0) + 1
    else:
        order_num = data.order_num

    chapter = Chapter(
        course_id=course_id,
        title=chap_title,
        slug=slug,
        order_num=order_num
    )
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    return chapter.to_dict()

@router.put("/chapters/{chapter_id}")
async def update_chapter(chapter_id: int, data: ChapterUpdateRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    res = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = res.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    if data.title is not None and data.title.strip():
        chapter.title = data.title.strip()
    if data.order_num is not None:
        chapter.order_num = data.order_num

    await db.commit()
    await db.refresh(chapter)
    return chapter.to_dict()

@router.delete("/chapters/{chapter_id}")
async def delete_chapter(chapter_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    res = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = res.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    les_res = await db.execute(select(Lesson.id).where(Lesson.chapter_id == chapter_id))
    les_ids = les_res.scalars().all()
    if les_ids:
        await db.execute(delete(UserReadProgress).where(UserReadProgress.lesson_id.in_(les_ids)))
        await db.execute(delete(Lesson).where(Lesson.id.in_(les_ids)))

    await db.delete(chapter)
    await db.commit()
    return {"status": "success", "message": "Chapter deleted"}

# =========================
# BATCH MARKDOWN UPLOAD
# =========================

@router.post("/chapters/{chapter_id}/batch-upload-md")
async def batch_upload_markdown_to_chapter(
    chapter_id: int,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    chap_res = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = chap_res.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    # Filter markdown files
    md_files = [f for f in files if (f.filename or "").lower().endswith((".md", ".markdown"))]
    if not md_files:
        raise HTTPException(status_code=400, detail="No .md files found in upload")

    # Natural sort by filename
    sorted_files = sorted(md_files, key=lambda f: natural_sort_key(f.filename or ""))

    # Find highest order_num in chapter
    max_order_res = await db.execute(select(func.coalesce(func.max(Lesson.order_num), 0)).where(Lesson.chapter_id == chapter_id))
    current_max_order = max_order_res.scalar() or 0

    created_lessons = []
    for idx, f in enumerate(sorted_files, start=1):
        filename = f.filename or f"lesson_{idx}.md"
        base_name = os.path.splitext(filename)[0]

        # Extract number prefix if present, e.g. "01. ..." -> 1
        m = re.match(r'^\D*(\d+)', base_name)
        if m:
            file_order = int(m.group(1))
        else:
            file_order = current_max_order + idx

        content_bytes = await f.read()
        raw_text = content_bytes.decode("utf-8", errors="ignore")

        meta, clean_md = BatchImporter.parse_frontmatter(raw_text)
        fallback_title = re.sub(r'^\d+[\s._\-–:]*', '', base_name).strip() or base_name
        lesson_title = meta.get("title") or BatchImporter.extract_title(clean_md, fallback_title)
        toc = BatchImporter.extract_toc(clean_md)
        slug_seed = BatchImporter.slugify(fallback_title)
        lesson_slug = f"c{chapter.id}-o{file_order}-{slug_seed[:60]}"

        lesson = Lesson(
            chapter_id=chapter.id,
            title=lesson_title.strip(),
            slug=lesson_slug,
            raw_markdown=raw_text,
            frontmatter_data=meta,
            toc_data=toc,
            order_num=file_order,
            tts_enabled=True,
            tts_generated=False
        )
        db.add(lesson)
        created_lessons.append(lesson)

    await db.commit()
    for l in created_lessons:
        await db.refresh(l)

    return {
        "status": "success",
        "chapter_id": chapter.id,
        "chapter_title": chapter.title,
        "imported_count": len(created_lessons),
        "lessons": [l.to_dict(include_content=False) for l in created_lessons]
    }

@router.post("/courses/{course_id}/batch-upload-md")
async def batch_upload_markdown_to_course(
    course_id: int,
    chapter_id: Optional[int] = Form(None),
    new_chapter_title: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    c_res = await db.execute(select(Course).where(Course.id == course_id))
    course = c_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    target_chapter: Optional[Chapter] = None
    if chapter_id:
        chap_res = await db.execute(select(Chapter).where(Chapter.id == chapter_id, Chapter.course_id == course_id))
        target_chapter = chap_res.scalar_one_or_none()

    if not target_chapter:
        if new_chapter_title and new_chapter_title.strip():
            title = new_chapter_title.strip()
        else:
            title = "Chapter 1"
        cnt_res = await db.execute(select(func.coalesce(func.max(Chapter.order_num), 0)).where(Chapter.course_id == course_id))
        new_order = (cnt_res.scalar() or 0) + 1
        target_chapter = Chapter(
            course_id=course_id,
            title=title,
            slug=f"{course.slug}-{BatchImporter.slugify(title)}",
            order_num=new_order
        )
        db.add(target_chapter)
        await db.commit()
        await db.refresh(target_chapter)

    return await batch_upload_markdown_to_chapter(target_chapter.id, files, db, admin)

# =========================
# LESSONS ENDPOINTS
# =========================

@router.get("/lessons/{lesson_id}")
async def get_lesson_detail(lesson_id: int, db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_optional)):
    res = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = res.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    data = lesson.to_dict(include_content=True)

    # Attach chapter and course info for breadcrumbs & navigation
    chap_res = await db.execute(select(Chapter).where(Chapter.id == lesson.chapter_id))
    chapter = chap_res.scalar_one_or_none()
    if chapter:
        data["chapter"] = chapter.to_dict()
        c_res = await db.execute(select(Course).where(Course.id == chapter.course_id))
        course = c_res.scalar_one_or_none()
        if course:
            data["course"] = course.to_dict()

    # Attach user reading progress
    if current_user:
        prog_res = await db.execute(select(UserReadProgress).where(UserReadProgress.user_id == current_user.id, UserReadProgress.lesson_id == lesson_id))
        prog = prog_res.scalar_one_or_none()
        data["progress"] = prog.to_dict() if prog else None
    else:
        data["progress"] = None

    return data

@router.post("/lessons")
async def create_lesson(data: LessonCreateRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    chap_res = await db.execute(select(Chapter).where(Chapter.id == data.chapter_id))
    chapter = chap_res.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    meta, clean_md = BatchImporter.parse_frontmatter(data.raw_markdown)
    slug = f"{chapter.slug}-{BatchImporter.slugify(data.title)}"
    toc = BatchImporter.extract_toc(clean_md)

    lesson = Lesson(
        chapter_id=data.chapter_id,
        title=data.title.strip(),
        slug=slug,
        raw_markdown=data.raw_markdown,
        frontmatter_data=meta,
        toc_data=toc,
        order_num=data.order_num or 0,
        tts_enabled=data.tts_enabled
    )
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)
    return lesson.to_dict(include_content=True)

@router.put("/lessons/{lesson_id}")
async def update_lesson(lesson_id: int, data: LessonUpdateRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    """Used by WYSIWYG / Markdown Live Editor to save edits in real-time."""
    res = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = res.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if data.title is not None:
        lesson.title = data.title.strip()

    if data.raw_markdown is not None:
        lesson.raw_markdown = data.raw_markdown
        meta, clean_md = BatchImporter.parse_frontmatter(data.raw_markdown)
        lesson.frontmatter_data = meta
        lesson.toc_data = BatchImporter.extract_toc(clean_md)
        # Invalidate old TTS cache if markdown changed significantly
        lesson.tts_generated = False

    if data.order_num is not None:
        lesson.order_num = data.order_num

    if data.tts_enabled is not None:
        lesson.tts_enabled = data.tts_enabled

    if data.chapter_id is not None:
        ch_check = await db.execute(select(Chapter).where(Chapter.id == data.chapter_id))
        if not ch_check.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Target chapter not found")
        lesson.chapter_id = data.chapter_id

    await db.commit()
    await db.refresh(lesson)
    return lesson.to_dict(include_content=True)

@router.delete("/lessons/{lesson_id}")
async def delete_lesson(lesson_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    res = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = res.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    await db.delete(lesson)
    await db.commit()
    return {"status": "success", "message": "Lesson deleted"}

@router.post("/lessons/{lesson_id}/progress")
async def update_progress(lesson_id: int, data: ProgressUpdateRequest, user: User = Depends(get_current_user_optional), db: AsyncSession = Depends(get_db)):
    if not user:
        return {"status": "ignored", "reason": "unauthenticated"}

    res = await db.execute(select(UserReadProgress).where(UserReadProgress.user_id == user.id, UserReadProgress.lesson_id == lesson_id))
    prog = res.scalar_one_or_none()
    if not prog:
        prog = UserReadProgress(user_id=user.id, lesson_id=lesson_id)
        db.add(prog)

    if data.is_completed is not None:
        prog.is_completed = data.is_completed
    if data.last_scroll_pos is not None:
        prog.last_scroll_pos = data.last_scroll_pos
    if data.last_audio_pos is not None:
        prog.last_audio_pos = data.last_audio_pos

    await db.commit()
    await db.refresh(prog)
    return prog.to_dict()

# =========================
# ASYNC TTS GENERATION TASK
# =========================

async def _generate_lesson_tts_task(lesson_id: int):
    """Background task running edge-tts synthesis."""
    from app.core.db import SessionLocal
    async with SessionLocal() as db:
        res = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
        lesson = res.scalar_one_or_none()
        if not lesson or not lesson.raw_markdown:
            return

        try:
            audio_url = await TTSService.synthesize_lesson(db, lesson.id, lesson.raw_markdown)
            if audio_url:
                lesson.audio_url = audio_url
                lesson.tts_generated = True
                await db.commit()
        except Exception as e:
            import logging
            logging.getLogger("uvicorn.error").error(f"TTS generation error for lesson {lesson_id}: {e}")

@router.post("/lessons/{lesson_id}/generate-tts")
async def trigger_tts_generation(lesson_id: int, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    res = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = res.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    background_tasks.add_task(_generate_lesson_tts_task, lesson_id)
    return {"status": "queued", "message": "TTS generation queued in background"}
