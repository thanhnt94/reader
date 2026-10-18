import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  Trash2,
  Reply,
  User as UserIcon,
  X,
  ShieldCheck,
  GraduationCap,
  LogIn,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { readerApi, LessonComment } from '../../lib/api/readerApi';
import { useAppStore } from '../../store/useAppStore';

interface LessonCommentsSectionProps {
  lessonId: number;
  isOpen?: boolean;
  onClose?: () => void;
  isDrawer?: boolean;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 45) return 'Vừa xong';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
    if (diffSec < 172800) {
      return `Hôm qua lúc ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const LessonCommentsSection: React.FC<LessonCommentsSectionProps> = ({
  lessonId,
  isOpen = true,
  onClose,
  isDrawer = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoggedIn } = useAppStore();

  const [comments, setComments] = useState<LessonComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<number | null>(null);

  const loadComments = () => {
    if (!lessonId) return;
    setIsLoading(true);
    readerApi
      .getLessonComments(lessonId)
      .then(setComments)
      .catch((e) => console.warn('Could not load comments:', e))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (lessonId && isOpen) {
      loadComments();
    }
  }, [lessonId, isOpen]);

  const handleNavigateToLogin = () => {
    const currentPath = location.pathname + location.search;
    navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      handleNavigateToLogin();
      return;
    }
    if (!newCommentText.trim()) return;

    setIsSubmitting(true);
    try {
      await readerApi.postLessonComment(lessonId, newCommentText.trim());
      setNewCommentText('');
      loadComments();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Không thể gửi bình luận');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostReply = async (parentId: number) => {
    if (!isLoggedIn) {
      handleNavigateToLogin();
      return;
    }
    if (!replyText.trim()) return;

    setIsSubmitting(true);
    try {
      await readerApi.postLessonComment(lessonId, replyText.trim(), parentId);
      setReplyText('');
      setReplyingToId(null);
      loadComments();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Không thể gửi câu trả lời');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!commentToDelete) return;
    try {
      await readerApi.deleteLessonComment(lessonId, commentToDelete);
      setComments((prev) => prev.filter((c) => c.id !== commentToDelete && c.parent_id !== commentToDelete));
      setCommentToDelete(null);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Không thể xóa bình luận');
    }
  };

  if (!isOpen) return null;

  // Separate top-level comments and replies
  const topLevelComments = comments.filter((c) => !c.parent_id);
  const repliesByParentId: Record<number, LessonComment[]> = {};
  comments.forEach((c) => {
    if (c.parent_id) {
      if (!repliesByParentId[c.parent_id]) repliesByParentId[c.parent_id] = [];
      repliesByParentId[c.parent_id].push(c);
    }
  });

  const contentUI = (
    <div className="flex flex-col h-full text-slate-100 font-sans relative">
      {/* Header if in Drawer mode */}
      {isDrawer && (
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Thảo Luận & Hỏi Đáp</h3>
              <p className="text-[11px] text-slate-400">{comments.length} bình luận</p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Main Comment List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
            <div className="w-6 h-6 border-2 border-sky-500/20 border-t-sky-400 rounded-full animate-spin" />
            <span className="text-xs">Đang tải bình luận...</span>
          </div>
        ) : topLevelComments.length === 0 ? (
          <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl p-6">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="text-xs font-semibold text-slate-400">Chưa có bình luận nào</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {isLoggedIn
                ? 'Hãy là người đầu tiên đặt câu hỏi hoặc chia sẻ ý kiến!'
                : 'Đăng nhập để là người đầu tiên tham gia thảo luận bài học này.'}
            </p>
          </div>
        ) : (
          topLevelComments.map((comment) => {
            const replies = repliesByParentId[comment.id] || [];
            const isAuthor = user?.id === comment.user_id;
            const canDelete = isAuthor || user?.role === 'admin';
            const authorInitial = (comment.user?.full_name || comment.user?.username || 'U')[0].toUpperCase();
            const isAdmin = comment.user?.role === 'admin';

            return (
              <div key={comment.id} className="space-y-3">
                {/* Main Comment Card */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center text-slate-950 text-xs font-black shadow-xs shrink-0">
                        {authorInitial}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white truncate max-w-[140px] sm:max-w-[200px]">
                            {comment.user?.full_name || comment.user?.username || 'Học viên'}
                          </span>
                          {isAdmin ? (
                            <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] font-bold flex items-center gap-0.5 shrink-0">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              Admin
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[9px] font-medium flex items-center gap-0.5 shrink-0">
                              <GraduationCap className="w-2.5 h-2.5" />
                              Học viên
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {formatRelativeTime(comment.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isLoggedIn) {
                            handleNavigateToLogin();
                            return;
                          }
                          setReplyingToId(replyingToId === comment.id ? null : comment.id);
                          setReplyText('');
                        }}
                        className="px-2 py-1 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors text-xs flex items-center gap-1 cursor-pointer"
                        title="Trả lời"
                      >
                        <Reply className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Trả lời</span>
                      </button>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setCommentToDelete(comment.id)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Xóa bình luận"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap pl-9">
                    {comment.content}
                  </p>
                </div>

                {/* Reply Box if Active */}
                {replyingToId === comment.id && (
                  <div className="pl-9 space-y-2 animate-in slide-in-from-top-1">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        autoFocus
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`Trả lời @${comment.user?.username || 'bạn học'}...`}
                        className="flex-1 bg-slate-900 border border-sky-500/50 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handlePostReply(comment.id);
                          }
                        }}
                      />
                      <button
                        type="button"
                        disabled={isSubmitting || !replyText.trim()}
                        onClick={() => handlePostReply(comment.id)}
                        className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Gửi'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingToId(null);
                          setReplyText('');
                        }}
                        className="px-2.5 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}

                {/* Nested Replies */}
                {replies.length > 0 && (
                  <div className="pl-8 space-y-2.5 border-l-2 border-slate-800/80 ml-4">
                    {replies.map((reply) => {
                      const isReplyAuthor = user?.id === reply.user_id;
                      const canDeleteReply = isReplyAuthor || user?.role === 'admin';
                      const replyInitial = (reply.user?.full_name || reply.user?.username || 'U')[0].toUpperCase();
                      const isReplyAdmin = reply.user?.role === 'admin';

                      return (
                        <div
                          key={reply.id}
                          className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 text-[10px] font-bold">
                                {replyInitial}
                              </div>
                              <span className="text-xs font-semibold text-white">
                                {reply.user?.full_name || reply.user?.username || 'Học viên'}
                              </span>
                              {isReplyAdmin && (
                                <span className="px-1 py-0.2 rounded bg-cyan-500/15 text-cyan-300 text-[9px] font-bold">
                                  Admin
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400">
                                {formatRelativeTime(reply.created_at)}
                              </span>
                            </div>

                            {canDeleteReply && (
                              <button
                                type="button"
                                onClick={() => setCommentToDelete(reply.id)}
                                className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Xóa câu trả lời"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed pl-8 whitespace-pre-wrap">
                            {reply.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Area: Auth Wall or Comment Input */}
      {isLoggedIn ? (
        <form onSubmit={handlePostComment} className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center text-slate-950 text-xs font-black shrink-0 hidden sm:flex">
              {(user?.full_name || user?.username || 'U')[0].toUpperCase()}
            </div>
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Viết bình luận, đặt câu hỏi về bài học..."
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newCommentText.trim()}
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-sky-600/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Gửi</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* ======================================================== */
        /* AUTH WALL: Elegant login callout for guests              */
        /* ======================================================== */
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-800/40 border border-sky-500/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                <LogIn className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Tham gia thảo luận cùng cộng đồng</p>
                <p className="text-[11px] text-slate-400">
                  Đăng nhập tài khoản InMind để đặt câu hỏi, chia sẻ mẹo học tập và tương tác.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleNavigateToLogin}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <LogIn className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Đăng nhập ngay</span>
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {commentToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-[#0f172a] border border-slate-700 p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="font-bold text-sm text-white">Xác nhận xóa bình luận</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Bạn có chắc chắn muốn xóa bình luận này? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCommentToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/25 cursor-pointer"
              >
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isDrawer) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden font-sans">
        <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in" />
        <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
          <div className="w-screen max-w-md bg-[#0b1120] border-l border-sky-900/40 shadow-2xl animate-in slide-in-from-right duration-300">
            {contentUI}
          </div>
        </div>
      </div>
    );
  }

  // Inline section (embedded at bottom of lesson reader)
  return (
    <section className="mt-12 pt-8 border-t border-slate-800">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
          <MessageSquare className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-bold text-base text-white">Thảo Luận & Hỏi Đáp</h3>
          <p className="text-xs text-slate-400">Đặt câu hỏi hoặc chia sẻ kinh nghiệm học tập về bài học này</p>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden min-h-[300px]">
        {contentUI}
      </div>
    </section>
  );
};
