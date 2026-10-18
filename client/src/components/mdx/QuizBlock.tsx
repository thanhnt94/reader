import React, { useState } from 'react';
import { HelpCircle, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';

interface QuizBlockProps {
  question: string;
  options: string | string[];
  correct?: string | number;
  explanation?: string;
  quizId?: string;
}

export const QuizBlock: React.FC<QuizBlockProps> = ({
  question,
  options,
  correct = 0,
  explanation,
  quizId,
}) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Parse options if string
  let parsedOptions: string[] = [];
  if (Array.isArray(options)) {
    parsedOptions = options;
  } else if (typeof options === 'string') {
    try {
      parsedOptions = JSON.parse(options);
    } catch {
      parsedOptions = options.split('|').map((o) => o.trim());
    }
  }

  const correctIndex = Number(correct);

  const handleSelect = (idx: number) => {
    if (submitted) return;
    setSelectedOption(idx);
    setSubmitted(true);
  };

  const isCorrect = selectedOption === correctIndex;

  return (
    <div className="my-6 p-5 rounded-2xl bg-slate-900/80 border border-indigo-500/20 shadow-xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <HelpCircle className="w-4 h-4" />
          </div>
          <span className="text-xs uppercase font-bold tracking-wider text-indigo-400">
            Quick Check Quiz
          </span>
        </div>
        {quizId && (
          <a
            href={`https://quiz.inmind.site/quiz/${quizId}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-300 transition-colors"
          >
            <span>Open in QuizMind</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <h4 className="text-sm font-semibold text-white mb-4 leading-relaxed">
        {question}
      </h4>

      <div className="space-y-2 mb-4">
        {parsedOptions.map((opt, idx) => {
          let stateStyle = 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800/70';
          if (submitted) {
            if (idx === correctIndex) {
              stateStyle = 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200 font-semibold';
            } else if (idx === selectedOption) {
              stateStyle = 'border-rose-500/50 bg-rose-500/10 text-rose-200';
            } else {
              stateStyle = 'border-slate-800/50 bg-slate-900/40 text-slate-500 opacity-60';
            }
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={submitted}
              onClick={() => handleSelect(idx)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-xs sm:text-sm transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer ${stateStyle}`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-slate-400">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span>{opt}</span>
              </div>
              {submitted && idx === correctIndex && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              {submitted && idx === selectedOption && idx !== correctIndex && (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {submitted && (
        <div className={`p-3.5 rounded-xl border text-xs leading-relaxed ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
          <div className="font-semibold mb-1 flex items-center justify-between gap-1.5">
            <span>{isCorrect ? '🎉 Chính xác!' : '❌ Chưa chính xác!'}</span>
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setSelectedOption(null);
              }}
              className="text-[11px] font-normal text-slate-400 hover:text-white underline cursor-pointer"
            >
              Làm lại ↺
            </button>
          </div>
          {explanation && <p className="text-slate-300 mt-1">{explanation}</p>}
        </div>
      )}
    </div>
  );
};
