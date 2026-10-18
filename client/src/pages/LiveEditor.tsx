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
  RotateCcw,
  ShieldAlert,
  Wand2,
  ClipboardPaste,
  Calculator,
  GitFork,
  CreditCard,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Headphones,
  Trash2,
  Volume2,
  Copy,
} from 'lucide-react';
import { readerApi, Lesson, Chapter, Course, AudioTrack } from '../lib/api/readerApi';
import { MarkdownRenderer } from '../components/mdx/MarkdownRenderer';
import { htmlToMarkdown, markdownToHtml } from '../lib/utils/markdownConverter';
import { useAppStore } from '../store/useAppStore';
import { detectLanguage } from '../components/player/BrowserSpeechPlayer';

export default function LiveEditor() {
  const { lessonId } = useParams<{ lessonId?: string }>();
  const navigate = useNavigate();
  const { user, isLoggedIn, isLoading: isAuthLoading } = useAppStore();

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

  // 4 Primary Editor Pages/Tabs: 'content' (Bài học chính) | 'slot1' | 'slot2' | 'slot3'
  const [editorMainTab, setEditorMainTab] = useState<'content' | 'slot1' | 'slot2' | 'slot3'>('content');
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([
    { slot_num: 1, mode_key: 'slot_1', title: 'Slot 1', description: '', audio_script: '', duration_seconds: 0 },
    { slot_num: 2, mode_key: 'slot_2', title: 'Slot 2', description: '', audio_script: '', duration_seconds: 0 },
    { slot_num: 3, mode_key: 'slot_3', title: 'Slot 3', description: '', audio_script: '', duration_seconds: 0 },
  ]);
  const [isGeneratingSlotTTS, setIsGeneratingSlotTTS] = useState<number | null>(null);

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

  // Intelligent WYSIWYG & Self-Healing States
  const [isSmartPasteModalOpen, setIsSmartPasteModalOpen] = useState(false);
  const [smartPasteRaw, setSmartPasteRaw] = useState('');
  const [smartPasteAutoFurigana, setSmartPasteAutoFurigana] = useState(true);
  const [isConvertingSmartPaste, setIsConvertingSmartPaste] = useState(false);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [isGeneratingFurigana, setIsGeneratingFurigana] = useState(false);

  // Real-time Lint & Quality Health Info
  const [lintInfo, setLintInfo] = useState<{
    score: number;
    status: string;
    issues: Array<{ level: string; message: string }>;
    stats: { headings: number; ruby_count: number; word_count: number; char_count: number };
  }>({
    score: 100,
    status: 'excellent',
    issues: [],
    stats: { headings: 0, ruby_count: 0, word_count: 0, char_count: 0 },
  });

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
      const currentHtml = visualEditorRef.current.innerHTML.trim();
      // Guard: If visual editor DOM was unmounted or empty but markdown has content, do not wipe out!
      if ((!currentHtml || currentHtml === '<p><br></p>') && markdown.trim()) {
        return markdown;
      }
      const md = htmlToMarkdown(visualEditorRef.current);
      setMarkdown(md);
      return md;
    }
    return markdown;
  }, [markdown]);

  // Robust synchronization hook: ensures visual editor DOM is always populated when activeTab is visual
  useEffect(() => {
    if (activeTab === 'visual' && editorMainTab === 'content' && visualEditorRef.current && markdown) {
      const currentHtml = visualEditorRef.current.innerHTML.trim();
      if (!currentHtml || currentHtml === '<p><br></p>') {
        visualEditorRef.current.innerHTML = markdownToHtml(markdown);
      }
    }
  }, [activeTab, editorMainTab, markdown]);

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
          if (l.audio_tracks && l.audio_tracks.length > 0) {
            setAudioTracks(l.audio_tracks);
          }
          // Populate visual DOM immediately and with fallback
          syncMarkdownToVisual(raw);
          setTimeout(() => syncMarkdownToVisual(raw), 50);
          setTimeout(() => syncMarkdownToVisual(raw), 250);
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

  // Real-time Lint Runner
  const runLint = useCallback(async (content: string) => {
    if (!content.trim()) return;
    try {
      const res = await readerApi.lintMarkdown(content);
      setLintInfo(res);
    } catch (e) {
      // silent
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      runLint(markdown);
    }, 1200);
    return () => clearTimeout(timer);
  }, [markdown, runLint]);

  // Quick Action: 1-Click Auto-Fix & Self-Healing
  const handleAutoFix = async () => {
    let currentMd = markdown;
    if (activeTab === 'visual') {
      currentMd = syncVisualToMarkdown();
    }
    if (!currentMd.trim()) return;

    try {
      setIsAutoFixing(true);
      const res = await readerApi.autoFixMarkdown(currentMd);
      setMarkdown(res.fixed_markdown);
      if (activeTab === 'visual') {
        syncMarkdownToVisual(res.fixed_markdown);
      }
      if (res.issues_fixed && res.issues_fixed.length > 0) {
        setStatusMsg({
          type: 'success',
          text: `Đã tự sửa ${res.changes_count} lỗi: ${res.issues_fixed.slice(0, 2).join(', ')}${res.issues_fixed.length > 2 ? '...' : ''}`,
        });
      } else {
        setStatusMsg({
          type: 'success',
          text: 'Cú pháp bài học đã rất chuẩn, không phát hiện lỗi cần sửa!',
        });
      }
      runLint(res.fixed_markdown);
    } catch (err: any) {
      console.error('Auto fix failed:', err);
      setStatusMsg({ type: 'error', text: 'Tự sửa lỗi thất bại. Vui lòng thử lại!' });
    } finally {
      setIsAutoFixing(false);
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  // Quick Action: 1-Click Auto-Generate Furigana
  const handleAutoFurigana = async () => {
    let currentMd = markdown;
    if (activeTab === 'visual') {
      currentMd = syncVisualToMarkdown();
    }
    if (!currentMd.trim()) return;

    let targetText = currentMd;
    let isSelectedOnly = false;
    let selStart = 0;
    let selEnd = 0;

    if (activeTab === 'code' && codeTextareaRef.current) {
      const ta = codeTextareaRef.current;
      if (ta.selectionStart !== ta.selectionEnd) {
        selStart = ta.selectionStart;
        selEnd = ta.selectionEnd;
        targetText = currentMd.substring(selStart, selEnd);
        isSelectedOnly = true;
      }
    }

    try {
      setIsGeneratingFurigana(true);
      const res = await readerApi.autoGenerateFurigana(targetText);
      let updatedMd = currentMd;
      if (isSelectedOnly) {
        updatedMd = currentMd.substring(0, selStart) + res.converted_text + currentMd.substring(selEnd);
      } else {
        updatedMd = res.converted_text;
      }
      setMarkdown(updatedMd);
      if (activeTab === 'visual') {
        syncMarkdownToVisual(updatedMd);
      }
      setStatusMsg({
        type: 'success',
        text: `Đã tự động tạo Furigana cho ${res.ruby_added} từ Kanji (${res.kanji_count} chữ Hán)!`,
      });
      runLint(updatedMd);
    } catch (err: any) {
      console.error('Auto furigana failed:', err);
      setStatusMsg({ type: 'error', text: 'Tự động tạo Furigana thất bại. Vui lòng thử lại!' });
    } finally {
      setIsGeneratingFurigana(false);
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  // Quick Action: Smart Convert Raw Notes
  const handleSmartConvert = async () => {
    if (!smartPasteRaw.trim()) return;
    try {
      setIsConvertingSmartPaste(true);
      const res = await readerApi.smartConvertNotes(smartPasteRaw, smartPasteAutoFurigana);
      if (!lessonTitle.trim() || lessonTitle === 'New Lesson Title') {
        setLessonTitle(res.title);
      }
      setMarkdown(res.markdown);
      if (activeTab === 'visual') {
        syncMarkdownToVisual(res.markdown);
      }
      setIsSmartPasteModalOpen(false);
      setSmartPasteRaw('');
      setStatusMsg({
        type: 'success',
        text: `Đã phân tích & cấu trúc bài học: "${res.title}"`,
      });
      runLint(res.markdown);
    } catch (err: any) {
      console.error('Smart convert failed:', err);
      alert('Không thể chuyển đổi văn bản. Vui lòng kiểm tra lại nội dung dán!');
    } finally {
      setIsConvertingSmartPaste(false);
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  // Quick Action: Insert Math
  const handleInsertMath = () => {
    const mathSnippet = `\n$$\nE = mc^2\n$$\n\n`;
    if (activeTab === 'visual') {
      insertHtmlAtCursor(`<p>$$E = mc^2$$</p><p><br></p>`);
    } else {
      insertCodeSnippet(mathSnippet);
    }
  };

  // Quick Action: Insert Mermaid Diagram
  const handleInsertMermaid = () => {
    const mermaidSnippet = `\n\`\`\`mermaid\ngraph TD\n    A[Bắt đầu] --> B[Học Ngữ pháp]\n    B --> C[Luyện phản xạ JSST]\n    C --> D[Thành thạo]\n\`\`\`\n\n`;
    if (activeTab === 'visual') {
      insertHtmlAtCursor(`<pre><code data-language="mermaid">graph TD\n    A[Bắt đầu] --> B[Hoàn thành]</code></pre><p><br></p>`);
    } else {
      insertCodeSnippet(mermaidSnippet);
    }
  };

  // Quick Action: Insert Vocab Card
  const handleInsertVocabCard = () => {
    const cardSnippet = `\n<vocabcard word="社会人" reading="しゃかいじん" meaning="Người đã đi làm, người trưởng thành trong xã hội" />\n\n`;
    if (activeTab === 'visual') {
      insertHtmlAtCursor(cardSnippet);
    } else {
      insertCodeSnippet(cardSnippet);
    }
  };

  // Quick Action: Insert Quiz Block
  const handleInsertQuiz = () => {
    const quizSnippet = `\n<quiz question="Chọn đáp án đúng nhất:" options='["Lựa chọn A", "Lựa chọn B", "Lựa chọn C"]' correct="Lựa chọn A" />\n\n`;
    if (activeTab === 'visual') {
      insertHtmlAtCursor(quizSnippet);
    } else {
      insertCodeSnippet(quizSnippet);
    }
  };

  // Quick Action: Insert Language Span Tag (<ja> or <vi>)
  const handleInsertLangTag = (tag: 'ja' | 'vi') => {
    if (activeTab === 'visual') {
      insertHtmlAtCursor(`<${tag}>văn bản</${tag}> `);
    } else {
      insertCodeSnippet(`<${tag}>`, `</${tag}>`);
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

  // Active Slot helper properties & actions
  const activeSlotNum = editorMainTab === 'slot1' ? 1 : editorMainTab === 'slot2' ? 2 : editorMainTab === 'slot3' ? 3 : 1;
  const activeTrack = audioTracks.find((t) => t.slot_num === activeSlotNum) || {
    slot_num: activeSlotNum,
    mode_key: `slot_${activeSlotNum}`,
    title: `Slot ${activeSlotNum}`,
    description: '',
    audio_script: '',
    duration_seconds: 0,
  };

  const updateActiveTrack = (patch: Partial<AudioTrack>) => {
    setAudioTracks((prev) => {
      const idx = prev.findIndex((t) => t.slot_num === activeSlotNum);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      }
      return [
        ...prev,
        {
          slot_num: activeSlotNum,
          mode_key: `slot_${activeSlotNum}`,
          title: `Slot ${activeSlotNum}`,
          description: '',
          audio_script: '',
          duration_seconds: 0,
          ...patch,
        },
      ];
    });
  };

  const handleSaveActiveSlot = async () => {
    if (!lessonId) {
      setStatusMsg({ type: 'error', text: 'Vui lòng lưu bài học chính trước khi lưu cấu hình Audio Slot!' });
      return;
    }
    setIsSaving(true);
    try {
      await readerApi.updateAudioTrack(Number(lessonId), activeSlotNum, {
        title: activeTrack.title || `Slot ${activeSlotNum}`,
        description: activeTrack.description || '',
        audio_script: activeTrack.audio_script || '',
      });
      setStatusMsg({ type: 'success', text: `Đã lưu cấu hình Audio Slot ${activeSlotNum} thành công!` });
    } catch (err: any) {
      console.error('Failed to save slot track:', err);
      setStatusMsg({ type: 'error', text: err.response?.data?.detail || `Lỗi khi lưu Slot ${activeSlotNum}!` });
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleGenerateSlotAudio = async () => {
    if (!lessonId) {
      setStatusMsg({ type: 'error', text: 'Vui lòng lưu bài học trước khi tạo Audio!' });
      return;
    }
    setIsGeneratingSlotTTS(activeSlotNum);
    setStatusMsg({ type: 'success', text: `Đang gửi lệnh tạo Audio AI cho Slot ${activeSlotNum}...` });
    try {
      const res = await readerApi.generateTTS(Number(lessonId), {
        slot_num: activeSlotNum,
        audio_script: activeTrack.audio_script || '',
      });
      if (res.audio_tracks) {
        setAudioTracks(res.audio_tracks);
      } else if (res.audio_url) {
        updateActiveTrack({ audio_url: res.audio_url, duration_seconds: res.duration_seconds });
      }
      setStatusMsg({ type: 'success', text: `Tạo Audio AI cho Slot ${activeSlotNum} thành công!` });
    } catch (err: any) {
      console.error('Failed to generate audio:', err);
      setStatusMsg({ type: 'error', text: err.response?.data?.detail || `Lỗi tạo Audio AI Slot ${activeSlotNum}!` });
    } finally {
      setIsGeneratingSlotTTS(null);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  const handleDeleteSlotAudio = async () => {
    if (!lessonId) return;
    if (!confirm(`Bạn có chắc muốn xóa file âm thanh đã tạo của Slot ${activeSlotNum}?`)) return;
    try {
      await readerApi.deleteAudioTrackFile(Number(lessonId), activeSlotNum);
      updateActiveTrack({ audio_url: undefined, duration_seconds: 0 });
      setStatusMsg({ type: 'success', text: `Đã xóa file Audio AI của Slot ${activeSlotNum}` });
    } catch (err: any) {
      console.error('Failed to delete track audio:', err);
      setStatusMsg({ type: 'error', text: 'Lỗi xóa file âm thanh!' });
    }
  };

  const slotScriptTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertScriptPause = (pauseTag: string) => {
    const el = slotScriptTextareaRef.current;
    const currentScript = activeTrack.audio_script || '';
    if (!el) {
      updateActiveTrack({ audio_script: (currentScript ? currentScript + '\n' : '') + pauseTag });
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const nextScript = currentScript.substring(0, start) + `\n${pauseTag}\n` + currentScript.substring(end);
    updateActiveTrack({ audio_script: nextScript });
    setTimeout(() => {
      el.focus();
      const nextPos = start + pauseTag.length + 2;
      el.setSelectionRange(nextPos, nextPos);
    }, 50);
  };

  const handleCopyFromLessonMarkdown = () => {
    if (!markdown.trim()) {
      setStatusMsg({ type: 'error', text: 'Nội dung bài học hiện đang trống!' });
      return;
    }
    let cleaned = markdown.replace(/<ruby>(.*?)<rt>.*?<\/rt><\/ruby>/gi, '$1');
    cleaned = cleaned.replace(/<[^>]+>/g, '');
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    cleaned = cleaned.replace(/^#+\s+/gm, '');
    cleaned = cleaned.replace(/^\|.*\|$/gm, (match) => {
      const cells = match.split('|').map((c) => c.trim()).filter(Boolean);
      return cells.join(' — ');
    });
    cleaned = cleaned.replace(/[*_`~]/g, '');
    cleaned = cleaned.trim();

    updateActiveTrack({ audio_script: cleaned });
    setStatusMsg({ type: 'success', text: 'Đã sao chép nội dung bài viết vào kịch bản Slot!' });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  // Browser speech testing inside Slot editor
  const [isTestingSpeech, setIsTestingSpeech] = useState(false);
  const handleToggleBrowserSpeech = () => {
    if (isTestingSpeech) {
      window.speechSynthesis.cancel();
      setIsTestingSpeech(false);
      return;
    }
    const script = activeTrack.audio_script || '';
    if (!script.trim()) {
      setStatusMsg({ type: 'error', text: 'Kịch bản Slot đang trống, vui lòng nhập nội dung!' });
      return;
    }

    window.speechSynthesis.cancel();
    setIsTestingSpeech(true);

    const lines = script.split('\n');
    const sentences: { text: string; lang: 'ja-JP' | 'vi-VN' | 'en-US' }[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('[pause:') || trimmed.startsWith('//')) return;
      const parts = trimmed.split(/(?<=[。！？!?\.\n])/g).map((p) => p.trim()).filter(Boolean);
      parts.forEach((p) => {
        sentences.push({
          text: p,
          lang: detectLanguage(p, 'ja-JP'),
        });
      });
    });

    if (sentences.length === 0) {
      setIsTestingSpeech(false);
      return;
    }

    let currentIndex = 0;
    const speakNext = () => {
      if (currentIndex >= sentences.length) {
        setIsTestingSpeech(false);
        return;
      }
      const item = sentences[currentIndex];
      const utter = new SpeechSynthesisUtterance(item.text);
      utter.lang = item.lang;
      utter.rate = 1.0;
      utter.onend = () => {
        currentIndex++;
        speakNext();
      };
      utter.onerror = () => {
        currentIndex++;
        speakNext();
      };
      window.speechSynthesis.speak(utter);
    };

    speakNext();
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (editorMainTab === 'content') {
          handleSave();
        } else {
          handleSaveActiveSlot();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lessonTitle, selectedChapterId, markdown, activeTab, editorMainTab, activeTrack, lessonId]);

  if (!isAuthLoading && (!isLoggedIn || user?.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-[#070a13] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4 shadow-lg shadow-rose-500/10">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Quyền Truy Cập Bị Giới Hạn</h2>
        <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
          Trang Soạn Thảo WYSIWYG & Quản Trị Bài Học chỉ dành riêng cho Quản trị viên (Admin). Vui lòng đăng nhập với tài khoản Quản trị viên hoặc quay lại Thư viện khóa học.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/courses')}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all cursor-pointer"
          >
            Quay lại Thư viện
          </button>
          {!isLoggedIn && (
            <button
              type="button"
              onClick={() => navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg shadow-sky-600/20 transition-all cursor-pointer"
            >
              Đăng nhập Admin
            </button>
          )}
        </div>
      </div>
    );
  }

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
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <span className="text-xs font-bold text-white hidden md:inline">
              {lessonId ? `Editing Lesson #${lessonId}` : 'Create New Lesson'}
            </span>
          </div>

          {statusMsg && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold ${
                statusMsg.type === 'success'
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {statusMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>{statusMsg.text}</span>
            </div>
          )}
        </div>

        {/* 4 Primary Editor Pages / Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setEditorMainTab('content')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              editorMainTab === 'content'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>1. Bài viết</span>
          </button>

          {[1, 2, 3].map((slotNum) => {
            const tabKey = `slot${slotNum}` as 'slot1' | 'slot2' | 'slot3';
            const trk = audioTracks.find((t) => t.slot_num === slotNum);
            const hasAudio = !!trk?.audio_url;
            const hasScript = !!trk?.audio_script?.trim();
            const isSelected = editorMainTab === tabKey;

            return (
              <button
                key={slotNum}
                type="button"
                onClick={() => setEditorMainTab(tabKey)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Slot {slotNum}</span>
                {hasAudio ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Đã có file Audio AI" />
                ) : hasScript ? (
                  <span className="w-2 h-2 rounded-full bg-sky-400" title="Đã có kịch bản" />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Right Action Section */}
        <div className="flex items-center gap-3">
          {editorMainTab === 'content' ? (
            <>
              {/* WordPress-Style Editor Mode Tabs */}
              <div className="flex rounded-xl bg-slate-800/90 p-1 border border-slate-700/60 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => handleTabChange('visual')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === 'visual'
                      ? 'bg-sky-600 text-white font-bold shadow-md shadow-sky-600/20'
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
                      ? 'bg-sky-600 text-white font-bold shadow-md shadow-sky-600/20'
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
                      ? 'bg-sky-600 text-white font-bold shadow-md shadow-sky-600/20'
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
                      ? 'bg-sky-600 text-white font-bold shadow-md shadow-sky-600/20'
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
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Đang lưu...' : 'Lưu bài (Ctrl+S)'}</span>
              </button>
            </>
          ) : (
            <>
              {/* Slot Mode Actions */}
              <button
                type="button"
                onClick={handleToggleBrowserSpeech}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  isTestingSpeech
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700/80 text-sky-400'
                }`}
                title="Nghe thử kịch bản này trực tiếp bằng Trình duyệt"
              >
                {isTestingSpeech ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isTestingSpeech ? 'Dừng đọc' : 'Nghe trình duyệt'}</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateSlotAudio}
                disabled={isGeneratingSlotTTS !== null}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                title="Tạo file MP3 Edge-TTS cho Slot này"
              >
                {isGeneratingSlotTTS === activeSlotNum ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Tạo Audio AI</span>
              </button>

              <button
                type="button"
                onClick={handleSaveActiveSlot}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Đang lưu...' : `Lưu Slot ${activeSlotNum} (Ctrl+S)`}</span>
              </button>
            </>
          )}
        </div>
      </header>

      {editorMainTab === 'content' && (
        <>
          {/* Lesson Metadata Sub-Header */}
          <div className="px-4 py-2.5 bg-slate-900/40 border-b border-slate-800 flex flex-wrap items-center gap-3 shrink-0 text-xs">
        <input
          type="text"
          value={lessonTitle}
          onChange={(e) => setLessonTitle(e.target.value)}
          placeholder="Nhập tiêu đề bài học (Enter lesson title here)..."
          className="flex-1 min-w-[240px] bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-white text-sm font-semibold placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
        />

        {/* Course Select */}
        <div className="flex items-center gap-1.5">
          <select
            value={selectedCourseId}
            onChange={(e) => {
              setSelectedCourseId(Number(e.target.value) || '');
              setSelectedChapterId('');
            }}
            className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500 max-w-[150px] truncate"
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
            className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500 disabled:opacity-40 max-w-[160px] truncate"
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

        {/* Table, Code & Interactive Blocks */}
        <button
          type="button"
          onClick={handleInsertTable}
          title="Chèn bảng dữ liệu (Markdown Table)"
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/60 transition-colors cursor-pointer"
        >
          <TableIcon className="w-3.5 h-3.5 text-sky-400" />
          <span>Bảng</span>
        </button>

        <button
          type="button"
          onClick={() => setIsCodeModalOpen(true)}
          title="Chèn khối mã nguồn code"
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/60 transition-colors cursor-pointer"
        >
          <Code2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>Code</span>
        </button>

        {/* KaTeX Math */}
        <button
          type="button"
          onClick={handleInsertMath}
          title="Chèn công thức toán học KaTeX ($$E=mc^2$$)"
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/60 transition-colors cursor-pointer"
        >
          <Calculator className="w-3.5 h-3.5 text-emerald-400" />
          <span>Toán</span>
        </button>

        {/* Mermaid Diagram */}
        <button
          type="button"
          onClick={handleInsertMermaid}
          title="Chèn sơ đồ lưu trình Mermaid Diagram"
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/60 transition-colors cursor-pointer"
        >
          <GitFork className="w-3.5 h-3.5 text-amber-400" />
          <span>Sơ đồ</span>
        </button>

        {/* Vocab Card */}
        <button
          type="button"
          onClick={handleInsertVocabCard}
          title="Chèn thẻ từ vựng tương tác (<vocabcard>)"
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/60 transition-colors cursor-pointer"
        >
          <CreditCard className="w-3.5 h-3.5 text-purple-400" />
          <span>Thẻ từ</span>
        </button>

        {/* Quiz Block */}
        <button
          type="button"
          onClick={handleInsertQuiz}
          title="Chèn câu hỏi trắc nghiệm tương tác (<quiz>)"
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/60 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5 text-rose-400" />
          <span>Quiz</span>
        </button>

        <div className="w-px h-4 bg-slate-800 mx-1" />

        {/* Language tags */}
        <button
          type="button"
          onClick={() => handleInsertLangTag('ja')}
          title="Gắn thẻ tiếng Nhật <ja>...</ja>"
          className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono font-bold border border-slate-700/60 cursor-pointer"
        >
          &lt;ja&gt;
        </button>
        <button
          type="button"
          onClick={() => handleInsertLangTag('vi')}
          title="Gắn thẻ tiếng Việt <vi>...</vi>"
          className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono font-bold border border-slate-700/60 cursor-pointer"
        >
          &lt;vi&gt;
        </button>

        <button
          type="button"
          onClick={() => setIsFuriganaModalOpen(true)}
          title="Chèn Furigana thủ công"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-semibold border border-sky-500/30 transition-colors cursor-pointer"
        >
          <Languages className="w-3.5 h-3.5 text-sky-400" />
          <span>Ruby</span>
        </button>

        <div className="w-px h-4 bg-slate-800 mx-1" />

        {/* GitHub Alerts Dropdown */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleInsertAlert('NOTE')}
            className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/30 text-[11px] font-semibold hover:bg-sky-500/20 cursor-pointer"
          >
            [!NOTE]
          </button>
          <button
            type="button"
            onClick={() => handleInsertAlert('TIP')}
            className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[11px] font-semibold hover:bg-cyan-500/20 cursor-pointer"
          >
            [!TIP]
          </button>
          <button
            type="button"
            onClick={() => handleInsertAlert('WARNING')}
            className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-semibold hover:bg-amber-500/20 cursor-pointer"
          >
            [!WARN]
          </button>
        </div>
      </div>

      {/* Smart AI, Automation & Health Sub-Toolbar */}
      <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
        {/* Left Side: 1-Click Smart Tools */}
        <div className="flex items-center gap-2">
          {/* 1-Click Auto-Fix & Self-Healing */}
          <button
            type="button"
            disabled={isAutoFixing}
            onClick={handleAutoFix}
            title="Tự động sửa lỗi cú pháp Markdown, đóng thẻ HTML/Ruby, tách câu chuẩn cho TTS"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 text-emerald-300 font-bold border border-emerald-500/40 shadow-xs cursor-pointer transition-all active:scale-95 disabled:opacity-50"
          >
            {isAutoFixing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Tự sửa lỗi (Auto-Fix)</span>
          </button>

          {/* 1-Click Auto-Generate Furigana */}
          <button
            type="button"
            disabled={isGeneratingFurigana}
            onClick={handleAutoFurigana}
            title="Tự động nhận diện chữ Hán Kanji và tạo phiên âm Furigana (ruby)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500/20 to-blue-500/20 hover:from-sky-500/30 hover:to-blue-500/30 text-sky-300 font-bold border border-sky-500/40 shadow-xs cursor-pointer transition-all active:scale-95 disabled:opacity-50"
          >
            {isGeneratingFurigana ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            )}
            <span>Auto Furigana</span>
          </button>

          {/* Smart Paste (From Word / ChatGPT) */}
          <button
            type="button"
            onClick={() => setIsSmartPasteModalOpen(true)}
            title="Dán văn bản thô từ Word/ChatGPT và tự động cấu trúc thành bài học MDX hoàn chỉnh"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700/60 cursor-pointer transition-all"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-amber-400" />
            <span>Dán thông minh</span>
          </button>
        </div>

        {/* Right Side: Quality Health & Structural HUD */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <span className="text-slate-500">Đề mục:</span>
            <span className="font-bold text-sky-400">{lintInfo.stats.headings}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-slate-500">Furigana:</span>
            <span className="font-bold text-sky-400">{lintInfo.stats.ruby_count}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-slate-500">Từ:</span>
            <span className="font-bold text-slate-300">{lintInfo.stats.word_count}</span>
          </span>

          <div className="h-3 w-px bg-slate-800" />

          {/* Quality Score Badge */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Chất lượng:</span>
            <span
              className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                lintInfo.score >= 90
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : lintInfo.score >= 70
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              {lintInfo.score}/100
            </span>
          </div>

          {/* Warning quick-fix button if any issues */}
          {lintInfo.issues.length > 0 && (
            <button
              type="button"
              onClick={handleAutoFix}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-sans text-[11px] font-bold cursor-pointer transition-all animate-pulse"
              title={lintInfo.issues.map((i) => i.message).join('\n')}
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>{lintInfo.issues.length} lỗi [Tự sửa ⚡]</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Editing Canvas Area */}
      <div className="flex-1 flex min-h-0 bg-[#070a13] relative overflow-hidden">
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
              <FileCode className="w-3.5 h-3.5 text-sky-400" />
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
            className="flex-1 w-full p-6 bg-[#0a0d14] text-slate-200 font-mono text-xs sm:text-sm leading-relaxed resize-none focus:outline-none selection:bg-sky-500/30 selection:text-white"
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
          <div className="w-1/2 h-full flex flex-col bg-[#070a13] overflow-y-auto p-6">
            <div className="text-[11px] font-mono text-sky-400 uppercase tracking-wider mb-4">
              Live Rendered Preview
            </div>
            <MarkdownRenderer content={markdown} />
          </div>
        </div>

        {/* ========================================================= */}
        {/* TAB 4: Full Reading Presentation Preview                  */}
        {/* ========================================================= */}
        <div className={`${activeTab === 'preview' ? 'block' : 'hidden'} flex-1 h-full overflow-y-auto p-8 bg-[#070a13]`}>
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <span className="px-2.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-bold uppercase">
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
        </>
      )}

      {/* ========================================================= */}
      {/* AUDIO SLOT STUDIO (Slot 1 / Slot 2 / Slot 3)              */}
      {/* ========================================================= */}
      {editorMainTab !== 'content' && (
        <div className="flex-1 flex flex-col min-h-0 bg-[#070a13] overflow-hidden">
          {/* Slot Metadata Bar */}
          <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold font-mono text-sm">
                S{activeSlotNum}
              </div>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={activeTrack.title || `Slot ${activeSlotNum}`}
                  onChange={(e) => updateActiveTrack({ title: e.target.value })}
                  placeholder={`Tên Slot ${activeSlotNum}...`}
                  className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1.5 text-white text-sm font-bold focus:outline-none focus:border-indigo-500 w-44"
                />
                <input
                  type="text"
                  value={activeTrack.description || ''}
                  onChange={(e) => updateActiveTrack({ description: e.target.value })}
                  placeholder="Ghi chú cấu hình Slot (ví dụ: Đọc câu hỏi, nghỉ 2s, đọc câu trả lời tiếng Nhật)..."
                  className="flex-1 bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Quick Actions for Script */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Chèn khoảng lặng:</span>
              <button
                type="button"
                onClick={() => handleInsertScriptPause('[pause: 2s]')}
                className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-bold transition-all cursor-pointer"
                title="Chèn lệnh nghỉ 2 giây giữa các câu"
              >
                + [pause: 2s]
              </button>
              <button
                type="button"
                onClick={() => handleInsertScriptPause('[pause: 1s]')}
                className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-bold transition-all cursor-pointer"
                title="Chèn lệnh nghỉ 1 giây"
              >
                + [pause: 1s]
              </button>
              <button
                type="button"
                onClick={() => handleInsertScriptPause('[pause: 500ms]')}
                className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-bold transition-all cursor-pointer"
                title="Chèn lệnh nghỉ 500ms"
              >
                + [pause: 500ms]
              </button>

              <div className="h-4 w-px bg-slate-800 mx-1" />

              <button
                type="button"
                onClick={handleCopyFromLessonMarkdown}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
                title="Sao chép toàn bộ văn bản từ bài viết chính và làm sạch thẻ furigana"
              >
                <Copy className="w-3.5 h-3.5 text-sky-400" />
                <span>Lấy từ bài viết</span>
              </button>

              <button
                type="button"
                onClick={() => updateActiveTrack({ audio_script: '' })}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition-all cursor-pointer"
                title="Xóa trắng kịch bản"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Main 2-column Studio Area */}
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
            {/* Left Column: Script Textarea */}
            <div className="flex-1 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-slate-800">
              <div className="px-6 py-2.5 bg-slate-900/40 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
                <span className="flex items-center gap-2 font-semibold text-slate-300">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  Kịch bản âm thanh (Audio Script) — Độc lập với nội dung bài viết
                </span>
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span>Ký tự: <strong className="text-white">{(activeTrack.audio_script || '').length}</strong></span>
                  <span>Dòng: <strong className="text-white">{(activeTrack.audio_script || '').split('\n').length}</strong></span>
                  <span>Ước tính: <strong className="text-indigo-400">~{Math.round((activeTrack.audio_script || '').length / 6)}s</strong></span>
                </div>
              </div>

              <textarea
                ref={slotScriptTextareaRef}
                value={activeTrack.audio_script || ''}
                onChange={(e) => updateActiveTrack({ audio_script: e.target.value })}
                placeholder={`Nhập kịch bản âm thanh cho Slot ${activeSlotNum} tại đây...
Ví dụ:
あなたにとって最も大切なものは何ですか。その理由も教えてください。
[pause: 2s]
四季の中で、私は秋が一番好きです。
[pause: 1s]
涼しい気候で散歩が気持ちいいです。`}
                className="flex-1 w-full p-6 bg-[#060810] text-slate-200 font-mono text-sm leading-relaxed resize-none focus:outline-none selection:bg-indigo-600/30 overflow-y-auto"
              />
            </div>

            {/* Right Column: Audio Output & Speech Player Test Card */}
            <div className="w-full lg:w-96 bg-slate-900/30 p-6 flex flex-col gap-6 overflow-y-auto shrink-0">
              {/* Card 1: Browser Speech Testing */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-sky-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Trình duyệt Đọc</h4>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold">
                    Web Speech API
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Nghe trực tiếp kịch bản trên bằng giọng đọc của trình duyệt máy bạn (tự động nhận diện tiếng Nhật & tiếng Việt theo từng câu).
                </p>
                <button
                  type="button"
                  onClick={handleToggleBrowserSpeech}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isTestingSpeech
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/25 animate-pulse'
                      : 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/25'
                  }`}
                >
                  {isTestingSpeech ? (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>Dừng đọc trình duyệt</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Nghe thử bằng Trình duyệt</span>
                    </>
                  )}
                </button>
              </div>

              {/* Card 2: AI Pre-generated Audio (Edge-TTS) */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Audio AI Tạo Sẵn</h4>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    activeTrack.audio_url
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {activeTrack.audio_url ? 'Đã tạo MP3' : 'Chưa tạo'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Tổng hợp kịch bản thành file MP3 chất lượng phòng thu (Edge-TTS) với đầy đủ khoảng lặng và lưu trên server.
                </p>

                {activeTrack.audio_url ? (
                  <div className="space-y-3 pt-2">
                    <audio
                      controls
                      src={activeTrack.audio_url}
                      className="w-full h-10 rounded-lg"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Thời lượng: {activeTrack.duration_seconds || 0}s</span>
                      <button
                        type="button"
                        onClick={handleDeleteSlotAudio}
                        className="flex items-center gap-1 text-rose-400 hover:text-rose-300 font-sans cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa file này</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleGenerateSlotAudio}
                  disabled={isGeneratingSlotTTS !== null}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
                >
                  {isGeneratingSlotTTS === activeSlotNum ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang tổng hợp Audio AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{activeTrack.audio_url ? 'Tạo lại Audio AI (Ghi đè)' : 'Tạo Audio AI ngay'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Tips */}
              <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-900/40 text-[11px] text-indigo-300/80 space-y-1.5 leading-relaxed">
                <span className="font-bold text-indigo-300 block">💡 Mẹo quản lý Slot:</span>
                <p>• Kịch bản âm thanh hoàn toàn độc lập với bài viết.</p>
                <p>• Dùng <code>[pause: 2s]</code> để ngắt nhịp suy nghĩ trước khi nghe câu trả lời.</p>
                <p>• Nhấn <strong>Lưu Slot (Ctrl+S)</strong> để lưu kịch bản vào cơ sở dữ liệu.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Code Block Inserter Modal */}
      {isCodeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-sky-400" />
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
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
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-sky-300 focus:outline-none focus:border-sky-500 resize-none"
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
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white shadow-lg shadow-sky-600/25"
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
                <Languages className="w-4 h-4 text-sky-400" />
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Cách đọc Furigana (Hiragana):</label>
                <input
                  type="text"
                  value={furiganaReading}
                  onChange={(e) => setFuriganaReading(e.target.value)}
                  placeholder="Ví dụ: きせつ hoặc りゆう"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              {furiganaKanji && (
                <div className="p-3 bg-slate-950 rounded-xl text-center">
                  <span className="text-xs text-slate-500 block mb-1">Xem trước:</span>
                  <ruby className="text-xl font-bold text-sky-300">
                    {furiganaKanji}
                    <rt className="text-xs text-sky-400">{furiganaReading}</rt>
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
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-xs font-bold text-white shadow-lg shadow-sky-600/25"
              >
                Chèn Furigana
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Paste & Auto-Converter Modal */}
      {isSmartPasteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 sm:p-8 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <ClipboardPaste className="w-5 h-5 text-amber-400" />
                  Dán thông minh & Tự động tạo bài giảng
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Dán bản ghi thô từ Word, PDF, ChatGPT hoặc giáo trình. Hệ thống sẽ tự phân tích đề mục, câu hỏi, câu trả lời, bảng từ vựng và tự động tạo Furigana.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSmartPasteModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <textarea
                  rows={10}
                  value={smartPasteRaw}
                  onChange={(e) => setSmartPasteRaw(e.target.value)}
                  placeholder="Dán nội dung bài học thô vào đây...&#10;Ví dụ:&#10;Câu 1: Bạn thích mùa nào nhất trong năm?&#10;四季の中で、私は秋が一番好きです。&#10;Trong bốn mùa, tôi thích nhất mùa thu.&#10;Từ vựng:&#10;四季: bốn mùa&#10;気候: khí hậu"
                  className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs sm:text-sm font-sans text-slate-200 focus:outline-none focus:border-sky-500 resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="smart-paste-furigana"
                  checked={smartPasteAutoFurigana}
                  onChange={(e) => setSmartPasteAutoFurigana(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-0 bg-slate-800 border-slate-700 cursor-pointer"
                />
                <label htmlFor="smart-paste-furigana" className="text-xs text-slate-300 font-medium cursor-pointer">
                  Tự động nhận diện chữ Hán và gắn phiên âm Furigana (&lt;ruby&gt;漢字&lt;rt&gt;かんじ&lt;/rt&gt;&lt;/ruby&gt;)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsSmartPasteModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!smartPasteRaw.trim() || isConvertingSmartPaste}
                onClick={handleSmartConvert}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-xs font-bold text-white shadow-lg shadow-sky-600/25 transition-all cursor-pointer disabled:opacity-40"
              >
                {isConvertingSmartPaste ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang chuyển đổi & sinh Furigana...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>⚡ Phân tích & Tạo bài giảng</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
