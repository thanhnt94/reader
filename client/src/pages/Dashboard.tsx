import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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
  Sparkles,
  Settings as SettingsIcon,
  Globe
} from 'lucide-react';
import { readerApi, Course } from '../lib/api/readerApi';
import { useAppStore } from '../store/useAppStore';
import { CreateCourseModal } from '../components/course/CreateCourseModal';
import { CourseManagerModal } from '../components/course/CourseManagerModal';
import { UserNavMenu } from '../components/common/UserNavMenu';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout, authConfig, fetchAuthConfig } = useAppStore();

  const [courses, setCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Course Studio & Management State
  const [isCreateCourseModalOpen, setIsCreateCourseModalOpen] = useState(false);
  const [manageCourseId, setManageCourseId] = useState<number | null>(null);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'zip' | 'folder'>('zip');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [folderPath, setFolderPath] = useState('');
  const [importCourseTitle, setImportCourseTitle] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // SSO Settings State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [ssoUrl, setSsoUrl] = useState('https://inmind.site');
  const [ssoClientId, setSsoClientId] = useState('reader-v1');
  const [ssoClientSecret, setSsoClientSecret] = useState('reader_secret_123');
  const [ssoEnabled, setSsoEnabled] = useState(true);
  const [ssoTestStatus, setSsoTestStatus] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: ''
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const loadSSOConfig = async () => {
    try {
      const res = await axios.get('/api/sso/config');
      if (res.data) {
        setSsoUrl(res.data.server_url || 'https://inmind.site');
        setSsoClientId(res.data.client_id || 'reader-v1');
        setSsoClientSecret(res.data.client_secret || 'reader_secret_123');
        setSsoEnabled(res.data.is_enabled ?? true);
      }
    } catch (e) {
      console.warn('Could not load SSO config:', e);
    }
  };

  const handleOpenSettings = () => {
    loadSSOConfig();
    setIsSettingsModalOpen(true);
    setSsoTestStatus({ status: 'idle', message: '' });
  };

  const handleTestSSO = async () => {
    setSsoTestStatus({ status: 'loading', message: 'Testing connection...' });
    try {
      const res = await axios.post('/api/sso/test', { server_url: ssoUrl.trim() });
      if (res.data?.status === 'success') {
        setSsoTestStatus({ status: 'success', message: res.data.message || 'Connected successfully!' });
      } else {
        setSsoTestStatus({ status: 'error', message: res.data?.message || 'Connection failed' });
      }
    } catch (e: any) {
      setSsoTestStatus({ status: 'error', message: e.response?.data?.message || e.message || 'Connection test failed' });
    }
  };

  const handleSaveSSOSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await axios.post('/api/sso/config', {
        is_enabled: ssoEnabled,
        server_url: ssoUrl.trim(),
        client_id: ssoClientId.trim(),
        client_secret: ssoClientSecret.trim()
      });
      await fetchAuthConfig();
      setIsSettingsModalOpen(false);
    } catch (e) {
      alert('Failed to save SSO settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

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

  const handleCourseCreated = (newCourse: Course) => {
    setIsCreateCourseModalOpen(false);
    fetchCourses();
    setManageCourseId(newCourse.id);
  };

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
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-sky-500/20">
            <BookOpen className="w-5 h-5 fill-current" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              Reader <span className="text-sky-400 text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20">LMS</span>
            </span>
            <p className="text-[11px] text-slate-400">Interactive MDX & Audio Narration</p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleOpenSettings}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/60 transition-colors cursor-pointer"
            title="SSO Settings"
          >
            <SettingsIcon className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => setIsCreateCourseModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Course</span>
            </button>
          )}

          <div className="h-5 w-px bg-slate-800 mx-1 hidden sm:block" />
          <UserNavMenu compactOnMobile={false} />
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
              Select a course to start interactive reading with audio narration.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses..."
              className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Courses Grid */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-9 h-9 rounded-full border-3 border-sky-500/20 border-t-sky-500 animate-spin" />
            <span className="text-xs font-medium">Loading Course Library...</span>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="py-20 border border-dashed border-slate-800 rounded-3xl text-center p-8">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">No Courses Found</h3>
            <p className="text-xs text-slate-400 mb-6 max-w-md mx-auto">
              Get started by creating a course, then upload Markdown files or write lessons.
            </p>
            {user?.role === 'admin' && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateCourseModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg shadow-sky-600/20 cursor-pointer flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Course</span>
                </button>
              </div>
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
                      <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-full bg-slate-800 text-[11px] font-semibold text-slate-300">
                          {c.lesson_count || 0} Lessons
                        </span>
                        {user?.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => setManageCourseId(c.id)}
                            title="Manage Course & Upload .md"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <FolderUp className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3
                      onClick={() => navigate(`/courses/${c.slug || c.id}`)}
                      className="font-bold text-base text-white mb-2 group-hover:text-sky-300 transition-colors cursor-pointer"
                    >
                      {c.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-6">
                      {c.description || 'Interactive markdown course with audio narration.'}
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
                          className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/courses/${c.slug || c.id}`)}
                        className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-sky-600 hover:text-white text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Dashboard</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      {user?.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => setManageCourseId(c.id)}
                          title="Manage Course & Upload Markdown Files"
                          className="px-3 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-sky-400 border border-slate-700/60 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                        >
                          <FolderUp className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Manage</span>
                        </button>
                      )}
                    </div>
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
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
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
                className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${importMode === 'zip' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload ZIP Archive
              </button>
              <button
                type="button"
                onClick={() => setImportMode('folder')}
                className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${importMode === 'folder' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
              >
                <Folder className="w-3.5 h-3.5" />
                Server Folder Path
              </button>
            </div>

            {importMsg && (
              <div className={`p-3.5 rounded-xl text-xs font-semibold mb-5 ${importMsg.type === 'success' ? 'bg-sky-500/10 text-sky-300 border border-sky-500/20' : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'}`}>
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
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
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
                    className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-500"
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
                    className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Enter the absolute folder path containing markdown files.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isImporting}
                className="w-full mt-2 py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg shadow-sky-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isImporting ? 'Processing & Importing...' : 'Start Batch Import'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SSO Configuration Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">CentralAuth SSO Switch</h3>
                  <p className="text-[11px] text-slate-400">Toggle CentralAuth SSO vs Local Login</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSSOSettings} className="space-y-4">
              {/* Enable / Disable Toggle Switch */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <label htmlFor="dashboardSsoSwitch" className="text-xs font-bold text-white block cursor-pointer">
                    Enable CentralAuth SSO
                  </label>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {ssoEnabled ? 'Logins redirect to inmind.site' : 'Logins stay on Reader locally'}
                  </p>
                </div>
                <input
                  id="dashboardSsoSwitch"
                  type="checkbox"
                  checked={ssoEnabled}
                  onChange={(e) => setSsoEnabled(e.target.checked)}
                  className="w-5 h-5 text-sky-500 bg-slate-800 border-slate-700 rounded focus:ring-sky-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  CentralAuth Server URL
                </label>
                <input
                  type="url"
                  value={ssoUrl}
                  onChange={(e) => setSsoUrl(e.target.value)}
                  placeholder="https://inmind.site"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={ssoClientId}
                    onChange={(e) => setSsoClientId(e.target.value)}
                    placeholder="reader-v1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    value={ssoClientSecret}
                    onChange={(e) => setSsoClientSecret(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Test Status Banner */}
              {ssoTestStatus.status !== 'idle' && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium ${
                    ssoTestStatus.status === 'success'
                      ? 'bg-sky-500/10 border border-sky-500/20 text-sky-300'
                      : ssoTestStatus.status === 'error'
                      ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {ssoTestStatus.status === 'loading' && 'Testing connection to CentralAuth...'}
                  {ssoTestStatus.status === 'success' && `✅ ${ssoTestStatus.message}`}
                  {ssoTestStatus.status === 'error' && `❌ ${ssoTestStatus.message}`}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestSSO}
                  disabled={ssoTestStatus.status === 'loading'}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                >
                  Test Connection
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20 transition-all cursor-pointer"
                >
                  {isSavingSettings ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Course Modal */}
      <CreateCourseModal
        isOpen={isCreateCourseModalOpen}
        onClose={() => setIsCreateCourseModalOpen(false)}
        onCreated={handleCourseCreated}
      />

      {/* Course Studio & Batch Markdown Uploader Modal */}
      {manageCourseId && (
        <CourseManagerModal
          courseId={manageCourseId}
          isOpen={Boolean(manageCourseId)}
          onClose={() => setManageCourseId(null)}
          onCourseUpdated={fetchCourses}
        />
      )}
    </div>
  );
}
