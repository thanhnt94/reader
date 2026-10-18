# Reader Audio Player & Centralized TTS Architecture

## 1. Top-of-Article Audio Player (`ArticleTopPlayer.tsx`)
- **News-Style Pattern**: Directly embedded right at the top of the reading article (below sticky article header, above markdown content).
- **Dual Mode Switcher**:
  1. `Studio Audio HD (Edge-TTS AI)`: Plays pre-generated unified MP3 audio file with natural neural voices and silence pauses.
  2. `Trình Duyệt Đọc (Web Speech API / Karaoke Live)`: Directly controls browser speech synthesis with real-time text sweeping/highlighting and sentence-level tap-to-speak.
- **Embedded Controls**:
  - Play/Pause toggle with soundwave equalizer visual.
  - Interactive seek bar + current/total timestamps.
  - Quick seek (`-10s` / `+10s`).
  - Speed selector (`0.8x`, `1.0x`, `1.25x`, `1.5x`, `2.0x`).
  - Volume control / Mute toggle.
  - 1-Click Generate TTS button (`handleGenerateTTS`).

---

## 2. CentralAuth Sentence Chunking & Stitching Pipeline (`TTSService`)
- **Problem Solved**: Long articles (1,000+ words) previously suffered from HTTP timeouts, character truncation, and unnatural transitions between mixed Japanese and Vietnamese sentences.
- **Solution Architecture**:
  1. **Sentence Segmenter**: Splits raw markdown into bilingual segments with language tags (`[ja: ...]`, `[vi: ...]`).
  2. **CentralAuth Proxy Dispatch**: Dispatches formatted payload to CentralAuth (`/api/tts/generate` via unix socket `/var/www/CentralAuth/centralauth.sock` or internal URL).
  3. **CentralAuth Synthesis & Pydub Stitching**:
     - Japanese sentences synthesized with `ja-JP-NanamiNeural`.
     - Vietnamese sentences synthesized with `vi-VN-HoaiMyNeural`.
     - Segments concatenated using `pydub.AudioSegment` with natural 300ms silence pauses between sentences.
     - Caches each sentence chunk by MD5 hash to eliminate redundant TTS synthesis across all satellite applications.
  4. **Local Offline Resilience Fallback**: If CentralAuth is unavailable, Reader executes local Edge-TTS segment synthesis with local `pydub` pause stitching.
