import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Volume2,
  CheckCircle,
  XCircle,
  Sparkles,
  RefreshCw,
  Layers,
  ArrowRightLeft,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';

export interface FlashcardItem {
  id?: number | string;
  front: string;
  back: string;
  furigana?: string;
  example?: string;
  hint?: string;
}

interface FlashcardDeckProps {
  dataString?: string;
  cards?: FlashcardItem[];
  title?: string;
}

export const FlashcardDeck: React.FC<FlashcardDeckProps> = ({
  dataString,
  cards: propCards,
  title = 'Ôn tập thẻ ghi nhớ (Flashcard)'
}) => {
  // Parse input cards from either prop or markdown codeblock text
  const initialCards = useMemo<FlashcardItem[]>(() => {
    if (propCards && propCards.length > 0) return propCards;
    if (!dataString) return [];

    const trimmed = dataString.trim();

    // 1. Try parsing JSON
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
        if (parsed.cards && Array.isArray(parsed.cards)) return parsed.cards;
      } catch (e) {
        console.warn('Flashcard JSON parse failed, trying line format:', e);
      }
    }

    // 2. Line format: "Front | Back | Example" or "Q: ... A: ... Ex: ..."
    const items: FlashcardItem[] = [];
    const lines = trimmed.split('\n');

    let currentItem: Partial<FlashcardItem> = {};

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (currentItem.front && currentItem.back) {
          items.push(currentItem as FlashcardItem);
          currentItem = {};
        }
        continue;
      }

      // Pipe format: Front | Back | Example
      if (line.includes('|')) {
        const parts = line.replace(/^[-*•]\s*/, '').split('|').map((s) => s.trim());
        if (parts.length >= 2) {
          items.push({
            front: parts[0],
            back: parts[1],
            example: parts[2] || undefined,
          });
          continue;
        }
      }

      // Key-value format: Front / Back / Ex
      if (/^(?:Front|Q|Câu hỏi|Mặt trước)\s*[:：]/i.test(line)) {
        currentItem.front = line.replace(/^(?:Front|Q|Câu hỏi|Mặt trước)\s*[:：]\s*/i, '');
      } else if (/^(?:Back|A|Đáp án|Mặt sau)\s*[:：]/i.test(line)) {
        currentItem.back = line.replace(/^(?:Back|A|Đáp án|Mặt sau)\s*[:：]\s*/i, '');
      } else if (/^(?:Ex|Example|Ví dụ)\s*[:：]/i.test(line)) {
        currentItem.example = line.replace(/^(?:Ex|Example|Ví dụ)\s*[:：]\s*/i, '');
      }
    }

    if (currentItem.front && currentItem.back) {
      items.push(currentItem as FlashcardItem);
    }

    return items;
  }, [dataString, propCards]);

  const [deck, setDeck] = useState<FlashcardItem[]>(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [invertSides, setInvertSides] = useState(false); // false: Front=VI, Back=JA; true: Front=JA, Back=VI

  // Evaluation states
  const [knownIds, setKnownIds] = useState<Set<number>>(new Set());
  const [unknownIds, setUnknownIds] = useState<Set<number>>(new Set());
  const [isCompleted, setIsCompleted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Preserve scroll position without resetting on mobile
  const savedScrollRef = useRef<number>(0);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      savedScrollRef.current = window.scrollY || window.pageYOffset || 0;
      setIsFullscreen(true);
    } else {
      setIsFullscreen(false);
      const pos = savedScrollRef.current;
      setTimeout(() => {
        window.scrollTo({ top: pos, behavior: 'instant' });
      }, 30);
    }
  };

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Sync when initialCards change
  useEffect(() => {
    setDeck(initialCards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnownIds(new Set());
    setUnknownIds(new Set());
    setIsCompleted(false);
  }, [initialCards]);

  if (!deck || deck.length === 0) {
    return null;
  }

  const currentCard = deck[currentIndex];
  const total = deck.length;
  const progressPercent = Math.round(((currentIndex + 1) / total) * 100);

  // Card side assignment based on invertSides
  const displayFront = invertSides
    ? (currentCard.furigana ? currentCard.furigana : currentCard.back)
    : currentCard.front;
  const displayBack = invertSides
    ? currentCard.front
    : (currentCard.furigana ? currentCard.furigana : currentCard.back);

  const displayFrontPlain = invertSides ? currentCard.back : currentCard.front;
  const displayBackPlain = invertSides ? currentCard.front : currentCard.back;

  // Audio pronunciation via SpeechSynthesis
  const speakText = (text: string, lang: 'ja' | 'vi' = 'ja') => {
    if (typeof window === 'undefined') return;
    try {
      const clean = text.replace(/<[^>]+>/g, '').trim();
      const utt = new SpeechSynthesisUtterance(clean);
      utt.lang = lang === 'ja' ? 'ja-JP' : 'vi-VN';
      utt.rate = 0.95;
      window.speechSynthesis.speak(utt);
    } catch (e) {
      console.warn('Speech error:', e);
    }
  };

  const handleNext = () => {
    setIsFlipped(false);
    if (currentIndex + 1 < total) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrev = () => {
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleEvaluate = (known: boolean) => {
    if (known) {
      setKnownIds((prev) => new Set(prev).add(currentIndex));
      setUnknownIds((prev) => {
        const next = new Set(prev);
        next.delete(currentIndex);
        return next;
      });
    } else {
      setUnknownIds((prev) => new Set(prev).add(currentIndex));
      setKnownIds((prev) => {
        const next = new Set(prev);
        next.delete(currentIndex);
        return next;
      });
    }
    handleNext();
  };

  const handleShuffle = () => {
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnownIds(new Set());
    setUnknownIds(new Set());
    setIsCompleted(false);
  };

  const handleRestart = (onlyUnknown: boolean = false) => {
    if (onlyUnknown && unknownIds.size > 0) {
      const filtered = deck.filter((_, idx) => unknownIds.has(idx));
      setDeck(filtered);
    } else {
      setDeck(initialCards);
    }
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnownIds(new Set());
    setUnknownIds(new Set());
    setIsCompleted(false);
  };

  // Shared inner deck renderer for both inline and fullscreen modal
  const renderDeckBody = (inModal: boolean) => {
    return (
      <div className={`w-full flex-1 flex flex-col ${inModal ? 'max-w-2xl mx-auto h-full min-h-0' : 'justify-between'}`}>
        {/* Deck Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 sm:pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                {title}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono font-normal">
                  {deck.length} thẻ
                </span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Invert Sides (VI ⇄ JA) */}
            <button
              type="button"
              onClick={() => setInvertSides((prev) => !prev)}
              title={invertSides ? 'Đang hỏi: Tiếng Nhật ➔ Tiếng Việt' : 'Đang hỏi: Tiếng Việt ➔ Tiếng Nhật'}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                invertSides
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{invertSides ? 'JA ➔ VI' : 'VI ➔ JA'}</span>
            </button>

            {/* Shuffle Deck */}
            <button
              type="button"
              onClick={handleShuffle}
              title="Xáo trộn ngẫu nhiên thứ tự thẻ"
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            {/* Fullscreen Toggle Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={inModal ? 'Thu nhỏ lại (ESC)' : 'Mở rộng toàn màn hình'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                inModal
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                  : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 hover:text-white border-sky-500/30'
              }`}
            >
              {inModal ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-bold">Thu nhỏ</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[11px] font-medium hidden xs:inline">Toàn màn hình</span>
                </>
              )}
            </button>
          </div>
        </div>

        {!isCompleted ? (
          <div className="flex-1 flex flex-col min-h-0 py-1.5 sm:py-2">
            {/* Progress Bar & Counters */}
            <div className="mt-1 mb-2 shrink-0">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-mono">
                <span>Thẻ {currentIndex + 1} / {total}</span>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> {knownIds.size} thuộc
                  </span>
                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> {unknownIds.size} chưa
                  </span>
                </div>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* 3D Flip Card Container - Expands vertically in modal */}
            <div
              onClick={() => setIsFlipped((prev) => !prev)}
              className={`group relative w-full ${
                inModal ? 'flex-1 my-1.5 sm:my-3 min-h-0' : 'min-h-[220px] sm:min-h-[250px]'
              } p-4 sm:p-6 rounded-2xl cursor-pointer transition-all duration-200 border border-slate-800 hover:border-sky-500/50 bg-slate-900/90 hover:bg-slate-900 flex flex-col justify-between shadow-xl`}
            >
              {/* Top Indicator */}
              <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-2 shrink-0">
                <span className="font-semibold text-sky-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {!isFlipped
                    ? (invertSides ? 'Tiếng Nhật (Câu hỏi)' : 'Tiếng Việt (Ý nghĩa)')
                    : (invertSides ? 'Tiếng Việt (Đáp án)' : 'Tiếng Nhật (Đáp án)')}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {!isFlipped ? 'Chạm để lật đáp án 👆' : 'Chạm để quay lại mặt trước 👆'}
                </span>
              </div>

              {/* Card Content Body */}
              <div className="py-4 flex-1 flex flex-col items-center justify-center text-center my-auto overflow-y-auto min-h-0">
                {!isFlipped ? (
                  // FRONT SIDE
                  <div className="animate-in fade-in duration-200 w-full px-2">
                    <p
                      className={`${
                        inModal ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-2xl'
                      } font-bold text-white tracking-tight leading-relaxed`}
                      dangerouslySetInnerHTML={{ __html: displayFront }}
                    />
                    {currentCard.hint && (
                      <p className="mt-3 text-xs sm:text-sm text-slate-400 italic">💡 Gợi ý: {currentCard.hint}</p>
                    )}
                  </div>
                ) : (
                  // BACK SIDE
                  <div className="animate-in fade-in duration-200 w-full max-w-lg mx-auto px-2">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <div
                        className={`${
                          inModal ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
                        } font-extrabold text-sky-300 tracking-tight leading-relaxed`}
                        dangerouslySetInnerHTML={{ __html: displayBack }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          speakText(displayBackPlain, invertSides ? 'vi' : 'ja');
                        }}
                        className="p-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 transition-colors shrink-0"
                        title="Phát âm"
                      >
                        <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>

                    {/* Example sentence if available */}
                    {currentCard.example && (
                      <div className="mt-3 pt-3 border-t border-slate-800/80 text-left bg-slate-950/60 p-3 sm:p-4 rounded-xl border border-slate-800/60 text-xs sm:text-sm text-slate-300 leading-relaxed">
                        <div className="text-[10px] sm:text-xs text-sky-400 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                          <span>💬 Ví dụ thực chiến:</span>
                        </div>
                        <div dangerouslySetInnerHTML={{ __html: currentCard.example }} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Flip Hint Bar */}
              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 pt-2 border-t border-slate-800/60 font-medium shrink-0">
                <RotateCw className="w-3 h-3 text-sky-400 animate-spin-slow" />
                <span>{!isFlipped ? 'Lật mặt sau để kiểm tra' : 'Lật lại mặt trước'}</span>
              </div>
            </div>

            {/* Action Footer Buttons (Self-Evaluation & Prev/Next) */}
            <div className="mt-1 sm:mt-2 flex items-center justify-between gap-2 shrink-0 pb-1">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={handlePrev}
                className={`flex items-center gap-1 px-3 py-2 sm:py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  currentIndex > 0
                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                    : 'bg-slate-950/40 border-slate-900 text-slate-600 opacity-40 cursor-not-allowed'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Trước</span>
              </button>

              {/* Self-evaluation (Chưa thuộc / Đã thuộc) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEvaluate(false)}
                  className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-bold transition-all cursor-pointer active:scale-95"
                >
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span>Chưa thuộc</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleEvaluate(true)}
                  className="flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Đã thuộc</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1 px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-all cursor-pointer"
              >
                <span>{currentIndex + 1 < total ? 'Tiếp' : 'Kết thúc'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          // DECK COMPLETED SUMMARY CELEBRATION
          <div className="py-8 text-center animate-in zoom-in-95 duration-200 my-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/10">
              <CheckCircle className="w-8 h-8" />
            </div>

            <h4 className="text-xl font-bold text-white mb-1">Xuất sắc! Bạn đã ôn tập xong!</h4>
            <p className="text-xs text-slate-400 mb-6">
              Đã hoàn thành toàn bộ {total} thẻ trong bài học này.
            </p>

            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto mb-6">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="text-2xl font-black text-emerald-400">{knownIds.size}</div>
                <div className="text-[11px] font-semibold text-emerald-300/80">Đã ghi nhớ</div>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <div className="text-2xl font-black text-rose-400">{unknownIds.size}</div>
                <div className="text-[11px] font-semibold text-rose-300/80">Cần ôn thêm</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleRestart(false)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Ôn lại từ đầu</span>
              </button>

              {unknownIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => handleRestart(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Chỉ ôn {unknownIds.size} thẻ chưa thuộc</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* 1. Normal Inline Deck: Stays in DOM to avoid page height jumping */}
      <div className="my-8 rounded-2xl border border-sky-500/30 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 shadow-2xl p-4 sm:p-6 text-slate-100 select-none">
        {renderDeckBody(false)}
      </div>

      {/* 2. Fullscreen Portal Overlay: Mounts directly to document.body */}
      {isFullscreen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-[#070a13] w-screen h-[100dvh] flex flex-col p-3 sm:p-6 overflow-hidden overscroll-contain text-slate-100 select-none animate-in fade-in duration-150">
            {renderDeckBody(true)}
          </div>,
          document.body
        )}
    </>
  );
};
