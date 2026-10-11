# 📘 Quy Chuẩn Soạn Thảo File Bài Học Markdown (.md) Cho InMind Reader

> **Tài liệu hướng dẫn chuẩn hóa cấu trúc nội dung, siêu dữ liệu (frontmatter), bảng biểu, furigana và tối ưu hóa âm thanh (Audio / TTS Continuous Playback) cho hệ thống InMind Reader.**

---

## 📑 Mục lục
1. [Cấu trúc thư mục & Khóa học (Folder Structure)](#1-cấu-trúc-thư-mục--khóa-học)
2. [Cấu trúc file Markdown chuẩn (.md Anatomy)](#2-cấu-trúc-file-markdown-chuẩn)
3. [Quy chuẩn âm thanh & TTS Song ngữ (Audio & TTS Engine)](#3-quy-chuẩn-âm-thanh--tts-song-ngữ)
4. [Cú pháp Furigana (Chữ Hán có phiên âm)](#4-cú-pháp-furigana)
5. [Ẩn nội dung khỏi Audio với `<nospeech>`](#5-ẩn-nội-dung-khỏi-audio-với-nospeech)
6. [Bảng biểu, Ghi chú & Định dạng MDX](#6-bảng-biểu-ghi-chú--định-dạng-mdx)
7. [File mẫu chuẩn hoàn chỉnh (Full Working Template)](#7-file-mẫu-chuẩn-hoàn-chỉnh)
8. [Checklist kiểm tra trước khi Import](#8-checklist-kiểm-tra-trước-khi-import)

---

## 1. Cấu trúc thư mục & Khóa học

Hệ thống InMind Reader hỗ trợ cơ chế **Batch Import** (qua file `.zip` hoặc đường dẫn thư mục). Hệ thống sẽ tự động phân cấp thành **Khóa học (Course) ➔ Chương (Chapter) ➔ Bài học (Lesson)** dựa trên cấu trúc thư mục:

```text
📁 Tên_Khóa_Học/                  (Cấp 1: Tên Khóa học - ví dụ: JSST)
│
├── 📁 01. Xin phép & Nghỉ phép/  (Cấp 2: Tên Chương 1 - đánh số 01, 02 để xếp thứ tự)
│   ├── 01. Đau bụng xin nghỉ.md  (Cấp 3: File bài học 1)
│   ├── 02. Xin đi muộn.md        (Cấp 3: File bài học 2)
│   └── 03. Xin về sớm.md
│
├── 📁 02. Báo cáo & Trao đổi/    (Cấp 2: Tên Chương 2)
│   ├── 01. Báo cáo tiến độ.md
│   └── 02. Xin ý kiến sếp.md
│
└── 📁 03. Nhờ vả & Từ chối/
    └── 01. Nhờ đồng nghiệp giúp.md
```

> [!TIP]
> **Đánh số thứ tự**: Hãy luôn đặt tiền tố số thứ tự cho thư mục và file (ví dụ `01. `, `02. `, `03. `) để hệ thống tự động sắp xếp danh mục và bài học theo đúng lộ trình mong muốn.

---

## 2. Cấu trúc file Markdown chuẩn

Mỗi file `.md` nên bao gồm 2 phần chính:
1. **YAML Frontmatter** (nằm ở đầu file, kẹp giữa cặp `---`).
2. **Nội dung Markdown** (thân bài học).

### 2.1. YAML Frontmatter (Siêu dữ liệu)

```yaml
---
title: "勤務時間中の外部研修参加の許可を取る"
order: 6
tts: true
audio_url: ""
duration: 0
tags:
  - "Xin phép"
  - "Công sở"
  - "N3-N2"
---
```

| Trường | Bắt buộc | Mặc định | Ý nghĩa |
| :--- | :---: | :---: | :--- |
| `title` | Không | Lấy tên file hoặc H1 | Tiêu đề bài học hiển thị trên trang và mục lục |
| `order` | Không | Tự động tăng | Thứ tự bài học trong chương |
| `tts` | Không | `true` | Bật/tắt tính năng đọc TTS cho bài học này |
| `audio_url` | Không | `null` | Đường dẫn file MP3 thu âm sẵn (nếu có audio người thật đọc) |
| `duration` | Không | `0` | Thời lượng audio tính bằng giây (nếu có `audio_url`) |
| `tags` | Không | `[]` | Danh sách nhãn phân loại bài học |

---

## 3. Quy chuẩn âm thanh & TTS Song ngữ

Hệ thống InMind Reader được trang bị **Engine TTS Song ngữ thông minh (Bilingual Smart Engine)**. Để âm thanh đọc mượt mà, tự nhiên và tự động chuyển câu/chuyển bài không lỗi, hãy tuân thủ các quy tắc sau:

### 3.1. Cấu trúc Song ngữ Xen kẽ (Sentence-by-Sentence Interleaving)
Trình phát TTS sẽ đọc từng câu theo thứ tự: **1 câu tiếng Nhật ➔ 1 câu dịch tiếng Việt tương ứng**.

```markdown
休みの日は、いつもより少し遅く起きて、家で猫と遊んで過ごします。
*Vào ngày nghỉ, tôi dậy muộn hơn bình thường một chút, và dành thời gian ở nhà chơi với mèo.*

私の猫はとても可愛くて、一緒にいるだけで毎日のストレスが解消されます。
*Mèo của tôi rất đáng yêu, chỉ cần ở bên cạnh nó thôi là bao căng thẳng mỗi ngày đều tan biến.*
```

- **Quy ước**:
  - Dòng trên: **Câu tiếng Nhật gốc**.
  - Dòng dưới ngay sau: **Dịch tiếng Việt** (khuyến khích viết *in nghiêng* `*...*` để phân biệt trực quan về mặt thị giác).
  - Cách 1 dòng trống trước khi sang cặp câu tiếp theo.
- **Cách hoạt động của Audio**:
  - Máy đọc câu Nhật ➔ Tạm dừng $x$ giây (theo cài đặt *Nghỉ câu*) ➔ Đọc câu dịch Việt ➔ Tạm dừng $x$ giây ➔ Đọc câu Nhật tiếp theo...
  - Người học có thể shadowing (nhại theo) và nắm trọn nghĩa của từng câu mà không cần phải nhìn xuống cuối bài.

### 3.2. Không ghi các nhãn phụ (Prefixes) trong câu đọc
Tránh viết các nhãn như:
- ❌ `Câu 01: 休みの日は...` (TTS sẽ đọc cả chữ "Câu không một")
- ❌ `Dịch nghĩa: Vào ngày nghỉ...`
- ❌ `Tiếng Nhật: 休みの日は...`
- ❌ `📌 Câu hỏi:`
- ✅ **Chỉ viết câu văn trực tiếp**:
  ```markdown
  休みの日は、いつもより少し遅く起きて、家で猫と遊んで過ごします。
  *Vào ngày nghỉ, tôi dậy muộn hơn bình thường một chút, và dành thời gian ở nhà chơi với mèo.*
  ```

---

## 4. Cú pháp Furigana (Chữ Hán có phiên âm)

Hệ thống hỗ trợ thẻ HTML `<ruby>` chuẩn W3C để hiển thị phiên âm Hiragana trên đầu chữ Hán:

```html
<ruby>研修<rt>けんしゅう</rt></ruby>に<ruby>参加<rt>さんか</rt></ruby>したいと<ruby>思<rt>おも</rt></ruby>っております。
```

- **Màn hình hiển thị**:
  Chữ Hán hiển thị to, phiên âm Hiragana nhỏ xinh nằm ngay ngắn phía trên đầu chữ Hán.
- **Xử lý Audio thông minh**:
  Trình phát TTS **tự động bóc tách** thẻ `<rt>...</rt>` và `<rp>...</rp>`. Máy chỉ đọc chữ Hán chính, **tuyệt đối không bị lỗi đọc lặp** cả Kanji lẫn Kana.

---

## 5. Ẩn nội dung khỏi Audio với `<nospeech>`

Trong một bài học, có những phần **chỉ dành cho mắt xem** (như bảng dàn ý PREP, phân tích ngữ pháp, bảng so sánh từ vựng thay thế) mà **không muốn audio đọc ê a từng chữ**.

Hãy bao bọc đoạn đó trong thẻ `<nospeech>...</nospeech>`:

```html
<nospeech>

### 💡 Dàn ý trả lời (PREP)
| Bước | Ý chính | Câu gợi ý |
| :--- | :--- | :--- |
| **Point** | Xin phép tham gia | 外部研修への参加許可をいただきたく... |
| **Reason** | Lý do cần học | 業務効率化に直結するスキルのため... |

</nospeech>
```

- **Trên giao diện**: Người dùng vẫn nhìn thấy bảng biểu, dàn ý, icon bình thường.
- **Trên Audio TTS**: Trình phát sẽ tự động lướt qua đoạn này, không đọc vào tai người nghe.

> [!NOTE]
> Ngoài ra, các tiêu đề H2/H3 như `## Dàn ý`, `## Từ vựng`, `## Ghi chú` nằm ở cuối bài cũng được Engine tự động nhận diện và bỏ qua khi đọc.

---

## 6. Bảng biểu, Ghi chú & Định dạng MDX

### 6.1. Tiêu đề phân cấp (H1, H2, H3)
- `# Tiêu đề bài học` (Chỉ dùng 1 lần ở đầu bài).
- `## Phần lớn` (Ví dụ: `## Tình huống`, `## Câu trả lời mẫu`).
- `### Mục con` (Ví dụ: `### Cách nói trang trọng`, `### Cách nói ngắn gọn`).
- Hệ thống tự động trích xuất các tiêu đề `##` và `###` thành **Table of Contents (Mục lục cuộn)** bên thanh điều hướng.

### 6.2. Hộp lưu ý / Callout Box
Sử dụng cú pháp blockquote Markdown để tạo các khung ghi chú đẹp mắt:

```markdown
> [!TIP]
> Khi xin phép cấp trên, hãy luôn trình bày trước lý do và lợi ích đối với công ty (lợi ích kép) thay vì chỉ nói nguyện vọng cá nhân.

> [!WARNING]
> Không được tự ý đăng ký khóa học trước khi có sự đồng ý chính thức của cấp trên quản lý trực tiếp.
```

---

## 7. File mẫu chuẩn hoàn chỉnh (Full Working Template)

Dưới đây là một file mẫu hoàn chỉnh đạt 100% chuẩn kỹ thuật để anh có thể sao chép và chỉnh sửa nội dung:

```markdown
---
title: "06. 勤務時間中の外部研修参加の許可を取る"
order: 6
tts: true
tags:
  - "Xin phép"
  - "Nghỉ phép"
  - "Role Play"
---

# 勤務時間中の外部研修参加の許可を取る

## 📌 Tình huống
来週の金曜日の午後に開催される「業務効率化のためのPython基礎研修」に参加したいです。参加の許可を取ってください。
*Bạn muốn tham gia buổi "Đào tạo cơ bản về Python phục vụ nâng cao hiệu suất công việc" diễn ra vào chiều thứ Sáu tuần tới. Hãy xin phép cấp trên.*

---

## 💬 Bài nói mẫu

部長、今、少しお時間をいただいてもよろしいでしょうか。
*Trưởng phòng, bây giờ anh có thể cho em xin ít phút được không ạ?*

実は、来週の金曜日の午後に、業務効率化のための<ruby>外部研修<rt>がいぶけんしゅう</rt></ruby>が開催されるのですが、そちらに参加させていただきたいと考えております。
*Thực ra vào chiều thứ Sáu tuần tới có buổi đào tạo bên ngoài về nâng cao hiệu suất công việc, em muốn xin phép được tham gia buổi đó ạ.*

研修では、日常業務の自動化やデータ集計の高速化について学べる内容となっており、現在のチーム業務にも直接活かせると考えております。
*Nội dung khóa học hướng dẫn tự động hóa công việc hằng ngày và đẩy nhanh tốc độ tổng hợp dữ liệu, em thấy có thể ứng dụng trực tiếp vào công việc hiện tại của nhóm mình ạ.*

金曜日の午後は定例業務を前倒しで終わらせ、緊急の対応が入った場合も連絡が取れるように準備いたします。
*Chiều thứ Sáu em sẽ hoàn thành trước các đầu việc định kỳ, đồng thời luôn bật liên lạc để sẵn sàng hỗ trợ nếu có phát sinh khẩn cấp ạ.*

参加費は無料で、業務時間中の2時間ほど席を外す形となりますが、ご許可いただけますでしょうか。
*Khóa đào tạo hoàn toàn miễn phí, em chỉ xin phép vắng mặt khoảng 2 tiếng trong giờ làm việc, mong anh xem xét và cho phép em tham gia ạ.*

---

<nospeech>

## 💡 Dàn ý trả lời (PREP)

| Bước | Nội dung | Câu gợi ý tiếng Nhật |
| :--- | :--- | :--- |
| **Point** | Đặt vấn đề xin phép | 外部研修への参加許可をいただきたく... |
| **Reason** | Lý do & Giá trị mang lại | 業務効率化に直結するスキルのため... |
| **Arrangement** | Sắp xếp công việc chu toàn | 定例業務は前倒しで対応いたします... |
| **Ask** | Xin quyết định của sếp | ご許可いただけますでしょうか。 |

## 📚 Từ vựng hữu ích

- <ruby>外部研修<rt>がいぶけんしゅう</rt></ruby>: Đào tạo bên ngoài công ty
- <ruby>業務効率化<rt>ぎょうむこうりつか</rt></ruby>: Nâng cao hiệu suất công việc
- <ruby>前倒し<rt>まえだおし</rt></ruby>にする: Đẩy sớm tiến độ, làm trước hạn
- <ruby>席を外す<rt>せきをはずす</rt></ruby>: Vắng mặt tại bàn làm việc

</nospeech>
```

---

## 8. Checklist kiểm tra trước khi Import

Trước khi nén thư mục thành `.zip` hoặc import vào InMind Reader, hãy kiểm tra nhanh:

- [ ] **Mã hóa file**: File được lưu với encoding **UTF-8** (không dùng UTF-16, Shift-JIS).
- [ ] **Định dạng cặp câu**: Câu tiếng Nhật ở trên, dòng dịch nghĩa tiếng Việt ở ngay dưới (in nghiêng).
- [ ] **Không sót Prefix rác**: Không viết `Câu 01:`, `Dịch:`, `Tiếng Nhật:` ở đầu câu.
- [ ] **Thẻ `<nospeech>`**: Các bảng biểu dài, dàn ý, từ vựng phụ đã được kẹp trong `<nospeech>...</nospeech>`.
- [ ] **Thẻ `<ruby>` hợp lệ**: Các thẻ phiên âm đóng mở đúng cú pháp `<ruby>漢字<rt>かんじ</rt></ruby>`.
- [ ] **Tên file & thư mục**: Có tiền tố số thứ tự rõ ràng (`01. `, `02. `).
