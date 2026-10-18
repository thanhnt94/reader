import re
from typing import List, Dict, Any, Optional

try:
    import pykakasi
    _kks = pykakasi.kakasi()
except Exception:
    _kks = None

class FuriganaService:
    """
    Intelligent Japanese Furigana generator.
    Safely converts Kanji into <ruby>漢字<rt>かんじ</rt></ruby> while strictly
    preserving existing markdown code blocks, KaTeX math formulas, URLs,
    and pre-existing HTML ruby tags.
    """

    @classmethod
    def is_available(cls) -> bool:
        return _kks is not None

    @classmethod
    def generate_furigana(cls, text: str) -> Dict[str, Any]:
        if not text:
            return {"converted_text": "", "kanji_count": 0, "ruby_added": 0}

        if _kks is None:
            return {
                "converted_text": text,
                "kanji_count": 0,
                "ruby_added": 0,
                "warning": "pykakasi is not available on server"
            }

        placeholders: Dict[str, str] = {}
        token_counter = 0

        def protect(pattern: str, s: str, flags: int = 0) -> str:
            nonlocal token_counter
            def repl(m: re.Match) -> str:
                nonlocal token_counter
                tok = f"__PROTECT_TOKEN_{token_counter}__"
                token_counter += 1
                placeholders[tok] = m.group(0)
                return tok
            return re.sub(pattern, repl, s, flags=flags)

        # 1. Protect YAML frontmatter
        s = protect(r'^---\s*\n[\s\S]*?\n---\s*\n', text)
        # 2. Protect multi-line code blocks (```...```)
        s = protect(r'```[\s\S]*?```', s)
        # 3. Protect inline code (`...`)
        s = protect(r'`[^`\n]+`', s)
        # 4. Protect KaTeX display math ($$...$$)
        s = protect(r'\$\$[\s\S]*?\$\$', s)
        # 5. Protect KaTeX inline math ($...$)
        s = protect(r'(?<!\\)\$[^\$\n]+?\$', s)
        # 6. Protect markdown links [title](url)
        s = protect(r'\[[^\]]+\]\([^\)]+\)', s)
        # 7. Protect existing <ruby>...</ruby> tags
        s = protect(r'<ruby[\s\S]*?<\/ruby>', s, flags=re.IGNORECASE)
        # 8. Protect HTML tags e.g. <ja>, <vi>, <vocabcard ... />, etc.
        s = protect(r'<[a-zA-Z\/][^>]*>', s)

        # 9. Split by token pattern
        token_regex = re.compile(r'(__PROTECT_TOKEN_\d+__)')
        chunks = token_regex.split(s)

        ruby_added_count = 0
        total_kanji_count = 0
        converted_chunks = []

        kanji_regex = re.compile(r'[\u4e00-\u9faf]')
        # Strictly match Japanese continuous runs
        jp_segment_pattern = re.compile(r'([\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff\u3000-\u303f]+)')

        def convert_jp_run(match: re.Match) -> str:
            nonlocal ruby_added_count, total_kanji_count
            seg = match.group(1)
            if not kanji_regex.search(seg):
                return seg
            parts = []
            for item in _kks.convert(seg):
                orig = item.get('orig', '')
                hira = item.get('hira', '')
                kanjis_found = kanji_regex.findall(orig)
                total_kanji_count += len(kanjis_found)
                if kanjis_found and orig != hira:
                    parts.append(f"<ruby>{orig}<rt>{hira}</rt></ruby>")
                    ruby_added_count += 1
                else:
                    parts.append(orig)
            return ''.join(parts)

        for chunk in chunks:
            if chunk in placeholders:
                converted_chunks.append(chunk)
                continue

            # Safely process only Japanese runs within this chunk
            converted_chunk = jp_segment_pattern.sub(convert_jp_run, chunk)
            converted_chunks.append(converted_chunk)

        result = ''.join(converted_chunks)

        # 10. Restore protected placeholders in exact reverse order
        for tok, orig_val in placeholders.items():
            result = result.replace(tok, orig_val)

        return {
            "converted_text": result,
            "kanji_count": total_kanji_count,
            "ruby_added": ruby_added_count
        }
