import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  CheckCircle2,
  Table,
  Play,
  Square,
  HelpCircle,
  Copy,
  Check
} from 'lucide-react';

export interface LevelSentence {
  step?: number | string;
  step_title?: string;
  ja: string;
  vi: string;
  plain_ja?: string;
}

export interface LevelData {
  level: string;
  badge: string;
  color?: string;
  description?: string;
  sentences: LevelSentence[];
}

export interface LevelAnswersPayload {
  title?: string;
  situation?: string;
  flow?: Array<{ step: number | string; vi: string; ja?: string }>;
  n5: LevelData;
  n4: LevelData;
  n3: LevelData;
}

interface LevelAnswersBlockProps {
  dataString?: string;
  data?: LevelAnswersPayload;
  globalBlur?: boolean;
}

export const LevelAnswersBlock: React.FC<LevelAnswersBlockProps> = ({
  dataString,
  data: propData,
  globalBlur = false,
}) => {
  const parsedData = React.useMemo<LevelAnswersPayload | null>(() => {
    if (propData) return propData;
    if (!dataString) return null;
    try {
      return JSON.parse(dataString);
    } catch (e) {
      console.error('Failed to parse LevelAnswersBlock json:', e);
      return null;
    }
  }, [propData, dataString]);

  const [activeTab, setActiveTab] = useState<'n5' | 'n4' | 'n3' | 'compare'>('n5');
  const [isLocalBlur, setIsLocalBlur] = useState<boolean>(false);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [copiedLevel, setCopiedLevel] = useState<string | null>(null);

  // Sync with globalBlur when it changes
  useEffect(() => {
    setIsLocalBlur(globalBlur);
    setRevealedIndices(new Set());
  }, [globalBlur]);

  // Reset revealed when switching tabs
  useEffect(() => {
    setRevealedIndices(new Set());
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAll(false);
  }, [activeTab]);

  if (!parsedData || (!parsedData.n5 && !parsedData.n4 && !parsedData.n3)) {
    return null;
  }

  const currentLevelData: LevelData | undefined =
    activeTab === 'compare' ? undefined : (parsedData[activeTab] as LevelData);

  const toggleReveal = (idx: number) => {
    setRevealedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const handleSpeakSentence = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/<[^>]+>/g, '').trim();
    const utt = new SpeechSynthesisUtterance(cleanText);
    utt.lang = 'ja-JP';
    utt.rate = activeTab === 'n5' ? 0.85 : (activeTab === 'n4' ? 0.92 : 1.0);
    window.speechSynthesis.speak(utt);
  };

  const handleSpeakAll = () => {
    if (!currentLevelData || !('speechSynthesis' in window)) return;

    if (isPlayingAll) {
      window.speechSynthesis.cancel();
      setIsPlayingAll(false);
      return;
    }

    window.speechSynthesis.cancel();
    const fullText = currentLevelData.sentences
      .map((s) => s.plain_ja || s.ja.replace(/<[^>]+>/g, ''))
      .join('。 ');

    const utt = new SpeechSynthesisUtterance(fullText);
    utt.lang = 'ja-JP';
    utt.rate = activeTab === 'n5' ? 0.88 : (activeTab === 'n4' ? 0.95 : 1.0);
    utt.onend = () => setIsPlayingAll(false);
    utt.onerror = () => setIsPlayingAll(false);

    setIsPlayingAll(true);
    window.speechSynthesis.speak(utt);
  };

  const handleCopyText = (lvl: 'n5' | 'n4' | 'n3') => {
    const target = parsedData[lvl];
    if (!target) return;
    const clean = target.sentences
      .map((s) => (s.plain_ja || s.ja.replace(/<[^>]+>/g, '')) + '\n' + s.vi)
      .join('\n\n');
    navigator.clipboard.writeText(clean);
    setCopiedLevel(lvl);
    setTimeout(() => setCopiedLevel(null), 2000);
  };

  return (
    <div className="my-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl overflow-hidden backdrop-blur-md">
      {/* Top Banner / Header */}
      <div className="p-3 sm:p-4 bg-slate-950/70 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 via-sky-500/20 to-purple-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Bài Nói Mẫu 3 Cấp Độ</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">
                N5 ➔ N4 ➔ N3
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Cùng 1 dàn ý chuẩn PREP, chọn cấp độ vừa sức để phản xạ trôi chảy 45s
            </p>
          </div>
        </div>

        {/* Global Level Controls */}
        <div className="flex items-center gap-1.5">
          {/* Toggle Blur Japanese */}
          <button
            type="button"
            onClick={() => {
              setIsLocalBlur((prev) => !prev);
              setRevealedIndices(new Set());
            }}
            title={isLocalBlur ? 'Đang che tiếng Nhật (chạm vào câu để xem)' : 'Bấm để che tiếng Nhật luyện phản xạ'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isLocalBlur
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            {isLocalBlur ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
            <span className="text-[11px] hidden xs:inline">{isLocalBlur ? 'Đang che tiếng Nhật' : 'Che tiếng Nhật'}</span>
          </button>

          {/* Read All Speech */}
          {activeTab !== 'compare' && (
            <button
              type="button"
              onClick={handleSpeakAll}
              title={isPlayingAll ? 'Dừng phát âm' : 'Nghe đọc trôi chảy cả bài'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isPlayingAll
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border-sky-500/40'
              }`}
            >
              {isPlayingAll ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span className="text-[11px]">{isPlayingAll ? 'Dừng' : 'Nghe cả bài'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Level Selector Tabs */}
      <div className="px-3 pt-3 bg-slate-950/40 border-b border-slate-800/60 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* N5 Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('n5')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'n5'
                ? 'bg-slate-900 text-emerald-400 border-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/40'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Mức N5 (Dễ nói)</span>
          </button>

          {/* N4 Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('n4')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'n4'
                ? 'bg-slate-900 text-amber-400 border-amber-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/40'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Mức N4 (Tự nhiên)</span>
          </button>

          {/* N3 Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('n3')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'n3'
                ? 'bg-slate-900 text-sky-400 border-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/40'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span>Mức N3 (Chuyên sâu)</span>
          </button>

          {/* Compare Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('compare')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'compare'
                ? 'bg-slate-900 text-purple-400 border-purple-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/40'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Đối chiếu 3 mức</span>
            <span className="sm:hidden">Đối chiếu</span>
          </button>
        </div>

        {activeTab !== 'compare' && (
          <button
            type="button"
            onClick={() => handleCopyText(activeTab)}
            title="Sao chép bài nói mẫu của cấp độ này"
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            {copiedLevel === activeTab ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span className="hidden md:inline">{copiedLevel === activeTab ? 'Đã sao chép' : 'Sao chép'}</span>
          </button>
        )}
      </div>

      {/* Tab Body */}
      <div className="p-3 sm:p-5">
        {/* VIEW 1: SINGLE LEVEL (N5, N4, or N3) */}
        {activeTab !== 'compare' && currentLevelData && (
          <div>
            {/* Level Description Pill */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                    activeTab === 'n5'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : activeTab === 'n4'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  }`}
                >
                  {currentLevelData.badge}
                </span>
                <span className="text-slate-300">{currentLevelData.description}</span>
              </div>
              <span className="text-[11px] text-slate-500 italic">
                {isLocalBlur ? '💡 Đang che: chạm vào câu tiếng Nhật để hé mở' : '💡 Bấm vào câu để nghe phát âm'}
              </span>
            </div>

            {/* Sentence Flow List */}
            <div className="space-y-3">
              {currentLevelData.sentences.map((sent, idx) => {
                const isItemBlurred = isLocalBlur && !revealedIndices.has(idx);

                return (
                  <div
                    key={idx}
                    className="group relative p-3 sm:p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all"
                  >
                    {/* Step Badge & Sentence Player */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60">
                          {sent.step ? `Bước ${sent.step}` : `Câu ${idx + 1}`}
                        </span>
                        {sent.step_title && (
                          <span className="text-xs font-semibold text-slate-400">
                            {sent.step_title}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpeakSentence(sent.plain_ja || sent.ja);
                        }}
                        className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                        title="Phát âm câu này"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Japanese text (clickable to unblur / toggle) */}
                    <div
                      onClick={() => {
                        if (isLocalBlur) {
                          toggleReveal(idx);
                        } else {
                          handleSpeakSentence(sent.plain_ja || sent.ja);
                        }
                      }}
                      className={`relative my-1 cursor-pointer select-text transition-all duration-200 rounded-lg p-1.5 -mx-1.5 ${
                        isItemBlurred
                          ? 'filter blur-[5px] select-none opacity-40 bg-slate-800/30'
                          : 'hover:bg-slate-900/80'
                      }`}
                    >
                      <p
                        className="text-base sm:text-lg font-bold text-white tracking-tight leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: sent.ja }}
                      />

                      {/* Tap to Reveal hint badge overlay when blurred */}
                      {isItemBlurred && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="px-2.5 py-1 rounded-full bg-slate-900/90 text-amber-300 font-bold text-[11px] border border-amber-500/40 shadow-lg flex items-center gap-1 backdrop-blur-md">
                            <Eye className="w-3 h-3 text-amber-400" />
                            <span>Chạm để mở câu tiếng Nhật</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Vietnamese Translation */}
                    <div className="mt-2 pt-2 border-t border-slate-800/60 text-xs sm:text-sm text-sky-300/90 italic font-medium leading-relaxed">
                      {sent.vi}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 2: COMPARE 3 LEVELS SIDE BY SIDE */}
        {activeTab === 'compare' && (
          <div className="overflow-x-auto">
            <div className="mb-3 text-xs text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>
                So sánh trực tiếp từng bước để thấy cách nâng cấp câu từ <strong>N5 (Cơ bản)</strong> lên <strong>N4 (Tự nhiên)</strong> và <strong>N3 (Kính ngữ)</strong>:
              </span>
            </div>

            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-300 font-bold">
                  <th className="p-3 w-1/4 min-w-[140px] text-slate-400">Ý tưởng (Bước)</th>
                  <th className="p-3 w-1/4 min-w-[200px] text-emerald-400 bg-emerald-950/20 border-l border-slate-800">
                    🟢 Mức N5 (Dễ nói)
                  </th>
                  <th className="p-3 w-1/4 min-w-[220px] text-amber-400 bg-amber-950/20 border-l border-slate-800">
                    🟡 Mức N4 (Tự nhiên)
                  </th>
                  <th className="p-3 w-1/4 min-w-[240px] text-sky-400 bg-sky-950/20 border-l border-slate-800">
                    🔵 Mức N3 (Chuyên sâu)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {parsedData.n5.sentences.map((_, idx) => {
                  const sN5 = parsedData.n5.sentences[idx];
                  const sN4 = parsedData.n4?.sentences[idx];
                  const sN3 = parsedData.n3?.sentences[idx];
                  const flowItem = parsedData.flow && parsedData.flow[idx];

                  return (
                    <tr key={idx} className="hover:bg-slate-950/40 transition-colors">
                      {/* Step & Vi meaning */}
                      <td className="p-3 align-top font-medium text-slate-300">
                        <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-1">
                          {sN5?.step ? `Bước ${sN5.step}` : `Bước ${idx + 1}`}
                        </div>
                        <div className="font-semibold text-white">
                          {flowItem?.vi || sN5?.step_title || sN5?.vi}
                        </div>
                      </td>

                      {/* N5 Cell */}
                      <td className="p-3 align-top bg-emerald-950/10 border-l border-slate-800/80">
                        {sN5 && (
                          <div className="space-y-1.5">
                            <div
                              className="font-bold text-white text-xs sm:text-sm leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: sN5.ja }}
                            />
                            <div className="text-[11px] text-emerald-300/80 italic">{sN5.vi}</div>
                          </div>
                        )}
                      </td>

                      {/* N4 Cell */}
                      <td className="p-3 align-top bg-amber-950/10 border-l border-slate-800/80">
                        {sN4 && (
                          <div className="space-y-1.5">
                            <div
                              className="font-bold text-white text-xs sm:text-sm leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: sN4.ja }}
                            />
                            <div className="text-[11px] text-amber-300/80 italic">{sN4.vi}</div>
                          </div>
                        )}
                      </td>

                      {/* N3 Cell */}
                      <td className="p-3 align-top bg-sky-950/10 border-l border-slate-800/80">
                        {sN3 && (
                          <div className="space-y-1.5">
                            <div
                              className="font-bold text-white text-xs sm:text-sm leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: sN3.ja }}
                            />
                            <div className="text-[11px] text-sky-300/80 italic">{sN3.vi}</div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
