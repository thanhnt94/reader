# 📘 Hướng Dẫn Soạn Thảo File Bài Học Markdown (.md) Đơn Lẻ

> **Quy chuẩn kỹ thuật soạn thảo 1 file `.md` đơn lẻ cho hệ thống InMind Reader, tối ưu hóa 100% cho giao diện đọc và bộ máy phát âm thanh tự động (Bilingual Audio / Continuous TTS).**

---

## 📑 Mục lục
1. [Cấu trúc tổng quan của 1 file .md](#1-cấu-trúc-tổng-quan-của-1-file-md)
2. [Phần 1: YAML Frontmatter (Siêu dữ liệu đầu file)](#2-phần-1-yaml-frontmatter-siêu-dữ-liệu-đầu-file)
3. [Phần 2: Thân bài học & Quy chuẩn Audio TTS](#3-phần-2-thân-bài-học--quy-chuẩn-audio-tts)
4. [Phần 3: Phiên âm Furigana chuẩn W3C `<ruby>`](#4-phần-3-phiên-âm-furigana-chuẩn-w3c-ruby)
5. [Phần 4: Ẩn nội dung khỏi Audio bằng `<nospeech>`](#5-phần-4-ẩn-nội-dung-khỏi-audio-bằng-nospeech)
6. [Phần 5: Đánh dấu ngôn ngữ khi câu pha trộn (`<ja>`, `<vi>`)](#6-phần-5-đánh-dấu-ngôn-ngữ-khi-câu-pha-trộn-ja-vi)
7. [File mẫu chuẩn hoàn chỉnh (Copy & Dùng ngay)](#7-file-mẫu-chuẩn-hoàn-chỉnh-copy--dùng-ngay)
8. [Checklist kiểm tra 1 file .md trước khi lưu](#8-checklist-kiểm-tra-1-file-md-trước-khi-lưu)

---

## 1. Cấu trúc tổng quan của 1 file .md

Mỗi file `.md` bài học là một thực thể độc lập, gồm 2 phần rõ rệt:

```markdown
---
# PHẦN 1: YAML FRONTMATTER (Thông tin bài học)
title: "Tiêu đề bài học"
order: 1
tts: true
---

# PHẦN 2: THÂN BÀI HỌC (Nội dung hiển thị & Nội dung đọc Audio)

## 📌 Tình huống / Câu hỏi
[Câu tiếng Nhật]
*[Dịch tiếng Việt in nghiêng]*

## 💬 Bài nói mẫu / Nội dung bài
[Câu tiếng Nhật 1]
*[Dịch tiếng Việt câu 1]*

[Câu tiếng Nhật 2]
*[Dịch tiếng Việt câu 2]*

<nospeech>
## 💡 Dàn ý & Ghi chú (Chỉ mắt xem, không đọc audio)
...
</nospeech>
```

---

## 2. Phần 1: YAML Frontmatter (Siêu dữ liệu đầu file)

Nằm ở **dòng đầu tiên** của file, kẹp giữa hai dấu `---`:

```yaml
---
title: "06. 勤務時間中の外部研修参加の許可を取る"
order: 6
tts: true
tags:
  - "Xin phép"
  - "N3-N2"
---
```

### Các trường hỗ trợ:
| Trường | Bắt buộc | Mặc định | Ý nghĩa |
| :--- | :---: | :---: | :--- |
| `title` | Không | Lấy dòng `# ` đầu tiên | Tiêu đề hiển thị của bài học trên thanh tiêu đề và danh sách bài. |
| `order` | Không | 1 | Số thứ tự sắp xếp của bài học. |
| `tts` | Không | `true` | Bật/tắt tính năng đọc âm thanh TTS cho bài học. |
| `audio_url` | Không | `""` | Đường dẫn file MP3 thu âm sẵn (nếu bài học có sẵn file audio người thật đọc). |
| `duration` | Không | `0` | Thời lượng file MP3 tính bằng giây (nếu dùng `audio_url`). |
| `tags` | Không | `[]` | Các nhãn phân loại chủ đề (ví dụ: `["Xin phép", "Kinh doanh"]`). |

---

## 3. Phần 2: Thân bài học & Quy chuẩn Audio TTS

Để bộ máy TTS phát âm chuẩn xác từng câu và tự động chuyển câu/chuyển bài mượt mà:

### 3.1. Cấu trúc cặp câu song ngữ xen kẽ (Bắt buộc)
Trình phát sẽ đọc theo thứ tự: **1 câu tiếng Nhật ➔ Dừng nghỉ ➔ 1 câu dịch tiếng Việt tương ứng ➔ Dừng nghỉ ➔ Câu tiếp theo...**

```markdown
休みの日は、いつもより少し遅く起きて、家で猫と遊んで過ごします。
*Vào ngày nghỉ, tôi dậy muộn hơn bình thường một chút, và dành thời gian ở nhà chơi với mèo.*

私の猫はとても可愛くて、一緒にいるだけで毎日のストレスが解消されます。
*Mèo của tôi rất đáng yêu, chỉ cần ở bên cạnh nó thôi là bao căng thẳng mỗi ngày đều tan biến.*
```

- **Dòng trên**: Câu tiếng Nhật.
- **Dòng dưới ngay sau**: Dịch tiếng Việt (khuyến khích viết *in nghiêng* bằng cặp `*...*` để phân biệt thị giác rõ ràng).
- **Cách 1 dòng trống**: Phân cách rõ ràng giữa các cặp câu.

### 3.2. Không viết các tiền tố (Prefixes) rác vào đầu câu
Tránh tuyệt đối việc ghi các nhãn cố định vào đầu câu:
- ❌ **Không viết**: `Câu 01: 休みの日は...` (Máy sẽ đọc cả chữ "Câu không một").
- ❌ **Không viết**: `Dịch nghĩa: Vào ngày nghỉ...`
- ❌ **Không viết**: `Tiếng Nhật: 休みの日は...`
- ❌ **Không viết**: `Dịch câu hỏi: Bạn hãy...`
- ✅ **Chỉ viết câu văn trực tiếp**.

### 3.3. Đối với công thức ngữ pháp & Số La Mã
- **Số La Mã đầu mục (I., II., III...)**: Hệ thống Reader tự động lược bỏ khi phát âm thanh để không bị đọc thành tiếng Anh ("eye"), đồng thời vẫn giữ nguyên trên giao diện cho mắt nhìn.
- **Công thức ngữ pháp có dấu cộng (`+` hoặc `＋`)**: Ví dụ `Động từ thể た ＋ ところです`, hệ thống sẽ tự động phát âm thành *"cộng"* bằng tiếng Việt một cách tự nhiên.


---

## 4. Phần 3: Phiên âm Furigana chuẩn W3C `<ruby>`

Hệ thống hỗ trợ thẻ HTML `<ruby>` chuẩn:

```html
実は、来週の金曜日に<ruby>外部研修<rt>がいぶけんしゅう</rt></ruby>が<ruby>開催<rt>かいさい</rt></ruby>されます。
```

- **Màn hình hiển thị**: Chữ Hán to, chữ Furigana nhỏ xíu nằm ngay ngắn trên đầu chữ Hán.
- **Xử lý Audio thông minh**: Engine TTS sẽ tự động lọc bỏ thẻ `<rt>` và `<rp>` khi đọc. Máy chỉ đọc chữ Hán chính, **tuyệt đối không bị đọc lặp** cả Kanji lẫn Kana.

---

## 5. Phần 4: Ẩn nội dung khỏi Audio bằng `<nospeech>`

Trong bài học thường có các phần **chỉ dành cho mắt xem** (như dàn ý phân tích, bảng PREP, từ vựng mở rộng, ngữ pháp ghi chú). Nếu để nguyên, audio sẽ đọc ê a từng ô trong bảng rất khó chịu.

Hãy bao bọc toàn bộ phần đó bên trong thẻ `<nospeech>...</nospeech>`:

```html
<nospeech>

## 💡 Dàn ý trả lời (PREP)

| Bước | Ý chính | Gợi ý tiếng Nhật |
| :--- | :--- | :--- |
| **Point** | Xin phép | 外部研修への参加許可をいただきたく... |
| **Reason** | Lý do | 業務効率化に直結するため... |

## 📚 Từ vựng mở rộng
- <ruby>外部研修<rt>がいぶけんしゅう</rt></ruby>: Đào tạo bên ngoài
- <ruby>業務効率化<rt>ぎょうむこうりつか</rt></ruby>: Nâng cao hiệu suất công việc

</nospeech>
```

- **Giao diện bài học**: Vẫn hiển thị đầy đủ bảng biểu, màu sắc, icon.
- **Trình phát Audio TTS**: Sẽ bỏ qua toàn bộ phần này, chỉ tập trung đọc Tình huống và Bài nói mẫu.

---

## 6. Phần 5: Đánh dấu ngôn ngữ khi câu pha trộn (`<ja>`, `<vi>`)

Trong trường hợp có 1 dòng chứa cả tiếng Nhật và tiếng Việt lẫn lộn (ví dụ mục giải thích từ vựng hoặc so sánh ngữ pháp), hãy dùng thẻ `<ja>` và `<vi>` để ép giọng đọc chính xác cho từng phần:

```markdown
<ja>四季</ja>: <vi>bốn mùa</vi>
<ja>前倒しにする</ja>: <vi>làm trước thời hạn, đẩy sớm tiến độ</vi>
```

- Máy sẽ đọc đoạn `<ja>` bằng giọng tiếng Nhật chuẩn Tokyo.
- Máy sẽ đọc đoạn `<vi>` bằng giọng tiếng Việt chuẩn.

---

## 7. File mẫu chuẩn hoàn chỉnh (Copy & Dùng ngay)

Dưới đây là một file `.md` đơn lẻ hoàn chỉnh 100% chuẩn kỹ thuật để anh có thể copy làm mẫu:

```markdown
---
title: "06. 勤務時間中の外部研修参加の許可を取る"
order: 6
tts: true
tags:
  - "Xin phép"
  - "N3-N2"
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

## 8. Checklist kiểm tra 1 file .md trước khi lưu

- [ ] **Mã hóa file**: Lưu dưới dạng **UTF-8** (không có BOM).
- [ ] **Frontmatter**: Có cặp `---` ở đầu với ít nhất trường `title`.
- [ ] **Cặp câu xen kẽ**: Câu Nhật ở trên, dòng dịch Việt ở ngay dưới (*in nghiêng*).
- [ ] **Sạch Prefix**: Không có chữ `Câu 01:`, `Dịch nghĩa:`, `Tiếng Nhật:` ở đầu câu.
- [ ] **Furigana đúng thẻ**: Dùng thẻ `<ruby>漢字<rt>かんじ</rt></ruby>`.
- [ ] **Đã bọc `<nospeech>`**: Các bảng biểu, dàn ý PREP, từ vựng phụ đã được kẹp trong `<nospeech>...</nospeech>`.
