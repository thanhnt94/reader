import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import SSOConfig
from fastapi import HTTPException
from app.core.config import settings

class SSOService:
    @staticmethod
    async def get_config(db: AsyncSession) -> SSOConfig:
        result = await db.execute(select(SSOConfig))
        config = result.scalar_one_or_none()
        if not config:
            config = SSOConfig(
                is_enabled=True,
                server_url=settings.CENTRAL_AUTH_URL,
                client_id=settings.CLIENT_ID,
                client_secret=settings.CLIENT_SECRET
            )
            db.add(config)
            await db.commit()
            await db.refresh(config)
        return config

    @staticmethod
    async def verify_sso_code(db: AsyncSession, code: str):
        config = await SSOService.get_config(db)
        if not config.is_enabled:
            raise HTTPException(status_code=400, detail="SSO is disabled locally")

        # Prioritize internal URL if available for speed and reliability
        candidate_urls = [config.server_url]
        if settings.CENTRALAUTH_INTERNAL_URL and settings.CENTRALAUTH_INTERNAL_URL != config.server_url:
            candidate_urls.insert(0, settings.CENTRALAUTH_INTERNAL_URL)

        last_error = None
        for base_url in candidate_urls:
            try:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    res = await client.post(
                        f"{base_url.rstrip('/')}/api/auth/token",
                        json={
                            "code": code,
                            "client_id": config.client_id,
                            "client_secret": config.client_secret
                        }
                    )
                    if res.status_code != 200:
                        last_error = f"Token exchange failed ({res.status_code})"
                        continue
                    
                    token_data = res.json()
                    access_token = token_data.get("access_token")
                    if not access_token:
                        last_error = "Missing access_token in response"
                        continue

                    v_res = await client.get(
                        f"{base_url.rstrip('/')}/api/auth/verify-token",
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
                    if v_res.status_code != 200:
                        last_error = f"Verification failed ({v_res.status_code})"
                        continue
                    
                    user_data = v_res.json().get("user")
                    return user_data, None
            except Exception as e:
                last_error = str(e)
                continue

        return None, last_error or "CentralAuth unreachable"
