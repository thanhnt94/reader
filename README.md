# 📖 Reader LMS — Interactive MDX & Smart Speech Narration Platform

**Reader** (`read.inmind.site`) là nền tảng bài giảng số (File-driven LMS) trong Hệ sinh thái InMind Ecosystem. Ứng dụng cho phép tạo khóa học từ các file Markdown (`.md`), tích hợp trình đọc tương tác cấp độ 4 (Interactive MDX), trình phát âm thanh thông minh đa ngôn ngữ (Smart Browser Speech Narration), và xác thực tập trung qua **CentralAuth**.

---

## 🌐 Thông số Kỹ thuật & Cổng Dịch vụ
* **Domain**: `read.inmind.site` (hỗ trợ cả `reader.inmind.site`)
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
4. **CentralAuth Synchronized TTS Audio Player**:
   - Đồng bộ hóa tạo âm thanh bài đọc trực tiếp qua CentralAuth (`POST /api/tts/generate`), lưu trữ tập trung tại CDN CentralAuth (`https://inmind.site/static/reader/{lesson_id}/audio/...`).
   - Trình phát âm thanh tiêu chuẩn hiện đại (Modern Glassmorphic Docked Player): Play/Pause, tua ±10s, chọn tốc độ đọc (0.8x - 2.0x), thanh tua tiến trình (Seekable Scrubber), điều chỉnh âm lượng & Mute.
   - Trải nghiệm đọc sách tự nhiên, mượt mà, tích hợp trình đọc giọng nói trình duyệt Web Speech API tức thời.
5. **CentralAuth SSO Integration & Công Tắc Bật Tắt (SSO Toggle)**:
   - Hỗ trợ công tắc bật/tắt linh hoạt giữa **Đăng nhập tập trung CentralAuth** (`https://inmind.site/api/auth/jump/reader-v1`) và **Đăng nhập tài khoản nội bộ** (Local Login / Backdoor Bypass `?backdoor=1`).
   - Tích hợp Modal Cài đặt SSO với tính năng Kiểm tra kết nối tức thời (`POST /api/sso/test`).
6. **Bố cục 3 cột (3-Column Layout)**:
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
