# 📖 Reader LMS — Interactive MDX & Karaoke TTS Platform

**Reader** (`reader.inmind.site`) là nền tảng bài giảng số (File-driven LMS) trong Hệ sinh thái InMind Ecosystem. Ứng dụng cho phép tạo khóa học từ các file Markdown (`.md`), tích hợp trình đọc tương tác cấp độ 4 (Interactive MDX), trình phát âm thanh Karaoke đồng bộ câu chữ (Read-Along TTS), và xác thực tập trung qua **CentralAuth**.

---

## 🌐 Thông số Kỹ thuật & Cổng Dịch vụ
* **Domain**: `reader.inmind.site`
* **Local Dev Port**: `5070` (`http://localhost:5070`)
* **CentralAuth Client ID**: `reader-v1`
* **Database**: `Storage/database/Reader.db` (SQLite WAL mode)
* **Media Storage**: `Storage/Reader/uploads/` (Audio `.mp3`, Timestamps `.json`)

---

## 🚀 Tính năng Nổi bật
1. **Interactive MDX Level 4**:
   - Chuẩn GitHub Flavored Markdown (GFM): Bảng biểu, checklist task `- [x]`, GitHub Alerts (`[!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!IMPORTANT]`, `[!CAUTION]`).
   - Sơ đồ Mermaid (`mermaid.js`) & Công thức Toán học KaTeX / LaTeX ($E=mc^2$).
   - Nhận diện URL YouTube để tự động chuyển thành video player responsive.
   - Code Block phong cách VS Code dark theme: line numbers, language badge, 1-click Copy button.
   - Thẻ ngữ âm Furigana tiếng Nhật `<ruby>漢字<rt>かんじ</rt></ruby>`.
   - Component tương tác: `<VocabCard />` kết nối Vocaburn, `<Quiz />` kết nối QuizMind.
2. **Dual-Pane WYSIWYG / Markdown Live Editor (`/editor`)**:
   - Một bên soạn thảo Markdown thô với phím tắt chèn nhanh, một bên hiển thị Live MDX Preview tức thì.
   - Lưu trữ trực tiếp vào cơ sở dữ liệu dưới dạng Markdown chuẩn.
3. **Batch Import Khóa học**:
   - Nạp hàng loạt qua file `.zip` hoặc quét trực tiếp thư mục máy chủ (ví dụ `Ecosystem/JSST`).
   - Bóc tách YAML Frontmatter (`title`, `order`, `duration`, `tts: true`) và trích xuất Table of Contents (TOC) tự động.
4. **Karaoke Read-Along & Multilingual TTS**:
   - Tiền xử lý văn bản tiếng Nhật/Việt/Anh sạch sẽ (loại bỏ code block, url, cú pháp markdown).
   - Tự động sinh file audio `.mp3` chất lượng cao bằng `edge-tts` và file timestamps `.json`.
   - Trình phát docked bottom bar: Play/Pause, tua ±10s, chọn tốc độ đọc (0.8x - 1.5x), tự động highlight câu đang đọc và cuộn màn hình mượt mà.
5. **Bố cục 3 cột (3-Column Layout)**:
   - Sidebar phân cấp Cây thư mục (Khóa học -> Chương -> Bài học) có trạng thái đã đọc.
   - Cột đọc bài tối ưu typography, hỗ trợ Focus Mode.
   - Mục lục bài viết (TOC) bám dính khi cuộn màn hình (Scrollspy).

---

## 🛠️ Khởi chạy Ứng dụng
```bash
# 1. Chạy độc lập
python run_reader.py

# 2. Cập nhật từ xa lên VPS
python remote_update_reader.py
```
