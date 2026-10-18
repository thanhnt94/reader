import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  X,
  Languages,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Minimize2,
  Maximize2,
  Sun,
  Radio,
  FastForward,
  Timer,
  Clock,
  LocateFixed,
  Headphones,
  Loader2,
  Settings,
  Repeat
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export type DetectedLang = 'ja-JP' | 'vi-VN' | 'en-US';

export interface SpeechSentence {
  index: number;
  text: string;
  lang: DetectedLang;
  noDelay?: boolean;
  pauseAfterSec?: number;
  isSignal?: boolean;
}

/**
 * Synthesizes a clean two-tone exam chime (880Hz -> 1175Hz) via Web Audio API.
 */
export function playExamChime(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        resolve();
        return;
      }
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Tone 1: 880Hz (A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Tone 2: 1175Hz (D6)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1175, now + 0.22);
      gain2.gain.setValueAtTime(0, now + 0.22);
      gain2.gain.linearRampToValueAtTime(0.3, now + 0.25);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.22);
      osc2.stop(now + 0.8);

      setTimeout(() => {
        try { ctx.close(); } catch (e) {}
        resolve();
      }, 850);
    } catch (e) {
      console.warn('Web Audio chime error:', e);
      resolve();
    }
  });
}

/**
 * Analyzes character distribution and vocabulary clues to identify Japanese vs Vietnamese vs English.
 * Pure numbers, symbols, Latin abbreviations, or untagged content gracefully inherit the Main Language.
 */
export function detectLanguage(text: string, mainLang: DetectedLang = 'ja-JP'): DetectedLang {
  const trimmed = text.trim();
  if (!trimmed) return mainLang;

  // 1. Japanese Kanji, Hiragana, Katakana check
  const jaMatches = trimmed.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g);
  const jaCount = jaMatches ? jaMatches.length : 0;

  // 2. Vietnamese explicit accented letters check
  const viMatches = trimmed.match(
    /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/g
  );
  const viCount = viMatches ? viMatches.length : 0;

  // 3. Common Vietnamese unaccented words or labels
  const hasViKeywords = /\b(câu|bài|bước|dịch|nghĩa|tiếng|ví dụ|hỏi|đáp|trả lời|dàn ý|từ vựng|mẫu|cú pháp|ngữ cảnh|tiến độ|trạng thái|thời gian|công việc|cộng|động từ|thể|tập|nhật|việt|nói|nghe|đọc|viết|tôi|bạn|thường|sử dụng|nhiều|hơn|bởi vì)\b/i.test(trimmed);

  if (jaCount > 0 && jaCount >= viCount && !hasViKeywords) {
    return 'ja-JP';
  }
  if ((viCount > 0 || hasViKeywords) && jaCount === 0) {
    return 'vi-VN';
  }
  if (viCount > 0 || hasViKeywords) {
    return 'vi-VN';
  }
  if (jaCount > 0) {
    return 'ja-JP';
  }

  // Explicit English vocabulary check
  const isExplicitEnglish = /\b(the|is|are|was|were|have|has|this|that|with|for|and|you|we|they|from|to|in|on|at|lesson|chapter)\b/i.test(trimmed);
  if (isExplicitEnglish) {
    return 'en-US';
  }

  // Pure numbers, abbreviations, neutral symbols fall back to Main Language!
  return mainLang;
}

/**
 * Automatically detects whether a document's main language is Japanese, Vietnamese or English,
 * checking YAML frontmatter (lang/main_lang) first or presence of Japanese characters.
 */
export function detectDocumentMainLang(md: string): DetectedLang {
  if (!md) return 'ja-JP';
  const frontmatterMatch = md.match(/^---\s*[\s\S]*?(?:main_lang|lang):\s*['"]?([a-zA-Z_-]+)['"]?[\s\S]*?---/i);
  if (frontmatterMatch) {
    const code = frontmatterMatch[1].toLowerCase();
    if (code.startsWith('ja')) return 'ja-JP';
    if (code.startsWith('vi')) return 'vi-VN';
    if (code.startsWith('en')) return 'en-US';
  }
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(md)) {
    return 'ja-JP';
  }
  return 'vi-VN';
}

/**
 * Strips HTML tags, removes <rt>...</rt> ruby annotations, cleans markdown formatting,
 * processes tables cell-by-cell, separates mixed language sentences,
 * and splits into natural speech sentences with accurate language tags.
 * Pure numbers and neutral symbols inherit the configured mainLang.
 */
export function cleanTextForSpeech(rawMarkdown: string, mainLang: DetectedLang = 'ja-JP'): SpeechSentence[] {
  if (!rawMarkdown) return [];

  let text = rawMarkdown;

  // 1. Remove YAML frontmatter
  text = text.replace(/^\s*---[\r\n]+[\s\S]*?[\r\n]+---\s*[\r\n]*/, '');

  // 2. Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`[^`]+`/g, '');

  // 3. Remove nospeech tags (Content that should only be viewed by eyes, never read by audio TTS)
  text = text.replace(/<nospeech[^>]*>[\s\S]*?<\/nospeech>/gi, '');
  text = text.replace(/<!--\s*nospeech[\s\S]*?\/nospeech\s*-->/gi, '');

  // 4. In structured Q&A / Role-play lessons:
  // Automatically strip the dense PREP outline tables & Vocabulary alternative lists at the bottom!
  text = text.replace(/^#{1,4}\s*[⚡💡📌]?\s*(?:[Dd]àn\s*ý|[Tt]ừ\s*vựng|[Gg]hi\s*chú|[Ll]ưu\s*ý|[Vv]ocabulary)[\s\S]*$/mi, '');

  // 5. Remove Japanese Ruby Furigana annotations (<rt>...</rt> and <rp>...</rp>)
  // Stripping Furigana prevents duplicate pronunciation of both Kanji and Kana
  text = text.replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, '');
  text = text.replace(/<rp[^>]*>[\s\S]*?<\/rp>/gi, '');

  // 6. Extract lines
  const lines = text.split('\n');
  const sentences: SpeechSentence[] = [];
  let idx = 0;

  const pushSentence = (str: string, forcedLang?: DetectedLang, noDelay?: boolean) => {
    let cleaned = str
      .replace(/<[^>]+>/g, '') // remove remaining HTML tags
      .replace(/[*_~]{1,3}/g, '') // remove bold/italics
      .replace(/[📌⚡💡💬➡/]/g, ' ') // decorative symbols
      .replace(/^(?:[Cc]âu\s*\d+|[Dd]ịch\s*câu\s*hỏi|[Dd]ịch\s*tình\s*huống|[Tt]ình\s*huống|[Dd]ịch\s*nghĩa|[Tt]iếng\s*[Nn]hật|[Tt]iếng\s*[Vv]iệt|[Tt]ừ\s*vựng|[Gg]hi\s*chú|[Ll]ưu\s*ý)[\s:*_.-]*/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Convert plus signs to "cộng" if surrounding is Vietnamese, otherwise keep space
    if (/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(cleaned)) {
      cleaned = cleaned.replace(/[+＋]/g, ' cộng ').replace(/\s+/g, ' ').trim();
    } else {
      cleaned = cleaned.replace(/[+＋]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Check pause directives e.g. [pause: 2s], [pause]
    const pauseMatch = cleaned.match(/^\[pause(?::\s*([\d.]+)\s*(?:s|ms)?)?\]/i);
    if (pauseMatch || /^\[pause/i.test(cleaned)) {
      const pauseSec = pauseMatch && pauseMatch[1] ? parseFloat(pauseMatch[1]) : 2;
      if (sentences.length > 0) {
        sentences[sentences.length - 1].pauseAfterSec = pauseSec;
      }
      return;
    }

    // Check signal / chime / beep directives e.g. [chime], [signal], [beep]
    if (/^\[(?:signal|chime|beep)(?::\s*[\w-]+)?\]$/i.test(cleaned)) {
      const isFirstChime = sentences.filter((s) => s.isSignal).length === 0;
      sentences.push({
        index: idx++,
        text: isFirstChime ? '🔔 Chuông bắt đầu (45s trả lời)' : '🔔 Chuông kết thúc (Hết giờ)',
        lang: 'ja-JP',
        isSignal: true,
      });
      return;
    }

    // Skip isolated bullets, Roman numerals (I, II, III...), plus signs, or single letters
    if (/^(?:[IVXLCDM]+\.?|\d+\.?|[+＋*•·–—\-#\s]+|[a-zA-Z]\.?)$/i.test(cleaned)) {
      return;
    }

    if (cleaned.length > 0 && !/^[-_—\s,.:;|]+$/.test(cleaned)) {
      const lang = forcedLang || detectLanguage(cleaned, mainLang);
      sentences.push({
        index: idx++,
        text: cleaned,
        lang,
        noDelay: !!noDelay,
      });
    }
  };

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Skip generic label-only subheadings so the audio reads seamlessly:
    // (Question JP -> Question VI translation -> Answer JP -> Answer VI translation)
    const normalizedLine = line.replace(/[*_#`~>💬📌⚡💡➡/]/g, '').trim();
    if (
      /^(?:câu\s*trả\s*lời\s*mẫu|bài\s*nói\s*mẫu|tiếng\s*nhật|dịch\s*nghĩa|dàn\s*ý|từ\s*vựng)\s*:?$/i.test(normalizedLine)
    ) {
      continue;
    }

    // Check if line is a Markdown Table row: e.g. | Bước | Tiếng Việt | Tiếng Nhật |
    if (line.startsWith('|') && line.endsWith('|')) {
      // Skip separator rows like | :--- | :--- |
      if (/^\|[\s:-\|]+\|$/.test(line)) {
        continue;
      }
      // Extract cells
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());

      // If it's a table header with generic column names, skip
      const isHeaderRow = cells.every((c) =>
        /^(bước|tiếng việt|tiếng nhật|stt|no|nghĩa|kanji|furigana)$/i.test(c.replace(/[*_~]/g, ''))
      );
      if (isHeaderRow) {
        continue;
      }

      // Read each non-empty data cell individually with its own detected language
      for (const cell of cells) {
        const cellClean = cell.replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, '').replace(/<[^>]+>/g, '');
        pushSentence(cellClean);
      }
      continue;
    }

    // Transform grammar section headings:
    // e.g. "## I. TIẾN ĐỘ, THỜI GIAN VÀ TRẠNG THÁI CÔNG VIỆC" or "Phần 1: TIẾN ĐỘ..."
    // -> "Các mẫu câu liên quan đến tiến độ, thời gian và trạng thái công việc"
    const sectionMatch = line.match(
      /^(?:#{1,4}\s*)?(?:(?:Phần|phần|Chương|chương|Mục|mục)\s*(?:\d+|[IVXLCDM]+)[\s:.-]*|[IVXLCDM]+\.[\s:-]*)\s*(.+)$/i
    );
    if (sectionMatch) {
      const topic = sectionMatch[1].trim();
      line = `Các mẫu câu liên quan đến ${topic.toLowerCase()}`;
    }

    // Clean markdown headings, blockquotes, list markers
    line = line.replace(/^#{1,6}\s+/, '');
    line = line.replace(/^>\s*/, '');
    line = line.replace(/^\s*[-*+＋•]\s+/, '');
    line = line.replace(/^\s*\d+\.\s+/, '');

    // Strip "- Tập 1", "- Tập 2" (or "Tập 1", "Tập 2") from lesson titles:
    line = line.replace(/[\s–—-]+\s*(?:Tập|tập|Phần|phần|Vol|vol|Volume|Part)\s*\d+.*$/i, '');

    // Clean Roman numerals at start of lines (if any residual)
    line = line.replace(/^[IVXLCDM]+\.\s*/i, '');

    // Clean emojis & decorative symbols from beginning of line (e.g. 📌, 💬, ⚡, 💡)
    line = line.replace(/^[📌⚡💡💬👉➡■●★\s]+/u, '');

    // Clean leading bold/italic formatting (e.g. **, *)
    line = line.replace(/^[*_~]{1,3}\s*/, '');

    // Strip audio prefixes completely so they are NEVER spoken:
    line = line.replace(
      /^(?:[Cc]âu\s*\d+|[Dd]ịch\s*câu\s*hỏi|[Dd]ịch\s*tình\s*huống|[Tt]ình\s*huống|[Dd]ịch\s*nghĩa|[Tt]iếng\s*[Nn]hật|[Tt]iếng\s*[Vv]iệt|[Tt]ừ\s*vựng|[Gg]hi\s*chú|[Ll]ưu\s*ý)[\s:*_.-]*/i,
      ''
    );

    // Clean any residual formatting, colons, or dashes after prefix removal
    line = line.replace(/^[*_~:\s-]+/, '').trim();
    if (!line) continue;

    // 1. Check for explicit manual override tags: <ja>...</ja>, <vi>...</vi>, <en>...</en>
    if (/<(?:ja|vi|en)>[\s\S]*?<\/(?:ja|vi|en)>/i.test(line)) {
      const tagSegments = line.split(/(<(?:ja|vi|en)>[\s\S]*?<\/(?:ja|vi|en)>)/gi);
      for (const seg of tagSegments) {
        const segTrim = seg.trim();
        if (!segTrim) continue;
        if (/^<ja>([\s\S]*?)<\/ja>$/i.test(segTrim)) {
          const match = segTrim.match(/^<ja>([\s\S]*?)<\/ja>$/i);
          if (match && match[1]) pushSentence(match[1], 'ja-JP');
        } else if (/^<vi>([\s\S]*?)<\/vi>$/i.test(segTrim)) {
          const match = segTrim.match(/^<vi>([\s\S]*?)<\/vi>$/i);
          if (match && match[1]) pushSentence(match[1], 'vi-VN');
        } else if (/^<en>([\s\S]*?)<\/en>$/i.test(segTrim)) {
          const match = segTrim.match(/^<en>([\s\S]*?)<\/en>$/i);
          if (match && match[1]) pushSentence(match[1], 'en-US');
        } else {
          pushSentence(segTrim, detectLanguage(segTrim, mainLang));
        }
      }
      continue;
    }

    // 2. Check if line has mixed Japanese characters AND Vietnamese text (without explicit tags):
    // e.g. "Cú pháp: Động từ thể て ＋ はじめて、〜" or "社会人: người đi làm"
    const hasJa = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(line);
    const hasVi = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/i.test(line);
    const hasViKw = /\b(cú\s*pháp|động\s*từ|thể|bỏ|từ\s*điển|ngữ\s*cảnh|nghĩa|mẫu|ví\s*dụ|cộng)\b/i.test(line);

    if (hasJa && (hasVi || hasViKw)) {
      const normalizedMixed = line.replace(/[+＋]/g, ' cộng ').replace(/\s+/g, ' ').trim();
      const mixedTokens = normalizedMixed.split(/([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3001\u3002\u300C\u300D]+)/);
      const nonNullTokens = mixedTokens.map((t) => t.trim()).filter(Boolean);

      for (let i = 0; i < nonNullTokens.length; i++) {
        const tok = nonNullTokens[i];
        const isJaToken = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(tok);
        const isNotLast = i < nonNullTokens.length - 1;
        if (isJaToken) {
          pushSentence(tok, 'ja-JP', isNotLast);
        } else {
          const cleanVi = tok.replace(/^[*_~:\s-]+|[*_~:\s-]+$/g, '').trim();
          if (cleanVi) {
            pushSentence(cleanVi, detectLanguage(cleanVi, mainLang), isNotLast);
          }
        }
      }
      continue;
    }

    // 3. Check if line is a vocabulary or comparison line with arrows (➡) or colons
    if (line.includes('➡') || (line.includes(':') && line.includes('ruby'))) {
      const parts = line.split(/[➡:]/);
      for (const p of parts) {
        pushSentence(p, detectLanguage(p, mainLang));
      }
      continue;
    }

    // 4. Split sentences on Japanese punctuation ([。！？]) or Western sentence boundaries ([.!?]+ followed by space or end)
    const punctuationSplit = line.split(/([。！？]+|[.!?]+(?:\s+|$))/);
    let buffer = '';
    for (const part of punctuationSplit) {
      if (/^[。！？.!?\s]+$/.test(part)) {
        buffer += part;
        if (buffer.trim()) {
          pushSentence(buffer.trim(), detectLanguage(buffer.trim(), mainLang));
        }
        buffer = '';
      } else {
        buffer += part;
      }
    }
    if (buffer.trim()) {
      pushSentence(buffer.trim(), detectLanguage(buffer.trim(), mainLang));
    }
  }

  return sentences;
}

export type RepeatMode = '1x' | '2x' | '3x' | 'loop';

export interface BrowserSpeechController {
  isPlaying: boolean;
  isPaused: boolean;
  currentIndex: number;
  totalSentences: number;
  speed: number;
  currentSentence?: SpeechSentence | null;
  handlePlay: () => void;
  handlePause: () => void;
  handleToggle: () => void;
  handlePrev: () => void;
  handleNext: () => void;
  handleSpeedChange: (speed: number) => void;
  cycleSpeed: () => void;
}

export interface BrowserSpeechPlayerProps {
  lessonId?: number;
  rawMarkdown: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onLessonComplete?: () => void;
  hasNextLesson?: boolean;
  autoPlay?: boolean;
  hasAudioUrl?: boolean;
  onSwitchToStudioAudio?: () => void;
  onRequestGenerateTTS?: () => void;
  isGeneratingTTS?: boolean;
  onActiveSentenceChange?: (sentence: SpeechSentence | null) => void;
  onSentenceProgress?: (progress: number) => void;
  onScrollToActiveSentence?: () => void;
  targetSentenceIndex?: number | null;
  onTargetSentenceHandled?: () => void;
  headless?: boolean;
  onControllerReady?: (controller: BrowserSpeechController) => void;
  autoAdvance?: boolean;
}

export const BrowserSpeechPlayer: React.FC<BrowserSpeechPlayerProps> = ({
  lessonId,
  rawMarkdown,
  title,
  isOpen,
  onClose,
  onLessonComplete,
  hasNextLesson = false,
  autoPlay = false,
  hasAudioUrl = false,
  onSwitchToStudioAudio,
  onRequestGenerateTTS,
  isGeneratingTTS = false,
  onActiveSentenceChange,
  onSentenceProgress,
  onScrollToActiveSentence,
  targetSentenceIndex = null,
  onTargetSentenceHandled,
  headless = false,
  onControllerReady,
  autoAdvance,
}) => {
  const { settings, updateSettings } = useAppStore();

  const [sentences, setSentences] = useState<SpeechSentence[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'ja' | 'vi'>('all');
  const [mainLang, setMainLang] = useState<DetectedLang>(() => detectDocumentMainLang(rawMarkdown));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sentenceProgress, setSentenceProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('1x');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Shadowing Repeat Ref
  const repeatCountRef = useRef(0);
  const repeatModeRef = useRef<RepeatMode>('1x');
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  // Screen Wake Lock API State & Ref
  const wakeLockRef = useRef<any>(null);
  const [isWakeLocked, setIsWakeLocked] = useState(false);

  // Continuous Mode Countdown State & Refs
  const [transitionCountdown, setTransitionCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<any>(null);
  const sentenceDelayTimerRef = useRef<any>(null);
  const onLessonCompleteRef = useRef(onLessonComplete);
  const hasNextLessonRef = useRef(hasNextLesson);
  const settingsRef = useRef(settings);
  const hasAutoPlayedRef = useRef(false);

  const autoAdvanceRef = useRef(autoAdvance);
  useEffect(() => {
    autoAdvanceRef.current = autoAdvance;
  }, [autoAdvance]);

  useEffect(() => {
    onLessonCompleteRef.current = onLessonComplete;
  }, [onLessonComplete]);

  useEffect(() => {
    hasNextLessonRef.current = hasNextLesson;
  }, [hasNextLesson]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Request Screen Wake Lock (Keeps mobile display awake during TTS playback)
  const requestWakeLock = async () => {
    if (!settingsRef.current.tts_wake_lock) return;
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        if (wakeLockRef.current) {
          try {
            await wakeLockRef.current.release();
          } catch (e) {
            // ignore
          }
          wakeLockRef.current = null;
        }
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        setIsWakeLocked(true);
        wakeLockRef.current?.addEventListener('release', () => {
          setIsWakeLocked(false);
          wakeLockRef.current = null;
        });
      } catch (err) {
        console.warn('Wake Lock request error:', err);
        setIsWakeLocked(false);
      }
    }
  };

  // Release Screen Wake Lock
  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch (e) {
        // ignore
      }
      wakeLockRef.current = null;
      setIsWakeLocked(false);
    }
  };

  // Synchronize Wake Lock with playback status
  useEffect(() => {
    if (isPlaying && settings.tts_wake_lock) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [isPlaying, settings.tts_wake_lock]);

  // Re-acquire Wake Lock when tab/app becomes visible again if playing
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPlaying && settingsRef.current.tts_wake_lock) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isPlaying]);

  // Track whether player is actively in continuous autoplay mode
  const isContinuousPlayingRef = useRef(false);

  // Keep a single reusable Audio element to maintain mobile audio unlocking
  const getAudioElement = (): HTMLAudioElement => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    return audioRef.current;
  };

  // Countdown timer effect for auto-advancing to next lesson
  useEffect(() => {
    if (transitionCountdown === null) return;
    if (transitionCountdown <= 0) {
      setTransitionCountdown(null);
      isContinuousPlayingRef.current = true;
      if (onLessonCompleteRef.current) {
        onLessonCompleteRef.current();
      }
      return;
    }
    countdownTimerRef.current = setTimeout(() => {
      setTransitionCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => {
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, [transitionCountdown]);

  // Stop both speech synthesis and any playing audio stream
  const stopAllAudio = () => {
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
    }
    if (sentenceDelayTimerRef.current) {
      clearTimeout(sentenceDelayTimerRef.current);
      sentenceDelayTimerRef.current = null;
    }
    setTransitionCountdown(null);
    if (synthRef.current) {
      try {
        synthRef.current.cancel();
      } catch (e) {}
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
    }
    releaseWakeLock();
    if (onActiveSentenceChange) {
      onActiveSentenceChange(null);
    }
  };

  // Initialize SpeechSynthesis and load browser voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;

      const updateVoices = () => {
        const available = window.speechSynthesis.getVoices();
        setVoices(available);
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      stopAllAudio();
    };
  }, []);

  // Filter sentences according to selected filter mode (Memoized to prevent infinite render loops)
  const activeSentences = useMemo(() => {
    return sentences.filter((s) => {
      if (filterMode === 'ja') return s.lang === 'ja-JP';
      if (filterMode === 'vi') return s.lang === 'vi-VN';
      return true;
    });
  }, [sentences, filterMode]);

  // Jump to target sentence when requested from tap-to-speak
  useEffect(() => {
    if (
      targetSentenceIndex !== null &&
      targetSentenceIndex !== undefined &&
      targetSentenceIndex >= 0 &&
      activeSentences.length > 0
    ) {
      const targetIdx = Math.min(activeSentences.length - 1, Math.max(0, targetSentenceIndex));
      repeatCountRef.current = 0;
      setCurrentIndex(targetIdx);
      speakSentence(targetIdx);
      onTargetSentenceHandled?.();
    }
  }, [targetSentenceIndex, activeSentences.length]);

  // Notify parent of active sentence changes for live karaoke highlight on screen (Deduped by string key)
  const lastActiveSentenceKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (onActiveSentenceChange) {
      const current = isOpen && (isPlaying || isPaused) ? activeSentences[currentIndex] || null : null;
      const currentKey = current ? `${current.index}-${current.text}` : null;
      if (lastActiveSentenceKeyRef.current !== currentKey) {
        lastActiveSentenceKeyRef.current = currentKey;
        onActiveSentenceChange(current);
      }
    }
  }, [isOpen, isPlaying, isPaused, currentIndex, activeSentences, onActiveSentenceChange]);

  // Cycle through available main languages (JA ➡ VI ➡ EN)
  const cycleMainLang = () => {
    const next: DetectedLang = mainLang === 'ja-JP' ? 'vi-VN' : mainLang === 'vi-VN' ? 'en-US' : 'ja-JP';
    setMainLang(next);
    if (!rawMarkdown) return;
    const parsed = cleanTextForSpeech(rawMarkdown, next);
    setSentences(parsed);
    setCurrentIndex(0);
    if (isPlaying) {
      handleStop();
    }
  };

  // Parse markdown into clean speech sentences and trigger autoplay if continuous mode is active
  useEffect(() => {
    if (!rawMarkdown) return;

    const docMainLang = detectDocumentMainLang(rawMarkdown);
    setMainLang(docMainLang);
    const parsed = cleanTextForSpeech(rawMarkdown, docMainLang);
    setSentences(parsed);
    setCurrentIndex(0);
    setTransitionCountdown(null);

    const shouldContinuousPlay =
      autoPlay || isContinuousPlayingRef.current || (settings.tts_auto_advance && isPlaying);

    if (shouldContinuousPlay && parsed.length > 0) {
      setIsPlaying(true);
      setIsPaused(false);
      isContinuousPlayingRef.current = true;

      // Filter list based on active filterMode
      const list =
        filterMode === 'ja'
          ? parsed.filter((s) => s.lang === 'ja-JP')
          : filterMode === 'vi'
          ? parsed.filter((s) => s.lang === 'vi-VN')
          : parsed;

      // Start sentence 0 of new lesson immediately on persistent unlocked audio element
      speakSentence(0, list);
    } else {
      setIsPlaying(false);
      setIsPaused(false);
      stopAllAudio();
    }
  }, [rawMarkdown, lessonId]);

  const currentSentence = activeSentences[currentIndex] || null;

  // Find best matching voice for language (used for local speech fallback)
  const getVoiceForLang = (lang: DetectedLang): SpeechSynthesisVoice | null => {
    const langPrefix = lang.split('-')[0].toLowerCase();

    // 1. Exact match on language prefix or code
    const exact = voices.find((v) => {
      const vLang = v.lang.toLowerCase().replace('_', '-');
      return vLang === lang.toLowerCase() || vLang.startsWith(langPrefix);
    });
    if (exact) return exact;

    // 2. Keyword match in voice name
    if (langPrefix === 'vi') {
      const viVoice = voices.find((v) => {
        const name = v.name.toLowerCase();
        return name.includes('vietnam') || name.includes('tiếng việt') || name.includes('hoaimy') || name.includes('an');
      });
      if (viVoice) return viVoice;
    }

    if (langPrefix === 'ja') {
      const jaVoice = voices.find((v) => {
        const name = v.name.toLowerCase();
        return name.includes('japan') || name.includes('nihongo') || name.includes('nanami') || name.includes('kyoko');
      });
      if (jaVoice) return jaVoice;
    }

    return null;
  };

  // Speak sentence at specific index (accepts optional sentences list for immediate playback)
  const speakSentence = (index: number, sentencesOverride?: SpeechSentence[]) => {
    const list = sentencesOverride || activeSentences;
    if (index < 0 || index >= list.length) {
      setIsPlaying(false);
      setIsPaused(false);
      return;
    }

    // Cancel synthesis if speaking
    if (synthRef.current) {
      try { synthRef.current.cancel(); } catch (e) {}
    }

    setCurrentIndex(index);
    setSentenceProgress(0);
    if (onSentenceProgress) onSentenceProgress(0);
    setIsPlaying(true);
    setIsPaused(false);

    const target = list[index];
    const matchedVoice = getVoiceForLang(target.lang);

    const handleSentenceFinish = () => {
      // 1. Check Shadowing repeat mode
      const mode = repeatModeRef.current;
      const targetRepeat = mode === 'loop' ? Infinity : (parseInt(mode, 10) || 1);
      if (repeatCountRef.current < targetRepeat - 1) {
        repeatCountRef.current += 1;
        const sentenceDelaySec = target.noDelay ? 0.2 : (settingsRef.current.tts_sentence_delay ?? 0.6);
        const delayMs = Math.max(100, Math.round(sentenceDelaySec * 1000));

        if (sentenceDelayTimerRef.current) clearTimeout(sentenceDelayTimerRef.current);
        sentenceDelayTimerRef.current = setTimeout(() => {
          speakSentence(index, list);
        }, delayMs);
        return;
      }

      // Reached repetition count for this sentence, reset for next
      repeatCountRef.current = 0;

      if (index + 1 < list.length) {
        const sentenceDelaySec = target.pauseAfterSec ?? (target.noDelay ? 0.15 : (settingsRef.current.tts_sentence_delay ?? 0.5));
        const delayMs = Math.max(0, Math.round(sentenceDelaySec * 1000));

        if (delayMs > 0) {
          if (sentenceDelayTimerRef.current) clearTimeout(sentenceDelayTimerRef.current);
          sentenceDelayTimerRef.current = setTimeout(() => {
            setCurrentIndex(index + 1);
            speakSentence(index + 1, list);
          }, delayMs);
        } else {
          setCurrentIndex(index + 1);
          speakSentence(index + 1, list);
        }
      } else {
        // Reached end of current lesson: auto advance if autoAdvance prop or continuous mode or auto_advance setting is on
        const shouldAdvance =
          autoAdvanceRef.current !== undefined
            ? autoAdvanceRef.current
            : (settingsRef.current.tts_auto_advance !== false || isContinuousPlayingRef.current);

        if (
          shouldAdvance &&
          hasNextLessonRef.current &&
          onLessonCompleteRef.current
        ) {
          isContinuousPlayingRef.current = true;
          const lessonDelaySec = settingsRef.current.tts_lesson_delay ?? 1;
          setTransitionCountdown(Math.max(1, lessonDelaySec));
        } else {
          isContinuousPlayingRef.current = false;
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentIndex(0);
        }
      }
    };

    // If target is an exam ending chime or sound signal, play tone and finish sentence
    if (target.isSignal) {
      playExamChime().then(() => {
        handleSentenceFinish();
      });
      return;
    }

    // Preload next sentence audio in background for instant playback
    if (index + 1 < list.length) {
      const nextTarget = list[index + 1];
      const nextLangParam = nextTarget.lang === 'vi-VN' ? 'vi' : (nextTarget.lang === 'ja-JP' ? 'ja' : 'en');
      const nextUrl = `/api/v1/tts/stream?text=${encodeURIComponent(nextTarget.text)}&lang=${nextLangParam}`;
      const preloader = new Audio();
      preloader.preload = 'auto';
      preloader.src = nextUrl;
    }

    // Transparent fallback to local speech synthesis if network stream fails
    const fallbackToSpeechSynthesis = () => {
      if (synthRef.current) {
        try {
          const utt = new SpeechSynthesisUtterance(target.text);
          utt.lang = target.lang;
          utt.rate = speed;
          if (matchedVoice) utt.voice = matchedVoice;
          utt.onboundary = (e: any) => {
            if (target.text.length > 0) {
              const charIdx = e.charIndex || 0;
              const prog = Math.min(1, Math.max(0, charIdx / target.text.length));
              setSentenceProgress(prog);
              if (onSentenceProgress) onSentenceProgress(prog);
            }
          };
          utt.onend = handleSentenceFinish;
          utt.onerror = () => {
            console.warn('Speech synthesis error on fallback');
            setIsPlaying(false);
            setIsPaused(false);
          };
          synthRef.current.speak(utt);
          return;
        } catch (e2) {}
      }
      setIsPlaying(false);
      setIsPaused(false);
    };

    // Unified streaming via backend Google TTS:
    // Keeps single HTMLAudioElement continuously playing across sentences and lessons,
    // avoiding mobile browser autoplay blocks and voice mismatch bugs!
    const langParam = target.lang === 'vi-VN' ? 'vi' : (target.lang === 'ja-JP' ? 'ja' : 'en');
    const streamUrl = `/api/v1/tts/stream?text=${encodeURIComponent(target.text)}&lang=${langParam}`;
    const audio = getAudioElement();
    audio.pause();
    audio.currentTime = 0;
    audio.src = streamUrl;
    audio.playbackRate = speed;
    audio.onended = handleSentenceFinish;
    audio.ontimeupdate = () => {
      if (audio.duration && audio.duration > 0) {
        const prog = Math.min(1, Math.max(0, audio.currentTime / audio.duration));
        setSentenceProgress(prog);
        if (onSentenceProgress) onSentenceProgress(prog);
      }
    };

    audio.onerror = (e) => {
      console.warn('Audio stream error, falling back to speech synthesis:', e);
      fallbackToSpeechSynthesis();
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Audio play error, attempting speech synthesis fallback:', err);
        fallbackToSpeechSynthesis();
      });
    }
  };

  const handlePlay = () => {
    isContinuousPlayingRef.current = true;
    repeatCountRef.current = 0;
    setTransitionCountdown(null);
    if (sentenceDelayTimerRef.current) {
      clearTimeout(sentenceDelayTimerRef.current);
      sentenceDelayTimerRef.current = null;
    }
    if (isPaused) {
      if (audioRef.current && audioRef.current.src) {
        audioRef.current.play().catch(() => {
          speakSentence(currentIndex);
        });
        setIsPaused(false);
        setIsPlaying(true);
        return;
      }
      if (synthRef.current) {
        synthRef.current.resume();
        setIsPaused(false);
        setIsPlaying(true);
        return;
      }
    }
    speakSentence(currentIndex);
  };

  const handlePause = () => {
    isContinuousPlayingRef.current = false;
    setTransitionCountdown(null);
    if (sentenceDelayTimerRef.current) {
      clearTimeout(sentenceDelayTimerRef.current);
      sentenceDelayTimerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (synthRef.current) {
      synthRef.current.pause();
    }
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    isContinuousPlayingRef.current = false;
    repeatCountRef.current = 0;
    stopAllAudio();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(0);
  };

  const handlePrev = () => {
    repeatCountRef.current = 0;
    if (sentenceDelayTimerRef.current) {
      clearTimeout(sentenceDelayTimerRef.current);
      sentenceDelayTimerRef.current = null;
    }
    const nextIdx = Math.max(0, currentIndex - 1);
    setCurrentIndex(nextIdx);
    if (isPlaying) {
      speakSentence(nextIdx);
    }
  };

  const handleNext = () => {
    repeatCountRef.current = 0;
    if (sentenceDelayTimerRef.current) {
      clearTimeout(sentenceDelayTimerRef.current);
      sentenceDelayTimerRef.current = null;
    }
    if (currentIndex + 1 < activeSentences.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      if (isPlaying) {
        speakSentence(nextIdx);
      }
    } else {
      // If already on the last sentence of current question, jumping forward advances to the next question
      if (hasNextLessonRef.current && onLessonCompleteRef.current) {
        onLessonCompleteRef.current();
      }
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (isPlaying) {
      speakSentence(currentIndex);
    }
  };

  const lastControllerStateRef = useRef<{
    isPlaying: boolean;
    isPaused: boolean;
    currentIndex: number;
    totalSentences: number;
    speed: number;
  } | null>(null);

  useEffect(() => {
    if (!onControllerReady) return;
    const last = lastControllerStateRef.current;
    if (
      last &&
      last.isPlaying === isPlaying &&
      last.isPaused === isPaused &&
      last.currentIndex === currentIndex &&
      last.totalSentences === activeSentences.length &&
      last.speed === speed
    ) {
      return;
    }

    lastControllerStateRef.current = {
      isPlaying,
      isPaused,
      currentIndex,
      totalSentences: activeSentences.length,
      speed,
    };

    onControllerReady({
      isPlaying,
      isPaused,
      currentIndex,
      totalSentences: activeSentences.length,
      speed,
      currentSentence: activeSentences[currentIndex] || null,
      handlePlay,
      handlePause,
      handleToggle: isPlaying ? handlePause : handlePlay,
      handlePrev,
      handleNext,
      handleSpeedChange,
      cycleSpeed: () => {
        const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
        const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
        handleSpeedChange(speeds[nextIdx]);
      },
    });
  }, [isPlaying, isPaused, currentIndex, activeSentences.length, speed, onControllerReady]);

  if (headless || !isOpen) return null;

  // Mini-pill collapsed view (completely non-intrusive on mobile!)
  if (isCollapsed) {
    return (
      <div className="fixed bottom-[70px] inset-x-3 sm:bottom-4 sm:inset-x-auto sm:right-6 max-w-sm ml-auto z-50 animate-in slide-in-from-bottom duration-200 font-sans">
        <div className="bg-slate-900/95 border border-sky-500/40 rounded-2xl p-2 px-3 shadow-2xl backdrop-blur-xl text-slate-100 flex items-center justify-between gap-3">
          {transitionCountdown !== null ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                <span className="text-xs font-bold text-sky-300 truncate">
                  Tiếp theo ({transitionCountdown}s)...
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setTransitionCountdown(null);
                    if (onLessonCompleteRef.current) onLessonCompleteRef.current();
                  }}
                  className="px-2 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-[10px] font-bold cursor-pointer"
                >
                  Chuyển ngay
                </button>
                <button
                  type="button"
                  onClick={() => setTransitionCountdown(null)}
                  className="px-1.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px] cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                <span className="text-xs font-bold text-white truncate max-w-[100px]">
                  #{currentIndex + 1}/{activeSentences.length}
                </span>
                <span className="text-[10px] text-sky-400 font-mono">
                  {currentSentence?.lang === 'ja-JP' ? '🇯🇵' : currentSentence?.lang === 'vi-VN' ? '🇻🇳' : '🇺🇸'}
                </span>
                <button
                  type="button"
                  onClick={cycleMainLang}
                  className="text-[9px] text-slate-300 hover:text-white font-mono bg-slate-800/80 hover:bg-slate-700 px-1.5 py-0.5 rounded cursor-pointer transition-colors border border-slate-700/60"
                  title="Ngôn ngữ chính (Số & ký hiệu mặc định): Bấm để đổi (JA ➡ VI ➡ EN)"
                >
                  Main: {mainLang === 'ja-JP' ? '🇯🇵' : mainLang === 'vi-VN' ? '🇻🇳' : '🇺🇸'}
                </button>
                {settings.tts_wake_lock && (
                  <span title="Màn hình sáng" className="text-amber-400 text-[10px]">☀️</span>
                )}
                {settings.tts_auto_advance && (
                  <span title="Chạy liên tục (Máy audio)" className="text-sky-400 text-[10px]">📻</span>
                )}
                {repeatMode !== '1x' && (
                  <span title={`Đang lặp Shadowing ${repeatMode}`} className="text-emerald-400 text-[10px] font-mono font-bold bg-emerald-500/15 px-1 py-0.5 rounded border border-emerald-500/30">🔁{repeatMode}</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isPlaying ? (
                  <button
                    type="button"
                    onClick={handlePause}
                    className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePlay}
                    className="w-7 h-7 rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center font-bold"
                  >
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsCollapsed(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Mở rộng trình phát"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleStop();
                    onClose();
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="Đóng"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Expanded View - Modern, sleek floating audio capsule
  return (
    <div className="fixed bottom-[72px] inset-x-2 sm:bottom-4 sm:inset-x-auto sm:right-6 sm:max-w-xl sm:w-full z-50 animate-in slide-in-from-bottom duration-300 font-sans">
      {/* Collapsible Settings Drawer - only shown when ⚙️ is tapped */}
      {isSettingsOpen && (
        <div className="mb-2 p-3 sm:p-3.5 rounded-2xl bg-slate-900/98 border border-slate-700/90 shadow-2xl backdrop-blur-2xl text-slate-100 animate-in slide-in-from-bottom-2 fade-in duration-200 flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span className="font-bold text-sky-400 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <Settings className="w-3.5 h-3.5 text-sky-400" />
              <span>Cài đặt Đọc TTS</span>
            </span>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Filter Sentences Mode */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400 text-[11px]">Lọc nội dung đọc:</span>
            <div className="flex rounded-lg bg-slate-800 p-0.5 text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => {
                  setFilterMode('all');
                  setCurrentIndex(0);
                  if (isPlaying) handleStop();
                }}
                className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                  filterMode === 'all' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode('ja');
                  setCurrentIndex(0);
                  if (isPlaying) handleStop();
                }}
                className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                  filterMode === 'ja' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                🇯🇵 Nhật
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode('vi');
                  setCurrentIndex(0);
                  if (isPlaying) handleStop();
                }}
                className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                  filterMode === 'vi' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                🇻🇳 Việt
              </button>
            </div>
          </div>

          {/* Smart Toggles: Furigana, Wake Lock & Auto-advance */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => updateSettings({ show_furigana: settings.show_furigana === false ? true : false })}
              className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-[11px] font-medium border transition-all cursor-pointer ${
                settings.show_furigana !== false
                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:text-white'
              }`}
              title="Bật/Tắt hiển thị phiên âm Furigana trên chữ Hán"
            >
              <span className="text-[10px] font-bold font-mono px-1 rounded bg-slate-900 border border-slate-700">振</span>
              <span>{settings.show_furigana !== false ? 'Furigana: BẬT' : 'Furigana: TẮT'}</span>
            </button>

            <button
              type="button"
              onClick={() => updateSettings({ tts_wake_lock: !settings.tts_wake_lock })}
              className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-[11px] font-medium border transition-all cursor-pointer ${
                settings.tts_wake_lock
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:text-white'
              }`}
            >
              <Sun className={`w-3.5 h-3.5 ${settings.tts_wake_lock ? 'text-amber-400' : ''}`} />
              <span>{settings.tts_wake_lock ? 'Màn hình luôn sáng' : 'Tự tắt màn hình'}</span>
            </button>

            <button
              type="button"
              onClick={() => updateSettings({ tts_auto_advance: !settings.tts_auto_advance })}
              className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-[11px] font-medium border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                settings.tts_auto_advance
                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:text-white'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${settings.tts_auto_advance ? 'text-sky-400' : ''}`} />
              <span>{settings.tts_auto_advance ? 'Chạy liên tục các bài' : 'Dừng khi hết bài'}</span>
            </button>
          </div>

          {/* Delay Interval between sentences */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-slate-400 flex items-center gap-1 text-[11px]">
              <Timer className="w-3.5 h-3.5 text-sky-400" />
              <span>Nghỉ giữa câu:</span>
            </span>
            <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              {[0, 0.5, 1, 2].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => updateSettings({ tts_sentence_delay: d })}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                    (settings.tts_sentence_delay ?? 0.5) === d
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Shadowing A-B Repetition Mode */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-slate-400 flex items-center gap-1 text-[11px]">
              <Repeat className="w-3.5 h-3.5 text-emerald-400" />
              <span>Luyện nói Shadowing:</span>
            </span>
            <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              {(['1x', '2x', '3x', 'loop'] as RepeatMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setRepeatMode(mode);
                    repeatCountRef.current = 0;
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                    repeatMode === mode
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={mode === 'loop' ? 'Lặp vô tận' : `Lặp lại câu ${mode}`}
                >
                  {mode === 'loop' ? 'Lặp ∞' : mode}
                </button>
              ))}
            </div>
          </div>

          {/* Studio Audio Option */}
          {hasAudioUrl ? (
            <button
              type="button"
              onClick={() => {
                handleStop();
                onSwitchToStudioAudio?.();
              }}
              className="mt-1 w-full py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Headphones className="w-3.5 h-3.5 text-emerald-400" />
              <span>Chuyển sang Audio Studio (Edge-TTS HD)</span>
            </button>
          ) : onRequestGenerateTTS ? (
            <button
              type="button"
              disabled={isGeneratingTTS}
              onClick={onRequestGenerateTTS}
              className="mt-1 w-full py-2 px-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-[11px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {isGeneratingTTS ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                  <span>Đang tạo bản thu Edge-TTS...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tạo Edge-TTS Studio (Giọng AI mượt mà)</span>
                </>
              )}
            </button>
          ) : null}
        </div>
      )}

      {/* Primary Floating Capsule Player (Ultra-modern, sleek ~76px) */}
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl backdrop-blur-2xl text-slate-100 overflow-hidden">
        {/* Progress Bar along the top edge */}
        <div className="h-1 w-full bg-slate-800">
          <div
            className="h-full bg-sky-400 transition-all duration-300 ease-out"
            style={{
              width: `${activeSentences.length > 0 ? ((currentIndex + 1) / activeSentences.length) * 100 : 0}%`,
            }}
          />
        </div>

        <div className="p-2.5 sm:px-4 sm:py-3 flex flex-col gap-1.5">
          {/* Active Sentence Row */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md font-mono ${
                currentSentence?.lang === 'ja-JP'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : currentSentence?.lang === 'vi-VN'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}
            >
              {currentSentence?.lang === 'ja-JP' ? '🇯🇵' : currentSentence?.lang === 'vi-VN' ? '🇻🇳' : '🇺🇸'} #{currentIndex + 1}
            </span>

            <p className="text-xs sm:text-sm font-medium text-slate-100 truncate flex-1 min-w-0">
              {currentSentence ? currentSentence.text : 'Đang tải bài học...'}
            </p>

            {onScrollToActiveSentence && (
              <button
                type="button"
                onClick={onScrollToActiveSentence}
                title="Cuộn tới vị trí câu này trong bài viết"
                className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors"
              >
                <LocateFixed className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Controls & Quick Toggles Row */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
            {/* Left: Main Lang, Speed, & Shadowing pills */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={cycleMainLang}
                className="px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-[10px] font-bold text-slate-300 border border-slate-700/60 cursor-pointer transition-colors"
                title="Ngôn ngữ chính (Số & ký hiệu): Bấm để đổi (JA ➡ VI ➡ EN)"
              >
                Main: {mainLang === 'ja-JP' ? '🇯🇵' : mainLang === 'vi-VN' ? '🇻🇳' : '🇺🇸'}
              </button>

              <button
                type="button"
                onClick={() => {
                  const speeds = [0.8, 1.0, 1.2, 1.5, 1.8];
                  const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
                  handleSpeedChange(speeds[nextIdx]);
                }}
                className="px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-[10px] font-mono font-bold text-sky-400 border border-slate-700/60 cursor-pointer transition-colors"
                title="Tốc độ phát âm: Bấm để đổi"
              >
                {speed}x
              </button>

              <button
                type="button"
                onClick={() => {
                  const modes: RepeatMode[] = ['1x', '2x', '3x', 'loop'];
                  const nextIdx = (modes.indexOf(repeatMode) + 1) % modes.length;
                  setRepeatMode(modes[nextIdx]);
                  repeatCountRef.current = 0;
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                  repeatMode !== '1x'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border-slate-700/60'
                }`}
                title="Chế độ Shadowing: Lặp lại câu (1x, 2x, 3x, hoặc Vô tận ∞) để luyện nhại giọng"
              >
                <Repeat className={`w-3 h-3 ${repeatMode !== '1x' ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{repeatMode === 'loop' ? 'Loop ∞' : `${repeatMode}`}</span>
              </button>
            </div>

            {/* Center: Playback Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex <= 0}
                className="p-1.5 rounded-full text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer transition-colors active:scale-95"
                title="Câu trước"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {isPlaying ? (
                <button
                  type="button"
                  onClick={handlePause}
                  className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer transition-transform"
                  title="Tạm dừng"
                >
                  <Pause className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePlay}
                  disabled={activeSentences.length === 0}
                  className="w-9 h-9 rounded-full bg-sky-500 hover:bg-sky-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-sky-500/20 active:scale-95 cursor-pointer transition-transform disabled:opacity-40"
                  title="Phát tiếp"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                disabled={currentIndex >= activeSentences.length - 1}
                className="p-1.5 rounded-full text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer transition-colors active:scale-95"
                title="Câu tiếp theo"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Right: Settings, Minimize, Close */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  isSettingsOpen
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800 border-transparent'
                }`}
                title="Cài đặt phát âm, nghỉ giữa câu & chế độ"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Thu nhỏ thanh phát"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  handleStop();
                  onClose();
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                title="Đóng trình phát"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
