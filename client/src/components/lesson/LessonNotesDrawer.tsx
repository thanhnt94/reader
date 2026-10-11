import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  BookOpen,
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sparkles,
  Copy,
  Trash2,
  Clock
} from 'lucide-react';
import { readerApi, UserLessonNote } from '../../lib/api/readerApi';

interface LessonNotesDrawerProps {
  lessonId: number;
  lessonTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export const LessonNotesDrawer: React.FC<LessonNotesDrawerProps> = ({
  lessonId,
  lessonTitle,
  isOpen,
  onClose,
}) => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load note on mount / when lessonId changes
  useEffect(() => {
    if (!isOpen || !lessonId) return;

    setIsLoading(true);
    readerApi
      .getUserLessonNote(lessonId)
      .then((note) => {
        setContent(note.content || '');
        if (note.updated_at) {
          const d = new Date(note.updated_at);
          setLastSavedTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      })
      .catch((err) => {
        console.warn('Could not load note:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, lessonId]);

  // Auto-save logic (Debounce 1.2s)
  const handleContentChange = (val: string) => {
    setContent(val);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      saveNote(val);
    }, 1200);
  };

  const saveNote = async (textToSave: string) => {
    if (!lessonId) return;
    setIsSaving(true);
    try {
      const saved = await readerApi.saveUserLessonNote(lessonId, textToSave);
      const now = new Date();
      setLastSavedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setStatusMsg({ type: 'success', text: 'Đã tự động lưu' });
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: 'Lưu thất bại' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setStatusMsg({ type: 'success', text: 'Đã sao chép vào clipboard!' });
    setTimeout(() => setStatusMsg(null), 2500);
  };

  const handleClear = () => {
    if (!content.trim()) return;
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ ghi chú của bài học này?')) {
      setContent('');
      saveNote('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      {/* Slide-over Panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#0b1120] border-l border-sky-900/40 text-slate-100 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-white truncate">Sổ Tay Cá Nhân</h3>
                <p className="text-[11px] text-slate-400 truncate max-w-[220px]">{lessonTitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {content && (
                <>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Sao chép nội dung"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                    title="Xóa ghi chú"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sub Status Bar */}
          <div className="px-5 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 shrink-0 font-mono">
            <div className="flex items-center gap-1.5">
              {isSaving ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                  <span className="text-sky-300">Đang lưu...</span>
                </>
              ) : lastSavedTime ? (
                <>
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>Đã lưu lúc {lastSavedTime}</span>
                </>
              ) : (
                <span>Tự động lưu khi gõ</span>
              )}
            </div>

            {statusMsg && (
              <span
                className={`text-[10px] font-bold ${
                  statusMsg.type === 'success' ? 'text-sky-400' : 'text-rose-400'
                }`}
              >
                {statusMsg.text}
              </span>
            )}
          </div>

          {/* Text Editor Area */}
          <div className="flex-1 flex flex-col p-4 bg-[#070a13]">
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
                <div className="w-6 h-6 border-2 border-sky-500/20 border-t-sky-400 rounded-full animate-spin" />
                <span className="text-xs">Đang tải ghi chú...</span>
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Viết ghi chú của bạn cho bài học này...
- Từ vựng mới
- Ngữ pháp cần chú ý
- Ý tưởng phản xạ speaking 45s
(Hệ thống tự động lưu vào tài khoản của bạn)"
                className="flex-1 w-full p-3 bg-transparent text-slate-200 text-xs sm:text-sm leading-relaxed resize-none focus:outline-none placeholder-slate-600 font-sans selection:bg-sky-500/30 selection:text-white"
                spellCheck={false}
              />
            )}
          </div>

          {/* Footer Info */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/90 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
            <span>{content.length} ký tự</span>
            <button
              type="button"
              onClick={() => saveNote(content)}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu ngay</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
