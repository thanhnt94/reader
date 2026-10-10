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

  return (
    <div className={`prose prose-invert max-w-none text-slate-200 ${sizeClasses} ${spacingClasses}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex, rehypeSlug]}
        components={{
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
              <code className="px-1.5 py-0.5 rounded-md bg-slate-800 text-emerald-300 font-mono text-[0.88em] border border-slate-700/60" {...props}>
                {children}
              </code>
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
                <div className="my-4 p-4 rounded-xl alert-tip text-emerald-200 text-sm flex gap-3 items-start">
                  <Lightbulb className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
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
              <blockquote className="my-4 border-l-3 border-emerald-500/40 bg-slate-800/20 pl-4 py-1.5 italic text-slate-300 rounded-r-lg">
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
                className="text-emerald-400 hover:text-emerald-300 underline underline-offset-3 decoration-emerald-500/30 hover:decoration-emerald-400 font-medium transition-colors"
                {...props}
              >
                {children}
              </a>
            );
          },

          // Table styling
          table({ children }: any) {
            return (
              <div className="my-6 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                <table className="w-full text-left border-collapse text-sm text-slate-300">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }: any) {
            return (
              <th className="px-4 py-3 bg-slate-800/60 font-semibold text-slate-200 border-b border-slate-800 text-xs uppercase tracking-wider">
                {children}
              </th>
            );
          },
          td({ children }: any) {
            return (
              <td className="px-4 py-3 border-b border-slate-800/60 text-xs sm:text-sm">
                {children}
              </td>
            );
          },

          // Interactive Components
          vocabcard: (props: any) => <VocabCard {...props} />,
          quiz: (props: any) => <QuizBlock {...props} />,
        } as any}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
