import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Upload,
  Folder,
  FolderPlus,
  FileText,
  Trash2,
  Edit2,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Plus
} from 'lucide-react';
import { readerApi, Course, Chapter, Lesson } from '../../lib/api/readerApi';

interface CourseManagerModalProps {
  courseId: number;
  isOpen: boolean;
  onClose: () => void;
  onCourseUpdated: () => void;
}

interface StagedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  detectedOrder: number;
  cleanTitle: string;
}

// Natural sort comparator for filenames
const naturalCompare = (a: string, b: string) => {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

export const CourseManagerModal: React.FC<CourseManagerModalProps> = ({
  courseId,
  isOpen,
  onClose,
  onCourseUpdated,
}) => {
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upload' | 'explorer'>('upload');

  // Edit Course Meta State
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [editCourseTitle, setEditCourseTitle] = useState('');
  const [editCourseDesc, setEditCourseDesc] = useState('');
  const [isSavingCourse, setIsSavingCourse] = useState(false);

  // New Chapter Form State
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [isCreatingChapter, setIsCreatingChapter] = useState(false);

  // Rename Chapter State
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null);
  const [editingChapterTitle, setEditingChapterTitle] = useState('');

  // Expanded Chapters in Explorer
  const [expandedChapterIds, setExpandedChapterIds] = useState<number[]>([]);

  // Drag & Drop / Batch Upload State
  const [targetChapterOption, setTargetChapterOption] = useState<'existing' | 'new'>('existing');
  const [selectedChapterId, setSelectedChapterId] = useState<number | ''>('');
  const [uploadNewChapterTitle, setUploadNewChapterTitle] = useState('');
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCourseDetail = async () => {
    setIsLoading(true);
    try {
      const data = await readerApi.getCourseDetail(courseId);
      setCourse(data);
      setEditCourseTitle(data.title);
      setEditCourseDesc(data.description || '');

      // Set default selected chapter if available
      if (data.chapters && data.chapters.length > 0) {
        if (!selectedChapterId) {
          setSelectedChapterId(data.chapters[0].id);
        }
        // Expand first chapter by default in explorer
        setExpandedChapterIds((prev) => (prev.length === 0 ? [data.chapters![0].id] : prev));
      } else {
        setTargetChapterOption('new');
        setUploadNewChapterTitle('Chapter 1');
      }
    } catch (err: any) {
      console.error('Failed to load course details:', err);
      setAlertMsg({ type: 'error', text: 'Failed to load course details' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && courseId) {
      loadCourseDetail();
      setAlertMsg(null);
      setStagedFiles([]);
    }
  }, [isOpen, courseId]);

  if (!isOpen) return null;

  // Process selected/dropped files
  const handleFilesAdded = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;

    const filesArray = Array.from(filesList);
    const mdFiles = filesArray.filter((f) => {
      const name = f.name.toLowerCase();
      return name.endsWith('.md') || name.endsWith('.markdown');
    });

    if (mdFiles.length === 0) {
      setAlertMsg({ type: 'error', text: 'Please select valid Markdown (.md) files' });
      return;
    }

    // Sort naturally by filename (01., 02., 10.)
    mdFiles.sort((a, b) => naturalCompare(a.name, b.name));

    const newStaged: StagedFile[] = mdFiles.map((f, idx) => {
      const baseName = f.name.replace(/\.[^/.]+$/, '');
      const match = baseName.match(/^\D*(\d+)/);
      const detectedOrder = match ? parseInt(match[1], 10) : idx + 1;
      const cleanTitle = baseName.replace(/^\d+[\s._\-–:]*/, '').trim() || baseName;

      return {
        id: `${f.name}-${f.size}-${Date.now()}-${idx}`,
        file: f,
        name: f.name,
        size: f.size,
        detectedOrder,
        cleanTitle,
      };
    });

    setStagedFiles((prev) => {
      // Merge and deduplicate by name
      const existingNames = new Set(prev.map((item) => item.name));
      const filtered = newStaged.filter((item) => !existingNames.has(item.name));
      const combined = [...prev, ...filtered];
      combined.sort((a, b) => naturalCompare(a.name, b.name));
      return combined;
    });

    setAlertMsg(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFilesAdded(e.dataTransfer.files);
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearAllStagedFiles = () => {
    setStagedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Perform Batch Upload
  const handleBatchUploadSubmit = async () => {
    if (stagedFiles.length === 0) {
      setAlertMsg({ type: 'error', text: 'No .md files selected to upload' });
      return;
    }

    let targetChapId: number | undefined;
    let targetNewTitle: string | undefined;

    if (targetChapterOption === 'existing') {
      if (!selectedChapterId) {
        setAlertMsg({ type: 'error', text: 'Please select a destination chapter' });
        return;
      }
      targetChapId = Number(selectedChapterId);
    } else {
      if (!uploadNewChapterTitle.trim()) {
        setAlertMsg({ type: 'error', text: 'Please enter a title for the new chapter' });
        return;
      }
      targetNewTitle = uploadNewChapterTitle.trim();
    }

    setIsUploading(true);
    setUploadProgressMsg(`Importing ${stagedFiles.length} files into chapter...`);
    setAlertMsg(null);

    try {
      const rawFiles = stagedFiles.map((s) => s.file);
      const res = await readerApi.batchUploadMarkdownToCourse(courseId, {
        chapterId: targetChapId,
        newChapterTitle: targetNewTitle,
        files: rawFiles,
      });

      setAlertMsg({
        type: 'success',
        text: `Successfully imported ${res.imported_count || stagedFiles.length} lessons into "${res.chapter_title || 'Chapter'}"!`,
      });
      setStagedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      await loadCourseDetail();
      onCourseUpdated();

      // Switch to explorer tab so user can see all imported lessons
      setTimeout(() => {
        setActiveTab('explorer');
        if (res.chapter_id) {
          setExpandedChapterIds((prev) => Array.from(new Set([...prev, res.chapter_id])));
        }
      }, 1000);
    } catch (err: any) {
      setAlertMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to upload and import markdown files',
      });
    } finally {
      setIsUploading(false);
      setUploadProgressMsg(null);
    }
  };

  // Create new chapter from Explorer tab
  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterTitle.trim()) return;

    setIsCreatingChapter(true);
    try {
      const created = await readerApi.createChapter(courseId, {
        title: newChapterTitle.trim(),
      });
      setNewChapterTitle('');
      await loadCourseDetail();
      onCourseUpdated();
      setExpandedChapterIds((prev) => [...prev, created.id]);
      setSelectedChapterId(created.id);
      setAlertMsg({ type: 'success', text: `Chapter "${created.title}" created successfully!` });
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to create chapter' });
    } finally {
      setIsCreatingChapter(false);
    }
  };

  // Save renamed chapter
  const handleSaveRenameChapter = async (chapterId: number) => {
    if (!editingChapterTitle.trim()) return;
    try {
      await readerApi.updateChapter(chapterId, { title: editingChapterTitle.trim() });
      setEditingChapterId(null);
      await loadCourseDetail();
      onCourseUpdated();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to rename chapter');
    }
  };

  // Delete chapter
  const handleDeleteChapter = async (chapter: Chapter) => {
    const confirmText = `Are you sure you want to delete chapter "${chapter.title}"? All lessons in this chapter will be deleted.`;
    if (!window.confirm(confirmText)) return;

    try {
      await readerApi.deleteChapter(chapter.id);
      await loadCourseDetail();
      onCourseUpdated();
      setAlertMsg({ type: 'success', text: `Chapter "${chapter.title}" deleted` });
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to delete chapter' });
    }
  };

  // Delete individual lesson
  const handleDeleteLesson = async (lesson: Lesson) => {
    if (!window.confirm(`Delete lesson "${lesson.title}"?`)) return;
    try {
      await readerApi.deleteLesson(lesson.id);
      await loadCourseDetail();
      onCourseUpdated();
    } catch (err: any) {
      alert('Failed to delete lesson');
    }
  };

  // Update Course Title/Desc
  const handleSaveCourseInfo = async () => {
    if (!editCourseTitle.trim()) return;
    setIsSavingCourse(true);
    try {
      await readerApi.updateCourse(courseId, {
        title: editCourseTitle.trim(),
        description: editCourseDesc.trim(),
      });
      setIsEditingCourse(false);
      await loadCourseDetail();
      onCourseUpdated();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update course');
    } finally {
      setIsSavingCourse(false);
    }
  };

  // Delete Course
  const handleDeleteCourse = async () => {
    if (!course) return;
    const confirm = window.confirm(
      `Delete course "${course.title}"? This cannot be undone and will delete all chapters and lessons.`
    );
    if (!confirm) return;

    try {
      await readerApi.deleteCourse(course.id);
      onCourseUpdated();
      onClose();
    } catch (err: any) {
      alert('Failed to delete course');
    }
  };

  const toggleChapterExpanded = (chapId: number) => {
    setExpandedChapterIds((prev) =>
      prev.includes(chapId) ? prev.filter((id) => id !== chapId) : [...prev, chapId]
    );
  };

  const chapters = course?.chapters || [];
  const totalLessons = chapters.reduce((acc, c) => acc + (c.lessons?.length || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in font-sans">
      <div className="w-full max-w-4xl h-[92vh] max-h-[850px] rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-100 relative">
        {/* Top Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white tracking-tight">
                  {course?.title || 'Course Manager'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-[11px] font-semibold text-sky-400 border border-slate-700/60">
                  {chapters.length} Chapters • {totalLessons} Lessons
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-1">
                {course?.description || 'Batch markdown uploader & chapter organization'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditingCourse(!isEditingCourse)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60 transition-colors"
              title="Edit Course Info"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDeleteCourse}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-700/60 transition-colors"
              title="Delete Entire Course"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Course Info Edit Banner */}
        {isEditingCourse && (
          <div className="p-4 bg-slate-800/70 border-b border-slate-700/70 shrink-0 animate-in slide-in-from-top-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                  Course Title
                </label>
                <input
                  type="text"
                  value={editCourseTitle}
                  onChange={(e) => setEditCourseTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editCourseDesc}
                  onChange={(e) => setEditCourseDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingCourse(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-medium text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCourseInfo}
                disabled={isSavingCourse}
                className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white shadow-xs"
              >
                {isSavingCourse ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Global Notifications */}
        {alertMsg && (
          <div
            className={`mx-4 sm:mx-6 mt-4 p-3 rounded-2xl text-xs font-semibold flex items-center justify-between shrink-0 ${
              alertMsg.type === 'success'
                ? 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
            }`}
          >
            <div className="flex items-center gap-2">
              {alertMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-sky-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{alertMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setAlertMsg(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Tab Navigation */}
        <div className="px-4 sm:px-6 pt-4 shrink-0">
          <div className="flex rounded-2xl bg-slate-800/80 p-1 text-xs font-bold border border-slate-700/60">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Batch Markdown Uploader (Drag & Drop)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('explorer')}
              className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'explorer'
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Folder className="w-4 h-4" />
              <span>Chapters & Lessons Explorer ({totalLessons})</span>
            </button>
          </div>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-8 h-8 rounded-full border-3 border-sky-500/20 border-t-sky-500 animate-spin" />
              <span className="text-xs">Loading course structure...</span>
            </div>
          ) : activeTab === 'upload' ? (
            /* TAB 1: BATCH MARKDOWN UPLOADER */
            <div className="space-y-5 animate-in fade-in">
              {/* Target Chapter Selection */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/50 border border-slate-700/60">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-sky-400" />
                  Target Chapter (Folder) Destination
                </label>

                <div className="flex flex-col sm:flex-row gap-3">
                  {chapters.length > 0 && (
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="chapOption"
                        checked={targetChapterOption === 'existing'}
                        onChange={() => setTargetChapterOption('existing')}
                        className="accent-sky-500"
                      />
                      <span>Select Existing Chapter</span>
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="chapOption"
                      checked={targetChapterOption === 'new'}
                      onChange={() => setTargetChapterOption('new')}
                      className="accent-sky-500"
                    />
                      <span>Create New Chapter</span>
                  </label>
                </div>

                <div className="mt-3">
                  {targetChapterOption === 'existing' && chapters.length > 0 ? (
                    <select
                      value={selectedChapterId}
                      onChange={(e) => setSelectedChapterId(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      {chapters.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.title} ({ch.lessons?.length || 0} lessons)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={uploadNewChapterTitle}
                      onChange={(e) => setUploadNewChapterTitle(e.target.value)}
                      placeholder="e.g. Chapter 1: Reflex Speaking, Part 2..."
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  )}
                </div>
              </div>

              {/* GitHub-Style Drag & Drop Area */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept=".md,text/markdown"
                  onChange={(e) => handleFilesAdded(e.target.files)}
                  className="hidden"
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 group ${
                    isDragOver
                      ? 'border-sky-500 bg-sky-500/10 scale-[1.01]'
                      : 'border-slate-700/80 hover:border-sky-500/50 bg-slate-800/30 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="w-14 h-14 rounded-3xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform shadow-lg shadow-sky-500/10">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm sm:text-base text-white mb-1">
                      Drag & Drop markdown (.md) files here
                    </h4>
                    <p className="text-xs text-slate-400 max-w-md">
                      Or <span className="text-sky-400 font-semibold underline underline-offset-2">browse files</span> from your computer. You can select all 50-100 files at once!
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>Supports: GFM Markdown (.md), Frontmatter, Furigana & Natural Ordering</span>
                  </div>
                </div>
              </div>

              {/* Staged Files Preview List */}
              {stagedFiles.length > 0 && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs uppercase text-slate-300">
                        Staged Files Ready to Import
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[11px] font-bold border border-sky-500/30">
                        {stagedFiles.length} files
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={clearAllStagedFiles}
                      className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/60">
                    {stagedFiles.map((item, idx) => (
                      <div
                        key={item.id}
                        className="pt-1.5 first:pt-0 flex items-center justify-between gap-3 text-xs group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-[10px] font-bold text-slate-400 shrink-0">
                            #{item.detectedOrder || idx + 1}
                          </span>
                          <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span className="text-white font-medium truncate">{item.name}</span>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            ({(item.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStagedFile(item.id)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-700/50 transition-colors shrink-0"
                          title="Remove file"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Primary Upload Action */}
                  <div className="pt-2 border-t border-slate-700/60">
                    <button
                      type="button"
                      onClick={handleBatchUploadSubmit}
                      disabled={isUploading}
                      className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-sky-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          <span>{uploadProgressMsg || 'Importing...'}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>
                            Import {stagedFiles.length} Lessons into{' '}
                            {targetChapterOption === 'existing'
                              ? chapters.find((c) => c.id === selectedChapterId)?.title || 'Chapter'
                              : uploadNewChapterTitle || 'New Chapter'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: CHAPTERS & LESSONS EXPLORER */
            <div className="space-y-4 animate-in fade-in">
              {/* Add New Chapter Form */}
              <form
                onSubmit={handleCreateChapter}
                className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex items-center gap-3"
              >
                <FolderPlus className="w-5 h-5 text-sky-400 shrink-0" />
                <input
                  type="text"
                  required
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  placeholder="New Chapter Title (e.g. Part 1: Reflex Speaking)..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  disabled={isCreatingChapter}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shrink-0 transition-colors cursor-pointer"
                >
                  {isCreatingChapter ? 'Adding...' : 'Add Chapter'}
                </button>
              </form>

              {/* Chapters Accordion */}
              {chapters.length === 0 ? (
                <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl p-6">
                  <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-medium text-slate-400">No chapters created yet.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Add a chapter above or use the Batch Markdown Uploader to import files directly!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {chapters.map((chapter) => {
                    const isExpanded = expandedChapterIds.includes(chapter.id);
                    const isEditing = editingChapterId === chapter.id;
                    const lessons = chapter.lessons || [];

                    return (
                      <div
                        key={chapter.id}
                        className="rounded-2xl bg-slate-800/30 border border-slate-700/60 overflow-hidden"
                      >
                        {/* Chapter Header */}
                        <div className="p-3.5 bg-slate-800/60 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => toggleChapterExpanded(chapter.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                            <Folder className="w-4 h-4 text-sky-400 shrink-0" />

                            {isEditing ? (
                              <div className="flex items-center gap-2 flex-1 max-w-sm">
                                <input
                                  type="text"
                                  value={editingChapterTitle}
                                  onChange={(e) => setEditingChapterTitle(e.target.value)}
                                  className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveRenameChapter(chapter.id)}
                                  className="p-1 rounded bg-sky-600 text-white"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingChapterId(null)}
                                  className="p-1 rounded bg-slate-700 text-slate-300"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span
                                onClick={() => toggleChapterExpanded(chapter.id)}
                                className="font-bold text-xs text-white truncate cursor-pointer hover:text-sky-300 transition-colors"
                              >
                                {chapter.title}
                              </span>
                            )}

                            <span className="px-2 py-0.5 rounded-full bg-slate-900 text-[10px] font-semibold text-slate-400 shrink-0">
                              {lessons.length} lessons
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedChapterId(chapter.id);
                                setTargetChapterOption('existing');
                                setActiveTab('upload');
                              }}
                              className="px-2 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-[11px] font-semibold transition-colors flex items-center gap-1"
                              title="Upload .md files to this chapter"
                            >
                              <Upload className="w-3 h-3" />
                              <span className="hidden sm:inline">Drop Files</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingChapterId(chapter.id);
                                setEditingChapterTitle(chapter.title);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                              title="Rename chapter"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteChapter(chapter)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Delete chapter"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Chapter Lessons List */}
                        {isExpanded && (
                          <div className="p-3 bg-slate-900/40 border-t border-slate-800/80 space-y-1">
                            {lessons.length === 0 ? (
                              <div className="py-4 text-center text-[11px] text-slate-500">
                                No lessons in this chapter yet. Drop markdown files in the Uploader tab!
                              </div>
                            ) : (
                              lessons.map((lesson) => (
                                <div
                                  key={lesson.id}
                                  className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-slate-800/50 transition-colors group text-xs"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-6 text-center text-[11px] font-semibold text-slate-500 shrink-0">
                                      #{lesson.order_num}
                                    </span>
                                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 group-hover:text-sky-400 transition-colors" />
                                    <span className="text-slate-200 font-medium truncate">
                                      {lesson.title}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => navigate(course ? `/courses/${course.slug || course.id}/${lesson.slug || lesson.id}` : `/reader/${lesson.id}`)}
                                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-sky-600 hover:text-white text-slate-300 text-[10px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                      <span>Read</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/editor/${lesson.id}`)}
                                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition-colors cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteLesson(lesson)}
                                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                      title="Delete lesson"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
