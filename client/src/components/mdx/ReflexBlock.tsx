import React, { useState, useEffect, useRef } from 'react';
import { Timer, Volume2, Eye, EyeOff, RotateCcw, CheckCircle2, AlertCircle, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';

export interface ReflexItem {
  id?: number | string;
  situation: string;
  hint?: string;
  japanese: string;
  furigana?: string;
  romaji?: string;
  key_point?: string;
}

interface ReflexBlockProps {
  dataString?: string;
  items?: ReflexItem[];
}

export const ReflexBlock: React.FC<ReflexBlockProps> = ({ dataString, items: propsItems }) => {
  let items: ReflexItem[] = propsItems || [];

  if (!items.length && dataString) {
    try {
      const parsed = JSON.parse(dataString);
      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (parsed && typeof parsed === 'object') {
        items = [parsed];
      }
    } catch (e) {
      console.error('Failed to parse reflex dataString', e);
    }
  }

  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(5);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [selfScore, setSelfScore] = useState<Record<number, 'pass' | 'fail'>>({});

  const timerRef = useRef<any>(null);

  const currentItem = items[currentIndex];

  useEffect(() => {
    // Reset state when switching items
    setTimeLeft(5);
    setIsTimerRunning(false);
    setTimerFinished(false);
    setIsRevealed(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [currentIndex]);

  const startCountdown = () => {
    if (isTimerRunning) return;
    setTimeLeft(5);
    setTimerFinished(false);
    setIsTimerRunning(true);
    setIsRevealed(false);

    if (timerRef.current) clearInterval(timerRef.current);

    const startTime = Date.now();
    const duration = 5000;

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 5 - Math.floor(elapsed / 1000));
      setTimeLeft(remaining);

      if (elapsed >= duration) {
        clearInterval(timerRef.current);
        setIsTimerRunning(false);
        setTimerFinished(true);
      }
    }, 100);
  };

  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(5);
    setIsTimerRunning(false);
    setTimerFinished(false);
    setIsRevealed(false);
  };

  const handleSpeak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  if (!items.length || !currentItem) {
    return null;
  }

  const currentStatus = selfScore[currentIndex];

  return (
    <div className="my-6 rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/40 via-slate-900/60 to-slate-950/80 p-4 sm:p-6 shadow-xl backdrop-blur-md">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 border-b border-indigo-500/20 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner">
            <Timer className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              Thử Thách Phản Xạ 5 Giây
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                JSST Speaking
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">Tự nói thành tiếng trong 5s trước khi mở đáp án</p>
          </div>
        </div>

        {items.length > 1 && (
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono">
            <span>{currentIndex + 1}</span>
            <span className="text-slate-600">/</span>
            <span>{items.length}</span>
          </div>
        )}
      </div>

      {/* Situation Box */}
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 mb-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Tình huống phản xạ #{currentIndex + 1}:</span>
        </div>
        <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed">
          {currentItem.situation}
        </p>
        {currentItem.hint && (
          <p className="mt-2 text-xs text-slate-400 italic flex items-center gap-1">
            <span className="text-slate-500 font-bold not-italic">Gợi ý từ khóa:</span> {currentItem.hint}
          </p>
        )}
      </div>

      {/* 5-Second Countdown HUD */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/20 mb-4">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <button
            type="button"
            onClick={startCountdown}
            disabled={isTimerRunning}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              isTimerRunning
                ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
            }`}
          >
            <Timer className="w-4 h-4" />
            {isTimerRunning ? 'Đang đếm ngược...' : 'Bắt đầu 5s ⏱️'}
          </button>

          <button
            type="button"
            onClick={handleReset}
            title="Đặt lại đồng hồ"
            className="p-2 rounded-xl border border-slate-700/60 bg-slate-800/60 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Timer status badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`text-2xl font-black font-mono transition-colors ${
                timeLeft === 0
                  ? 'text-rose-400 animate-bounce'
                  : isTimerRunning
                  ? 'text-amber-300'
                  : 'text-indigo-300'
              }`}
            >
              00:0{timeLeft}s
            </div>
            <span className="text-[11px] text-slate-400">
              {timerFinished
                ? '🔔 Hết giờ! Hãy nói ngay!'
                : isTimerRunning
                ? '🗣️ Mở miệng nói ngay!'
                : 'Chờ kích hoạt'}
            </span>
          </div>
        </div>
      </div>

      {/* Answer Reveal Section */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setIsRevealed(!isRevealed)}
          className="w-full py-2.5 px-4 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-800/90 text-xs sm:text-sm font-semibold text-sky-300 hover:text-sky-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          {isRevealed ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-sky-400" />}
          {isRevealed ? 'Ẩn câu mẫu & phân tích' : '👉 Bấm xem câu tiếng Nhật mẫu chuẩn & phân tích'}
        </button>

        {isRevealed && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Japanese phrase with Furigana */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Câu phản xạ chuẩn:
                </span>
                <button
                  type="button"
                  onClick={() => handleSpeak(currentItem.japanese)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-[11px] font-medium text-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Nghe phát âm
                </button>
              </div>

              {currentItem.furigana ? (
                <div
                  className="text-base sm:text-lg font-bold text-white tracking-wide leading-relaxed font-sans"
                  dangerouslySetInnerHTML={{ __html: currentItem.furigana }}
                />
              ) : (
                <div className="text-base sm:text-lg font-bold text-white tracking-wide leading-relaxed">
                  {currentItem.japanese}
                </div>
              )}

              {currentItem.romaji && (
                <div className="text-xs text-emerald-300/70 font-mono mt-1">
                  {currentItem.romaji}
                </div>
              )}
            </div>

            {/* Key takeaway */}
            {currentItem.key_point && (
              <div className="pt-2 border-t border-emerald-500/20">
                <div className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                  <span className="shrink-0 font-bold text-amber-400">💡 Điểm mấu chốt:</span>
                  <span>{currentItem.key_point}</span>
                </div>
              </div>
            )}

            {/* Self evaluation */}
            <div className="pt-3 border-t border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <span className="text-xs text-slate-400">Bạn đã tự nói được câu này trong 5 giây chưa?</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelfScore({ ...selfScore, [currentIndex]: 'fail' })}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    currentStatus === 'fail'
                      ? 'bg-rose-500/30 border-rose-500 text-rose-300'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  😅 Chưa kịp nói
                </button>
                <button
                  type="button"
                  onClick={() => setSelfScore({ ...selfScore, [currentIndex]: 'pass' })}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    currentStatus === 'pass'
                      ? 'bg-emerald-500/30 border-emerald-500 text-emerald-300'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🎯 Đã phản xạ tốt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation between reflex items */}
      {items.length > 1 && (
        <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-800/80">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-800 text-xs text-slate-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Tình huống trước
          </button>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5">
            {items.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentIndex
                    ? 'w-6 bg-indigo-500'
                    : selfScore[idx] === 'pass'
                    ? 'w-2 bg-emerald-500/80'
                    : selfScore[idx] === 'fail'
                    ? 'w-2 bg-rose-500/80'
                    : 'w-2 bg-slate-700 hover:bg-slate-600'
                }`}
                title={`Tình huống #${idx + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            disabled={currentIndex === items.length - 1}
            onClick={() => setCurrentIndex((prev) => Math.min(items.length - 1, prev + 1))}
            className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-800 text-xs text-slate-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            Tình huống sau
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
