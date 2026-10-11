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
import { Info, Lightbulb, AlertTriangle, Flame, AlertCircle } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  activeSentenceId?: string | null;
  activeSentenceText?: string | null;
  fontSize?: 'sm' | 'base' | 'lg' | 'xl';
  lineSpacing?: 'normal' | 'relaxed' | 'loose';
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  activeSentenceText,
  fontSize = 'base',
  lineSpacing = 'relaxed',
}) => {
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
    if (!content) return '';
    let text = content.replace(/^---[\s\S]*?---\s*\n?/m, '').trim();

    // Ensure translations or consecutive lines under Japanese/dialogue break into a new paragraph (Enter xuống 1 dòng):
    // 1. Line followed immediately by italic translation (*...*)
    text = text.replace(/([^\n])\n(\s*\*)/g, '$1\n\n$2');

    // 2. Line with Japanese characters immediately followed by a non-empty text line
    text = text.replace(/([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF>][^\n]*)\n([^\n#*|>])/g, '$1\n\n$2');

    return text;
  }, [content]);


  return (
    <div className={`prose prose-invert max-w-none text-slate-200 ${sizeClasses} ${spacingClasses}`}>
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
          h2({ children, ...props }: any) {
            return (
              <h2 className="text-xl sm:text-2xl font-bold text-sky-400 mt-8 mb-3 tracking-tight border-b border-slate-800/60 pb-2" {...props}>
                {children}
              </h2>
            );
          },
          h3({ children, ...props }: any) {
            return (
              <h3 className="text-lg sm:text-xl font-bold text-slate-100 mt-6 mb-2 tracking-tight" {...props}>
                {children}
              </h3>
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
              <div className="my-5 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm -mx-2 sm:mx-0">
                <table className="w-full min-w-[320px] text-left border-collapse text-xs sm:text-sm text-slate-300">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }: any) {
            return (
              <th className="px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-800/80 font-bold text-slate-200 border-b border-slate-800 text-[11px] sm:text-xs uppercase tracking-wider whitespace-nowrap">
                {children}
              </th>
            );
          },
          td({ children }: any) {
            return (
              <td className="px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-800/60 text-xs sm:text-sm leading-relaxed">
                {children}
              </td>
            );
          },

          // Language tagging helpers
          ja: ({ children }: any) => <span lang="ja" className="font-medium text-slate-100">{children}</span>,
          vi: ({ children }: any) => <span lang="vi">{children}</span>,

          // Interactive Components
          vocabcard: (props: any) => <VocabCard {...props} />,
          quiz: (props: any) => <QuizBlock {...props} />,
        } as any}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
};
