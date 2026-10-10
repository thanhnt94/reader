from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.core.db import get_db
from app.modules.auth.routes.auth_routes import get_current_user
from app.modules.auth.models import User
from .models import UserGlobalSettings

router = APIRouter(prefix="/api/v1/user/settings", tags=["User Settings"])

class UpdateSettingsRequest(BaseModel):
    reading_theme: Optional[str] = None
    font_size: Optional[str] = None
    line_spacing: Optional[str] = None
    audio_speed: Optional[float] = None
    auto_scroll: Optional[bool] = None

@router.get("")
async def get_user_settings(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(UserGlobalSettings).where(UserGlobalSettings.user_id == user.id))
    settings_obj = res.scalar_one_or_none()
    if not settings_obj:
        settings_obj = UserGlobalSettings(user_id=user.id)
        db.add(settings_obj)
        await db.commit()
        await db.refresh(settings_obj)
    return settings_obj.to_dict()

@router.post("")
async def update_user_settings(data: UpdateSettingsRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(UserGlobalSettings).where(UserGlobalSettings.user_id == user.id))
    settings_obj = res.scalar_one_or_none()
    if not settings_obj:
        settings_obj = UserGlobalSettings(user_id=user.id)
        db.add(settings_obj)

    if data.reading_theme is not None:
        settings_obj.reading_theme = data.reading_theme
    if data.font_size is not None:
        settings_obj.font_size = data.font_size
    if data.line_spacing is not None:
        settings_obj.line_spacing = data.line_spacing
    if data.audio_speed is not None:
        settings_obj.audio_speed = data.audio_speed
    if data.auto_scroll is not None:
        settings_obj.auto_scroll = data.auto_scroll

    await db.commit()
    await db.refresh(settings_obj)
    return settings_obj.to_dict()
