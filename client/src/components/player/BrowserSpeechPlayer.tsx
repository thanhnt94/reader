import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
  Languages,
  Sparkles,
  ChevronDown
} from 'lucide-react';

export type DetectedLang = 'ja-JP' | 'vi-VN' | 'en-US';

export interface SpeechSentence {
  index: number;
  text: string;
  lang: DetectedLang;
}

/**
 * Strips HTML tags, removes <rt>...</rt> ruby annotations, cleans markdown formatting,
 * and splits into natural speech sentences.
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
  // This prevents the browser voice from repeating both Kanji and Furigana pronunciation
  text = text.replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, '');
  text = text.replace(/<rp[^>]*>[\s\S]*?<\/rp>/gi, '');

  // 4. Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // 5. Clean Markdown Tables: remove separator lines like | :--- | :--- |
  text = text.replace(/\|[\s:-\|]+\|/g, '');
  text = text.replace(/\|/g, ', ');

  // 6. Clean Markdown Syntax:
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ''); // images
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'); // links
  text = text.replace(/>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]/gi, ''); // GitHub alerts
  text = text.replace(/^>\s*/gm, ''); // blockquotes
  text = text.replace(/^#{1,6}\s+/gm, ''); // headers
  text = text.replace(/[*_~]{1,3}/g, ''); // bold, italics, strikethrough
  text = text.replace(/^\s*[-*+]\s+/gm, ''); // bullets
  text = text.replace(/^\s*\d+\.\s+/gm, ''); // numbered lists

  // 7. Remove non-speech emojis / decorative symbols
  text = text.replace(/[📌⚡💡💬➡/]/g, ' ');

  // 8. Split by punctuation: Japanese (。！？) and Latin (.!?) and newlines
  const rawSegments = text.split(/(?<=[。！？.!?\n])\s+/);

  const sentences: SpeechSentence[] = [];
  let idx = 0;

  for (const seg of rawSegments) {
    const trimmed = seg.trim();
    // Exclude noise, horizontal rules, or single punctuation
    if (trimmed.length > 1 && !/^[-_—\s,.]+$/.test(trimmed)) {
      const lang = detectLanguage(trimmed);
      sentences.push({
        index: idx++,
        text: trimmed,
        lang,
      });
    }
  }

  return sentences;
}

/**
 * Analyzes character distribution to identify Japanese vs Vietnamese vs English.
 */
export function detectLanguage(text: string): DetectedLang {
  const jaMatches = text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g);
  const jaCount = jaMatches ? jaMatches.length : 0;

  const viMatches = text.match(
    /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/g
  );
  const viCount = viMatches ? viMatches.length : 0;

  if (jaCount > 0 && jaCount >= viCount) {
    return 'ja-JP';
  }
  if (viCount > 0) {
    return 'vi-VN';
  }
  return 'en-US';
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
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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
      if (synthRef.current) {
        synthRef.current.cancel();
      }
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
      if (synthRef.current) {
        synthRef.current.cancel();
      }
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
    const langPrefix = lang.split('-')[0]; // 'ja', 'vi', 'en'
    const exact = voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase());
    if (exact) return exact;

    const natural = voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith(langPrefix) &&
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Online'))
    );
    if (natural) return natural;

    const fallback = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
    return fallback || null;
  };

  // Speak sentence at specific index
  const speakSentence = (index: number) => {
    if (!synthRef.current || index < 0 || index >= activeSentences.length) {
      setIsPlaying(false);
      setIsPaused(false);
      return;
    }

    synthRef.current.cancel();

    const target = activeSentences[index];
    const utterance = new SpeechSynthesisUtterance(target.text);
    utterance.lang = target.lang;
    utterance.rate = speed;

    const matchedVoice = getVoiceForLang(target.lang);
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
      console.warn('Speech synthesis error:', e);
      if (index + 1 < activeSentences.length) {
        setCurrentIndex(index + 1);
        speakSentence(index + 1);
      } else {
        setIsPlaying(false);
        setIsPaused(false);
      }
    };

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  };

  const handlePlay = () => {
    if (!synthRef.current) return;

    if (isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
      setIsPlaying(true);
    } else {
      speakSentence(currentIndex);
    }
  };

  const handlePause = () => {
    if (!synthRef.current) return;
    synthRef.current.pause();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
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
    <div className="fixed bottom-4 inset-x-4 max-w-3xl mx-auto z-40 animate-in slide-in-from-bottom duration-300 font-sans">
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-2xl text-slate-100 flex flex-col gap-3">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Volume2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-white truncate">{title}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-semibold text-emerald-400 border border-slate-700/60 shrink-0">
                  Browser TTS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Native Speech Engine • Auto-detecting Language & Clean Furigana
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Filter Mode Selector */}
            <div className="flex rounded-xl bg-slate-800 p-0.5 text-[11px] font-semibold">
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
                🇯🇵 Japanese Only
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
                🇻🇳 Vietnamese Only
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                handleStop();
                onClose();
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Active Sentence Display */}
        <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 min-h-[56px] flex flex-col justify-center">
          {currentSentence ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
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
                  <span>Sentence {currentIndex + 1} of {activeSentences.length}</span>
                </span>
                <span className="text-[10px] text-slate-500">
                  {isPlaying ? 'Speaking...' : isPaused ? 'Paused' : 'Ready'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed line-clamp-2">
                {currentSentence.text}
              </p>
            </div>
          ) : (
            <div className="text-center text-xs text-slate-500 py-2">
              No speech sentences found in this article.
            </div>
          )}
        </div>

        {/* Playback Controls & Speed */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Main Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex <= 0}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
              title="Previous Sentence"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {isPlaying ? (
              <button
                type="button"
                onClick={handlePause}
                className="w-10 h-10 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                title="Pause"
              >
                <Pause className="w-5 h-5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePlay}
                disabled={activeSentences.length === 0}
                className="w-10 h-10 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-40"
                title="Play Audio"
              >
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={currentIndex >= activeSentences.length - 1}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
              title="Next Sentence"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleStop}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Stop"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl text-[11px] font-bold">
            <span className="text-slate-400 px-1 text-[10px] uppercase">Speed:</span>
            {[0.8, 1.0, 1.25, 1.5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSpeedChange(s)}
                className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
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
