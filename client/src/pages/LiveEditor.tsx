import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save,
  Play,
  Columns2,
  Code,
  Eye,
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  Table as TableIcon,
  Code2,
  Languages,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { readerApi, Lesson, Chapter, Course } from '../lib/api/readerApi';
import { MarkdownRenderer } from '../components/mdx/MarkdownRenderer';

export default function LiveEditor() {
  const { lessonId } = useParams<{ lessonId?: string }>();
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | ''>('');
  const [availableChapters, setAvailableChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<number | ''>('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [orderNum, setOrderNum] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // View Mode: 'split' | 'code' | 'preview'
  const [viewMode, setViewMode] = useState<'split' | 'code' | 'preview'>('split');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load courses for selectors
  useEffect(() => {
    readerApi.getCourses().then(setCourses).catch(console.error);
  }, []);

  // Fetch chapters whenever selected course changes
  useEffect(() => {
    if (selectedCourseId) {
      readerApi
        .getCourseDetail(Number(selectedCourseId))
        .then((c) => {
          setAvailableChapters(c.chapters || []);
          if (c.chapters && c.chapters.length > 0 && !selectedChapterId) {
            setSelectedChapterId(c.chapters[0].id);
          }
        })
        .catch(console.error);
    } else {
      setAvailableChapters([]);
    }
  }, [selectedCourseId]);

  const handleQuickCreateCourse = async () => {
    const title = window.prompt('Enter new course title:');
    if (!title || !title.trim()) return;
    try {
      const created = await readerApi.createCourse({ title: title.trim() });
      setCourses((prev) => [...prev, created]);
      setSelectedCourseId(created.id);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create course');
    }
  };

  const handleQuickCreateChapter = async () => {
    if (!selectedCourseId) {
      alert('Please select a course first');
      return;
    }
    const title = window.prompt('Enter new chapter title (e.g. Chapter 1, Reflex Speaking):');
    if (!title || !title.trim()) return;
    try {
      const created = await readerApi.createChapter(Number(selectedCourseId), { title: title.trim() });
      setAvailableChapters((prev) => [...prev, created]);
      setSelectedChapterId(created.id);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create chapter');
    }
  };

  // Load lesson if lessonId present
  useEffect(() => {
    if (lessonId) {
      readerApi
        .getLessonDetail(Number(lessonId))
        .then((l) => {
          setLessonTitle(l.title);
          setMarkdown(l.raw_markdown || '');
          setOrderNum(l.order_num || 1);
          if (l.chapter) {
            setSelectedCourseId(l.chapter.course_id);
            setSelectedChapterId(l.chapter.id);
          }
        })
        .catch((e) => console.error('Failed to load lesson', e));
    } else {
      // Sample starter template
      setLessonTitle('New Lesson Title');
      setMarkdown(`# 📝 New Lesson

Welcome to the live interactive MDX editor.

> [!NOTE]
> You can edit markdown on the left and see real-time rendered MDX on the right.

### 📐 Formulas & Diagrams
Inline math: $a^2 + b^2 = c^2$.

\`\`\`mermaid
graph LR
    A[Markdown] --> B[AST Parser]
    B --> C[Interactive MDX]
\`\`\`

### 🇯🇵 Japanese Furigana
<ruby>日本<rt>にほん</rt></ruby>へようこそ！
`);
    }
  }, [lessonId]);

  // Insert markdown snippet at cursor
  const insertSnippet = (prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = markdown.substring(start, end);
    const replacement = `${prefix}${selectedText || ''}${suffix}`;

    const newMarkdown = markdown.substring(0, start) + replacement + markdown.substring(end);
    setMarkdown(newMarkdown);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 10);
  };

  // Save to DB
  const handleSave = async () => {
    if (!lessonTitle.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter a lesson title' });
      return;
    }

    setIsSaving(true);
    setStatusMsg(null);

    try {
      if (lessonId) {
        // Update existing lesson
        await readerApi.updateLesson(Number(lessonId), {
          title: lessonTitle.trim(),
          raw_markdown: markdown,
          order_num: orderNum,
          chapter_id: selectedChapterId ? Number(selectedChapterId) : undefined,
        });
        setStatusMsg({ type: 'success', text: 'Saved successfully!' });
      } else {
        // Create new lesson
        if (!selectedChapterId) {
          setStatusMsg({ type: 'error', text: 'Please select a chapter' });
          setIsSaving(false);
          return;
        }
        const created = await readerApi.createLesson({
          chapter_id: Number(selectedChapterId),
          title: lessonTitle.trim(),
          raw_markdown: markdown,
          order_num: orderNum,
        });
        setStatusMsg({ type: 'success', text: 'Lesson created!' });
        navigate(`/editor/${created.id}`, { replace: true });
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.response?.data?.detail || 'Failed to save' });
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger TTS Generation
  const handleGenerateTTS = async () => {
    if (!lessonId) {
      setStatusMsg({ type: 'error', text: 'Save lesson first before generating TTS' });
      return;
    }
    try {
      await readerApi.generateTTS(Number(lessonId));
      setStatusMsg({ type: 'success', text: 'TTS generation queued in background!' });
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: 'Failed to trigger TTS' });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0b0f19] text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation & Action Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="font-bold text-sm tracking-tight flex items-center gap-2">
            <span className="text-emerald-400">Reader</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-200">WYSIWYG Live Editor</span>
          </div>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium animate-in fade-in ${statusMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'}`}>
            {statusMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center rounded-xl bg-slate-800/80 p-0.5 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => setViewMode('code')}
              title="Markdown Code Only"
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'code' ? 'bg-slate-700 text-white shadow-xs' : 'hover:text-white'}`}
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              title="Split View (Code + Preview)"
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'split' ? 'bg-slate-700 text-white shadow-xs' : 'hover:text-white'}`}
            >
              <Columns2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              title="WYSIWYG Preview Only"
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'preview' ? 'bg-slate-700 text-white shadow-xs' : 'hover:text-white'}`}
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          {/* Trigger TTS */}
          {lessonId && (
            <button
              type="button"
              onClick={handleGenerateTTS}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/60 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="hidden sm:inline">Gen TTS</span>
            </button>
          )}

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save MD'}</span>
          </button>
        </div>
      </header>

      {/* Lesson Meta Header */}
      <div className="px-4 py-2 bg-slate-900/40 border-b border-slate-800 flex flex-wrap items-center gap-3 shrink-0 text-xs">
        <input
          type="text"
          value={lessonTitle}
          onChange={(e) => setLessonTitle(e.target.value)}
          placeholder="Lesson Title..."
          className="flex-1 min-w-[220px] bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-1.5 text-white font-medium placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />

        <div className="flex items-center gap-1.5">
          <select
            value={selectedCourseId}
            onChange={(e) => {
              setSelectedCourseId(Number(e.target.value) || '');
              setSelectedChapterId('');
            }}
            className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-emerald-500 max-w-[140px] truncate"
          >
            <option value="">Select Course...</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleQuickCreateCourse}
            title="Create New Course"
            className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700/60 text-[11px] font-bold cursor-pointer"
          >
            + Course
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={selectedChapterId}
            onChange={(e) => setSelectedChapterId(Number(e.target.value) || '')}
            disabled={!selectedCourseId}
            className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-emerald-500 disabled:opacity-40 max-w-[150px] truncate"
          >
            <option value="">Select Chapter...</option>
            {availableChapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleQuickCreateChapter}
            disabled={!selectedCourseId}
            title="Create New Chapter in Selected Course"
            className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700/60 text-[11px] font-bold disabled:opacity-40 cursor-pointer"
          >
            + Chapter
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          <span>Order:</span>
          <input
            type="number"
            value={orderNum}
            onChange={(e) => setOrderNum(parseInt(e.target.value) || 1)}
            className="w-14 bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-white text-center"
          />
        </div>
      </div>

      {/* Formatting Quick Toolbar */}
      <div className="px-4 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center gap-1 overflow-x-auto shrink-0 text-slate-400">
        <button
          type="button"
          onClick={() => insertSnippet('**', '**')}
          title="Bold (Ctrl+B)"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertSnippet('*', '*')}
          title="Italic (Ctrl+I)"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <div className="w-[1px] h-4 bg-slate-800 mx-1" />

        <button
          type="button"
          onClick={() => insertSnippet('# ')}
          title="Heading 1"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertSnippet('## ')}
          title="Heading 2"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertSnippet('### ')}
          title="Heading 3"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Heading3 className="w-3.5 h-3.5" />
        </button>
        <div className="w-[1px] h-4 bg-slate-800 mx-1" />

        <button
          type="button"
          onClick={() => insertSnippet('> ')}
          title="Quote"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Quote className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertSnippet('- ')}
          title="Bullet List"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertSnippet('\n| Header 1 | Header 2 |\n| :--- | :--- |\n| Data 1 | Data 2 |\n')}
          title="Table"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors"
        >
          <TableIcon className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertSnippet('```python\n', '\n```')}
          title="Code Block"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Code2 className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-slate-800 mx-1" />

        {/* Specialized MDX Snippets */}
        <button
          type="button"
          onClick={() => insertSnippet('<ruby>漢字<rt>かんじ</rt></ruby>')}
          title="Japanese Ruby (Furigana)"
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold transition-colors"
        >
          <Languages className="w-3 h-3" />
          <span>Furigana</span>
        </button>

        <button
          type="button"
          onClick={() => insertSnippet('<VocabCard word="学位" furigana="がくい" meaning="bằng cấp" />')}
          title="Vocaburn Card"
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[11px] font-semibold transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          <span>VocabCard</span>
        </button>

        <button
          type="button"
          onClick={() => insertSnippet('<Quiz question="Which one is correct?" options="Option A|Option B|Option C" correct="0" explanation="Option A is correct!" />')}
          title="Interactive Quiz"
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-[11px] font-semibold transition-colors"
        >
          <span>Quiz</span>
        </button>

        <button
          type="button"
          onClick={() => insertSnippet('\n```mermaid\ngraph TD\n    A[Step 1] --> B[Step 2]\n```\n')}
          title="Mermaid Diagram"
          className="px-2 py-1 rounded-lg hover:bg-slate-800 text-[11px] font-semibold transition-colors"
        >
          Mermaid
        </button>

        <button
          type="button"
          onClick={() => insertSnippet('$$', '$$')}
          title="KaTeX Math"
          className="px-2 py-1 rounded-lg hover:bg-slate-800 text-[11px] font-semibold transition-colors"
        >
          KaTeX
        </button>
      </div>

      {/* Main Dual-Pane Body */}
      <div className="flex-1 flex min-h-0">
        {/* Left Pane: Raw Markdown Editor */}
        {(viewMode === 'split' || viewMode === 'code') && (
          <div className={`h-full flex flex-col border-r border-slate-800 ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Raw Markdown Editor</span>
              <span className="text-[10px] text-slate-500 font-mono">{markdown.length} chars</span>
            </div>
            <textarea
              ref={textareaRef}
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="Type standard Markdown here..."
              className="flex-1 w-full p-4 bg-[#0d1117] text-slate-200 font-mono text-xs sm:text-sm leading-relaxed resize-none focus:outline-none focus:ring-0"
              spellCheck={false}
            />
          </div>
        )}

        {/* Right Pane: Live WYSIWYG MDX Preview */}
        {(viewMode === 'split' || viewMode === 'preview') && (
          <div className={`h-full flex flex-col bg-[#0b0f19] ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
              <span>Live WYSIWYG Preview</span>
              <span className="text-[10px] text-slate-500">AST Rendered</span>
            </div>
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              <div className="max-w-2xl mx-auto">
                <MarkdownRenderer content={markdown} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
