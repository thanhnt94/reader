import os
import re
import hashlib
import logging
from typing import Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx
import edge_tts

from app.core.config import settings
from app.modules.sso_module.service import SSOService
from app.modules.course.models import LessonAudioTrack, AUDIO_SLOT_PRESETS, Lesson

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

        # 3. Remove nospeech tags and custom components
        clean = re.sub(r'<nospeech[\s\S]*?</nospeech>', '', clean, flags=re.IGNORECASE)
        clean = re.sub(r'<VocabCard[\s\S]*?/>', '', clean)
        clean = re.sub(r'<Quiz[\s\S]*?/>', '', clean)

        # 4. Handle Japanese Ruby tags: replace <ruby>漢字<rt>かんじ</rt></ruby> with 漢字
        clean = re.sub(r'<rt[^>]*>[\s\S]*?</rt>', '', clean, flags=re.IGNORECASE)
        clean = re.sub(r'<rp[^>]*>[\s\S]*?</rp>', '', clean, flags=re.IGNORECASE)
        clean = re.sub(r'<ruby>([^<]+)</ruby>', r'\1', clean)
        # Strip all HTML tags EXCEPT explicit language tags <ja>, <vi>, <en> for optional manual override
        clean = re.sub(r'<(?!/?(?:ja|vi|en)\b)[^>]+>', '', clean)

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

        # 10. Strip label-only prefixes so audio flows naturally
        clean = re.sub(r'^(?:[Cc]âu\s*\d+|[Dd]ịch\s*câu\s*hỏi|[Dd]ịch\s*tình\s*huống|[Tt]ình\s*huống|[Dd]ịch\s*nghĩa|[Tt]iếng\s*[Nn]hật|[Tt]iếng\s*[Vv]iệt|[Tt]ừ\s*vựng|[Gg]hi\s*chú|[Ll]ưu\s*ý)[\s:*_.-]*', '', clean, flags=re.MULTILINE)

        # 11. Normalize multiple whitespaces and empty lines
        lines = [line.strip() for line in clean.split('\n') if line.strip()]
        return "\n\n".join(lines)

    @classmethod
    def detect_language(cls, text: str, default_lang: str = "ja") -> str:
        """
        Intelligently detects if text is Japanese, Vietnamese, or English.
        Numbers, symbols, or unclassified items gracefully fall back to default_lang (Main Language).
        """
        jp_chars = len(re.findall(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', text))
        vi_chars = len(re.findall(r'[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]', text, re.IGNORECASE))
        has_vi_kw = bool(re.search(r'\b(câu|bài|bước|dịch|nghĩa|tiếng|ví dụ|hỏi|đáp|trả lời|dàn ý|từ vựng|mẫu|cú pháp|ngữ cảnh|tiến độ|trạng thái|thời gian|công việc|cộng|động từ|thể|tập|nhật|việt|nói|nghe|đọc|viết|tôi|bạn|thường|sử dụng|nhiều|hơn|bởi vì)\b', text, re.IGNORECASE))

        if jp_chars > 0 and jp_chars >= vi_chars and not has_vi_kw:
            return "ja"
        if (vi_chars > 0 or has_vi_kw) and jp_chars == 0:
            return "vi"
        if vi_chars > 0 or has_vi_kw:
            return "vi"
        if jp_chars > 0:
            return "ja"

        # Explicit English words check
        if re.search(r'\b(the|is|are|was|were|have|has|this|that|with|for|and|you|we|they|from|to|in|on|at|lesson|chapter)\b', text, re.IGNORECASE):
            return "en"

        # Pure numbers, abbreviations, neutral symbols fall back to Main Language!
        return default_lang

    @classmethod
    def segment_text_by_language(cls, markdown_text: str, main_lang: Optional[str] = None) -> list:
        """
        Segments markdown into clean narration chunks with automatic language tags.
        - Prioritizes Main Language for neutral elements (numbers, punctuation, symbols).
        - Switches dynamically to Japanese neural voice for Japanese phrases and Vietnamese for Vietnamese phrases.
        - Supports optional manual overrides (<ja>...</ja>, <vi>...</vi>, <en>...</en>) when explicitly specified.
        """
        # Determine Main Language from frontmatter or document content if not explicitly passed
        if not main_lang:
            fm_match = re.search(r'^---\s*[\s\S]*?(?:main_lang|lang):\s*[\'"]?([a-zA-Z_-]+)[\'"]?[\s\S]*?---', markdown_text)
            if fm_match:
                val = fm_match.group(1).lower()
                if val.startswith("ja"): main_lang = "ja"
                elif val.startswith("vi"): main_lang = "vi"
                elif val.startswith("en"): main_lang = "en"
                else: main_lang = "ja"
            elif re.search(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', markdown_text):
                main_lang = "ja"
            else:
                main_lang = "vi"

        clean_text = cls.clean_markdown_for_tts(markdown_text)
        lines = [line.strip() for line in clean_text.split('\n') if line.strip()]
        
        segments = []
        for line in lines:
            # 1. Check for explicit manual override tags: <ja>...</ja>, <vi>...</vi>, <en>...</en>
            if re.search(r'<(?:ja|vi|en)>[\s\S]*?<\/(?:ja|vi|en)>', line, re.IGNORECASE):
                tag_parts = re.split(r'(<(?:ja|vi|en)>[\s\S]*?<\/(?:ja|vi|en)>)', line, flags=re.IGNORECASE)
                for tp in tag_parts:
                    tp_str = tp.strip()
                    if not tp_str:
                        continue
                    m_ja = re.match(r'^<ja>([\s\S]*?)</ja>$', tp_str, re.IGNORECASE)
                    m_vi = re.match(r'^<vi>([\s\S]*?)</vi>$', tp_str, re.IGNORECASE)
                    m_en = re.match(r'^<en>([\s\S]*?)</en>$', tp_str, re.IGNORECASE)
                    if m_ja:
                        segments.append({"text": m_ja.group(1).strip(), "lang": "ja"})
                    elif m_vi:
                        segments.append({"text": m_vi.group(1).strip(), "lang": "vi"})
                    elif m_en:
                        segments.append({"text": m_en.group(1).strip(), "lang": "en"})
                    else:
                        clean_residual = re.sub(r'<[^>]+>', '', tp_str).strip()
                        if clean_residual:
                            segments.append({"text": clean_residual, "lang": cls.detect_language(clean_residual, main_lang)})
                continue

            # 2. Mixed sentence without tags: e.g. "Cú pháp: Động từ thể て ＋ はじめて、〜"
            has_ja = bool(re.search(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', line))
            has_vi = bool(re.search(r'[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]', line, re.IGNORECASE))
            has_vi_kw = bool(re.search(r'\b(câu|bài|bước|dịch|nghĩa|tiếng|ví dụ|hỏi|đáp|trả lời|dàn ý|từ vựng|mẫu|cú pháp|ngữ cảnh|tiến độ|trạng thái|thời gian|công việc|cộng|động từ|thể|tập|nhật|việt|nói|nghe|đọc|viết|tôi|bạn|thường|sử dụng|nhiều|hơn|bởi vì)\b', line, re.IGNORECASE))

            if has_ja and (has_vi or has_vi_kw):
                # Split along Japanese character cluster boundaries
                parts = re.split(r'([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3001\u3002\u300C\u300D]+)', line)
                for p in parts:
                    p_clean = p.strip(' :-➡/+＋~〜*`_')
                    if not p_clean:
                        continue
                    p_has_ja = bool(re.search(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', p_clean))
                    p_has_vi = bool(re.search(r'[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]', p_clean, re.IGNORECASE))
                    p_has_vi_kw = bool(re.search(r'\b(câu|bài|bước|dịch|nghĩa|tiếng|ví dụ|hỏi|đáp|trả lời|dàn ý|từ vựng|mẫu|cú pháp|ngữ cảnh|tiến độ|trạng thái|thời gian|công việc|cộng|động từ|thể|tập|nhật|việt|nói|nghe|đọc|viết|tôi|bạn|thường|sử dụng|nhiều|hơn|bởi vì)\b', p_clean, re.IGNORECASE))
                    if p_has_ja:
                        segments.append({"text": p_clean, "lang": "ja"})
                    elif p_has_vi or p_has_vi_kw:
                        segments.append({"text": p_clean, "lang": "vi"})
                    else:
                        segments.append({"text": p_clean, "lang": main_lang})
            elif has_ja:
                segments.append({"text": line, "lang": "ja"})
            elif has_vi or has_vi_kw:
                segments.append({"text": line, "lang": "vi"})
            else:
                # Neutral content, isolated numbers, or symbols default to Main Language!
                segments.append({"text": line, "lang": cls.detect_language(line, main_lang)})

        # Merge consecutive segments with the same language to maximize natural speech flow
        merged = []
        for seg in segments:
            if not seg["text"]:
                continue
            if merged and merged[-1]["lang"] == seg["lang"]:
                sep = "。\n" if seg["lang"] == "ja" else ".\n"
                merged[-1]["text"] += sep + seg["text"]
            else:
                merged.append(seg)

        return merged

    @classmethod
    def segment_text_by_mode(cls, markdown_text: str, mode: str = "bilingual_interleaved", main_lang: Optional[str] = None) -> list:
        raw_segments = cls.segment_text_by_language(markdown_text, main_lang=main_lang or "ja")
        if not raw_segments:
            return []

        if mode == "japanese_only":
            return [s for s in raw_segments if s.get("lang") == "ja"]

        elif mode == "japanese_then_vietnamese":
            ja_segs = [s for s in raw_segments if s.get("lang") == "ja"]
            vi_segs = [s for s in raw_segments if s.get("lang") == "vi"]
            other_segs = [s for s in raw_segments if s.get("lang") not in ("ja", "vi")]

            merged = []
            if ja_segs:
                merged.extend(ja_segs)
            if other_segs:
                merged.extend(other_segs)
            if vi_segs:
                if ja_segs:
                    merged.append({"text": "Bản dịch tiếng Việt.", "lang": "vi"})
                merged.extend(vi_segs)
            return merged

        else:  # "bilingual_interleaved"
            return raw_segments

    @classmethod
    async def synthesize_lesson(
        cls,
        db: AsyncSession,
        lesson_id: int,
        markdown_text: str,
        slot_num: int = 1,
        mode_key: Optional[str] = None,
        force: bool = False,
        audio_script: Optional[str] = None
    ) -> Optional[str]:
        """
        Synthesizes lesson audio narration using Microsoft Edge-TTS natural neural voices.
        Supports 3 distinct audio slots with customizable audio scripts and pauses.
        """
        # Resolve track and preset details
        preset = next((p for p in AUDIO_SLOT_PRESETS if p["slot_num"] == slot_num), None)
        resolved_mode = mode_key or (preset["mode_key"] if preset else f"slot_{slot_num}")
        slot_title = preset["title"] if preset else f"Slot {slot_num}"
        slot_desc = preset["description"] if preset else None

        # Check existing track in DB
        track_res = await db.execute(
            select(LessonAudioTrack).where(
                LessonAudioTrack.lesson_id == lesson_id,
                LessonAudioTrack.slot_num == slot_num
            )
        )
        existing_track = track_res.scalar_one_or_none()
        if existing_track:
            if existing_track.title:
                slot_title = existing_track.title
            if existing_track.description:
                slot_desc = existing_track.description

        effective_script = audio_script
        if not effective_script and existing_track and existing_track.audio_script:
            effective_script = existing_track.audio_script

        if effective_script and effective_script.strip():
            clean_text = effective_script.strip()
            segments = []
            for line in clean_text.split('\n'):
                line = line.strip()
                if not line:
                    continue
                pause_m = re.match(r'^\[pause(?::\s*(\d+(?:\.\d+)?)\s*(s|ms)?)?\]$', line, re.IGNORECASE)
                if pause_m:
                    val = float(pause_m.group(1) or 1)
                    unit = (pause_m.group(2) or 's').lower()
                    dur_ms = int(val * 1000 if unit == 's' else val)
                    segments.append({"pause": dur_ms})
                    continue

                signal_m = re.match(r'^\[(?:signal|chime|beep)(?::\s*([a-zA-Z0-9_-]+))?\]$', line, re.IGNORECASE)
                if signal_m:
                    segments.append({"signal": signal_m.group(1) or "chime"})
                    continue

                lang = cls.detect_language(line, default_lang="ja")
                segments.append({"text": line, "lang": lang})
        else:
            clean_text = cls.clean_markdown_for_tts(markdown_text)
            if not clean_text:
                return None
            segments = cls.segment_text_by_mode(markdown_text, mode=resolved_mode, main_lang="ja")

        if not segments:
            return None

        os.makedirs(settings.AUDIO_DIR, exist_ok=True)
        content_hash = hashlib.md5(f"{lesson_id}_{slot_num}_{clean_text}".encode('utf-8')).hexdigest()[:12]
        filename = f"lesson_{lesson_id}_slot{slot_num}_{content_hash}.mp3"
        audio_path = os.path.join(settings.AUDIO_DIR, filename)

        if os.path.exists(audio_path) and not force:
            local_url = f"/uploads/audio/{filename}"
            logger.info(f"[TTS CACHE HIT] Reusing cached audio: {local_url} for slot {slot_num}")
            await cls._save_audio_track(db, lesson_id, slot_num, resolved_mode, slot_title, slot_desc, local_url, audio_path, effective_script)
            return local_url

        # Format bilingual chunks for CentralAuth parser: [ja: ...][vi: ...]
        bracket_segments = [
            f"[{s['lang']}: {s['text'].strip()}]"
            for s in segments
            if s.get("text", "").strip()
        ]
        bracket_payload_text = "".join(bracket_segments)

        # -------------------------------------------------------------
        # STEP 1: Attempt CentralAuth Unified Chunking & Stitching
        # -------------------------------------------------------------
        central_sock = "/var/www/CentralAuth/centralauth.sock"
        central_payload = {
            "text": bracket_payload_text,
            "lang": "multi",
            "app": "reader",
            "folder": f"lesson_{lesson_id}/slot_{slot_num}",
            "subfolder": "audio"
        }

        generated_url = None
        try:
            if any(s.get("pause") or s.get("signal") for s in segments):
                raise ValueError("Script contains custom pause or signal tags; bypass CentralAuth to stitch locally with pydub silence/chime")
            ca_response_data = None
            if os.path.exists(central_sock):
                logger.info(f"[TTS CENTRAL] Dispatching {len(segments)} chunks (slot {slot_num}) to CentralAuth via unix socket...")
                transport = httpx.AsyncHTTPTransport(uds=central_sock)
                async with httpx.AsyncClient(transport=transport, timeout=60.0) as client:
                    resp = await client.post("http://localhost/api/tts/generate", json=central_payload)
                    if resp.status_code == 200:
                        ca_response_data = resp.json()
            else:
                ca_url = getattr(settings, "CENTRALAUTH_INTERNAL_URL", "https://auth.inmind.site").rstrip("/")
                if "auth.inmind.site" in ca_url:
                    ca_url = ca_url.replace("auth.inmind.site", "inmind.site")
                logger.info(f"[TTS CENTRAL] Dispatching {len(segments)} chunks (slot {slot_num}) to CentralAuth at {ca_url}...")
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.post(f"{ca_url}/api/tts/generate", json=central_payload)
                    if resp.status_code == 200:
                        ca_response_data = resp.json()

            if ca_response_data and "url" in ca_response_data:
                rel_url = ca_response_data["url"]
                logger.info(f"[TTS CENTRAL SUCCESS] CentralAuth generated unified audio for slot {slot_num}: {rel_url}")

                ca_static_candidates = [
                    os.path.join("/var/www/CentralAuth/app", rel_url.lstrip("/")),
                    os.path.join("/var/www/CentralAuth", rel_url.lstrip("/"))
                ]
                copied = False
                for ca_path in ca_static_candidates:
                    if os.path.exists(ca_path):
                        import shutil
                        shutil.copyfile(ca_path, audio_path)
                        logger.info(f"[TTS COPIED] Copied CentralAuth audio to Reader storage: {audio_path}")
                        generated_url = f"/uploads/audio/{filename}"
                        copied = True
                        break

                if not copied:
                    clean_rel_url = rel_url.replace("auth.inmind.site", "inmind.site")
                    download_target = f"https://inmind.site{clean_rel_url}" if clean_rel_url.startswith("/") else clean_rel_url
                    try:
                        async with httpx.AsyncClient(timeout=30.0) as dl_client:
                            dl_resp = await dl_client.get(download_target)
                            if dl_resp.status_code == 200:
                                with open(audio_path, "wb") as f_out:
                                    f_out.write(dl_resp.content)
                                generated_url = f"/uploads/audio/{filename}"
                    except Exception as dl_err:
                        logger.warning(f"[TTS DOWNLOAD FALLBACK]: {dl_err}")
                        generated_url = download_target
        except Exception as ca_err:
            logger.warning(f"[TTS CENTRAL ENGINE FAILED, FALLING BACK TO LOCAL]: {ca_err}")

        # -------------------------------------------------------------
        # STEP 2: Local Resilience Fallback (Edge-TTS + pydub stitching)
        # -------------------------------------------------------------
        if not generated_url:
            try:
                logger.info(f"[TTS LOCAL] Synthesizing {len(segments)} segments locally for lesson {lesson_id} slot {slot_num}")
                import tempfile
                temp_chunk_files = []

                combined_items = []

                for idx, seg in enumerate(segments):
                    if seg.get("pause"):
                        combined_items.append(("pause", seg["pause"]))
                        continue
                    if seg.get("signal"):
                        combined_items.append(("signal", seg["signal"]))
                        continue

                    seg_text = seg.get("text", "").strip()
                    if not seg_text:
                        continue
                    voice = cls.VOICES.get(seg.get("lang"), cls.VOICES["ja"])

                    tf = tempfile.NamedTemporaryFile(suffix=f"_chunk_{idx}.mp3", delete=False)
                    tf_path = tf.name
                    tf.close()

                    comm = edge_tts.Communicate(seg_text, voice)
                    await comm.save(tf_path)
                    temp_chunk_files.append(tf_path)
                    combined_items.append(("file", tf_path))

                if combined_items:
                    stitched_with_pydub = False
                    try:
                        from pydub import AudioSegment
                        for p in ["/usr/bin", "/usr/local/bin", "/bin"]:
                            if p not in os.environ.get("PATH", ""):
                                os.environ["PATH"] = f"{p}:{os.environ.get('PATH', '')}"
                        for fpath in ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]:
                            if os.path.exists(fpath):
                                AudioSegment.converter = fpath
                                break

                        combined = AudioSegment.empty()
                        default_pause = AudioSegment.silent(duration=300)

                        for i, item in enumerate(combined_items):
                            if item[0] == "pause":
                                combined += AudioSegment.silent(duration=item[1])
                            elif item[0] == "signal":
                                try:
                                    from pydub.generators import Sine
                                    # Two-tone examination chime: 880Hz (A5, 220ms) -> 1175Hz (D6, 450ms)
                                    tone1 = Sine(880).to_audio_segment(duration=220).fade_in(20).fade_out(60) - 4
                                    tone2 = Sine(1175).to_audio_segment(duration=450).fade_in(20).fade_out(120) - 4
                                    chime = tone1 + AudioSegment.silent(duration=60) + tone2
                                    combined += chime
                                except Exception as chime_err:
                                    logger.warning(f"[TTS CHIME GENERATOR FAILED]: {chime_err}")
                                    combined += AudioSegment.silent(duration=500)
                            elif item[0] == "file":
                                if i > 0 and combined_items[i-1][0] not in ("pause", "signal"):
                                    combined += default_pause
                                combined += AudioSegment.from_file(item[1])

                        combined.export(audio_path, format="mp3")
                        stitched_with_pydub = True
                        logger.info(f"[TTS LOCAL PYDUB] Successfully stitched {len(combined_items)} items with natural pauses")
                    except Exception as pydub_err:
                        logger.warning(f"[TTS PYDUB UNAVAILABLE]: {pydub_err}, falling back to direct stream merge")

                    if not stitched_with_pydub:
                        with open(audio_path, "wb") as outfile:
                            for tf_path in temp_chunk_files:
                                with open(tf_path, "rb") as infile:
                                    outfile.write(infile.read())

                    for tf_path in temp_chunk_files:
                        try:
                            if os.path.exists(tf_path):
                                os.remove(tf_path)
                        except Exception:
                            pass

                    generated_url = f"/uploads/audio/{filename}"
            except Exception as local_err:
                logger.error(f"[TTS ERROR] Local Edge-TTS synthesis failed: {local_err}")
                return None

        if generated_url:
            await cls._save_audio_track(db, lesson_id, slot_num, resolved_mode, slot_title, slot_desc, generated_url, audio_path, effective_script)
            return generated_url
        return None

    @classmethod
    async def _save_audio_track(
        cls,
        db: AsyncSession,
        lesson_id: int,
        slot_num: int,
        mode_key: str,
        title: str,
        description: Optional[str],
        audio_url: str,
        audio_path: str,
        audio_script: Optional[str] = None
    ):
        duration = 0.0
        try:
            from pydub import AudioSegment
            if os.path.exists(audio_path):
                seg = AudioSegment.from_file(audio_path)
                duration = round(len(seg) / 1000.0, 2)
        except Exception:
            pass

        track_res = await db.execute(
            select(LessonAudioTrack).where(
                LessonAudioTrack.lesson_id == lesson_id,
                LessonAudioTrack.slot_num == slot_num
            )
        )
        track = track_res.scalar_one_or_none()
        if not track:
            track = LessonAudioTrack(
                lesson_id=lesson_id,
                slot_num=slot_num,
                mode_key=mode_key,
                title=title,
                description=description,
                audio_script=audio_script or "",
                audio_url=audio_url,
                duration_seconds=duration,
                tts_provider="edge-tts"
            )
            db.add(track)
        else:
            track.mode_key = mode_key
            track.title = title
            track.description = description
            if audio_script is not None:
                track.audio_script = audio_script
            track.audio_url = audio_url
            track.duration_seconds = duration
            track.updated_at = datetime.utcnow()

        if slot_num == 1:
            les_res = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
            cur_lesson = les_res.scalar_one_or_none()
            if cur_lesson:
                cur_lesson.audio_url = audio_url
                cur_lesson.duration_seconds = duration
                cur_lesson.tts_generated = True

        await db.commit()

