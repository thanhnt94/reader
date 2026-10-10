import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Save,
  Play,
  Columns2,
  Code,
  Eye,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  Table as TableIcon,
  Code2,
  Languages,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Plus,
  Link as LinkIcon,
  Image as ImageIcon,
  CheckSquare,
  HelpCircle,
  FolderPlus,
  BookOpen,
  FileCode,
  Layers,
  FileText,
  RotateCcw
} from 'lucide-react';
import { readerApi, Lesson, Chapter, Course } from '../lib/api/readerApi';
import { MarkdownRenderer } from '../components/mdx/MarkdownRenderer';
import { htmlToMarkdown, markdownToHtml } from '../lib/utils/markdownConverter';

export default function LiveEditor() {
  const { lessonId } = useParams<{ lessonId?: string }>();
  const navigate = useNavigate();

  // Courses & Chapters State
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | ''>('');
  const [availableChapters, setAvailableChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<number | ''>('');

  // Lesson Metadata
  const [lessonTitle, setLessonTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [orderNum, setOrderNum] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Editor Tabs: 'visual' (WordPress Visual WYSIWYG) | 'code' (WordPress Text/Code) | 'split' | 'preview'
  const [activeTab, setActiveTab] = useState<'visual' | 'code' | 'split' | 'preview'>('visual');

  // Code Inserter Modal State
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [codeSnippet, setCodeSnippet] = useState('');

  // Furigana Inserter Modal State
  const [isFuriganaModalOpen, setIsFuriganaModalOpen] = useState(false);
  const [furiganaKanji, setFuriganaKanji] = useState('');
  const [furiganaReading, setFuriganaReading] = useState('');

  // Refs
  const visualEditorRef = useRef<HTMLDivElement>(null);
  const codeTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Synchronize Markdown to Visual Editor DOM
  const syncMarkdownToVisual = useCallback((mdText: string) => {
    if (visualEditorRef.current) {
      const html = markdownToHtml(mdText);
      visualEditorRef.current.innerHTML = html;
    }
  }, []);

  // Synchronize Visual Editor DOM back to Markdown
  const syncVisualToMarkdown = useCallback(() => {
    if (visualEditorRef.current) {
      const md = htmlToMarkdown(visualEditorRef.current);
      setMarkdown(md);
      return md;
    }
    return markdown;
  }, [markdown]);

  // Load existing lesson or default template
  useEffect(() => {
    if (lessonId) {
      readerApi
        .getLessonDetail(Number(lessonId))
        .then((l) => {
          setLessonTitle(l.title);
          const raw = l.raw_markdown || '';
          setMarkdown(raw);
          setOrderNum(l.order_num || 1);
          if (l.chapter) {
            setSelectedCourseId(l.chapter.course_id);
            setSelectedChapterId(l.chapter.id);
          }
          // Populate visual DOM
          setTimeout(() => syncMarkdownToVisual(raw), 50);
        })
        .catch((e) => console.error('Failed to load lesson', e));
    } else {
      const defaultTemplate = `# 📌 Câu 01: <ruby>好<rt>す</rt></ruby>きな<ruby>季節<rt>きせつ</rt></ruby>はいつですか。<ruby>理由<rt>りゆう</rt></ruby>も<ruby>教<rt>おし</rt></ruby>えてください。

> **Dịch câu hỏi:** Bạn thích mùa nào nhất trong năm? Hãy cho biết lý do.

### 💬 Câu trả lời mẫu

**Tiếng Nhật:**
> <ruby>四季<rt>しき</rt></ruby>の<ruby>中<rt>なか</rt></ruby>で、<ruby>私<rt>わたし</rt></ruby>は<ruby>秋<rt>あき</rt></ruby>が<ruby>一番<rt>いちばん</rt></ruby><ruby>好<rt>す</rt></ruby>きです。

**Dịch nghĩa:**
> Trong bốn mùa, tôi thích nhất là mùa thu.

### ⚡ Dàn ý PREP phản xạ 45s

| Bước | Tiếng Việt | Tiếng Nhật |
| :--- | :--- | :--- |
| **P** (Point) | Thích mùa thu nhất trong năm | 四季の中で秋が一番好き |
| **R** (Reason) | Khí hậu mát mẻ, đi dạo sảng khoái | 涼しい気候で散歩が気持ちいい |

### 💡 Từ vựng & Cách nói thay thế

- <ruby>四季<rt>しき</rt></ruby>: bốn mùa ➡ <ruby>一年<rt>いちねん</rt></ruby>の<ruby>中<rt>なか</rt></ruby>: trong năm
`;
      setLessonTitle('New Lesson Title');
      setMarkdown(defaultTemplate);
      setTimeout(() => syncMarkdownToVisual(defaultTemplate), 50);
    }
  }, [lessonId, syncMarkdownToVisual]);

  // Handle Tab Switching (WordPress Style)
  const handleTabChange = (newTab: 'visual' | 'code' | 'split' | 'preview') => {
    if (activeTab === 'visual') {
      // Sync visual changes into markdown
      const updatedMd = syncVisualToMarkdown();
      if (newTab === 'visual') {
        syncMarkdownToVisual(updatedMd);
      }
    } else if (newTab === 'visual') {
      // Coming into visual mode, render latest markdown into visual DOM
      syncMarkdownToVisual(markdown);
    }
    setActiveTab(newTab);
  };

  // Execute formatting command in Visual Mode
  const execVisualCmd = (command: string, value: string | undefined = undefined) => {
    if (activeTab !== 'visual') {
      handleTabChange('visual');
    }
    setTimeout(() => {
      visualEditorRef.current?.focus();
      document.execCommand(command, false, value);
      syncVisualToMarkdown();
    }, 20);
  };

  // Insert HTML into Visual Editor at cursor
  const insertHtmlAtCursor = (html: string) => {
    if (activeTab !== 'visual') {
      handleTabChange('visual');
    }
    setTimeout(() => {
      visualEditorRef.current?.focus();
      document.execCommand('insertHTML', false, html);
      syncVisualToMarkdown();
    }, 20);
  };

  // Insert Markdown snippet into Code Tab textarea
  const insertCodeSnippet = (prefix: string, suffix: string = '') => {
    if (activeTab !== 'code' && activeTab !== 'split') {
      handleTabChange('code');
    }
    setTimeout(() => {
      const textarea = codeTextareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = markdown.substring(start, end);
      const replacement = `${prefix}${selectedText || ''}${suffix}`;

      const newMarkdown = markdown.substring(0, start) + replacement + markdown.substring(end);
      setMarkdown(newMarkdown);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      }, 10);
    }, 20);
  };

  // Quick Action: Insert Code Block
  const handleInsertCodeBlock = () => {
    if (!codeSnippet.trim()) return;
    const formatted = `\n\`\`\`${codeLanguage}\n${codeSnippet}\n\`\`\`\n\n`;

    if (activeTab === 'visual') {
      insertHtmlAtCursor(`<pre><code data-language="${codeLanguage}">${codeSnippet.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre><p><br></p>`);
    } else {
      insertCodeSnippet(formatted);
    }
    setCodeSnippet('');
    setIsCodeModalOpen(false);
  };

  // Quick Action: Insert Furigana
  const handleInsertFurigana = () => {
    if (!furiganaKanji.trim()) return;
    const rubyHtml = `<ruby>${furiganaKanji}<rt>${furiganaReading.trim()}</rt></ruby>`;

    if (activeTab === 'visual') {
      insertHtmlAtCursor(rubyHtml);
    } else {
      insertCodeSnippet(rubyHtml);
    }
    setFuriganaKanji('');
    setFuriganaReading('');
    setIsFuriganaModalOpen(false);
  };

  // Quick Action: Insert Table
  const handleInsertTable = () => {
    const tableMd = `\n| Cột 1 | Cột 2 | Cột 3 |\n| :--- | :--- | :--- |\n| Hàng 1 | Dữ liệu A | Dữ liệu B |\n| Hàng 2 | Dữ liệu C | Dữ liệu D |\n\n`;
    if (activeTab === 'visual') {
      insertHtmlAtCursor(`
        <table class="border-collapse border border-slate-700 w-full my-4">
          <tr><th class="border border-slate-700 p-2">Cột 1</th><th class="border border-slate-700 p-2">Cột 2</th><th class="border border-slate-700 p-2">Cột 3</th></tr>
          <tr><td class="border border-slate-700 p-2">Hàng 1</td><td class="border border-slate-700 p-2">Dữ liệu A</td><td class="border border-slate-700 p-2">Dữ liệu B</td></tr>
        </table>
        <p><br></p>
      `);
    } else {
      insertCodeSnippet(tableMd);
    }
  };

  // Quick Action: Insert Alert Box
  const handleInsertAlert = (type: 'NOTE' | 'TIP' | 'WARNING' | 'IMPORTANT') => {
    const alertMd = `\n> [!${type}]\n> Nhập nội dung thông báo tại đây...\n\n`;
    if (activeTab === 'visual') {
      insertHtmlAtCursor(`
        <div data-alert-type="${type.toLowerCase()}" class="my-4 p-4 rounded-xl border alert-${type.toLowerCase()}">
          <strong>${type}:</strong> Nhập nội dung thông báo tại đây...
        </div>
        <p><br></p>
      `);
    } else {
      insertCodeSnippet(alertMd);
    }
  };

  // Save Lesson Handler
  const handleSave = async () => {
    if (!lessonTitle.trim()) {
      setStatusMsg({ type: 'error', text: 'Vui lòng nhập tiêu đề bài học!' });
      return;
    }
    if (!selectedChapterId) {
      setStatusMsg({ type: 'error', text: 'Vui lòng chọn Chapter cho bài học!' });
      return;
    }

    // Make sure latest content is synchronized
    let currentMd = markdown;
    if (activeTab === 'visual') {
      currentMd = syncVisualToMarkdown();
    }

    setIsSaving(true);
    setStatusMsg(null);

    try {
      if (lessonId) {
        await readerApi.updateLesson(Number(lessonId), {
          title: lessonTitle.trim(),
          raw_markdown: currentMd,
          order_num: orderNum,
          chapter_id: Number(selectedChapterId),
        });
        setStatusMsg({ type: 'success', text: 'Đã lưu thay đổi thành công!' });
      } else {
        const created = await readerApi.createLesson({
          title: lessonTitle.trim(),
          raw_markdown: currentMd,
          order_num: orderNum,
          chapter_id: Number(selectedChapterId),
          tts_enabled: true,
        });
        setStatusMsg({ type: 'success', text: 'Đã tạo bài học mới thành công!' });
        navigate(`/editor/${created.id}`);
      }
    } catch (err: any) {
      console.error('Save failed:', err);
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Lưu thất bại. Vui lòng thử lại!',
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lessonTitle, selectedChapterId, markdown, activeTab]);

  return (
    <div className="h-screen flex flex-col bg-[#0b0f19] text-slate-100 font-sans select-none">
      {/* Top Main Navigation Header */}
      <header className="h-14 bg-slate-900/90 border-b border-slate-800 px-4 flex items-center justify-between gap-3 shrink-0 backdrop-blur-xl z-20">
        <div className="flex items-center gap-3">
          <Link
            to="/courses"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/60 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Library</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-white hidden md:inline">
              {lessonId ? `Editing Lesson #${lessonId}` : 'Create New Lesson'}
            </span>
          </div>

          {statusMsg && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {statusMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>{statusMsg.text}</span>
            </div>
          )}
        </div>

        {/* WordPress-Style Editor Mode Tabs */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl bg-slate-800/90 p-1 border border-slate-700/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleTabChange('visual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'visual'
                  ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="WordPress Visual WYSIWYG Editor"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Trực quan</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('code')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'code'
                  ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="WordPress Text & Markdown Code View (Paste raw code/markdown here)"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Văn bản / Code</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('split')}
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'split'
                  ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Side-by-side Split View"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Song song</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Full Student Reading Preview"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Xem bài</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu bài (Ctrl+S)'}</span>
          </button>
        </div>
      </header>

      {/* Lesson Metadata Sub-Header */}
      <div className="px-4 py-2.5 bg-slate-900/40 border-b border-slate-800 flex flex-wrap items-center gap-3 shrink-0 text-xs">
        <input
          type="text"
          value={lessonTitle}
          onChange={(e) => setLessonTitle(e.target.value)}
          placeholder="Nhập tiêu đề bài học (Enter lesson title here)..."
          className="flex-1 min-w-[240px] bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-white text-sm font-semibold placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />

        {/* Course Select */}
        <div className="flex items-center gap-1.5">
          <select
            value={selectedCourseId}
            onChange={(e) => {
              setSelectedCourseId(Number(e.target.value) || '');
              setSelectedChapterId('');
            }}
            className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 max-w-[150px] truncate"
          >
            <option value="">Chọn Khóa học...</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {/* Chapter Select */}
        <div className="flex items-center gap-1.5">
          <select
            value={selectedChapterId}
            onChange={(e) => setSelectedChapterId(Number(e.target.value) || '')}
            disabled={!selectedCourseId}
            className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 disabled:opacity-40 max-w-[160px] truncate"
          >
            <option value="">Chọn Chapter...</option>
            {availableChapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.title}
              </option>
            ))}
          </select>
        </div>

        {/* Order Number */}
        <div className="flex items-center gap-1.5 text-slate-400">
          <span className="font-semibold">Thứ tự:</span>
          <input
            type="number"
            value={orderNum}
            onChange={(e) => setOrderNum(parseInt(e.target.value, 10) || 1)}
            className="w-14 bg-slate-800/80 border border-slate-700/80 rounded-xl px-2 py-1.5 text-white text-center font-mono font-bold"
          />
        </div>
      </div>

      {/* WordPress-Style Quick Formatting Toolbar */}
      <div className="px-4 py-2 bg-slate-900/70 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto shrink-0 text-slate-300">
        {/* Headings */}
        <button
          type="button"
          onClick={() => (activeTab === 'visual' ? execVisualCmd('formatBlock', '<h1>') : insertCodeSnippet('# '))}
          title="Heading 1"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => (activeTab === 'visual' ? execVisualCmd('formatBlock', '<h2>') : insertCodeSnippet('## '))}
          title="Heading 2"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => (activeTab === 'visual' ? execVisualCmd('formatBlock', '<h3>') : insertCodeSnippet('### '))}
          title="Heading 3"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Heading3 className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-slate-800 mx-1" />

        {/* Inline Formatting */}
        <button
          type="button"
          onClick={() => (activeTab === 'visual' ? execVisualCmd('bold') : insertCodeSnippet('**', '**'))}
          title="Bold (Ctrl+B)"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors font-bold cursor-pointer"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => (activeTab === 'visual' ? execVisualCmd('italic') : insertCodeSnippet('*', '*'))}
          title="Italic (Ctrl+I)"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors italic cursor-pointer"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => (activeTab === 'visual' ? execVisualCmd('underline') : insertCodeSnippet('<u>', '</u>'))}
          title="Underline"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Underline className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => (activeTab === 'visual' ? execVisualCmd('strikeThrough') : insertCodeSnippet('~~', '~~'))}
          title="Strikethrough"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-slate-800 mx-1" />

        {/* Lists & Quotes */}
        <button
          type="button"
          onClick={() => (activeTab === 'visual' ? execVisualCmd('insertUnorderedList') : insertCodeSnippet('- '))}
          title="Bullet List"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => (activeTab === 'visual' ? execVisualCmd('insertOrderedList') : insertCodeSnippet('1. '))}
          title="Numbered List"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => (activeTab === 'visual' ? execVisualCmd('formatBlock', '<blockquote>') : insertCodeSnippet('> '))}
          title="Quote / Blockquote"
          className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Quote className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-slate-800 mx-1" />

        {/* Table & Code Insert */}
        <button
          type="button"
          onClick={handleInsertTable}
          title="Insert Table"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/60 transition-colors cursor-pointer"
        >
          <TableIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span>Bảng</span>
        </button>

        <button
          type="button"
          onClick={() => setIsCodeModalOpen(true)}
          title="Insert Code Block with Language Selector"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/60 transition-colors cursor-pointer"
        >
          <Code2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>Chèn Code</span>
        </button>

        <button
          type="button"
          onClick={() => setIsFuriganaModalOpen(true)}
          title="Insert Japanese Ruby (Furigana)"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-colors cursor-pointer"
        >
          <Languages className="w-3.5 h-3.5 text-emerald-400" />
          <span>Furigana</span>
        </button>

        <div className="w-px h-4 bg-slate-800 mx-1" />

        {/* GitHub Alerts Dropdown */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleInsertAlert('NOTE')}
            className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/30 text-[11px] font-semibold hover:bg-sky-500/20"
          >
            [!NOTE]
          </button>
          <button
            type="button"
            onClick={() => handleInsertAlert('TIP')}
            className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold hover:bg-emerald-500/20"
          >
            [!TIP]
          </button>
          <button
            type="button"
            onClick={() => handleInsertAlert('WARNING')}
            className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-semibold hover:bg-amber-500/20"
          >
            [!WARN]
          </button>
        </div>
      </div>

      {/* Main Editing Canvas Area */}
      <div className="flex-1 flex min-h-0 bg-[#0d1117] relative overflow-hidden">
        {/* ========================================================= */}
        {/* TAB 1: WordPress Visual WYSIWYG Editor                     */}
        {/* ========================================================= */}
        <div
          className={`${
            activeTab === 'visual' ? 'flex flex-col' : 'hidden'
          } flex-1 h-full overflow-y-auto p-6 sm:p-10 max-w-4xl mx-auto w-full`}
        >
          <div className="text-[11px] text-slate-500 uppercase tracking-widest font-mono mb-3 flex items-center justify-between">
            <span>Trình soạn thảo trực quan (WordPress Visual Mode)</span>
            <span>Chỉnh sửa trực tiếp trên trang</span>
          </div>
          <div
            ref={visualEditorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={syncVisualToMarkdown}
            onBlur={syncVisualToMarkdown}
            className="visual-editor flex-1 min-h-[500px] outline-none text-slate-100 font-sans text-sm sm:text-base leading-relaxed space-y-4 focus:ring-0 empty:before:content-['Nhập_nội_dung_bài_viết_tại_đây...'] empty:before:text-slate-600 max-w-none"
          />
        </div>

        {/* ========================================================= */}
        {/* TAB 2: WordPress Text / Code Editor (Paste Markdown/Code) */}
        {/* ========================================================= */}
        <div className={`${activeTab === 'code' ? 'flex flex-col' : 'hidden'} flex-1 h-full w-full`}>
          <div className="px-6 py-2 bg-slate-900/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between shrink-0">
            <span className="flex items-center gap-2">
              <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              Mã nguồn Markdown & HTML (WordPress Text View)
            </span>
            <span className="text-slate-500">
              {markdown.length} ký tự • Dán code hoặc văn bản Markdown tại đây
            </span>
          </div>
          <textarea
            ref={codeTextareaRef}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="Dán mã nguồn Markdown hoặc HTML bài học tại đây (Paste code/markdown here)..."
            className="flex-1 w-full p-6 bg-[#0a0d14] text-slate-200 font-mono text-xs sm:text-sm leading-relaxed resize-none focus:outline-none selection:bg-emerald-500/30 selection:text-white"
            spellCheck={false}
          />
        </div>

        {/* ========================================================= */}
        {/* TAB 3: Split View (Code on Left, Rendered on Right)       */}
        {/* ========================================================= */}
        <div className={`${activeTab === 'split' ? 'flex' : 'hidden'} flex-1 h-full w-full`}>
          <div className="w-1/2 h-full flex flex-col border-r border-slate-800">
            <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between shrink-0">
              <span>Markdown Source</span>
              <span>{markdown.length} chars</span>
            </div>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="Type or paste Markdown..."
              className="flex-1 w-full p-4 bg-[#0a0d14] text-slate-200 font-mono text-xs leading-relaxed resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>
          <div className="w-1/2 h-full flex flex-col bg-[#0b0f19] overflow-y-auto p-6">
            <div className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider mb-4">
              Live Rendered Preview
            </div>
            <MarkdownRenderer content={markdown} />
          </div>
        </div>

        {/* ========================================================= */}
        {/* TAB 4: Full Reading Presentation Preview                  */}
        {/* ========================================================= */}
        <div className={`${activeTab === 'preview' ? 'block' : 'hidden'} flex-1 h-full overflow-y-auto p-8 bg-[#0b0f19]`}>
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <span className="px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase">
                Preview
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
                {lessonTitle || 'Untitled Lesson'}
              </h1>
            </div>
            <MarkdownRenderer content={markdown} />
          </div>
        </div>
      </div>

      {/* Code Block Inserter Modal */}
      {isCodeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-400" />
                Chèn khối mã nguồn (Insert Code Block)
              </h3>
              <button
                type="button"
                onClick={() => setIsCodeModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Đóng
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Ngôn ngữ:</label>
                <select
                  value={codeLanguage}
                  onChange={(e) => setCodeLanguage(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                  <option value="json">JSON</option>
                  <option value="bash">Bash / Shell</option>
                  <option value="mermaid">Mermaid Diagram</option>
                  <option value="markdown">Markdown</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Mã nguồn (Paste Code Here):</label>
                <textarea
                  rows={8}
                  value={codeSnippet}
                  onChange={(e) => setCodeSnippet(e.target.value)}
                  placeholder="Dán code của bạn vào đây..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCodeModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleInsertCodeBlock}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-600/25"
              >
                Chèn vào bài viết
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Japanese Furigana Modal */}
      {isFuriganaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Languages className="w-4 h-4 text-emerald-400" />
                Chèn Furigana (Japanese Ruby)
              </h3>
              <button
                type="button"
                onClick={() => setIsFuriganaModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Đóng
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Chữ Hán (Kanji):</label>
                <input
                  type="text"
                  value={furiganaKanji}
                  onChange={(e) => setFuriganaKanji(e.target.value)}
                  placeholder="Ví dụ: 季節 hoặc 理由"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Cách đọc Furigana (Hiragana):</label>
                <input
                  type="text"
                  value={furiganaReading}
                  onChange={(e) => setFuriganaReading(e.target.value)}
                  placeholder="Ví dụ: きせつ hoặc りゆう"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {furiganaKanji && (
                <div className="p-3 bg-slate-950 rounded-xl text-center">
                  <span className="text-xs text-slate-500 block mb-1">Xem trước:</span>
                  <ruby className="text-xl font-bold text-emerald-300">
                    {furiganaKanji}
                    <rt className="text-xs text-emerald-400">{furiganaReading}</rt>
                  </ruby>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsFuriganaModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleInsertFurigana}
                disabled={!furiganaKanji.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-bold text-white shadow-lg shadow-emerald-600/25"
              >
                Chèn Furigana
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
