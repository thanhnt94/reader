import os
import re
import json
import asyncio
import hashlib
import edge_tts
from typing import List, Dict, Any, Tuple
from app.core.config import settings

class TTSService:
    VOICES = {
        "ja": "ja-JP-NanamiNeural",
        "vi": "vi-VN-HoaiMyNeural",
        "en": "en-US-AriaNeural"
    }

    @classmethod
    def clean_markdown_for_tts(cls, md: str) -> List[str]:
        """Cleans markdown text into readable sentences/paragraphs."""
        if not md:
            return []

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
        clean = re.sub(r'<[^>]+>', '', clean)  # Strip any remaining HTML tags

        # 5. Remove images and adjust links
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

        # Split into meaningful sentences or paragraphs
        lines = [line.strip() for line in clean.split('\n') if line.strip()]
        sentences = []
        for line in lines:
            # Split line by sentence terminators (Japanese 。！？ and Western .!?)
            parts = re.split(r'([。！？.!?]+)', line)
            current = ""
            for i in range(0, len(parts), 2):
                seg = parts[i].strip()
                punct = parts[i+1].strip() if i+1 < len(parts) else ""
                combined = (seg + punct).strip()
                if combined:
                    if len(combined) > 4:
                        sentences.append(combined)
                    else:
                        if sentences:
                            sentences[-1] += " " + combined
                        else:
                            sentences.append(combined)
        return sentences

    @classmethod
    def detect_language(cls, text: str) -> str:
        """Detects if sentence is primarily Japanese, Vietnamese, or English."""
        # Japanese characters: Hiragana, Katakana, Kanji
        jp_chars = len(re.findall(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', text))
        if jp_chars > 0 and (jp_chars / max(len(text), 1)) > 0.15:
            return "ja"
        
        # Vietnamese tone accents
        vi_chars = len(re.findall(r'[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]', text, re.IGNORECASE))
        if vi_chars > 0:
            return "vi"

        return "en"

    @classmethod
    async def synthesize_lesson(cls, lesson_id: int, markdown_text: str) -> Tuple[str, str, float, List[Dict[str, Any]]]:
        """
        Synthesizes lesson audio and generates word/sentence timestamps for Karaoke.
        Returns: (audio_url, timestamps_url, duration, timestamps)
        """
        sentences = cls.clean_markdown_for_tts(markdown_text)
        if not sentences:
            return "", "", 0.0, []

        os.makedirs(settings.AUDIO_DIR, exist_ok=True)
        
        content_hash = hashlib.md5(markdown_text.encode('utf-8')).hexdigest()[:12]
        base_filename = f"lesson_{lesson_id}_{content_hash}"
        audio_filename = f"{base_filename}.mp3"
        json_filename = f"{base_filename}_timestamps.json"
        
        audio_path = os.path.join(settings.AUDIO_DIR, audio_filename)
        json_path = os.path.join(settings.AUDIO_DIR, json_filename)

        # Check if already generated
        if os.path.exists(audio_path) and os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                duration = data[-1]["end"] if data else 0.0
                return f"/uploads/audio/{audio_filename}", f"/uploads/audio/{json_filename}", duration, data

        temp_files = []
        timestamps = []
        current_time = 0.0

        import tempfile
        from pydub import AudioSegment

        for idx, sentence in enumerate(sentences):
            lang = cls.detect_language(sentence)
            voice = cls.VOICES.get(lang, cls.VOICES["vi"])

            fd, temp_seg_path = tempfile.mkstemp(suffix=f"_seg_{idx}.mp3")
            os.close(fd)

            try:
                communicate = edge_tts.Communicate(sentence, voice)
                await communicate.save(temp_seg_path)
                
                # Read duration via pydub
                seg_audio = AudioSegment.from_file(temp_seg_path)
                seg_duration = len(seg_audio) / 1000.0  # in seconds

                start_time = round(current_time, 2)
                end_time = round(current_time + seg_duration, 2)

                timestamps.append({
                    "id": f"s-{idx}",
                    "sentence_idx": idx,
                    "start": start_time,
                    "end": end_time,
                    "lang": lang,
                    "text": sentence
                })

                temp_files.append(temp_seg_path)
                current_time = end_time + 0.3  # 300ms pause between sentences
            except Exception as e:
                if os.path.exists(temp_seg_path):
                    os.remove(temp_seg_path)
                continue

        if not temp_files:
            return "", "", 0.0, []

        # Merge segments using pydub
        combined = AudioSegment.empty()
        pause = AudioSegment.silent(duration=300)

        for i, tf in enumerate(temp_files):
            seg_audio = AudioSegment.from_file(tf)
            if i > 0:
                combined += pause
            combined += seg_audio

        combined.export(audio_path, format="mp3")
        total_duration = round(len(combined) / 1000.0, 2)

        # Clean temp files
        for tf in temp_files:
            if os.path.exists(tf):
                try:
                    os.remove(tf)
                except Exception:
                    pass

        # Write timestamps JSON
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(timestamps, f, ensure_ascii=False, indent=2)

        audio_url = f"/uploads/audio/{audio_filename}"
        timestamps_url = f"/uploads/audio/{json_filename}"

        return audio_url, timestamps_url, total_duration, timestamps
