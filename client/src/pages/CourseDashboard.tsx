import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  BookOpen,
  ArrowLeft,
  PlayCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  FolderUp,
  ChevronDown,
  ChevronRight,
  Volume2,
  Layers,
  Filter,
  BarChart2,
  FileText,
  AlertTriangle,
  RotateCcw,
  Check,
  ChevronUp
} from 'lucide-react';
import { readerApi, Course, Chapter, Lesson } from '../lib/api/readerApi';
import { useAppStore } from '../store/useAppStore';
import { CourseManagerModal } from '../components/course/CourseManagerModal';

export default function CourseDashboard() {
  const { courseSlugOrId } = useParams<{ courseSlugOrId: string }>();
  const navigate = useNavigate();
  const { user } = useAppStore();

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'completed'>('all');
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});

  // Course Manager Modal State
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);

  // Load Course Details
  const loadCourse = async () => {
    if (!courseSlugOrId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await readerApi.getCourseDetail(courseSlugOrId);
      setCourse(data);

      // Default expand all chapters
      if (data.chapters) {
        const initialExpanded: Record<number, boolean> = {};
        data.chapters.forEach((ch) => {
          initialExpanded[ch.id] = true;
        });
        setExpandedChapters(initialExpanded);
      }
    } catch (err: any) {
      console.error('Failed to load course details:', err);
      setError(err?.response?.data?.detail || 'Course not found or network error.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCourse();
  }, [courseSlugOrId]);

  // Aggregate Lessons & Stats
  const allLessons = useMemo(() => {
    if (!course?.chapters) return [];
    const list: Lesson[] = [];
    course.chapters.forEach((chap) => {
      if (chap.lessons) {
        list.push(...chap.lessons);
      }
    });
    return list;
  }, [course]);

  const totalLessons = allLessons.length;
  const completedLessons = useMemo(() => {
    return allLessons.filter((l) => l.progress?.is_completed).length;
  }, [allLessons]);

  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Next Lesson to Study (first uncompleted or first lesson)
  const nextLesson = useMemo(() => {
    if (!allLessons.length) return null;
    const uncompleted = allLessons.find((l) => !l.progress?.is_completed);
    return uncompleted || allLessons[0];
  }, [allLessons]);

  // JSST Missing Questions Analysis (from 1 to 87)
  const missingAnalysis = useMemo(() => {
    if (!course || course.slug !== 'jsst') return null;

    const foundNums = new Set<number>();
    allLessons.forEach((l) => {
      const numMatches = l.title.match(/\b\d+\b/) || l.slug.match(/\d+/g);
      if (numMatches) {
        const n = parseInt(numMatches[0], 10);
        if (n >= 1 && n <= 87) {
          foundNums.add(n);
        }
      }
    });

    const expected = Array.from({ length: 87 }, (_, i) => i + 1);
    const missing = expected.filter((num) => !foundNums.has(num));
    return {
      totalExpected: 87,
      totalPresent: foundNums.size,
      missingList: missing
    };
  }, [course, allLessons]);

  // Toggle chapter accordion
  const toggleChapter = (chapterId: number) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId]
    }));
  };

  const expandAll = () => {
    if (!course?.chapters) return;
    const updated: Record<number, boolean> = {};
    course.chapters.forEach((c) => {
      updated[c.id] = true;
    });
    setExpandedChapters(updated);
  };

  const collapseAll = () => {
    if (!course?.chapters) return;
    const updated: Record<number, boolean> = {};
    course.chapters.forEach((c) => {
      updated[c.id] = false;
    });
    setExpandedChapters(updated);
  };

  // Filter lessons per chapter
  const filteredChapters = useMemo(() => {
    if (!course?.chapters) return [];
    const q = searchQuery.trim().toLowerCase();

    return course.chapters
      .map((chap) => {
        const lessons = (chap.lessons || []).filter((l) => {
          // Status filter
          if (filterStatus === 'completed' && !l.progress?.is_completed) return false;
          if (filterStatus === 'unread' && l.progress?.is_completed) return false;

          // Search query filter
          if (!q) return true;
          const matchTitle = l.title.toLowerCase().includes(q);
          const matchSlug = l.slug.toLowerCase().includes(q);
          return matchTitle || matchSlug;
        });

        return {
          ...chap,
          filteredLessons: lessons
        };
      })
      .filter((chap) => chap.filteredLessons.length > 0 || !searchQuery);
  }, [course, searchQuery, filterStatus]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col items-center justify-center font-sans">
        <div className="w-12 h-12 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-400">Loading course dashboard...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4 text-2xl font-bold">
          ⚠️
        </div>
        <h2 className="text-xl font-bold mb-2">Course Not Found</h2>
        <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
          {error || `Could not find course '${courseSlugOrId}'. Please verify the URL or return to library.`}
        </p>
        <Link
          to="/courses"
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Library</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-white pb-24">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 bg-[#0b0f19]/80 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/courses"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="Back to All Courses"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Library</span>
          </Link>
          <div className="h-4 w-px bg-slate-800 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold tracking-wide uppercase">
              Course
            </span>
            <h1 className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">
              {course.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => setIsManagerModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold border border-slate-700/60 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title="Upload & Manage Markdown Files"
            >
              <FolderUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Course Studio</span>
            </button>
          )}

          {nextLesson && (
            <Link
              to={`/courses/${course.slug || course.id}/${nextLesson.slug || nextLesson.id}`}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/25 flex items-center gap-2"
            >
              <PlayCircle className="w-4 h-4" />
              <span>{completedLessons === 0 ? 'Start Learning' : 'Continue'}</span>
            </Link>
          )}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 pt-8 space-y-8">
        {/* Hero Course Overview Card */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-emerald-950/20 border border-slate-800/80 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl font-bold shadow-lg shadow-emerald-500/10">
                  {course.icon?.startsWith('fa') ? <BookOpen className="w-6 h-6" /> : (course.icon || '⛩️')}
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {course.title}
                  </h2>
                  <p className="text-xs font-medium text-emerald-400/90 flex items-center gap-2 mt-0.5">
                    <span>Slug:</span>
                    <code className="bg-slate-800/90 px-1.5 py-0.5 rounded text-[11px] text-emerald-300">
                      /courses/{course.slug}
                    </code>
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed font-normal pt-1">
                {course.description ||
                  'Interactive Japanese practice course with speech audio, ruby furigana rendering, and comprehensive lesson materials.'}
              </p>

              {/* Metric Badges */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-slate-300">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{course.chapters?.length || 0} Chapters</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-slate-300">
                  <FileText className="w-3.5 h-3.5 text-teal-400" />
                  <span>{totalLessons} Lessons</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{completedLessons} / {totalLessons} Completed</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-slate-300">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Native Speech TTS</span>
                </div>
              </div>
            </div>

            {/* Quick Action & Progress Box */}
            <div className="w-full md:w-80 rounded-2xl bg-slate-950/50 border border-slate-800/80 p-5 space-y-4 backdrop-blur-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
                  <span className="flex items-center gap-1.5">
                    <BarChart2 className="w-4 h-4 text-emerald-400" />
                    Overall Progress
                  </span>
                  <span className="text-emerald-400 font-mono">{progressPct}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-700 shadow-sm"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {nextLesson && (
                <div className="pt-1">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Next Up
                  </div>
                  <Link
                    to={`/courses/${course.slug || course.id}/${nextLesson.slug || nextLesson.id}`}
                    className="group block p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="truncate pr-2">
                        <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                          {nextLesson.title}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Click to continue reading</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Missing Questions Notification (For JSST Course) */}
        {missingAnalysis && missingAnalysis.missingList.length > 0 && (
          <section className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 backdrop-blur-md">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-amber-300">
                    Missing Syllabus Questions ({missingAnalysis.totalPresent} / {missingAnalysis.totalExpected} questions)
                  </h3>
                  {user?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => setIsManagerModalOpen(true)}
                      className="text-xs font-bold text-amber-300 hover:text-white underline cursor-pointer"
                    >
                      Open Course Studio to Upload &rarr;
                    </button>
                  )}
                </div>
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  Currently missing <strong>{missingAnalysis.missingList.length} questions</strong> from the 1–87 sequence:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {missingAnalysis.missingList.map((num) => (
                    <span
                      key={num}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-mono font-bold"
                    >
                      Câu {String(num).padStart(2, '0')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Syllabus Controls (Search, Filters, Accordion toggles) */}
        <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search lesson by title or question number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:outline-none text-xs text-white placeholder-slate-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Status Tabs & Accordion Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterStatus === 'all'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({totalLessons})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('unread')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterStatus === 'unread'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Unread ({totalLessons - completedLessons})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('completed')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterStatus === 'completed'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Completed ({completedLessons})
              </button>
            </div>

            <div className="flex items-center gap-1.5 pl-1">
              <button
                type="button"
                onClick={expandAll}
                className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-slate-400 hover:text-white transition-colors"
                title="Expand All Chapters"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-slate-400 hover:text-white transition-colors"
                title="Collapse All Chapters"
              >
                Collapse All
              </button>
            </div>
          </div>
        </section>

        {/* Chapters & Lessons Syllabus Accordion */}
        <section className="space-y-4">
          {filteredChapters.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-slate-800 rounded-3xl p-8 bg-slate-900/30">
              <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-white mb-1">No Lessons Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                No lessons matched your search query or filter criteria.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            filteredChapters.map((chap) => {
              const isExpanded = expandedChapters[chap.id] ?? true;
              const chapTotal = chap.lessons?.length || 0;
              const chapCompleted = (chap.lessons || []).filter((l) => l.progress?.is_completed).length;
              const chapProgress = chapTotal > 0 ? Math.round((chapCompleted / chapTotal) * 100) : 0;

              return (
                <div
                  key={chap.id}
                  className="rounded-2xl bg-slate-900/70 border border-slate-800/80 overflow-hidden shadow-lg transition-all"
                >
                  {/* Chapter Header */}
                  <div
                    onClick={() => toggleChapter(chap.id)}
                    className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold">
                        {chap.order_num || 1}
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                          {chap.title}
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {chap.filteredLessons.length} {chap.filteredLessons.length === 1 ? 'lesson' : 'lessons'}
                          {chapTotal > chap.filteredLessons.length && ` (filtered from ${chapTotal})`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Chapter Progress Pill */}
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${chapProgress}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 font-semibold">
                          {chapCompleted}/{chapTotal}
                        </span>
                      </div>

                      <div className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Lessons List inside Chapter */}
                  {isExpanded && (
                    <div className="border-t border-slate-800/60 divide-y divide-slate-800/50 bg-slate-950/40">
                      {chap.filteredLessons.map((lesson) => {
                        const isDone = lesson.progress?.is_completed;
                        const hasAudio = lesson.tts_enabled || lesson.audio_url;

                        return (
                          <Link
                            key={lesson.id}
                            to={`/courses/${course.slug || course.id}/${lesson.slug || lesson.id}`}
                            className="group p-3.5 sm:px-6 flex items-center justify-between hover:bg-slate-850/60 transition-colors"
                          >
                            <div className="flex items-center gap-3.5 min-w-0 pr-4">
                              {/* Status Check / Icon */}
                              <div className="flex-shrink-0">
                                {isDone ? (
                                  <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  </div>
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:border-emerald-500/50 group-hover:text-emerald-400 transition-colors">
                                    <FileText className="w-3.5 h-3.5" />
                                  </div>
                                )}
                              </div>

                              {/* Title & Metadata */}
                              <div className="min-w-0">
                                <h4 className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors truncate">
                                  {lesson.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                                  <span className="font-mono">#{String(lesson.order_num || 0).padStart(2, '0')}</span>
                                  <span>•</span>
                                  <span className="font-mono truncate max-w-[150px] sm:max-w-xs">{lesson.slug}</span>
                                </div>
                              </div>
                            </div>

                            {/* Badges & Actions */}
                            <div className="flex items-center gap-2.5 flex-shrink-0">
                              {hasAudio && (
                                <span
                                  className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 text-[10px] font-semibold text-emerald-400 border border-slate-700/60"
                                  title="Browser Speech Audio Available"
                                >
                                  <Volume2 className="w-3 h-3" />
                                  <span>Audio</span>
                                </span>
                              )}

                              {isDone ? (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                  Done
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-semibold group-hover:bg-slate-700 group-hover:text-slate-200 transition-colors">
                                  Read
                                </span>
                              )}

                              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      </main>

      {/* Course Manager Modal for Admin */}
      {course && isManagerModalOpen && (
        <CourseManagerModal
          courseId={course.id}
          isOpen={isManagerModalOpen}
          onClose={() => setIsManagerModalOpen(false)}
          onCourseUpdated={() => {
            loadCourse();
          }}
        />
      )}
    </div>
  );
}
