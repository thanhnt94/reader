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
  Sparkles
} from 'lucide-react';

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
}

export const BrowserSpeechPlayer: React.FC<BrowserSpeechPlayerProps> = ({
  rawMarkdown,
  title,
  isOpen,
  onClose,
}) => {
  const [sentences, setSentences] = useState<SpeechSentence[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'ja' | 'vi'>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stop both speech synthesis and any playing audio stream
  const stopAllAudio = () => {
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
      stopAllAudio();
    }
  }, [rawMarkdown]);

  // Filter sentences according to selected filter mode
  const activeSentences = sentences.filter((s) => {
    if (filterMode === 'ja') return s.lang === 'ja-JP';
    if (filterMode === 'vi') return s.lang === 'vi-VN';
    return true;
  });

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

    // CRITICAL: If language is Vietnamese ('vi-VN') and NO Vietnamese voice is found on the client device:
    // DO NOT allow the browser's default English voice to read Vietnamese text!
    // Instead, stream authentic Vietnamese audio from /api/v1/tts/stream!
    if ((target.lang === 'vi-VN' && !matchedVoice) || (target.lang === 'ja-JP' && !matchedVoice)) {
      const langParam = target.lang === 'vi-VN' ? 'vi' : 'ja';
      const streamUrl = `/api/v1/tts/stream?text=${encodeURIComponent(target.text)}&lang=${langParam}`;
      const audio = new Audio(streamUrl);
      audio.playbackRate = speed;
      audioRef.current = audio;

      audio.onended = () => {
        if (index + 1 < activeSentences.length) {
          setCurrentIndex(index + 1);
          speakSentence(index + 1);
        } else {
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentIndex(0);
        }
      };

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

    utterance.onend = () => {
      if (index + 1 < activeSentences.length) {
        setCurrentIndex(index + 1);
        speakSentence(index + 1);
      } else {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentIndex(0);
      }
    };

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

  return (
    <div className="fixed bottom-2 inset-x-2 sm:bottom-4 sm:inset-x-4 max-w-3xl mx-auto z-50 animate-in slide-in-from-bottom duration-300 font-sans">
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-2xl backdrop-blur-2xl text-slate-100 flex flex-col gap-2.5 sm:gap-3">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-white truncate max-w-[120px] sm:max-w-xs">{title}</span>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[9px] sm:text-[10px] font-semibold text-emerald-400 border border-slate-700/60 shrink-0">
                  Multilingual TTS
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Filter Mode Selector */}
            <div className="flex rounded-xl bg-slate-800 p-0.5 text-[10px] sm:text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => {
                  setFilterMode('all');
                  setCurrentIndex(0);
                  if (isPlaying) handleStop();
                }}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterMode === 'all' ? 'bg-slate-700 text-emerald-300 shadow-xs' : 'text-slate-400 hover:text-white'
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
                  filterMode === 'ja' ? 'bg-slate-700 text-emerald-300 shadow-xs' : 'text-slate-400 hover:text-white'
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
                  filterMode === 'vi' ? 'bg-slate-700 text-emerald-300 shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
                title="Read Vietnamese sentences only"
              >
                🇻🇳 <span className="hidden sm:inline">Vietnamese</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                handleStop();
                onClose();
              }}
              className="p-1 sm:p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Active Sentence Display */}
        <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-950/60 border border-slate-800/80 min-h-[50px] sm:min-h-[56px] flex flex-col justify-center">
          {currentSentence ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`px-1.5 py-0.2 rounded-md font-mono text-[9px] sm:text-[10px] font-bold ${
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
                <span className="text-[9px] sm:text-[10px] text-slate-500">
                  {isPlaying ? 'Speaking...' : isPaused ? 'Paused' : 'Ready'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed line-clamp-2">
                {currentSentence.text}
              </p>
            </div>
          ) : (
            <div className="text-center text-xs text-slate-500 py-1.5">
              No speech sentences found in this article.
            </div>
          )}
        </div>

        {/* Playback Controls & Speed */}
        <div className="flex items-center justify-between gap-2">
          {/* Main Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex <= 0}
              className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
              title="Previous Sentence"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {isPlaying ? (
              <button
                type="button"
                onClick={handlePause}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                title="Pause"
              >
                <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePlay}
                disabled={activeSentences.length === 0}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-40"
                title="Play Audio"
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={currentIndex >= activeSentences.length - 1}
              className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
              title="Next Sentence"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleStop}
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Stop"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 sm:p-1 rounded-xl text-[10px] sm:text-[11px] font-bold">
            <span className="text-slate-400 px-1 text-[9px] uppercase hidden xs:inline">Speed:</span>
            {[0.8, 1.0, 1.25, 1.5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSpeedChange(s)}
                className={`px-1.5 sm:px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                  speed === s ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
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
