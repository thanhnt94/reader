import os
import re
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import httpx
import urllib.parse

from app.core.config import settings
from app.core.db import get_db
from app.modules.course.models import Course, Chapter, Lesson, LessonAudioTrack, AUDIO_SLOT_PRESETS, UserReadProgress, LessonComment, UserLessonNote
from app.modules.auth.routes.auth_routes import get_current_user_optional, get_current_user, get_current_admin
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
    completed_sections: Optional[List[str]] = None

class LessonAudioTrackUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    audio_script: Optional[str] = None
    audio_url: Optional[str] = None
    duration_seconds: Optional[float] = None

class GenerateTTSRequest(BaseModel):
    slot: int = 1
    mode: Optional[str] = None
    force: bool = False
    audio_script: Optional[str] = None

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

@router.get("/courses/{course_id_or_slug}")
async def get_course_detail(course_id_or_slug: str, db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_optional)):
    if course_id_or_slug.isdigit():
        res = await db.execute(select(Course).where(Course.id == int(course_id_or_slug)))
    else:
        res = await db.execute(select(Course).where(Course.slug == course_id_or_slug))
    course = res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    c_dict = course.to_dict()

    # Load chapters
    chap_res = await db.execute(select(Chapter).where(Chapter.course_id == course.id).order_by(Chapter.order_num, Chapter.id))
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
        les_res = await db.execute(
            select(Lesson)
            .options(selectinload(Lesson.audio_tracks))
            .where(Lesson.chapter_id == chap.id)
            .order_by(Lesson.order_num, Lesson.id)
        )
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

@router.get("/lessons/{lesson_id_or_slug}")
async def get_lesson_detail(lesson_id_or_slug: str, db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_optional)):
    if lesson_id_or_slug.isdigit():
        res = await db.execute(select(Lesson).where(Lesson.id == int(lesson_id_or_slug)))
    else:
        res = await db.execute(select(Lesson).where(Lesson.slug == lesson_id_or_slug))
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
        prog_res = await db.execute(select(UserReadProgress).where(UserReadProgress.user_id == current_user.id, UserReadProgress.lesson_id == lesson.id))
        prog = prog_res.scalar_one_or_none()
    else:
        data["progress"] = None

    # Attach audio tracks (3 slots)
    tracks_res = await db.execute(
        select(LessonAudioTrack).where(LessonAudioTrack.lesson_id == lesson.id).order_by(LessonAudioTrack.slot_num)
    )
    existing_tracks = {t.slot_num: t for t in tracks_res.scalars().all()}

    audio_tracks = []
    for preset in AUDIO_SLOT_PRESETS:
        s_num = preset["slot_num"]
        if s_num in existing_tracks:
            audio_tracks.append(existing_tracks[s_num].to_dict())
        else:
            audio_tracks.append({
                "id": None,
                "lesson_id": lesson.id,
                "slot_num": s_num,
                "mode_key": preset["mode_key"],
                "title": preset["title"],
                "description": preset["description"],
                "audio_script": "",
                "audio_url": lesson.audio_url if s_num == 1 else None,
                "duration_seconds": lesson.duration_seconds if s_num == 1 else 0.0,
                "tts_provider": "edge-tts"
            })
    data["audio_tracks"] = audio_tracks

    return data

@router.get("/courses/{course_id_or_slug}/lessons/{lesson_id_or_slug}")
async def get_course_lesson_detail(
    course_id_or_slug: str,
    lesson_id_or_slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    return await get_lesson_detail(lesson_id_or_slug=lesson_id_or_slug, db=db, current_user=current_user)

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
async def update_progress(lesson_id: int, data: ProgressUpdateRequest, user: Optional[User] = Depends(get_current_user_optional), db: AsyncSession = Depends(get_db)):
    if not user:
        return {"status": "unauthenticated", "message": "Login required to persist reading progress"}

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
    if data.completed_sections is not None:
        prog.completed_sections = data.completed_sections

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

@router.put("/lessons/{lesson_id}/audio-tracks/{slot_num}")
async def update_lesson_audio_track(
    lesson_id: int,
    slot_num: int,
    data: LessonAudioTrackUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    res = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = res.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    track_res = await db.execute(
        select(LessonAudioTrack).where(
            LessonAudioTrack.lesson_id == lesson_id,
            LessonAudioTrack.slot_num == slot_num
        )
    )
    track = track_res.scalar_one_or_none()
    if not track:
        preset = next((p for p in AUDIO_SLOT_PRESETS if p["slot_num"] == slot_num), {
            "mode_key": f"slot_{slot_num}",
            "title": f"Slot {slot_num}",
            "description": f"Kịch bản âm thanh Slot {slot_num}"
        })
        track = LessonAudioTrack(
            lesson_id=lesson_id,
            slot_num=slot_num,
            mode_key=preset.get("mode_key", f"slot_{slot_num}"),
            title=data.title or preset.get("title", f"Slot {slot_num}"),
            description=data.description or preset.get("description", ""),
            audio_script=data.audio_script or "",
            audio_url=data.audio_url,
            duration_seconds=data.duration_seconds or 0.0
        )
        db.add(track)
    else:
        if data.title is not None:
            track.title = data.title.strip()
        if data.description is not None:
            track.description = data.description.strip()
        if data.audio_script is not None:
            track.audio_script = data.audio_script
        if data.audio_url is not None:
            track.audio_url = data.audio_url
        if data.duration_seconds is not None:
            track.duration_seconds = data.duration_seconds

    await db.commit()
    await db.refresh(track)
    return track.to_dict()

@router.delete("/lessons/{lesson_id}/audio-tracks/{slot_num}/audio")
async def clear_lesson_audio_file(
    lesson_id: int,
    slot_num: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    track_res = await db.execute(
        select(LessonAudioTrack).where(
            LessonAudioTrack.lesson_id == lesson_id,
            LessonAudioTrack.slot_num == slot_num
        )
    )
    track = track_res.scalar_one_or_none()
    if track and track.audio_url:
        local_path = os.path.join(settings.AUDIO_DIR, os.path.basename(track.audio_url))
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
            except Exception:
                pass
        track.audio_url = None
        track.duration_seconds = 0.0
        await db.commit()
        await db.refresh(track)
        return track.to_dict()
    return {"status": "ok", "message": "No audio file to delete"}

@router.post("/lessons/{lesson_id_or_slug}/generate-tts")
async def trigger_tts_generation(
    lesson_id_or_slug: str,
    data: Optional[GenerateTTSRequest] = None,
    slot: int = 1,
    mode: Optional[str] = None,
    force: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    target_slot = data.slot if data else slot
    target_mode = data.mode if data else mode
    target_force = data.force if data else force
    target_script = data.audio_script if data else None

    if lesson_id_or_slug.isdigit():
        res = await db.execute(select(Lesson).where(Lesson.id == int(lesson_id_or_slug)))
    else:
        res = await db.execute(select(Lesson).where(Lesson.slug == lesson_id_or_slug))
    lesson = res.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    track_res = await db.execute(
        select(LessonAudioTrack).where(
            LessonAudioTrack.lesson_id == lesson.id,
            LessonAudioTrack.slot_num == target_slot
        )
    )
    existing_track = track_res.scalar_one_or_none()

    if target_script is not None and existing_track:
        existing_track.audio_script = target_script

    if existing_track and existing_track.audio_url and not target_force:
        return {
            "status": "ready",
            "slot_num": target_slot,
            "audio_url": existing_track.audio_url,
            "duration_seconds": existing_track.duration_seconds
        }

    effective_script = target_script or (existing_track.audio_script if existing_track else None)
    source_text = effective_script or lesson.raw_markdown
    if not source_text or not source_text.strip():
        raise HTTPException(status_code=400, detail="Lesson/Slot has no script or content to synthesize")

    try:
        audio_url = await TTSService.synthesize_lesson(
            db=db,
            lesson_id=lesson.id,
            markdown_text=lesson.raw_markdown,
            slot_num=target_slot,
            mode_key=target_mode,
            force=target_force,
            audio_script=effective_script
        )
        if audio_url:
            tracks_res = await db.execute(
                select(LessonAudioTrack).where(LessonAudioTrack.lesson_id == lesson.id).order_by(LessonAudioTrack.slot_num)
            )
            tracks = tracks_res.scalars().all()
            return {
                "status": "ready",
                "slot_num": target_slot,
                "audio_url": audio_url,
                "audio_tracks": [t.to_dict() for t in tracks]
            }
        else:
            raise HTTPException(status_code=500, detail="TTS service did not return an audio URL")
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").error(f"TTS generation error for lesson {lesson_id_or_slug} slot {target_slot}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate TTS audio: {str(e)}")

@router.get("/tts/stream")
async def stream_tts(text: str, lang: str = "vi"):
    """
    Real-time streaming TTS audio fallback.
    Provides instant natural Vietnamese / Japanese speech synthesis when the user's browser lacks local voice models.
    """
    clean_text = text.strip()
    if not clean_text:
        raise HTTPException(status_code=400, detail="Text required")

    lang_code = "vi" if lang.startswith("vi") else ("ja" if lang.startswith("ja") else "en")
    tts_url = f"https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl={lang_code}&q={urllib.parse.quote(clean_text[:400])}"

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(tts_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://translate.google.com/"
            })
            if resp.status_code == 200:
                return Response(content=resp.content, media_type="audio/mpeg")
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").error(f"TTS stream error: {e}")

    raise HTTPException(status_code=500, detail="Failed to synthesize speech audio")
    return Response(status_code=500)

class CommentCreateRequest(BaseModel):
    content: str
    parent_id: Optional[int] = None

class NoteUpdateRequest(BaseModel):
    content: str

# =========================================================================
# LESSON COMMENTS
# =========================================================================
@router.get("/lessons/{lesson_id}/comments")
async def get_lesson_comments(lesson_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(LessonComment, User)
        .outerjoin(User, LessonComment.user_id == User.id)
        .where(LessonComment.lesson_id == lesson_id)
        .order_by(LessonComment.created_at.asc())
    )
    comments = []
    for comment, user in res.all():
        comments.append(comment.to_dict(user=user))
    return comments

@router.post("/lessons/{lesson_id}/comments")
async def post_lesson_comment(
    lesson_id: int,
    data: CommentCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    clean_content = data.content.strip()
    if not clean_content:
        raise HTTPException(status_code=400, detail="Nội dung bình luận không được để trống")

    les_res = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = les_res.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Bài học không tồn tại")

    comment = LessonComment(
        lesson_id=lesson_id,
        user_id=user.id,
        parent_id=data.parent_id,
        content=clean_content
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment.to_dict(user=user)

@router.delete("/lessons/{lesson_id}/comments/{comment_id}")
async def delete_lesson_comment(
    lesson_id: int,
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    res = await db.execute(
        select(LessonComment).where(
            LessonComment.id == comment_id,
            LessonComment.lesson_id == lesson_id
        )
    )
    comment = res.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Bình luận không tồn tại")

    if user.role != "admin" and comment.user_id != user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa bình luận này")

    await db.delete(comment)
    await db.commit()
    return {"status": "success", "message": "Đã xóa bình luận thành công"}

# =========================================================================
# USER LESSON NOTES (Personal Notebook) - Authenticated Only
# =========================================================================
@router.get("/lessons/{lesson_id}/note")
async def get_user_lesson_note(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    res = await db.execute(
        select(UserLessonNote).where(
            UserLessonNote.lesson_id == lesson_id,
            UserLessonNote.user_id == user.id
        )
    )
    note = res.scalar_one_or_none()
    if not note:
        return {"id": None, "lesson_id": lesson_id, "user_id": user.id, "content": "", "updated_at": None}
    return note.to_dict()

@router.put("/lessons/{lesson_id}/note")
async def save_user_lesson_note(
    lesson_id: int,
    data: NoteUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    res = await db.execute(
        select(UserLessonNote).where(
            UserLessonNote.lesson_id == lesson_id,
            UserLessonNote.user_id == user.id
        )
    )
    note = res.scalar_one_or_none()
    if note:
        note.content = data.content
    else:
        note = UserLessonNote(
            lesson_id=lesson_id,
            user_id=user.id,
            content=data.content
        )
        db.add(note)
    await db.commit()
    await db.refresh(note)
    return note.to_dict()


