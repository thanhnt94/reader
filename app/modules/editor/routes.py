from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.modules.auth.routes.auth_routes import get_current_user
from app.modules.auth.models import User
from .services.furigana_service import FuriganaService
from .services.repair_service import RepairService
from .services.smart_converter import SmartConverter
from .services.vocaburn_bridge import VocaburnBridgeService

router = APIRouter(prefix="/api/v1/editor", tags=["WYSIWYG Editor Tools"])

class FuriganaRequest(BaseModel):
    text: str

class AutoFixRequest(BaseModel):
    markdown: str

class LintRequest(BaseModel):
    markdown: str

class SmartConvertRequest(BaseModel):
    raw_text: str
    auto_furigana: Optional[bool] = True

class VocaburnCardRequest(BaseModel):
    front: str
    back: Optional[str] = ""
    reading: Optional[str] = ""
    context: Optional[str] = ""
    lesson_title: Optional[str] = ""

@router.post("/auto-furigana")
async def auto_generate_furigana(req: FuriganaRequest, user: User = Depends(get_current_user)):
    """Automatically adds <ruby>...</ruby> Furigana annotations to Japanese Kanji text."""
    return FuriganaService.generate_furigana(req.text)

@router.post("/auto-fix")
async def auto_fix_markdown(req: AutoFixRequest, user: User = Depends(get_current_user)):
    """Self-healing Markdown & HTML: fixes unclosed tags, malformed ruby, KaTeX, and TTS spacing."""
    return RepairService.fix_markdown(req.markdown)

@router.post("/lint")
async def lint_markdown(req: LintRequest, user: User = Depends(get_current_user)):
    """Lints Markdown text and returns health score (0-100), warnings, and structural stats."""
    return RepairService.lint_markdown(req.markdown)

@router.post("/smart-convert")
async def smart_convert_notes(req: SmartConvertRequest, user: User = Depends(get_current_user)):
    """Converts raw dumped text (ChatGPT / Word / PDF notes) into structured interactive MDX lesson."""
    return SmartConverter.convert_raw_text(req.raw_text, auto_furigana=req.auto_furigana if req.auto_furigana is not None else True)

@router.post("/vocaburn/save-card")
async def save_card_to_vocaburn(req: VocaburnCardRequest, user: User = Depends(get_current_user)):
    """Saves or updates a vocabulary / sentence card into Vocaburn LMS Deck directly."""
    try:
        return VocaburnBridgeService.save_flashcard(
            front=req.front,
            back=req.back or "",
            reading=req.reading,
            context=req.context,
            lesson_title=req.lesson_title,
            user_id=getattr(user, "id", None)
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

