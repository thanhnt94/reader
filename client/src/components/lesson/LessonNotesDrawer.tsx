import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  X,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileText,
  Copy,
  Trash2,
  Clock,
  LogIn,
  Loader2,
  Maximize2,
  Minimize2,
  Sparkles
} from 'lucide-react';
import { readerApi } from '../../lib/api/readerApi';
import { useAppStore } from '../../store/useAppStore';

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
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoggedIn } = useAppStore();

  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load note only when authenticated and drawer is open
  useEffect(() => {
    if (!isOpen || !lessonId || !isLoggedIn) return;

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
  }, [isOpen, lessonId, isLoggedIn]);

  const handleNavigateToLogin = () => {
    const currentPath = location.pathname + location.search;
    navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
  };

  // Auto-save logic (Debounce 1.2s)
  const handleContentChange = (val: string) => {
    setContent(val);
    if (!isLoggedIn) return;

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      saveNote(val);
    }, 1200);
  };

  const saveNote = async (textToSave: string) => {
    if (!lessonId || !isLoggedIn) return;
    setIsSaving(true);
    try {
      await readerApi.saveUserLessonNote(lessonId, textToSave);
      const now = new Date();
      setLastSavedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setStatusMsg({ type: 'success', text: 'Đã tự động lưu lên đám mây' });
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

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div
          className={`h-full bg-[#0b1120] border-l border-sky-900/40 shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right ${
            isExpanded ? 'w-screen max-w-3xl' : 'w-screen max-w-md'
          }`}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-white truncate">Sổ Tay Ghi Chú Cá Nhân</h3>
                <p className="text-[11px] text-slate-400 truncate max-w-[200px] sm:max-w-xs">
                  {lessonTitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors hidden sm:block cursor-pointer"
                title={isExpanded ? 'Thu gọn' : 'Phóng to'}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          {!isLoggedIn ? (
            /* ======================================================== */
            /* AUTH WALL: Login Prompt for Guests                       */
            /* ======================================================== */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-3xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-4 shadow-lg shadow-sky-500/10">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-white mb-2">Đồng Bộ Ghi Chú Trên Đám Mây</h4>
              <p className="text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">
                Sổ tay ghi chú cá nhân được lưu trữ bảo mật và đồng bộ tức thì theo tài khoản InMind của bạn trên mọi thiết bị.
              </p>
              <button
                type="button"
                onClick={handleNavigateToLogin}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4 stroke-[2.5]" />
                <span>Đăng nhập để ghi chép</span>
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              <span className="text-xs">Đang tải ghi chú...</span>
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-hidden">
              {/* Textarea container */}
              <div className="flex-1 relative flex flex-col">
                <textarea
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Ghi chú kiến thức quan trọng, từ vựng mới hoặc suy nghĩ của bạn về bài học này..."
                  className="flex-1 w-full bg-slate-900/60 border border-slate-800 focus:border-sky-500/60 rounded-2xl p-4 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed font-sans transition-colors"
                />
              </div>

              {/* Status and Action Bar */}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-2 text-[11px]">
                  {isSaving ? (
                    <span className="flex items-center gap-1.5 text-sky-400 font-medium">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Đang lưu...
                    </span>
                  ) : lastSavedTime ? (
                    <span className="flex items-center gap-1 text-slate-400">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Đã lưu lúc {lastSavedTime}
                    </span>
                  ) : (
                    <span>Tự động lưu khi gõ</span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400 px-2 font-mono">
                    {wordCount} từ · {charCount} ký tự
                  </span>

                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!content.trim()}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
                    title="Sao chép toàn bộ"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={!content.trim()}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
                    title="Xóa ghi chú"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Status Toast */}
              {statusMsg && (
                <div
                  className={`mt-2 p-2 rounded-xl text-center text-xs font-medium animate-in fade-in duration-200 ${
                    statusMsg.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {statusMsg.text}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
