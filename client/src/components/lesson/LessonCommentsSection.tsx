import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Trash2,
  Reply,
  CornerDownRight,
  User as UserIcon,
  X,
  Sparkles,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { readerApi, LessonComment } from '../../lib/api/readerApi';
import { useAppStore } from '../../store/useAppStore';

interface LessonCommentsSectionProps {
  lessonId: number;
  isOpen?: boolean;
  onClose?: () => void;
  isDrawer?: boolean;
}

export const LessonCommentsSection: React.FC<LessonCommentsSectionProps> = ({
  lessonId,
  isOpen = true,
  onClose,
  isDrawer = false,
}) => {
  const { user } = useAppStore();
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm('Xác nhận xóa bình luận này?')) return;
    try {
      await readerApi.deleteLessonComment(lessonId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_id !== commentId));
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
    <div className="flex flex-col h-full text-slate-100 font-sans">
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
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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
            <p className="text-[11px] text-slate-500 mt-1">Hãy là người đầu tiên đặt câu hỏi hoặc chia sẻ ý kiến!</p>
          </div>
        ) : (
          topLevelComments.map((comment) => {
            const replies = repliesByParentId[comment.id] || [];
            const isAuthor = user?.id === comment.user_id;
            const canDelete = isAuthor || user?.role === 'admin';

            return (
              <div key={comment.id} className="space-y-3">
                {/* Main Comment Card */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 text-xs font-bold">
                        {comment.user?.username?.[0]?.toUpperCase() || <UserIcon className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white leading-none">
                            {comment.user?.full_name || comment.user?.username || 'Học viên'}
                          </span>
                          {comment.user?.role === 'admin' && (
                            <span className="px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30 text-[9px] font-bold flex items-center gap-0.5">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              Admin
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(comment.created_at).toLocaleString([], {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingToId(replyingToId === comment.id ? null : comment.id);
                          setReplyText('');
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors text-xs flex items-center gap-1 cursor-pointer"
                        title="Trả lời"
                      >
                        <Reply className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Trả lời</span>
                      </button>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
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
                        placeholder={`Trả lời @${comment.user?.username}...`}
                        className="flex-1 bg-slate-900 border border-sky-500/50 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
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
                        className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        Gửi
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

                      return (
                        <div
                          key={reply.id}
                          className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 text-[11px] font-bold">
                                {reply.user?.username?.[0]?.toUpperCase() || 'U'}
                              </div>
                              <span className="text-xs font-semibold text-white">
                                {reply.user?.full_name || reply.user?.username || 'Học viên'}
                              </span>
                              {reply.user?.role === 'admin' && (
                                <span className="px-1 py-0.2 rounded bg-sky-500/10 text-sky-400 text-[9px] font-bold">
                                  Admin
                                </span>
                              )}
                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(reply.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>

                            {canDeleteReply && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(reply.id)}
                                className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
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

      {/* New Comment Input Box */}
      <form onSubmit={handlePostComment} className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/90 shrink-0">
        <div className="flex items-center gap-2">
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
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-sky-600/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Gửi</span>
          </button>
        </div>
      </form>
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
