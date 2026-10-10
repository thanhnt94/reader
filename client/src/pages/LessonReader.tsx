import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  ListTree,
  CheckCircle2,
  Circle,
  Volume2,
  ChevronRight,
  ChevronLeft,
  Edit3,
  BookmarkCheck,
  Maximize2,
  Minimize2,
  Type,
  AlignLeft,
  Sparkles,
  BookOpen
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { readerApi, Lesson, Course } from '../lib/api/readerApi';
import { MarkdownRenderer } from '../components/mdx/MarkdownRenderer';
import { AudioPlayer } from '../components/player/AudioPlayer';
import { BrowserSpeechPlayer } from '../components/player/BrowserSpeechPlayer';
import { useAppStore } from '../store/useAppStore';

export default function LessonReader() {
  const { lessonId, lessonSlug, courseSlug, courseId } = useParams<{
    lessonId?: string;
    lessonSlug?: string;
    courseSlug?: string;
    courseId?: string;
  }>();
  const navigate = useNavigate();

  const { settings, updateSettings, user } = useAppStore();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Layout & Drawers
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTOCOpen, setIsTOCOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [isSpeechPlayerOpen, setIsSpeechPlayerOpen] = useState(false);

  // Active Heading (Scrollspy)
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');

  // Target identifier: either slug or ID
  const targetLookup = lessonSlug || lessonId;

  // Load lesson details
  useEffect(() => {
    if (!targetLookup) return;

    setIsLoading(true);
    readerApi
      .getLessonDetail(targetLookup)
      .then((les) => {
        setLesson(les);
        setIsLoading(false);

        // Load full course tree for left sidebar
        if (les.chapter?.course_id) {
          readerApi.getCourseDetail(les.chapter.course_id).then((c) => {
            setCourse(c);
            document.title = `${les.title} — ${c.title}`;
            // Clean up browser URL if navigated via /reader/:id
            if (window.location.pathname.startsWith('/reader/')) {
              window.history.replaceState(null, '', `/courses/${c.slug}/${les.slug}`);
            }
          }).catch(console.error);
        } else {
          document.title = `${les.title} — Reader`;
        }
      })
      .catch((err) => {
        console.error('Failed to load lesson', err);
        setIsLoading(false);
      });
  }, [targetLookup]);

  // Scrollspy: Track active heading on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!lesson?.toc_data || lesson.toc_data.length === 0) return;
      const headings = lesson.toc_data.map((t) => document.getElementById(t.id)).filter(Boolean);
      const scrollPos = window.scrollY + 120;

      for (let i = headings.length - 1; i >= 0; i--) {
        const h = headings[i];
        if (h && h.offsetTop <= scrollPos) {
          setActiveHeadingId(h.id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lesson]);

  // Mark lesson as complete
  const handleToggleComplete = async () => {
    if (!lesson) return;
    const nextStatus = !lesson.progress?.is_completed;

    try {
      await readerApi.updateProgress(lesson.id, { is_completed: nextStatus });
      setLesson({
        ...lesson,
        progress: {
          ...(lesson.progress || { last_scroll_pos: 0, last_audio_pos: 0 }),
          is_completed: nextStatus,
        },
      });

      if (nextStatus) {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.8 },
        });
      }
    } catch (e) {
      console.error('Failed to update progress', e);
    }
  };

  // Find Next / Prev lesson
  let prevLesson: Lesson | null = null;
  let nextLesson: Lesson | null = null;

  if (course?.chapters) {
    const allLessons: Lesson[] = [];
    course.chapters.forEach((ch) => {
      if (ch.lessons) allLessons.push(...ch.lessons);
    });

    const currentIndex = allLessons.findIndex((l) => l.id === Number(lessonId));
    if (currentIndex > 0) prevLesson = allLessons[currentIndex - 1];
    if (currentIndex >= 0 && currentIndex < allLessons.length - 1) {
      nextLesson = allLessons[currentIndex + 1];
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-emerald-500/20 border-t-emerald-500 animate-spin" />
          <span className="text-sm font-medium">Loading Lesson Content...</span>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-slate-400">
        <div className="text-center space-y-3">
          <p className="text-lg text-white font-bold">Lesson Not Found</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = lesson.progress?.is_completed;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 h-14 bg-slate-900/90 border-b border-slate-800 backdrop-blur-xl px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Sidebar Toggle */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Breadcrumb Title */}
          <div className="min-w-0 flex items-center gap-2 text-xs truncate">
            <span
              onClick={() => navigate('/')}
              className="text-emerald-400 font-bold hover:underline cursor-pointer shrink-0"
            >
              Reader
            </span>
            {course && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span
                  onClick={() => navigate(`/courses/${course.slug || course.id}`)}
                  className="text-slate-400 hover:text-emerald-400 cursor-pointer truncate hidden sm:inline"
                  title="View Course Dashboard"
                >
                  {course.title}
                </span>
              </>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="text-slate-200 font-semibold truncate">{lesson.title}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Admin Edit Shortcut */}
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => navigate(`/editor/${lesson.id}`)}
              title="Edit in WYSIWYG Editor"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Edit3 className="w-4 h-4 text-emerald-400" />
            </button>
          )}

          {/* Font Size & Spacing Controls */}
          <div className="hidden md:flex items-center rounded-xl bg-slate-800/80 p-0.5 text-xs text-slate-400">
            {(['sm', 'base', 'lg'] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => updateSettings({ font_size: sz })}
                className={`px-2 py-1 rounded-lg uppercase text-[10px] font-bold transition-colors ${settings.font_size === sz ? 'bg-slate-700 text-emerald-400 shadow-xs' : 'hover:text-white'}`}
              >
                {sz}
              </button>
            ))}
          </div>

          {/* Focus Mode */}
          <button
            type="button"
            onClick={() => setFocusMode(!focusMode)}
            title={focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors hidden sm:block"
          >
            {focusMode ? <Minimize2 className="w-4 h-4 text-emerald-400" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Mobile TOC Toggle */}
          <button
            type="button"
            onClick={() => setIsTOCOpen(!isTOCOpen)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors lg:hidden"
          >
            <ListTree className="w-4 h-4" />
          </button>

          {/* Browser Native Speech Engine TTS */}
          <button
            type="button"
            onClick={() => setIsSpeechPlayerOpen(!isSpeechPlayerOpen)}
            title="Listen with Browser Native Speech Engine (Auto-detects Japanese/Vietnamese & cleans Furigana)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isSpeechPlayerOpen
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700/60'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Speech TTS</span>
          </button>

          {/* Mark Completed Button */}
          <button
            type="button"
            onClick={handleToggleComplete}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${isCompleted ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60'}`}
          >
            <BookmarkCheck className={`w-3.5 h-3.5 ${isCompleted ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">{isCompleted ? 'Completed' : 'Mark Done'}</span>
          </button>
        </div>
      </header>

      {/* 3-Column Document Body */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full pb-28">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Course Tree Sidebar (Collapsible)           */}
        {/* ========================================================= */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'} ${focusMode ? 'lg:hidden' : ''}`}
        >
          {/* Mobile Close Button */}
          <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800 lg:hidden">
            <span className="font-bold text-sm text-white">Course Navigation</span>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Course Title Badge */}
          {course && (
            <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Course</span>
              </div>
              <h3 className="font-bold text-sm text-white truncate">{course.title}</h3>
            </div>
          )}

          {/* Chapter & Lesson Tree */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
            {course?.chapters?.map((chap, cIdx) => (
              <div key={chap.id} className="space-y-1">
                <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>{chap.title}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {chap.lessons?.length || 0}
                  </span>
                </div>

                <div className="space-y-0.5">
                  {chap.lessons?.map((les) => {
                    const isCurrent = les.id === lesson.id || les.slug === targetLookup;
                    const lesCompleted = les.progress?.is_completed;

                    return (
                      <button
                        key={les.id}
                        type="button"
                        onClick={() => {
                          navigate(course ? `/courses/${course.slug || course.id}/${les.slug || les.id}` : `/reader/${les.id}`);
                          setIsSidebarOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 transition-all cursor-pointer ${isCurrent ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {lesCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          )}
                          <span className="truncate">{les.title}</span>
                        </div>
                        {les.audio_url && (
                          <Volume2 className="w-3 h-3 text-emerald-400/80 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Sidebar Overlay on Mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* ========================================================= */}
        {/* CENTER COLUMN: Main Reading Article Content               */}
        {/* ========================================================= */}
        <main className="flex-1 min-w-0 px-4 sm:px-8 md:px-12 py-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            {/* Article Header */}
            <div className="border-b border-slate-800/80 pb-6 mb-8">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
                {lesson.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                {lesson.audio_url && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>TTS Audio Available</span>
                  </div>
                )}
                {isCompleted && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-200 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Completed</span>
                  </div>
                )}
              </div>
            </div>

            {/* Markdown Body */}
            <MarkdownRenderer
              content={lesson.raw_markdown || ''}
              fontSize={settings.font_size}
              lineSpacing={settings.line_spacing}
            />

            {/* Bottom Lesson Navigation */}
            <div className="mt-12 pt-8 border-t border-slate-800 flex items-center justify-between gap-4">
              {prevLesson ? (
                <button
                  type="button"
                  onClick={() => navigate(course ? `/courses/${course.slug || course.id}/${prevLesson?.slug || prevLesson?.id}` : `/reader/${prevLesson?.id}`)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">
                    {prevLesson.title}
                  </span>
                </button>
              ) : (
                <div />
              )}

              {nextLesson && (
                <button
                  type="button"
                  onClick={() => navigate(course ? `/courses/${course.slug || course.id}/${nextLesson?.slug || nextLesson?.id}` : `/reader/${nextLesson?.id}`)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">
                    {nextLesson.title}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </main>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Sticky Table of Contents (Scrollspy)        */}
        {/* ========================================================= */}
        {lesson.toc_data && lesson.toc_data.length > 0 && !focusMode && (
          <aside className="hidden lg:block w-64 shrink-0 p-6 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto text-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <ListTree className="w-3.5 h-3.5 text-emerald-400" />
              <span>Table of Contents</span>
            </div>

            <nav className="space-y-1">
              {lesson.toc_data.map((item) => {
                const isActive = activeHeadingId === item.id;
                const indentClass = item.level === 3 ? 'pl-4' : 'pl-1.5';

                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const el = document.getElementById(item.id);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth' });
                        setActiveHeadingId(item.id);
                      }
                    }}
                    className={`block py-1 text-[11px] leading-relaxed transition-colors truncate rounded-md ${indentClass} ${isActive ? 'text-emerald-400 font-bold border-l-2 border-emerald-400 pl-2 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    {item.text}
                  </a>
                );
              })}
            </nav>
          </aside>
        )}
      </div>

      {/* Mobile TOC Drawer Sheet */}
      {isTOCOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
            onClick={() => setIsTOCOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 p-6 bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[70vh] overflow-y-auto lg:hidden animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <span className="font-bold text-sm text-white flex items-center gap-2">
                <ListTree className="w-4 h-4 text-emerald-400" />
                Table of Contents
              </span>
              <button
                type="button"
                onClick={() => setIsTOCOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {lesson.toc_data?.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setIsTOCOpen(false);
                    const el = document.getElementById(item.id);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`block py-1.5 text-xs text-slate-300 hover:text-emerald-400 ${item.level === 3 ? 'pl-4' : 'pl-1'}`}
                >
                  {item.text}
                </a>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Browser Native Speech Player */}
      <BrowserSpeechPlayer
        rawMarkdown={lesson.raw_markdown || ''}
        title={lesson.title}
        isOpen={isSpeechPlayerOpen}
        onClose={() => setIsSpeechPlayerOpen(false)}
      />

      {/* Docked Audio Player */}
      {lesson.audio_url && (
        <AudioPlayer
          audioUrl={lesson.audio_url}
          title={lesson.title}
          duration={lesson.duration_seconds}
        />
      )}

      {/* Mobile Docked Bottom Action Bar (Thumb Reachable) */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-slate-900/95 border-t border-slate-800 backdrop-blur-xl px-2 py-1.5 flex items-center justify-around lg:hidden shadow-2xl">
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <Menu className="w-4 h-4" />
          <span className="text-[10px] font-medium">Lessons</span>
        </button>

        <button
          type="button"
          onClick={() => setIsSpeechPlayerOpen(!isSpeechPlayerOpen)}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-colors cursor-pointer ${
            isSpeechPlayerOpen ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          <span className="text-[10px] font-medium">Speech</span>
        </button>

        {lesson.toc_data && lesson.toc_data.length > 0 && (
          <button
            type="button"
            onClick={() => setIsTOCOpen(true)}
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ListTree className="w-4 h-4" />
            <span className="text-[10px] font-medium">Outline</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleToggleComplete}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-colors cursor-pointer ${
            isCompleted ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookmarkCheck className="w-4 h-4" />
          <span className="text-[10px] font-medium">{isCompleted ? 'Done' : 'Mark'}</span>
        </button>

        {nextLesson && (
          <button
            type="button"
            onClick={() =>
              navigate(
                course
                  ? `/courses/${course.slug || course.id}/${nextLesson.slug || nextLesson.id}`
                  : `/reader/${nextLesson.id}`
              )
            }
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer font-bold"
          >
            <ChevronRight className="w-4 h-4" />
            <span className="text-[10px] font-medium">Next</span>
          </button>
        )}
      </div>
    </div>
  );
}
