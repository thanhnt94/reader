import re
from typing import Dict, Any, List

class RepairService:
    """
    Self-healing Markdown & HTML engine for Reader LMS.
    Automatically identifies and fixes syntax errors, unclosed tags,
    malformed Japanese ruby markup, and formatting issues.
    """

    @classmethod
    def fix_markdown(cls, md: str) -> Dict[str, Any]:
        if not md:
            return {"fixed_markdown": "", "issues_fixed": [], "changes_count": 0}

        fixed = md
        issues_fixed: List[str] = []

        # 1. Fix unclosed / malformed Japanese Ruby tags
        # Pattern 1a: <ruby>KANJI<rt>HIRA without </rt> or </ruby>
        def fix_unclosed_ruby_both(m: re.Match) -> str:
            issues_fixed.append("Đóng thẻ ruby & rt bị thiếu cú pháp")
            kanji = m.group(1)
            reading = m.group(2)
            return f"<ruby>{kanji}<rt>{reading}</rt></ruby>"

        fixed, count = re.subn(
            r'<ruby>([^<]+)<rt>([^<]+?)(?=(?:[\s\n.,!?;:)]|$|<ruby|<p|<div|<h[1-6]))',
            fix_unclosed_ruby_both,
            fixed
        )

        # Pattern 1b: <ruby>KANJI<rt>HIRA</rt> without </ruby>
        def fix_unclosed_ruby_close(m: re.Match) -> str:
            issues_fixed.append("Bổ sung thẻ đóng </ruby>")
            return f"<ruby>{m.group(1)}<rt>{m.group(2)}</rt></ruby>"

        fixed, count = re.subn(
            r'<ruby>([^<]+)<rt>([^<]+)<\/rt>(?!<\/ruby>)',
            fix_unclosed_ruby_close,
            fixed
        )

        # Pattern 1c: Empty <ruby></ruby>
        if "<ruby></ruby>" in fixed or "<ruby><rt></rt></ruby>" in fixed:
            fixed = fixed.replace("<ruby></ruby>", "").replace("<ruby><rt></rt></ruby>", "")
            issues_fixed.append("Loại bỏ thẻ ruby trống")

        # 2. Fix unclosed inline language tags (<ja>...</ja>, <vi>...</vi>)
        for tag in ['ja', 'vi', 'u', 'b', 'i']:
            open_count = len(re.findall(rf'<{tag}>', fixed))
            close_count = len(re.findall(rf'<\/{tag}>', fixed))
            if open_count > close_count:
                diff = open_count - close_count
                fixed += f"</{tag}>" * diff
                issues_fixed.append(f"Tự đóng {diff} thẻ <{tag}> chưa đóng")

        # 3. Fix unclosed code blocks (```)
        code_block_count = len(re.findall(r'(?m)^```', fixed))
        if code_block_count % 2 != 0:
            fixed = fixed.rstrip() + "\n```\n"
            issues_fixed.append("Tự đóng khối code block (```) còn thiếu")

        # 4. Fix unclosed KaTeX math blocks ($$)
        katex_block_count = len(re.findall(r'\$\$', fixed))
        if katex_block_count % 2 != 0:
            fixed = fixed.rstrip() + "\n$$\n"
            issues_fixed.append("Tự đóng khối công thức toán KaTeX ($$)")

        # 5. Fix TTS sentence separation: ensure blank line between Japanese text and Vietnamese translation
        # Detect Japanese character followed immediately by newline and *translation* or Vietnamese text
        pattern_tts_merge = re.compile(
            r'([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF][^\n]*)\n(\s*\*[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ][^\n]*\*)'
        )
        if pattern_tts_merge.search(fixed):
            fixed = pattern_tts_merge.sub(r'\1\n\n\2', fixed)
            issues_fixed.append("Tự tách dòng câu tiếng Nhật và câu dịch tiếng Việt để TTS đọc rành mạch")

        # 6. Normalize trailing spaces and excessive blank lines (> 2 newlines -> 2 newlines)
        fixed_normalized = re.sub(r'[ \t]+$', '', fixed, flags=re.MULTILINE)
        fixed_normalized = re.sub(r'\n{3,}', '\n\n', fixed_normalized)
        if fixed_normalized != fixed:
            fixed = fixed_normalized
            issues_fixed.append("Căn chỉnh khoảng cách & xóa dòng trống thừa")

        return {
            "fixed_markdown": fixed,
            "issues_fixed": issues_fixed,
            "changes_count": len(issues_fixed)
        }

    @classmethod
    def lint_markdown(cls, md: str) -> Dict[str, Any]:
        if not md or not md.strip():
            return {
                "score": 0,
                "status": "empty",
                "issues": ["Bài giảng hiện chưa có nội dung"],
                "stats": {"headings": 0, "ruby_count": 0, "word_count": 0}
            }

        issues: List[Dict[str, str]] = []

        # 1. Check Headings
        headings = re.findall(r'(?m)^#{1,6}\s+(.+)$', md)
        if not headings:
            issues.append({
                "level": "warning",
                "message": "Bài học chưa có tiêu đề đề mục (# hoặc ##). Nên thêm đề mục để tạo Mục lục (TOC)."
            })

        # 2. Check code blocks
        code_block_count = len(re.findall(r'(?m)^```', md))
        if code_block_count % 2 != 0:
            issues.append({
                "level": "error",
                "message": "Khối mã nguồn (```) chưa được đóng."
            })

        # 3. Check KaTeX math
        math_count = len(re.findall(r'\$\$', md))
        if math_count % 2 != 0:
            issues.append({
                "level": "error",
                "message": "Khối công thức toán ($$) chưa được đóng."
            })

        # 4. Check ruby tags
        ruby_open = len(re.findall(r'<ruby>', md, re.IGNORECASE))
        ruby_close = len(re.findall(r'<\/ruby>', md, re.IGNORECASE))
        if ruby_open != ruby_close:
            issues.append({
                "level": "warning",
                "message": f"Số thẻ mở <ruby> ({ruby_open}) không khớp số thẻ đóng </ruby> ({ruby_close})."
            })

        # 5. Check word & character count
        word_count = len(md.split())
        ruby_count = ruby_open

        # Calculate score (100 is perfect)
        score = 100
        for iss in issues:
            if iss["level"] == "error":
                score -= 30
            elif iss["level"] == "warning":
                score -= 15
        score = max(0, score)

        status = "excellent" if score >= 90 else ("good" if score >= 70 else "needs_fix")

        return {
            "score": score,
            "status": status,
            "issues": issues,
            "stats": {
                "headings": len(headings),
                "ruby_count": ruby_count,
                "word_count": word_count,
                "char_count": len(md)
            }
        }
