import React, { useState, useEffect, useRef } from 'react';
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
  FastForward
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export type DetectedLang = 'ja-JP' | 'vi-VN' | 'en-US';

export interface SpeechSentence {
  index: number;
  text: string;
  lang: DetectedLang;
}

/**
 * Analyzes character distribution and vocabulary clues to identify Japanese vs Vietnamese vs English.
 */
export function detectLanguage(text: string): DetectedLang {
  const trimmed = text.trim();
  if (!trimmed) return 'en-US';

  // 1. Japanese Kanji, Hiragana, Katakana check
  const jaMatches = trimmed.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g);
  const jaCount = jaMatches ? jaMatches.length : 0;

  // 2. Vietnamese explicit accented letters check
  const viMatches = trimmed.match(
    /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/g
  );
  const viCount = viMatches ? viMatches.length : 0;

  // 3. Common Vietnamese unaccented words or labels (like "Cau", "Dich", "Buoc", "Bai")
  const hasViKeywords = /\b(câu|bài|bước|dịch|nghĩa|tiếng|ví dụ|hỏi|đáp|trả lời|dàn ý|từ vựng)\b/i.test(trimmed);

  if (jaCount > 0 && jaCount >= viCount && !hasViKeywords) {
    return 'ja-JP';
  }
  if (viCount > 0 || hasViKeywords) {
    return 'vi-VN';
  }
  if (jaCount > 0) {
    return 'ja-JP';
  }
  return 'en-US';
}

/**
 * Strips HTML tags, removes <rt>...</rt> ruby annotations, cleans markdown formatting,
 * processes tables cell-by-cell, separates mixed language sentences,
 * and splits into natural speech sentences with accurate language tags.
 */
export function cleanTextForSpeech(rawMarkdown: string): SpeechSentence[] {
  if (!rawMarkdown) return [];

  let text = rawMarkdown;

  // 1. Remove YAML frontmatter
  text = text.replace(/^---[\s\S]*?---\s*\n?/m, '');

  // 2. Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`[^`]+`/g, '');

  // 3. Remove Japanese Ruby Furigana annotations (<rt>...</rt> and <rp>...</rp>)
  // Stripping Furigana prevents duplicate pronunciation of both Kanji and Kana
  text = text.replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, '');
  text = text.replace(/<rp[^>]*>[\s\S]*?<\/rp>/gi, '');

  // 4. Extract explicit language tags if user used <ja>...</ja> or <vi>...</vi>
  // We'll preserve them by marker replacement or processing
  const lines = text.split('\n');
  const sentences: SpeechSentence[] = [];
  let idx = 0;

  const pushSentence = (str: string, forcedLang?: DetectedLang) => {
    const cleaned = str
      .replace(/<[^>]+>/g, '') // remove remaining HTML tags
      .replace(/[*_~]{1,3}/g, '') // remove bold/italics
      .replace(/[📌⚡💡💬➡/]/g, ' ') // decorative symbols
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length > 0 && !/^[-_—\s,.:;|]+$/.test(cleaned)) {
      const lang = forcedLang || detectLanguage(cleaned);
      sentences.push({
        index: idx++,
        text: cleaned,
        lang,
      });
    }
  };

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

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

      // If it's a table header with generic column names like ["Bước", "Tiếng Việt", "Tiếng Nhật"], skip
      const isHeaderRow = cells.every((c) =>
        /^(bước|tiếng việt|tiếng nhật|stt|no|nghĩa|kanji|furigana)$/i.test(c.replace(/[*_~]/g, ''))
      );
      if (isHeaderRow) {
        continue;
      }

      // Read each non-empty data cell individually with its own detected language
      for (const cell of cells) {
        // Strip inline tags
        const cellClean = cell.replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, '').replace(/<[^>]+>/g, '');
        pushSentence(cellClean);
      }
      continue;
    }

    // Clean markdown headings, blockquotes, list markers
    line = line.replace(/^#{1,6}\s+/, '');
    line = line.replace(/^>\s*/, '');
    line = line.replace(/^\s*[-*+]\s+/, '');
    line = line.replace(/^\s*\d+\.\s+/, '');

    // Check for explicit <ja>...</ja> or <vi>...</vi> tags
    if (/<ja>[\s\S]*?<\/ja>/i.test(line) || /<vi>[\s\S]*?<\/vi>/i.test(line)) {
      // Split on tags
      const tagSegments = line.split(/(<ja>[\s\S]*?<\/ja>|<vi>[\s\S]*?<\/vi>)/gi);
      for (const seg of tagSegments) {
        if (/^<ja>([\s\S]*?)<\/ja>$/i.test(seg)) {
          const match = seg.match(/^<ja>([\s\S]*?)<\/ja>$/i);
          if (match && match[1]) pushSentence(match[1], 'ja-JP');
        } else if (/^<vi>([\s\S]*?)<\/vi>$/i.test(seg)) {
          const match = seg.match(/^<vi>([\s\S]*?)<\/vi>$/i);
          if (match && match[1]) pushSentence(match[1], 'vi-VN');
        } else {
          pushSentence(seg);
        }
      }
      continue;
    }

    // Check for mixed prefixes like:
    // "Câu 04: 家族と一緒に住んでいますか..."
    // "Dịch câu hỏi: Bạn thích mùa nào..."
    // "Tiếng Nhật: 四季の中で..."
    const prefixMatch = line.match(
      /^((?:[Cc]âu\s*\d+|[Dd]ịch\s*câu\s*hỏi|[Dd]ịch\s*nghĩa|[Tt]iếng\s*[Nn]hật|[Tt]iếng\s*[Vv]iệt|[Tt]ừ\s*vựng|[Gg]hi\s*chú|[Ll]ưu\s*ý)[\s:.-]*)(.*)$/i
    );
    if (prefixMatch) {
      const prefix = prefixMatch[1].trim();
      const rest = prefixMatch[2].trim();
      if (prefix) pushSentence(prefix, 'vi-VN');
      if (rest) {
        // Split rest if it contains punctuation
        const subParts = rest.split(/([。！？.!?]+)/);
        let cur = '';
        for (const sp of subParts) {
          if (/^[。！？.!?]+$/.test(sp)) {
            cur += sp;
            if (cur.trim()) pushSentence(cur.trim());
            cur = '';
          } else {
            cur += sp;
          }
        }
        if (cur.trim()) pushSentence(cur.trim());
      }
      continue;
    }

    // Check if line is a vocabulary or comparison line with arrows (➡) or colons
    // e.g. "四季: bốn mùa ➡ 一年の中: trong năm"
    if (line.includes('➡') || (line.includes(':') && line.includes('ruby'))) {
      const parts = line.split(/[➡:]/);
      for (const p of parts) {
        pushSentence(p);
      }
      continue;
    }

    // General sentence splitting without regex lookbehinds (for older iOS/WebKit engines)
    const punctuationSplit = line.split(/([。！？.!?]+)/);
    let buffer = '';
    for (const part of punctuationSplit) {
      if (/^[。！？.!?]+$/.test(part)) {
        buffer += part;
        if (buffer.trim()) {
          pushSentence(buffer.trim());
        }
        buffer = '';
      } else {
        buffer += part;
      }
    }
    if (buffer.trim()) {
      pushSentence(buffer.trim());
    }
  }

  return sentences;
}

interface BrowserSpeechPlayerProps {
  rawMarkdown: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onLessonComplete?: () => void;
  hasNextLesson?: boolean;
  autoPlay?: boolean;
}

export const BrowserSpeechPlayer: React.FC<BrowserSpeechPlayerProps> = ({
  rawMarkdown,
  title,
  isOpen,
  onClose,
  onLessonComplete,
  hasNextLesson = false,
  autoPlay = false,
}) => {
  const { settings, updateSettings } = useAppStore();

  const [sentences, setSentences] = useState<SpeechSentence[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'ja' | 'vi'>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Screen Wake Lock API State & Ref
  const wakeLockRef = useRef<any>(null);
  const [isWakeLocked, setIsWakeLocked] = useState(false);

  // Continuous Mode Countdown State & Refs
  const [transitionCountdown, setTransitionCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<any>(null);
  const onLessonCompleteRef = useRef(onLessonComplete);
  const hasNextLessonRef = useRef(hasNextLesson);
  const settingsRef = useRef(settings);
  const hasAutoPlayedRef = useRef(false);

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

  // Countdown timer effect for auto-advancing to next lesson
  useEffect(() => {
    if (transitionCountdown === null) return;
    if (transitionCountdown <= 0) {
      setTransitionCountdown(null);
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
    setTransitionCountdown(null);
    if (synthRef.current) {
      try {
        synthRef.current.cancel();
      } catch (e) {
        // ignore
      }
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    releaseWakeLock();
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

  // Parse markdown into clean speech sentences
  useEffect(() => {
    if (rawMarkdown) {
      const parsed = cleanTextForSpeech(rawMarkdown);
      setSentences(parsed);
      setCurrentIndex(0);
      setIsPlaying(false);
      setIsPaused(false);
      setTransitionCountdown(null);
      stopAllAudio();
      hasAutoPlayedRef.current = false;
    }
  }, [rawMarkdown]);

  // Filter sentences according to selected filter mode
  const activeSentences = sentences.filter((s) => {
    if (filterMode === 'ja') return s.lang === 'ja-JP';
    if (filterMode === 'vi') return s.lang === 'vi-VN';
    return true;
  });

  // Handle autoplay when navigated with ?autoplay=1 (Continuous Audio Machine)
  useEffect(() => {
    if (autoPlay && activeSentences.length > 0 && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      const timer = setTimeout(() => {
        speakSentence(0);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoPlay, activeSentences]);

  const currentSentence = activeSentences[currentIndex] || null;

  // Find best matching voice for language
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

  // Speak sentence at specific index
  const speakSentence = (index: number) => {
    if (index < 0 || index >= activeSentences.length) {
      setIsPlaying(false);
      setIsPaused(false);
      return;
    }

    stopAllAudio();

    const target = activeSentences[index];
    const matchedVoice = getVoiceForLang(target.lang);

    const handleSentenceFinish = () => {
      if (index + 1 < activeSentences.length) {
        setCurrentIndex(index + 1);
        speakSentence(index + 1);
      } else {
        // Reached end of current lesson
        if (settingsRef.current.tts_auto_advance && hasNextLessonRef.current && onLessonCompleteRef.current) {
          setIsPlaying(false);
          setIsPaused(false);
          setTransitionCountdown(2);
        } else {
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentIndex(0);
        }
      }
    };

    // CRITICAL: If language is Vietnamese ('vi-VN') and NO Vietnamese voice is found on the client device:
    // DO NOT allow the browser's default English voice to read Vietnamese text!
    // Instead, stream authentic Vietnamese audio from /api/v1/tts/stream!
    if ((target.lang === 'vi-VN' && !matchedVoice) || (target.lang === 'ja-JP' && !matchedVoice)) {
      const langParam = target.lang === 'vi-VN' ? 'vi' : 'ja';
      const streamUrl = `/api/v1/tts/stream?text=${encodeURIComponent(target.text)}&lang=${langParam}`;
      const audio = new Audio(streamUrl);
      audio.playbackRate = speed;
      audioRef.current = audio;

      audio.onended = handleSentenceFinish;

      audio.onerror = (e) => {
        console.warn('Audio stream error:', e);
        setIsPlaying(false);
        setIsPaused(false);
      };

      setIsPlaying(true);
      setIsPaused(false);
      audio.play().catch((err) => {
        console.warn('Audio play error:', err);
        setIsPlaying(false);
        setIsPaused(false);
      });
      return;
    }

    if (!synthRef.current) return;

    const utterance = new SpeechSynthesisUtterance(target.text);
    utterance.lang = target.lang;
    utterance.rate = speed;

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = handleSentenceFinish;

    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      setIsPlaying(false);
      setIsPaused(false);
    };

    setIsPlaying(true);
    setIsPaused(false);
    synthRef.current.speak(utterance);
  };

  const handlePlay = () => {
    setTransitionCountdown(null);
    if (isPaused) {
      if (audioRef.current) {
        audioRef.current.play();
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
    setTransitionCountdown(null);
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
    stopAllAudio();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(0);
  };

  const handlePrev = () => {
    const nextIdx = Math.max(0, currentIndex - 1);
    setCurrentIndex(nextIdx);
    if (isPlaying) {
      speakSentence(nextIdx);
    }
  };

  const handleNext = () => {
    const nextIdx = Math.min(activeSentences.length - 1, currentIndex + 1);
    setCurrentIndex(nextIdx);
    if (isPlaying) {
      speakSentence(nextIdx);
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (isPlaying) {
      speakSentence(currentIndex);
    }
  };

  if (!isOpen) return null;

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
                {settings.tts_wake_lock && (
                  <span title="Màn hình sáng" className="text-amber-400 text-[10px]">☀️</span>
                )}
                {settings.tts_auto_advance && (
                  <span title="Chạy liên tục (Máy audio)" className="text-sky-400 text-[10px]">📻</span>
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

  // Expanded View
  return (
    <div className="fixed bottom-[72px] inset-x-2 sm:bottom-4 sm:inset-x-4 max-w-2xl mx-auto z-50 animate-in slide-in-from-bottom duration-300 font-sans">
      <div className="bg-slate-900/95 border border-sky-900/50 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl backdrop-blur-2xl text-slate-100 flex flex-col gap-2.5">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <Volume2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-white truncate max-w-[120px] sm:max-w-xs">{title}</span>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[9px] font-semibold text-sky-400 border border-slate-700/60 shrink-0">
                  Multilingual TTS
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Filter Mode Selector */}
            <div className="flex rounded-xl bg-slate-800 p-0.5 text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => {
                  setFilterMode('all');
                  setCurrentIndex(0);
                  if (isPlaying) handleStop();
                }}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterMode === 'all' ? 'bg-slate-700 text-sky-300 shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
                title="Read all sentences"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode('ja');
                  setCurrentIndex(0);
                  if (isPlaying) handleStop();
                }}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterMode === 'ja' ? 'bg-slate-700 text-sky-300 shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
                title="Read Japanese sentences only"
              >
                🇯🇵 <span className="hidden sm:inline">Japanese</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode('vi');
                  setCurrentIndex(0);
                  if (isPlaying) handleStop();
                }}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterMode === 'vi' ? 'bg-slate-700 text-sky-300 shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
                title="Read Vietnamese sentences only"
              >
                🇻🇳 <span className="hidden sm:inline">Vietnamese</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="p-1 sm:p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Thu nhỏ thanh phát"
            >
              <Minimize2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                handleStop();
                onClose();
              }}
              className="p-1 sm:p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Đóng trình phát"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Transition Countdown Banner (Auto-advance to next lesson) */}
        {transitionCountdown !== null && (
          <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-sky-950/90 via-blue-950/90 to-sky-900/90 border border-sky-500/50 flex items-center justify-between gap-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs shrink-0 animate-pulse">
                {transitionCountdown}s
              </div>
              <p className="text-xs text-sky-200 font-medium truncate">
                Đã đọc xong! Đang chuyển bài tiếp theo...
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setTransitionCountdown(null);
                  if (onLessonCompleteRef.current) onLessonCompleteRef.current();
                }}
                className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-md shadow-sky-500/20"
              >
                <FastForward className="w-3 h-3" />
                <span>Chuyển ngay</span>
              </button>
              <button
                type="button"
                onClick={() => setTransitionCountdown(null)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium cursor-pointer"
              >
                Dừng lại
              </button>
            </div>
          </div>
        )}

        {/* Live Active Sentence Display */}
        <div className="p-2 sm:p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 min-h-[46px] flex flex-col justify-center">
          {currentSentence ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`px-1.5 py-0.2 rounded-md font-mono text-[9px] font-bold ${
                      currentSentence.lang === 'ja-JP'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : currentSentence.lang === 'vi-VN'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {currentSentence.lang === 'ja-JP'
                      ? '🇯🇵 Japanese'
                      : currentSentence.lang === 'vi-VN'
                      ? '🇻🇳 Vietnamese'
                      : '🇺🇸 English'}
                  </span>
                  <span>
                    #{currentIndex + 1} / {activeSentences.length}
                  </span>
                </span>
                <span className="text-[9px] text-slate-500">
                  {isPlaying ? 'Speaking...' : isPaused ? 'Paused' : 'Ready'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed line-clamp-2">
                {currentSentence.text}
              </p>
            </div>
          ) : (
            <div className="text-center text-xs text-slate-500 py-1">
              No speech sentences found in this article.
            </div>
          )}
        </div>

        {/* Smart Modes & Options Bar (Screen Wake Lock & Continuous Audio Machine) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            {/* Screen Wake Lock Toggle */}
            <button
              type="button"
              onClick={() => updateSettings({ tts_wake_lock: !settings.tts_wake_lock })}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${
                settings.tts_wake_lock
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs shadow-amber-500/10'
                  : 'bg-slate-800/70 text-slate-400 hover:text-white border border-slate-700/50'
              }`}
              title={
                settings.tts_wake_lock
                  ? 'Màn hình luôn bật sáng khi đọc trên di động'
                  : 'Tự tắt màn hình theo cài đặt tiết kiệm pin của máy'
              }
            >
              <Sun
                className={`w-3.5 h-3.5 ${
                  settings.tts_wake_lock && isPlaying ? 'text-amber-400' : ''
                }`}
              />
              <span>{settings.tts_wake_lock ? 'Giữ màn hình sáng' : 'Tự tắt MH'}</span>
              {isWakeLocked && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping ml-0.5" />
              )}
            </button>

            {/* Continuous Audio Machine Toggle */}
            <button
              type="button"
              onClick={() => updateSettings({ tts_auto_advance: !settings.tts_auto_advance })}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${
                settings.tts_auto_advance
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-xs shadow-sky-500/20'
                  : 'bg-slate-800/70 text-slate-400 hover:text-white border border-slate-700/50'
              }`}
              title={
                settings.tts_auto_advance
                  ? 'Tự động nhảy sang bài/chương tiếp theo khi đọc xong (Máy audio chạy liên tục)'
                  : 'Chỉ đọc hết bài hiện tại rồi dừng lại'
              }
            >
              <Radio
                className={`w-3.5 h-3.5 ${
                  settings.tts_auto_advance ? 'text-sky-400 animate-pulse' : ''
                }`}
              />
              <span>{settings.tts_auto_advance ? 'Máy audio (Chạy liên tục)' : 'Đọc 1 bài'}</span>
            </button>
          </div>

          <div className="text-[10px] text-slate-400 font-mono hidden sm:inline">
            {hasNextLesson ? '● Có bài kế tiếp' : '■ Đã đến bài cuối'}
          </div>
        </div>

        {/* Playback Controls & Speed */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
          {/* Main Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex <= 0}
              className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
              title="Previous Sentence"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {isPlaying ? (
              <button
                type="button"
                onClick={handlePause}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                title="Pause"
              >
                <Pause className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePlay}
                disabled={activeSentences.length === 0}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center font-bold shadow-lg shadow-sky-600/30 transition-all cursor-pointer disabled:opacity-40"
                title="Play Audio"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={currentIndex >= activeSentences.length - 1}
              className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
              title="Next Sentence"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleStop}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Stop"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-xl text-[10px] font-bold">
            <span className="text-slate-400 px-1 text-[9px] uppercase hidden xs:inline">Speed:</span>
            {[0.8, 1.0, 1.25, 1.5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSpeedChange(s)}
                className={`px-1.5 sm:px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                  speed === s ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
