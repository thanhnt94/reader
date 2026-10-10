import React, { useState } from 'react';
import { BookOpen, X, Sparkles, Languages, Flame, GraduationCap, CheckCircle2 } from 'lucide-react';
import { readerApi, Course } from '../../lib/api/readerApi';

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (course: Course) => void;
}

const ICON_OPTIONS = [
  { id: 'fas fa-book-open', label: 'Book', Icon: BookOpen },
  { id: 'fas fa-graduation-cap', label: 'Academic', Icon: GraduationCap },
  { id: 'fas fa-language', label: 'Language', Icon: Languages },
  { id: 'fas fa-fire', label: 'Fire', Icon: Flame },
  { id: 'fas fa-sparkles', label: 'Sparkles', Icon: Sparkles },
];

export const CreateCourseModal: React.FC<CreateCourseModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('fas fa-book-open');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter a course title');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const created = await readerApi.createCourse({
        title: title.trim(),
        description: description.trim(),
        icon: selectedIcon,
      });
      setTitle('');
      setDescription('');
      onCreated(created);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to create course');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-7 shadow-2xl relative text-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Create New Course</h3>
            <p className="text-xs text-slate-400">Set up a course container for chapters & lessons</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl text-xs font-semibold mb-4 bg-rose-500/10 text-rose-300 border border-rose-500/20">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Course Title <span className="text-emerald-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. JSST Speaking Mastery, JLPT N1..."
              className="w-full bg-slate-800/70 border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summary of this course, objectives, audience..."
              className="w-full bg-slate-800/70 border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Course Icon
            </label>
            <div className="flex gap-2">
              {ICON_OPTIONS.map((item) => {
                const IconComponent = item.Icon;
                const isSelected = selectedIcon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedIcon(item.id)}
                    className={`flex-1 py-2 rounded-xl flex flex-col items-center gap-1 text-[11px] font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-xs'
                        : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
