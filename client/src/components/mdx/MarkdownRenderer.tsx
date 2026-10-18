import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';

import { CodeBlock } from './CodeBlock';
import { MermaidBlock } from './MermaidBlock';
import { VocabCard } from './VocabCard';
import { QuizBlock } from './QuizBlock';
import { FlashcardDeck } from './FlashcardDeck';
import { ReflexBlock } from './ReflexBlock';
import { LevelAnswersBlock } from './LevelAnswersBlock';
import { BlurSpoiler } from './BlurSpoiler';
import { Info, Lightbulb, AlertTriangle, Flame, AlertCircle, CheckCircle2, Circle } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  activeSentenceId?: string | null;
  activeSentenceText?: string | null;
  fontSize?: 'sm' | 'base' | 'lg' | 'xl';
  lineSpacing?: 'normal' | 'relaxed' | 'loose';
  completedSections?: string[];
  onToggleSection?: (sectionId: string) => void;
  showFurigana?: boolean;
  blurJapanese?: boolean;
  tocData?: Array<{ id: string; text: string; level: number }> | null;
}

const getNodeText = (node: any): string => {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join('');
  if (node.props?.children) return getNodeText(node.props.children);
  return '';
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  activeSentenceText,
  fontSize = 'base',
  lineSpacing = 'relaxed',
  completedSections,
  onToggleSection,
  showFurigana = true,
  blurJapanese = false,
  tocData,
}) => {
  // Helper to map heading text to exact TOC ID
  const resolveHeadingId = (idFromPlugin: string | undefined, children: any): string => {
    const rawText = getNodeText(children).trim();
    if (!rawText) return idFromPlugin || '';

    if (tocData && tocData.length > 0) {
      const cleanRaw = rawText.replace(/^[^\w\s]+/, '').trim().toLowerCase();
      const matched = tocData.find((item) => {
        const itemClean = item.text.replace(/^[^\w\s]+/, '').trim().toLowerCase();
        return (
          itemClean === cleanRaw ||
          (cleanRaw.length > 3 && itemClean.includes(cleanRaw)) ||
          (itemClean.length > 3 && cleanRaw.includes(itemClean))
        );
      });
      if (matched) return matched.id;
    }
    return idFromPlugin || '';
  };
  // Font size mapping
  const sizeClasses = {
    sm: 'text-sm leading-6',
    base: 'text-base leading-7',
    lg: 'text-lg leading-8',
    xl: 'text-xl leading-9',
  }[fontSize];

  // Line spacing mapping
  const spacingClasses = {
    normal: 'leading-normal',
    relaxed: 'leading-relaxed',
    loose: 'leading-loose',
  }[lineSpacing];

  // Helper to extract YouTube video ID
  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  // Strip YAML frontmatter from markdown body and ensure Vietnamese translations break to a new line!
  const cleanContent = React.useMemo(() => {
    let text = content.replace(/^\s*---[\r\n]+[\s\S]*?[\r\n]+---\s*[\r\n]*/, '').trim();
    // Strip any speech/nospeech tags so only pure display content remains
    text = text.replace(/<\/?nospeech>/gi, '');

    // In blockquotes (>), break consecutive lines into separate paragraph elements so each sentence is isolated
    text = text.replace(/^(>\s*[^\n]+)\n(>\s*\*)/gm, '$1\n>\n$2');
    text = text.replace(/^(>\s*\*?[^\n]+)\n(>\s*[^\n*#>])/gm, '$1\n>\n$2');

    // Ensure translations or consecutive lines under Japanese/dialogue break into a new paragraph (Enter xuống 1 dòng):
    // 1. Line followed immediately by italic translation (*...*)
    text = text.replace(/([^\n])\n(\s*\*)/g, '$1\n\n$2');

    // 2. Line with Japanese characters immediately followed by a non-empty text line
    text = text.replace(/([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF][^\n]*)\n([^\n#*|>])/g, '$1\n\n$2');

    return text;
  }, [content]);


  return (
    <div
      className={`prose prose-invert max-w-none text-slate-200 ${sizeClasses} ${spacingClasses} ${
        showFurigana === false ? 'hide-furigana' : ''
      } ${blurJapanese ? 'blur-japanese-mode' : ''}`}
      data-furigana={showFurigana === false ? 'false' : 'true'}
      data-blur-japanese={blurJapanese ? 'true' : 'false'}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex, rehypeSlug]}
        components={{
          // Headings with prominent typography & anchor support
          h1({ children, ...props }: any) {
            return (
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-8 mb-4 tracking-tight border-b border-slate-800 pb-3" {...props}>
                {children}
              </h1>
            );
          },
          h2({ id, children, ...props }: any) {
            const finalId = resolveHeadingId(id, children);
            const isDone = finalId && completedSections?.includes(finalId);
            return (
              <div id={finalId} className="group flex items-center justify-between gap-3 mt-8 mb-3 border-b border-slate-800/60 pb-2 scroll-mt-28">
                <h2 id={finalId ? `${finalId}-title` : id} className="text-xl sm:text-2xl font-bold text-sky-400 tracking-tight" {...props}>
                  {children}
                </h2>
                {finalId && onToggleSection && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSection(finalId);
                    }}
                    title={isDone ? 'Đã hoàn thành mục này (nhấn để hoàn tác)' : 'Đánh dấu đã hoàn thành mục này'}
                    className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isDone
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                        : 'opacity-50 group-hover:opacity-100 hover:bg-slate-800 text-slate-400 border border-slate-700/60'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span className="text-[11px] hidden sm:inline">{isDone ? 'Đã học' : 'Xong'}</span>
                  </button>
                )}
              </div>
            );
          },
          h3({ id, children, ...props }: any) {
            const finalId = resolveHeadingId(id, children);
            const isDone = finalId && completedSections?.includes(finalId);
            return (
              <div id={finalId} className="group flex items-center justify-between gap-3 mt-6 mb-2 scroll-mt-28">
                <h3 id={finalId ? `${finalId}-title` : id} className={`text-lg sm:text-xl font-bold tracking-tight transition-colors ${isDone ? 'text-emerald-300/90' : 'text-slate-100'}`} {...props}>
                  {children}
                </h3>
                {finalId && onToggleSection && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSection(finalId);
                    }}
                    title={isDone ? 'Đã hoàn thành mẫu này (nhấn để hoàn tác)' : 'Đánh dấu đã hoàn thành mẫu này'}
                    className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                      isDone
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'opacity-40 group-hover:opacity-100 hover:bg-slate-800 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Circle className="w-3 h-3 text-slate-500" />
                    )}
                    <span className="hidden sm:inline">{isDone ? 'Đã xong' : 'Xong'}</span>
                  </button>
                )}
              </div>
            );
          },
          h4({ children, ...props }: any) {
            return (
              <h4 className="text-base sm:text-lg font-semibold text-slate-200 mt-4 mb-1.5" {...props}>
                {children}
              </h4>
            );
          },

          // Horizontal rule
          hr({ ...props }: any) {
            return <hr className="my-8 border-t border-slate-800/80" {...props} />;
          },

          // Lists with styled markers and spacing
          ul({ children, ...props }: any) {
            return (
              <ul className="my-3.5 ml-6 list-disc list-outside space-y-1.5 text-slate-300 marker:text-sky-400" {...props}>
                {children}
              </ul>
            );
          },
          ol({ children, ...props }: any) {
            return (
              <ol className="my-3.5 ml-6 list-decimal list-outside space-y-1.5 text-slate-300 marker:text-sky-400 font-medium" {...props}>
                {children}
              </ol>
            );
          },
          li({ children, ...props }: any) {
            return (
              <li className="leading-relaxed pl-1" {...props}>
                {children}
              </li>
            );
          },

          // Inline emphasis & typography
          strong({ children, ...props }: any) {
            return (
              <strong className="font-bold text-white" {...props}>
                {children}
              </strong>
            );
          },
          em({ children, ...props }: any) {
            return (
              <em className="italic text-sky-300/90 font-medium" {...props}>
                {children}
              </em>
            );
          },

          // Japanese Ruby Furigana annotations - Professional Japanese JIS Typesetting
          ruby({ children, ...props }: any) {
            return (
              <ruby className="text-white" style={{ display: 'inline-ruby', rubyPosition: 'over', verticalAlign: 'baseline', margin: 0, padding: 0 }} {...props}>
                {children}
              </ruby>
            );
          },
          rt({ children, ...props }: any) {
            return (
              <rt className="text-[0.55em] text-sky-400 select-none font-semibold tracking-tight" style={{ display: 'ruby-text', lineHeight: 1, margin: 0, padding: 0 }} {...props}>
                {children}
              </rt>
            );
          },


          // Code & Mermaid Blocks
          code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const lang = match ? match[1] : '';
            const codeString = String(children).replace(/\n$/, '');

            if (lang === 'mermaid') {
              return <MermaidBlock chart={codeString} />;
            }

            if (lang === 'flashcard' || lang === 'flashcards') {
              return <FlashcardDeck dataString={codeString} />;
            }

            if (lang === 'levels' || lang === 'level') {
              return <LevelAnswersBlock dataString={codeString} globalBlur={blurJapanese} />;
            }

            if (lang === 'reflex' || lang === 'reflexes') {
              return <ReflexBlock dataString={codeString} />;
            }

            if (lang === 'quiz') {
              try {
                const parsed = JSON.parse(codeString);
                return <QuizBlock {...parsed} />;
              } catch {
                const lines = codeString.split('\n').map((l: string) => l.trim()).filter(Boolean);
                let question = '';
                const options: string[] = [];
                let correct = 0;
                let explanation = '';

                for (const line of lines) {
                  if (/^(?:Q|Câu hỏi)\s*[:：]/i.test(line)) {
                    question = line.replace(/^(?:Q|Câu hỏi)\s*[:：]\s*/i, '');
                  } else if (/^[A-D]\s*[:：.]\s*/i.test(line)) {
                    options.push(line.replace(/^[A-D]\s*[:：.]\s*/i, ''));
                  } else if (/^[-*•]\s*/.test(line)) {
                    options.push(line.replace(/^[-*•]\s*/, ''));
                  } else if (/^(?:Correct|Đáp án|Đúng)\s*[:：]/i.test(line)) {
                    const ans = line.replace(/^(?:Correct|Đáp án|Đúng)\s*[:：]\s*/i, '').trim();
                    if (/^[A-D]$/i.test(ans)) {
                      correct = ans.toUpperCase().charCodeAt(0) - 65;
                    } else {
                      correct = parseInt(ans, 10) || 0;
                    }
                  } else if (/^(?:Exp|Explanation|Giải thích)\s*[:：]/i.test(line)) {
                    explanation = line.replace(/^(?:Exp|Explanation|Giải thích)\s*[:：]\s*/i, '');
                  } else if (!question) {
                    question = line;
                  }
                }
                return <QuizBlock question={question} options={options} correct={correct} explanation={explanation} />;
              }
            }

            if (match) {
              return <CodeBlock language={lang} value={codeString} />;
            }

            return (
              <code className="px-1.5 py-0.5 rounded-md bg-slate-800 text-sky-300 font-mono text-[0.88em] border border-slate-700/60" {...props}>
                {children}
              </code>
            );
          },

          // Nospeech block (displayed for reading eyes, skipped by TTS audio)
          nospeech({ children, ...props }: any) {
            return (
              <div className="nospeech-block" {...props}>
                {children}
              </div>
            );
          },

          // Click-to-reveal blur / spoiler tags
          blur({ children }: any) {
            return <BlurSpoiler globalBlur={blurJapanese}>{children}</BlurSpoiler>;
          },
          spoiler({ children }: any) {
            return <BlurSpoiler globalBlur={blurJapanese}>{children}</BlurSpoiler>;
          },

          // Paragraphs
          p({ children, ...props }: any) {
            return (
              <p className="my-3.5 leading-relaxed" {...props}>
                {children}
              </p>
            );
          },

          // Blockquotes & GitHub Alerts
          blockquote({ children }: any) {
            // Check for GitHub Alerts in children
            const text = React.Children.toArray(children)
              .map((c: any) => (typeof c === 'string' ? c : c?.props?.children || ''))
              .join(' ');

            if (text.includes('[!NOTE]')) {
              return (
                <div className="my-4 p-4 rounded-xl alert-note text-sky-200 text-sm flex gap-3 items-start">
                  <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                  <div className="flex-1">{children}</div>
                </div>
              );
            }
            if (text.includes('[!TIP]')) {
              return (
                <div className="my-4 p-4 rounded-xl alert-tip text-cyan-200 text-sm flex gap-3 items-start">
                  <Lightbulb className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="flex-1">{children}</div>
                </div>
              );
            }
            if (text.includes('[!WARNING]')) {
              return (
                <div className="my-4 p-4 rounded-xl alert-warning text-amber-200 text-sm flex gap-3 items-start">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">{children}</div>
                </div>
              );
            }
            if (text.includes('[!IMPORTANT]')) {
              return (
                <div className="my-4 p-4 rounded-xl alert-important text-purple-200 text-sm flex gap-3 items-start">
                  <Flame className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div className="flex-1">{children}</div>
                </div>
              );
            }
            if (text.includes('[!CAUTION]')) {
              return (
                <div className="my-4 p-4 rounded-xl alert-caution text-rose-200 text-sm flex gap-3 items-start">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">{children}</div>
                </div>
              );
            }

            return (
              <blockquote className="my-4 border-l-3 border-sky-500/40 bg-slate-800/20 pl-4 py-1.5 italic text-slate-300 rounded-r-lg">
                {children}
              </blockquote>
            );
          },

          // Links & YouTube Auto Embed
          a({ href, children, ...props }: any) {
            if (href) {
              const ytId = getYouTubeId(href);
              if (ytId) {
                return (
                  <div className="my-5 aspect-video w-full rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
                    <iframe
                      src={`https://www.youtube.com/embed/${ytId}`}
                      title="YouTube video player"
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                );
              }
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:text-sky-300 underline underline-offset-3 decoration-sky-500/30 hover:decoration-sky-400 font-medium transition-colors"
                {...props}
              >
                {children}
              </a>
            );
          },

          // Table styling with mobile responsiveness
          table({ children }: any) {
            return (
              <div className="my-6 rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg overflow-hidden -mx-2 sm:mx-0">
                <div className="sm:hidden px-3.5 py-1.5 bg-slate-800/90 border-b border-slate-700/80 text-[11px] text-slate-400 flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-400"></span> Bảng dữ liệu thực chiến
                  </span>
                  <span className="text-sky-400 font-medium flex items-center gap-1">👉 Vuốt sang phải để xem đủ cột</span>
                </div>
                <div className="overflow-x-auto max-w-full touch-pan-x overscroll-x-contain">
                  <table className="w-full min-w-[680px] text-left border-collapse text-xs sm:text-sm text-slate-300">
                    {children}
                  </table>
                </div>
              </div>
            );
          },
          th({ children }: any) {
            return (
              <th className="px-3.5 sm:px-4 py-2.5 sm:py-3 bg-slate-800/95 font-bold text-slate-100 border-b border-slate-700 text-[11px] sm:text-xs uppercase tracking-wider whitespace-nowrap">
                {children}
              </th>
            );
          },
          tr({ children }: any) {
            return (
              <tr className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                {children}
              </tr>
            );
          },
          td({ children }: any) {
            return (
              <td className="px-3.5 sm:px-4 py-2.5 sm:py-3.5 border-b border-slate-800/60 text-xs sm:text-sm leading-relaxed align-top">
                {children}
              </td>
            );
          },

          // Language tagging helpers
          ja: ({ children }: any) => <span lang="ja" className="font-medium text-slate-100">{children}</span>,
          vi: ({ children }: any) => <span lang="vi">{children}</span>,

          // Collapsible native details & summary
          details({ children, ...props }: any) {
            return (
              <details className="my-4 rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 transition-all group" {...props}>
                {children}
              </details>
            );
          },
          summary({ children, ...props }: any) {
            return (
              <summary className="font-semibold text-sky-400 cursor-pointer select-none hover:text-sky-300 list-none flex items-center gap-2" {...props}>
                <span className="text-xs transition-transform group-open:rotate-90">▶</span>
                {children}
              </summary>
            );
          },

          // Interactive Components
          vocabcard: (props: any) => <VocabCard {...props} />,
          quiz: (props: any) => <QuizBlock {...props} />,
          flashcards: (props: any) => <FlashcardDeck {...props} />,
          flashcard: (props: any) => <FlashcardDeck {...props} />,
          reflex: (props: any) => <ReflexBlock {...props} />,
          reflexes: (props: any) => <ReflexBlock {...props} />,
        } as any}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
};
