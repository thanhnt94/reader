import re
from typing import Dict, Any, List
from .furigana_service import FuriganaService

class SmartConverter:
    """
    Intelligent converter that transforms raw unformatted notes,
    ChatGPT dumps, Word/PDF transcripts into polished interactive MDX lessons.
    """

    @classmethod
    def convert_raw_text(cls, raw_text: str, auto_furigana: bool = True) -> Dict[str, Any]:
        if not raw_text or not raw_text.strip():
            return {
                "title": "Untitled Lesson",
                "markdown": "",
                "suggested_tags": []
            }

        lines = [l.strip() for l in raw_text.split('\n')]
        extracted_title = ""
        structured_lines: List[str] = []
        suggested_tags: List[str] = []

        i = 0
        while i < len(lines):
            line = lines[i]
            if not line:
                structured_lines.append("")
                i += 1
                continue

            # 1. Detect Lesson Title / Question Header
            # e.g.: "Câu 1: ...", "Question 1: ...", "Mẫu 51: ...", "Bài 1: ..."
            m_header = re.match(r'^(?:câu|question|mẫu|bài|part|chương)\s*(\d+)[:\.\-\s]+(.*)$', line, re.IGNORECASE)
            if m_header and not extracted_title:
                num = m_header.group(1)
                rest = m_header.group(2).strip()
                extracted_title = f"Câu {num.zfill(2)}: {rest}"
                structured_lines.append(f"# 📌 {extracted_title}\n")
                suggested_tags.append("Luyện phản xạ")
                i += 1
                continue

            # First line as title if starts with # or is bold
            if not extracted_title and (line.startswith('# ') or (len(line) < 100 and i == 0)):
                clean_title = re.sub(r'^[#*_\s]+', '', line).strip()
                extracted_title = clean_title
                structured_lines.append(f"# {clean_title}\n")
                i += 1
                continue

            # 2. Detect Question Translation or Prompt
            # e.g. "Dịch câu hỏi:", "Dịch:", "Nghĩa:"
            m_trans = re.match(r'^(?:dịch câu hỏi|dịch|nghĩa|dịch nghĩa|tiếng việt)[:\s]+(.*)$', line, re.IGNORECASE)
            if m_trans:
                content = m_trans.group(1).strip()
                structured_lines.append(f"> **Dịch câu hỏi:** {content}\n")
                i += 1
                continue

            # 3. Detect Japanese Sample Answer Section
            # e.g. "Câu trả lời mẫu:", "Mẫu câu:", "Example:"
            if re.match(r'^(?:câu trả lời mẫu|câu mẫu|mẫu câu|câu trả lời|example|sample answer)[:\s]*$', line, re.IGNORECASE):
                structured_lines.append("### 💬 Câu trả lời mẫu\n")
                i += 1
                continue

            # 4. Detect Vocabulary list block and convert to Markdown Table
            if re.match(r'^(?:từ vựng|từ mới|vocabulary|vocab)[:\s]*$', line, re.IGNORECASE):
                structured_lines.append("### 💡 Từ vựng quan trọng\n")
                structured_lines.append("| Từ vựng | Cách đọc | Ý nghĩa |")
                structured_lines.append("| :--- | :--- | :--- |")
                i += 1
                # Consume subsequent lines that look like vocabulary entries: "word: meaning" or "word - meaning"
                while i < len(lines):
                    sub_line = lines[i]
                    if not sub_line:
                        break
                    m_vocab = re.match(r'^[-*•]?\s*([^:\-–=]+)\s*[:\-–=]\s*(.+)$', sub_line)
                    if m_vocab:
                        word = m_vocab.group(1).strip()
                        meaning = m_vocab.group(2).strip()
                        structured_lines.append(f"| {word} | - | {meaning} |")
                        i += 1
                    else:
                        break
                structured_lines.append("")
                continue

            # 5. Detect bullet points
            if re.match(r'^[-*•]\s+(.*)$', line):
                content = re.sub(r'^[-*•]\s+', '', line)
                structured_lines.append(f"- {content}")
                i += 1
                continue

            # 6. Detect Japanese sentence line followed by translation line
            has_japanese = bool(re.search(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', line))
            if has_japanese and i + 1 < len(lines) and lines[i + 1]:
                next_line = lines[i + 1]
                # If next line is Vietnamese translation
                has_vietnamese = bool(re.search(r'[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]', next_line, re.IGNORECASE))
                if has_vietnamese and not re.search(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', next_line):
                    structured_lines.append(f"> {line}")
                    structured_lines.append(f"> *{next_line}*\n")
                    i += 2
                    continue

            # Default: append line
            structured_lines.append(line)
            i += 1

        final_md = '\n'.join(structured_lines).strip()

        # If title not found, use default
        if not extracted_title:
            extracted_title = "Bài học mới"
            final_md = f"# {extracted_title}\n\n" + final_md

        # Optionally auto-generate Furigana for all Japanese Kanji
        if auto_furigana:
            furi_res = FuriganaService.generate_furigana(final_md)
            final_md = furi_res.get("converted_text", final_md)

        return {
            "title": extracted_title,
            "markdown": final_md,
            "suggested_tags": suggested_tags or ["Tự động tạo"]
        }
