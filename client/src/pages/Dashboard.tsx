import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FolderUp,
  Plus,
  PlayCircle,
  CheckCircle2,
  ChevronRight,
  LogOut,
  User as UserIcon,
  Search,
  Upload,
  Folder,
  X,
  Sparkles
} from 'lucide-react';
import { readerApi, Course } from '../lib/api/readerApi';
import { useAppStore } from '../store/useAppStore';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout, authConfig } = useAppStore();

  const [courses, setCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'zip' | 'folder'>('zip');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [folderPath, setFolderPath] = useState('');
  const [importCourseTitle, setImportCourseTitle] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchCourses = () => {
    setIsLoading(true);
    readerApi
      .getCourses()
      .then((data) => {
        setCourses(data);
        setIsLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsImporting(true);
    setImportMsg(null);

    try {
      if (importMode === 'zip') {
        if (!zipFile) {
          setImportMsg({ type: 'error', text: 'Please select a .zip file' });
          setIsImporting(false);
          return;
        }
        const formData = new FormData();
        formData.append('file', zipFile);
        if (importCourseTitle.trim()) {
          formData.append('course_title', importCourseTitle.trim());
        }
        await readerApi.importZip(formData);
      } else {
        if (!folderPath.trim()) {
          setImportMsg({ type: 'error', text: 'Please enter a server folder path' });
          setIsImporting(false);
          return;
        }
        await readerApi.importFolder(folderPath.trim(), importCourseTitle.trim() || undefined);
      }

      setImportMsg({ type: 'success', text: 'Course imported successfully!' });
      setTimeout(() => {
        setIsImportModalOpen(false);
        setZipFile(null);
        setFolderPath('');
        setImportCourseTitle('');
        setImportMsg(null);
        fetchCourses();
      }, 1200);
    } catch (err: any) {
      setImportMsg({ type: 'error', text: err.response?.data?.detail || 'Import failed' });
    } finally {
      setIsImporting(false);
    }
  };

  const filteredCourses = courses.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-600/20">
            <BookOpen className="w-5 h-5 fill-current" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              Reader <span className="text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">LMS</span>
            </span>
            <p className="text-[11px] text-slate-400">Interactive MDX & Karaoke TTS</p>
          </div>
        </div>

        {/* User Status / Login */}
        <div className="flex items-center gap-3">
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/60 transition-colors cursor-pointer"
            >
              <FolderUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Batch Import</span>
            </button>
          )}

          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => navigate('/editor')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Lesson</span>
            </button>
          )}

          {isLoggedIn ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="hidden md:block text-left">
                  <div className="font-semibold text-white leading-tight">{user?.username}</div>
                  <div className="text-[10px] text-emerald-400 capitalize">{user?.role}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={logout}
                title="Sign Out"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-6 sm:p-8">
        {/* Search & Statistics Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Course Library
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Select a course to start interactive reading with synchronized karaoke audio.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses..."
              className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Courses Grid */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-9 h-9 rounded-full border-3 border-emerald-500/20 border-t-emerald-500 animate-spin" />
            <span className="text-xs font-medium">Loading Course Library...</span>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="py-20 border border-dashed border-slate-800 rounded-3xl text-center p-8">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">No Courses Found</h3>
            <p className="text-xs text-slate-400 mb-6 max-w-md mx-auto">
              Get started by importing markdown courses using our Batch Importer or create lessons in the WYSIWYG editor.
            </p>
            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20"
              >
                Batch Import Course
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((c) => {
              const progressPct =
                c.lesson_count && c.lesson_count > 0
                  ? Math.round(((c.completed_count || 0) / c.lesson_count) * 100)
                  : 0;

              return (
                <div
                  key={c.id}
                  className="rounded-3xl bg-slate-900/60 border border-slate-800/80 p-6 flex flex-col justify-between hover:border-slate-700 hover:bg-slate-900/90 transition-all duration-300 shadow-xl group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-slate-800 text-[11px] font-semibold text-slate-300">
                        {c.lesson_count || 0} Lessons
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-white mb-2 group-hover:text-emerald-300 transition-colors">
                      {c.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-6">
                      {c.description || 'Interactive markdown course with TTS audio.'}
                    </p>
                  </div>

                  <div>
                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
                        <span>Progress</span>
                        <span>{progressPct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        // Open first lesson in course
                        const detail = await readerApi.getCourseDetail(c.id);
                        const firstLes = detail.chapters?.[0]?.lessons?.[0];
                        if (firstLes) {
                          navigate(`/reader/${firstLes.id}`);
                        } else {
                          navigate(`/editor`);
                        }
                      }}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Start Reading</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Batch Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="absolute right-5 top-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <FolderUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Batch Import Course</h3>
                <p className="text-xs text-slate-400">Import Markdown files from ZIP or Folder</p>
              </div>
            </div>

            {/* Mode Tabs */}
            <div className="flex rounded-xl bg-slate-800/80 p-1 mb-6 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setImportMode('zip')}
                className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${importMode === 'zip' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload ZIP Archive
              </button>
              <button
                type="button"
                onClick={() => setImportMode('folder')}
                className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${importMode === 'folder' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
              >
                <Folder className="w-3.5 h-3.5" />
                Server Folder Path
              </button>
            </div>

            {importMsg && (
              <div className={`p-3.5 rounded-xl text-xs font-semibold mb-5 ${importMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'}`}>
                {importMsg.text}
              </div>
            )}

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Course Title (Optional Override)
                </label>
                <input
                  type="text"
                  value={importCourseTitle}
                  onChange={(e) => setImportCourseTitle(e.target.value)}
                  placeholder="e.g. JSST Speaking Mastery"
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {importMode === 'zip' ? (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Select .ZIP File
                  </label>
                  <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                    className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Zip should contain folders (chapters) with .md files or direct .md files.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Folder Path on Server
                  </label>
                  <input
                    type="text"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    placeholder="e.g. c:\Users\thanh\OneDrive\CodeHub\Ecosystem\JSST"
                    className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Enter the absolute folder path containing markdown files.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isImporting}
                className="w-full mt-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isImporting ? 'Processing & Importing...' : 'Start Batch Import'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
