import React, { useState } from 'react';
import { ExternalLink, BookmarkPlus, Check } from 'lucide-react';

interface VocabCardProps {
  word: string;
  furigana?: string;
  meaning?: string;
  pos?: string;
  deckId?: string;
}

export const VocabCard: React.FC<VocabCardProps> = ({
  word,
  furigana,
  meaning,
  pos,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleOpenVocaburn = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://vocab.inmind.site/library?q=${encodeURIComponent(word)}`, '_blank');
  };

  const handleQuickSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <span className="relative inline-block my-0.5 mx-1">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/40 font-medium text-sm transition-all duration-200 cursor-pointer shadow-xs active:scale-95"
      >
        <span className="font-semibold">{word}</span>
        {furigana && <span className="text-xs text-emerald-400/80 font-normal">({furigana})</span>}
      </button>

      {/* Floating Insight Popover */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-64 p-3.5 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl text-left text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
              <div>
                <div className="text-base font-bold text-white flex items-center gap-1.5">
                  {word}
                  {furigana && <span className="text-xs text-emerald-400 font-normal">[{furigana}]</span>}
                </div>
                {pos && <span className="text-[10px] uppercase font-semibold text-slate-400">{pos}</span>}
              </div>
              <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40 text-[10px] font-medium">
                Vocaburn
              </span>
            </div>

            {meaning && (
              <p className="text-slate-300 text-xs mb-3 font-normal leading-relaxed">
                {meaning}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleQuickSave}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition-colors"
              >
                {saved ? <Check className="w-3.5 h-3.5 text-white" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                {saved ? 'Saved!' : 'Save Word'}
              </button>

              <button
                type="button"
                onClick={handleOpenVocaburn}
                title="Search in Vocaburn"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </span>
  );
};
