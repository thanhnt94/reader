import os
import re
import hashlib
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
import edge_tts

from app.core.config import settings
from app.modules.sso_module.service import SSOService

logger = logging.getLogger(__name__)

class TTSService:
    VOICES = {
        "ja": "ja-JP-NanamiNeural",
        "vi": "vi-VN-HoaiMyNeural",
        "en": "en-US-AriaNeural"
    }

    @classmethod
    def clean_markdown_for_tts(cls, md: str) -> str:
        """Cleans markdown text into readable narration prose."""
        if not md:
            return ""

        # 1. Remove YAML frontmatter
        clean = re.sub(r'^---\s*[\s\S]*?---\s*', '', md)

        # 2. Remove code blocks and inline code
        clean = re.sub(r'```[\s\S]*?```', '', clean)
        clean = re.sub(r'`[^`\n]+`', '', clean)

        # 3. Remove custom MDX components <VocabCard .../> and <Quiz .../>
        clean = re.sub(r'<VocabCard[\s\S]*?/>', '', clean)
        clean = re.sub(r'<Quiz[\s\S]*?/>', '', clean)

        # 4. Handle Japanese Ruby tags: replace <ruby>漢字<rt>かんじ</rt></ruby> with 漢字
        clean = re.sub(r'<ruby>([^<]+)<rt>[^<]*</rt></ruby>', r'\1', clean)
        clean = re.sub(r'<[^>]+>', '', clean)  # Strip remaining HTML tags

        # 5. Remove images and keep link anchor texts
        clean = re.sub(r'!\[.*?\]\(.*?\)', '', clean)
        clean = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', clean)

        # 6. Remove GitHub alerts and blockquote markers
        clean = re.sub(r'^>\s*\[![A-Z]+\]', '', clean, flags=re.MULTILINE)
        clean = re.sub(r'^>\s*', '', clean, flags=re.MULTILINE)

        # 7. Remove Markdown headings and list bullets
        clean = re.sub(r'^#+\s*', '', clean, flags=re.MULTILINE)
        clean = re.sub(r'^\s*[-*+]\s+', '', clean, flags=re.MULTILINE)
        clean = re.sub(r'^\s*\d+\.\s+', '', clean, flags=re.MULTILINE)

        # 8. Remove Markdown tables formatting
        clean = re.sub(r'\|', ' ', clean)
        clean = re.sub(r'-{3,}', '', clean)

        # 9. Remove emphasis & bold markers
        clean = re.sub(r'[*_~]', '', clean)

        # 10. Normalize multiple whitespaces and empty lines
        lines = [line.strip() for line in clean.split('\n') if line.strip()]
        return "\n\n".join(lines)

    @classmethod
    def detect_language(cls, text: str) -> str:
        """Detects if text is Japanese, Vietnamese, or English."""
        jp_chars = len(re.findall(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', text))
        if jp_chars > 0 and (jp_chars / max(len(text), 1)) > 0.12:
            return "ja"

        vi_chars = len(re.findall(r'[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]', text, re.IGNORECASE))
        if vi_chars > 0:
            return "vi"

        return "en"

    @classmethod
    async def synthesize_lesson(cls, db: AsyncSession, lesson_id: int, markdown_text: str) -> Optional[str]:
        """
        Synthesizes lesson audio narration.
        Synchronizes via CentralAuth if SSO is enabled; otherwise generates locally via edge-tts.
        Returns: audio_url (string) or None if synthesis failed.
        """
        clean_text = cls.clean_markdown_for_tts(markdown_text)
        if not clean_text:
            return None

        lang = cls.detect_language(clean_text)
        sso_config = await SSOService.get_config(db)

        # 1. CentralAuth Synchronized TTS if Central SSO is enabled
        if sso_config and sso_config.is_enabled and sso_config.server_url:
            server_url = sso_config.server_url.rstrip("/")
            if "auth.inmind.site" in server_url:
                server_url = server_url.replace("auth.inmind.site", "inmind.site")

            logger.info(f"[TTS CENTRAL] Requesting CentralAuth TTS for lesson {lesson_id} (lang: {lang}) from {server_url}")
            try:
                # Try candidate URLs (external URL or unix socket)
                async with httpx.AsyncClient(timeout=45.0) as client:
                    tts_payload = {
                        "text": clean_text,
                        "app": "reader",
                        "folder": str(lesson_id),
                        "subfolder": "audio",
                        "lang": lang,
                        "bypass_parsing": True
                    }
                    resp = await client.post(
                        f"{server_url}/api/tts/generate",
                        json=tts_payload
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        rel_url = data.get("url", "")
                        resolved_url = f"{server_url}{rel_url}" if rel_url.startswith("/") else rel_url
                        logger.info(f"[TTS CENTRAL SUCCESS] Synced audio URL: {resolved_url}")
                        return resolved_url
                    else:
                        logger.warning(f"[TTS CENTRAL ERROR] CentralAuth TTS status {resp.status_code}: {resp.text}")
            except Exception as ca_err:
                logger.warning(f"[TTS CENTRAL WARNING] CentralAuth TTS request failed, falling back to local: {ca_err}")

        # 2. Local Fallback Synthesis via Edge-TTS
        try:
            os.makedirs(settings.AUDIO_DIR, exist_ok=True)
            voice = cls.VOICES.get(lang, cls.VOICES["vi"])
            content_hash = hashlib.md5(f"{lesson_id}_{clean_text}".encode('utf-8')).hexdigest()[:12]
            filename = f"lesson_{lesson_id}_{content_hash}.mp3"
            audio_path = os.path.join(settings.AUDIO_DIR, filename)

            if not os.path.exists(audio_path):
                logger.info(f"[TTS LOCAL] Synthesizing audio locally with voice {voice}")
                communicate = edge_tts.Communicate(clean_text, voice)
                await communicate.save(audio_path)

            local_url = f"/uploads/audio/{filename}"
            logger.info(f"[TTS LOCAL SUCCESS] Generated local audio: {local_url}")
            return local_url
        except Exception as local_err:
            logger.error(f"[TTS ERROR] Local synthesis failed: {local_err}")
            return None
