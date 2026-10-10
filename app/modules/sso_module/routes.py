import logging
import asyncio
import socket
import urllib.parse
from typing import Optional
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.db import get_db
from app.core.config import settings
from .service import SSOService
from .cookie_signer import sign_cookie
from app.modules.auth.models import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["SSO Integration"])

_HEALTH_CACHE = {"status": False, "ts": 0}

def _check_host(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=1.5):
            return True
    except Exception:
        if "inmind.site" in host:
            try:
                with socket.create_connection(("inmind.site", port), timeout=1.5):
                    return True
            except Exception:
                pass
        return False

@router.get("/api/v1/auth/config")
async def get_auth_config(db: AsyncSession = Depends(get_db)):
    """Public authentication configuration endpoint for pure SPA."""
    config = await SSOService.get_config(db)
    raw_server_url = config.server_url.rstrip("/") if config and config.server_url else settings.CENTRAL_AUTH_URL
    # Normalize auth.inmind.site to inmind.site if needed
    if "auth.inmind.site" in raw_server_url:
        raw_server_url = raw_server_url.replace("auth.inmind.site", "inmind.site")
        config.server_url = raw_server_url
        await db.commit()
    server_url = raw_server_url
    
    sso_active = bool(config.is_enabled)
    if sso_active and server_url:
        import time
        now = time.time()
        if now - _HEALTH_CACHE["ts"] < 30:
            sso_active = _HEALTH_CACHE["status"]
        else:
            try:
                parsed = urllib.parse.urlparse(server_url)
                host = parsed.hostname
                port = parsed.port or (443 if parsed.scheme == "https" else 80)
                if not host:
                    sso_active = False
                else:
                    sso_active = await asyncio.to_thread(_check_host, host, port)
            except Exception:
                sso_active = False
            _HEALTH_CACHE["status"] = sso_active
            _HEALTH_CACHE["ts"] = now

    client_id = config.client_id or settings.CLIENT_ID
    return {
        "auth_provider": "central" if sso_active else "local",
        "sso_enabled": sso_active,
        "central_auth_url": server_url,
        "jump_url": f"{server_url}/api/auth/jump/{client_id}" if sso_active and server_url else None
    }

@router.get("/auth-center/callback")
async def sso_callback(request: Request, code: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Standardized callback for CentralAuth SSO."""
    if not code:
        logger.error("SSO callback called without code. Redirecting to /login.")
        return RedirectResponse(url="/login", status_code=303)

    try:
        user_data, error = await SSOService.verify_sso_code(db, code)
    except Exception as e:
        logger.error(f"SSO verification exception: {e}")
        return RedirectResponse(url="/login?backdoor=1&error=SSO+service+error", status_code=303)

    if error or not user_data:
        err_msg = error or "No+user+data+returned"
        logger.error(f"SSO verification error: {err_msg}")
        return RedirectResponse(url=f"/login?backdoor=1&error={err_msg}", status_code=303)

    sso_id = str(user_data.get("id"))
    username = user_data.get("username")
    email = user_data.get("email")
    role = user_data.get("role", "user")

    # 1. Search by sso_id
    res = await db.execute(select(User).where(User.sso_id == sso_id))
    user = res.scalar_one_or_none()

    if not user and email:
        res = await db.execute(select(User).where(User.email == email))
        user = res.scalar_one_or_none()

    if not user and username:
        res = await db.execute(select(User).where(User.username == username))
        user = res.scalar_one_or_none()

    if user:
        user.sso_id = sso_id
        if username:
            user.username = username
        if email:
            user.email = email
    else:
        # Create new user
        target_username = username or f"user_{sso_id}"
        uname_dup = await db.execute(select(User).where(User.username == target_username))
        if uname_dup.scalar_one_or_none() is not None:
            target_username = f"{target_username}_{sso_id[-4:]}"

        user = User(
            username=target_username,
            email=email,
            full_name=username or target_username,
            sso_id=sso_id
        )
        db.add(user)

    if role:
        user.role = role

    try:
        await db.commit()
        await db.refresh(user)
    except Exception as commit_err:
        await db.rollback()
        logger.error(f"Failed to persist SSO user: {commit_err}")
        return RedirectResponse(url="/login?backdoor=1&error=User+sync+failed", status_code=303)

    logger.info(f"SSO login success for user: {user.username} (id={user.id})")

    res = RedirectResponse(url="/", status_code=303)
    signed_id = sign_cookie(str(user.id), settings.SECRET_KEY)
    res.set_cookie(key="user_id", value=signed_id, httponly=True, path="/", samesite="lax", max_age=2592000)
    return res

class HandshakeRequest(BaseModel):
    client_id: str
    client_secret: str

@router.post("/api/admin/sso/handshake")
async def sso_handshake(req: HandshakeRequest, db: AsyncSession = Depends(get_db)):
    """Dynamic DB discovery endpoint for CentralAuth Admin Hub."""
    config = await SSOService.get_config(db)
    expected_client_id = config.client_id or settings.CLIENT_ID
    expected_client_secret = config.client_secret or settings.CLIENT_SECRET

    if expected_client_id != req.client_id:
        raise HTTPException(status_code=401, detail="Client ID mismatch")

    if expected_client_secret != req.client_secret:
        raise HTTPException(status_code=401, detail="Client Secret mismatch")

    # Get absolute DB path
    db_url = settings.DATABASE_URL
    import os
    db_path = db_url.split("///")[-1] if "///" in db_url else db_url
    if not os.path.isabs(db_path):
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        db_path = os.path.abspath(os.path.join(project_root, db_path))

    return {
        "success": True,
        "db_path": db_path
    }

@router.get("/api/sso/config")
async def get_sso_config(db: AsyncSession = Depends(get_db)):
    config = await SSOService.get_config(db)
    return config.to_dict()

@router.post("/api/sso/config")
async def update_sso_config(data: dict, db: AsyncSession = Depends(get_db)):
    config = await SSOService.get_config(db)
    if "is_enabled" in data:
        config.is_enabled = bool(data["is_enabled"])
    if "server_url" in data and data["server_url"]:
        raw_url = str(data["server_url"]).strip().rstrip("/")
        if "auth.inmind.site" in raw_url:
            raw_url = raw_url.replace("auth.inmind.site", "inmind.site")
        config.server_url = raw_url
    if "client_id" in data and data["client_id"]:
        config.client_id = str(data["client_id"]).strip()
    if "client_secret" in data and data["client_secret"]:
        config.client_secret = str(data["client_secret"]).strip()
    await db.commit()
    await db.refresh(config)
    _HEALTH_CACHE["ts"] = 0
    return {"success": True, "config": config.to_dict()}

@router.post("/api/sso/test")
async def test_sso_connection(data: dict = None, db: AsyncSession = Depends(get_db)):
    config = await SSOService.get_config(db)
    target_url = (data.get("server_url") if data else None) or config.server_url or settings.CENTRAL_AUTH_URL
    target_url = target_url.strip().rstrip("/")
    if "auth.inmind.site" in target_url:
        target_url = target_url.replace("auth.inmind.site", "inmind.site")
    import httpx
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{target_url}/api/auth/health")
            if resp.status_code == 200:
                return {"status": "success", "message": "Connection to CentralAuth Successful!"}
            return {"status": "error", "message": f"CentralAuth responded with status {resp.status_code}"}
    except Exception as e:
        return {"status": "error", "message": f"Connection failed: {str(e)}"}
