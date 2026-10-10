from fastapi import APIRouter, Depends, Request, Response, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import hashlib

from app.core.db import get_db
from app.core.config import settings
from app.modules.auth.models import User
from app.modules.sso_module.cookie_signer import verify_cookie, sign_cookie
from app.modules.sso_module.service import SSOService

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

def hash_pw(pw: str) -> str:
    return hashlib.sha256((pw + settings.SECRET_KEY).encode()).hexdigest()

async def get_current_user_optional(request: Request, db: AsyncSession = Depends(get_db)) -> Optional[User]:
    # 1. Try Cookie
    raw_cookie = request.cookies.get("user_id")
    user_id_str = None
    if raw_cookie:
        user_id_str = verify_cookie(raw_cookie, settings.SECRET_KEY)
        if not user_id_str and raw_cookie.isdigit():
            user_id_str = raw_cookie

    # 2. Try Authorization header
    if not user_id_str:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            user_id_str = verify_cookie(token, settings.SECRET_KEY)

    if not user_id_str or not user_id_str.isdigit():
        return None

    res = await db.execute(select(User).where(User.id == int(user_id_str)))
    return res.scalar_one_or_none()

async def get_current_user(user: Optional[User] = Depends(get_current_user_optional)) -> User:
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user

class LoginRequest(BaseModel):
    username: str
    password: str
    is_backdoor: Optional[bool] = False

@router.get("/me")
async def get_me(user: Optional[User] = Depends(get_current_user_optional)):
    if not user:
        return {"authenticated": False, "user": None}
    return {"authenticated": True, "user": user.to_dict()}

@router.post("/login")
async def local_login(data: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    config = await SSOService.get_config(db)
    
    # Backdoor rule: If SSO is enabled, only admins can log in locally
    res = await db.execute(select(User).where(User.username == data.username.strip()))
    user = res.scalar_one_or_none()
    
    hashed = hash_pw(data.password)
    
    # Check demo admin bootstrap if no users exist
    if not user and data.username.strip() == "admin" and data.password == "admin123":
        user = User(
            username="admin",
            full_name="Administrator",
            hashed_password=hashed,
            role="admin"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    if not user or user.hashed_password != hashed:
        raise HTTPException(status_code=400, detail="Invalid username or password")

    if config.is_enabled and user.role != "admin" and not data.is_backdoor:
        raise HTTPException(status_code=403, detail="SSO is active. Only administrator backdoor access is allowed.")

    signed_id = sign_cookie(str(user.id), settings.SECRET_KEY)
    response.set_cookie(key="user_id", value=signed_id, httponly=True, path="/", samesite="lax", max_age=2592000)
    
    return {
        "status": "success",
        "user": user.to_dict(),
        "token": signed_id
    }

@router.get("/logout")
async def logout(response: Response):
    response.delete_cookie(key="user_id", path="/")
    return {"status": "success", "message": "Logged out successfully"}
