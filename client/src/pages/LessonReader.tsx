import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  BookOpen,
  MessageSquare,
  FileText,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Headphones,
  Radio,
  RefreshCw,
  Loader2,
  Copy,
  Flame,
  Check,
  Shuffle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { readerApi, Lesson, Course, Chapter } from '../lib/api/readerApi';
import { MarkdownRenderer } from '../components/mdx/MarkdownRenderer';
import { AudioPlayer } from '../components/player/AudioPlayer';
import { DockedBottomPlayer } from '../components/player/DockedBottomPlayer';
import {
  BrowserSpeechPlayer,
  BrowserSpeechController,
  SpeechSentence,
  cleanTextForSpeech,
  detectDocumentMainLang,
  detectLanguage
} from '../components/player/BrowserSpeechPlayer';
import { LessonNotesDrawer } from '../components/lesson/LessonNotesDrawer';
import { LessonCommentsSection } from '../components/lesson/LessonCommentsSection';
import { UserNavMenu } from '../components/common/UserNavMenu';
import { useAppStore } from '../store/useAppStore';

// Helper to normalize text (Vietnamese diacritics stripped, lowercased, trimmed)
const normalizeSearchText = (text: string): string => {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
};

// Fast and smart lesson matching supporting numbers, Vietnamese with/without accents, and Japanese text
const matchLesson = (les: Lesson, query: string): boolean => {
  const cleanQ = query.trim();
  if (!cleanQ) return true;

  const normalizedQ = normalizeSearchText(cleanQ);
  const normalizedTitle = normalizeSearchText(les.title || '');
  const normalizedSlug = normalizeSearchText(les.slug || '');

  // 1. Direct normalized match in title or slug
  if (normalizedTitle.includes(normalizedQ) || normalizedSlug.includes(normalizedQ)) {
    return true;
  }

  // 2. Direct case-insensitive match for original characters (e.g. Japanese Kanji/Hiragana)
  const lowerQ = cleanQ.toLowerCase();
  if ((les.title || '').toLowerCase().includes(lowerQ) || (les.slug || '').toLowerCase().includes(lowerQ)) {
    return true;
  }

  // 3. Smart Number-Based Matching (e.g., query "27", "cau 27", "câu 027", "bai 27")
  const numMatch = cleanQ.match(/\d+/);
  if (numMatch) {
    const queryNum = parseInt(numMatch[0], 10);
    if (les.order_num === queryNum) return true;

    const padded2 = queryNum < 10 ? `0${queryNum}` : `${queryNum}`;
    const padded3 = queryNum < 10 ? `00${queryNum}` : queryNum < 100 ? `0${queryNum}` : `${queryNum}`;

    const titleNumbers = (les.title || '').match(/\d+/g) || [];
    for (const tNum of titleNumbers) {
      if (parseInt(tNum, 10) === queryNum) return true;
    }

    if (
      normalizedSlug.includes(`-${queryNum}`) ||
      normalizedSlug.includes(`-${padded2}`) ||
      normalizedSlug.includes(`-${padded3}`) ||
      normalizedSlug.endsWith(`${queryNum}`) ||
      normalizedSlug.endsWith(`${padded2}`) ||
      normalizedSlug.endsWith(`${padded3}`)
    ) {
      return true;
    }
  }

  return false;
};

export default function LessonReader() {
  const { lessonId, lessonSlug, courseSlug, courseId } = useParams<{
    lessonId?: string;
    lessonSlug?: string;
    courseSlug?: string;
    courseId?: string;
  }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoPlayFromUrl = searchParams.get('autoplay') === '1';
  const urlSlot = searchParams.get('slot');
  const urlMode = searchParams.get('mode');

  const { settings, updateSettings, user } = useAppStore();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Layout & Drawers
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTOCOpen, setIsTOCOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [isSpeechPlayerOpen, setIsSpeechPlayerOpen] = useState(false);
  const [isStudioAudioOpen, setIsStudioAudioOpen] = useState(false);
  const [speechController, setSpeechController] = useState<BrowserSpeechController | null>(null);
  const [isShuffle, setIsShuffle] = useState<boolean>(() => searchParams.get('shuffle') === '1');
  const [audioMode, setAudioMode] = useState<'studio' | 'browser'>(() => {
    return urlMode === 'browser' ? 'browser' : 'studio';
  });
  const [selectedAudioSlot, setSelectedAudioSlot] = useState<number>(() => {
    return urlSlot ? Math.max(1, Math.min(3, parseInt(urlSlot, 10) || 1)) : 1;
  });
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [activeSpeechSentence, setActiveSpeechSentence] = useState<SpeechSentence | null>(null);
  const articleContainerRef = useRef<HTMLDivElement | null>(null);
  const [isNotesDrawerOpen, setIsNotesDrawerOpen] = useState(false);
  const [isCommentsDrawerOpen, setIsCommentsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Memoized filtered chapters and lessons for instant search
  const { filteredChapters, totalMatchingLessons, totalLessons } = useMemo(() => {
    if (!course?.chapters) {
      return { filteredChapters: [], totalMatchingLessons: 0, totalLessons: 0 };
    }
    let matchCount = 0;
    let allCount = 0;
    const chaps = course.chapters.map((chap) => {
      const lessonsInChap = chap.lessons || [];
      allCount += lessonsInChap.length;
      const matched = lessonsInChap.filter((l) => matchLesson(l, searchQuery));
      matchCount += matched.length;
      return {
        ...chap,
        filteredLessons: matched,
      };
    });
    return {
      filteredChapters: chaps,
      totalMatchingLessons: matchCount,
      totalLessons: allCount,
    };
  }, [course?.chapters, searchQuery]);

  // Sticky header scroll detection
  const [isScrolled, setIsScrolled] = useState(false);

  // Tap-to-Speak Target Sentence
  const [targetSpeechIndex, setTargetSpeechIndex] = useState<number | null>(null);

  // Floating Selection Bar & Vocaburn Integration
  const [selectedText, setSelectedText] = useState('');
  const [selectionContext, setSelectionContext] = useState('');
  const [floatingBarPos, setFloatingBarPos] = useState<{ x: number; y: number } | null>(null);
  const [isCopiedToast, setIsCopiedToast] = useState(false);
  const [isVocaburnModalOpen, setIsVocaburnModalOpen] = useState(false);
  const [vocaburnCardData, setVocaburnCardData] = useState({
    front: '',
    reading: '',
    back: '',
    context: '',
  });
  const [isSavingVocaburn, setIsSavingVocaburn] = useState(false);
  const [vocaburnSuccessMsg, setVocaburnSuccessMsg] = useState('');

  // Active Heading (Scrollspy)
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');

  // Target identifier: either slug or ID
  const targetLookup = lessonSlug || lessonId;

  // Auto-scroll to top whenever switching to a new lesson
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [targetLookup]);

  // Sync slot, mode & shuffle from URL parameters
  useEffect(() => {
    if (urlSlot) {
      const parsedSlot = Math.max(1, Math.min(3, parseInt(urlSlot, 10) || 1));
      setSelectedAudioSlot(parsedSlot);
    }
    if (urlMode === 'browser' || urlMode === 'studio') {
      setAudioMode(urlMode);
    }
    const shuffleParam = searchParams.get('shuffle');
    if (shuffleParam !== null) {
      setIsShuffle(shuffleParam === '1');
    }
  }, [targetLookup, urlSlot, urlMode, searchParams]);

  // Auto-open speech player if arrived with ?autoplay=1 (Continuous Audio Machine)
  useEffect(() => {
    if (autoPlayFromUrl) {
      const mode = urlMode || audioMode;
      if (mode === 'browser') {
        setIsSpeechPlayerOpen(true);
        setIsStudioAudioOpen(false);
      } else {
        setIsSpeechPlayerOpen(false);
        setIsStudioAudioOpen(true);
      }
    }
  }, [autoPlayFromUrl, lesson?.id, targetLookup, urlMode]);

  // Decoupled article text from speech/audio: do not auto-scroll or mutate DOM inside article
  useEffect(() => {
    const container = articleContainerRef.current;
    if (!container) return;
    container.querySelectorAll('.speech-reading-highlight').forEach((el) => {
      el.classList.remove('speech-reading-highlight');
      (el as HTMLElement).style.removeProperty('--karaoke-progress');
    });
  }, [lesson?.id]);

  // Real-time karaoke text sweep (no-op since article jumping is decoupled)
  const handleSentenceProgress = (_prog: number) => {};

  // Helper to re-center active speech sentence on user request (no-op)
  const scrollToActiveSentence = () => {};

  // Generate high quality Studio Edge-TTS audio on demand and persist to DB
  const handleGenerateTTS = async (slotOrForce: number | boolean = 1, force: boolean = false) => {
    if (!lesson?.id && !lesson?.slug) return;
    const targetIdOrSlug = lesson.slug || lesson.id;
    let slot = 1;
    let actualForce = force;
    if (typeof slotOrForce === 'boolean') {
      actualForce = slotOrForce;
      slot = 1;
    } else if (typeof slotOrForce === 'number') {
      slot = slotOrForce;
    }

    try {
      setIsGeneratingTTS(true);
      const currentTrack = lesson.audio_tracks?.find((t) => t.slot_num === slot);
      const res = await readerApi.generateTTS(targetIdOrSlug, slot, actualForce, currentTrack?.audio_script);
      if (res.audio_url) {
        setLesson((prev) => {
          if (!prev) return null;
          const updatedTracks = res.audio_tracks || prev.audio_tracks || [];
          return {
            ...prev,
            audio_url: slot === 1 ? res.audio_url : prev.audio_url,
            audio_tracks: updatedTracks,
            tts_generated: true,
          };
        });
        setIsStudioAudioOpen(true);
        setIsSpeechPlayerOpen(false);
      }
    } catch (err: any) {
      console.error('Failed to generate Edge-TTS audio:', err);
      alert('Không thể tạo file Edge-TTS. Vui lòng thử lại sau.');
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  // Cancel any browser speech synthesis when using Studio Audio mode
  useEffect(() => {
    if (audioMode === 'studio' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [audioMode, lesson?.id]);


  // Text Selection Listener: Displays Floating Action Menu
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        if (!isVocaburnModalOpen) {
          setFloatingBarPos(null);
          setSelectedText('');
        }
        return;
      }

      const text = sel.toString().trim();
      if (text.length === 0 || text.length > 500) {
        setFloatingBarPos(null);
        setSelectedText('');
        return;
      }

      const container = articleContainerRef.current;
      if (!container) return;

      const anchorNode = sel.anchorNode;
      if (!anchorNode || !container.contains(anchorNode)) {
        setFloatingBarPos(null);
        setSelectedText('');
        return;
      }

      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        let contextStr = '';
        const parentBlock = anchorNode.parentElement?.closest('p, li, blockquote, td, h1, h2, h3, h4');
        if (parentBlock) {
          const clone = parentBlock.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('rt, rp, nospeech, script, style').forEach((n) => n.remove());
          contextStr = (clone.textContent || '').trim();
        }

        setSelectedText(text);
        setSelectionContext(contextStr);

        const barWidth = 250;
        const posX = Math.max(12, Math.min(window.innerWidth - barWidth - 12, rect.left + rect.width / 2 - barWidth / 2));
        const posY = Math.max(12, rect.top - 46);

        setFloatingBarPos({ x: posX, y: posY });
      } catch (e) {}
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isVocaburnModalOpen]);

  // Floating Action 1: Speak selected text
  const handleSpeakSelection = () => {
    if (!selectedText) return;
    const lang = detectLanguage(selectedText);
    const langParam = lang === 'vi-VN' ? 'vi' : (lang === 'ja-JP' ? 'ja' : 'en');
    const audio = new Audio(`/api/v1/tts/stream?text=${encodeURIComponent(selectedText)}&lang=${langParam}`);
    audio.play().catch(() => {
      if ('speechSynthesis' in window) {
        const utt = new SpeechSynthesisUtterance(selectedText);
        utt.lang = lang;
        window.speechSynthesis.speak(utt);
      }
    });
  };

  // Floating Action 2: Open Vocaburn Modal
  const handleOpenVocaburnModal = async () => {
    const textToSave = selectedText;
    const contextToSave = selectionContext;
    setFloatingBarPos(null);

    let autoReading = '';
    if (/[\u4E00-\u9FAF]/.test(textToSave)) {
      try {
        const res = await readerApi.autoGenerateFurigana(textToSave);
        const kanaMatches = res.converted_text.match(/<rt>([^<]+)<\/rt>/g);
        if (kanaMatches) {
          autoReading = kanaMatches.map((m) => m.replace(/<\/?rt>/g, '')).join('');
        }
      } catch (e) {}
    }

    setVocaburnCardData({
      front: textToSave,
      reading: autoReading,
      back: '',
      context: contextToSave || textToSave,
    });
    setVocaburnSuccessMsg('');
    setIsVocaburnModalOpen(true);
  };

  // Floating Action 3: Copy text to clipboard
  const handleCopySelection = () => {
    if (!selectedText) return;
    navigator.clipboard.writeText(selectedText);
    setIsCopiedToast(true);
    setTimeout(() => {
      setIsCopiedToast(false);
      setFloatingBarPos(null);
    }, 1200);
  };

  // Submit save card to Vocaburn platform
  const handleSaveToVocaburn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vocaburnCardData.front.trim()) return;
    try {
      setIsSavingVocaburn(true);
      const res = await readerApi.saveVocaburnCard({
        front: vocaburnCardData.front,
        back: vocaburnCardData.back,
        reading: vocaburnCardData.reading,
        context: vocaburnCardData.context,
        lesson_title: lesson?.title || '',
      });
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.5 },
      });
      setVocaburnSuccessMsg(res.message || 'Đã lưu thành công vào Vocaburn!');
      setTimeout(() => {
        setIsVocaburnModalOpen(false);
        setVocaburnSuccessMsg('');
      }, 1200);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Không thể lưu vào Vocaburn. Vui lòng kiểm tra kết nối.');
    } finally {
      setIsSavingVocaburn(false);
    }
  };

  // Load lesson details
  useEffect(() => {
    if (!targetLookup) return;

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    setIsLoading(true);
    readerApi
      .getLessonDetail(targetLookup)
      .then((les) => {
        setLesson(les);
        setIsLoading(false);
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;

        // Load full course tree for left sidebar
        if (les.chapter?.course_id) {
          if (!course || course.id !== les.chapter.course_id) {
            readerApi.getCourseDetail(les.chapter.course_id).then((c) => {
              setCourse(c);
              document.title = `${les.title} — ${c.title}`;
              // Clean up browser URL if navigated via /reader/:id
              if (window.location.pathname.startsWith('/reader/')) {
                const search = window.location.search;
                window.history.replaceState(null, '', `/courses/${c.slug}/${les.slug}${search}`);
              }
            }).catch(console.error);
          } else {
            document.title = `${les.title} — ${course.title}`;
          }
        } else {
          document.title = `${les.title} — Reader`;
        }
      })
      .catch((err) => {
        console.error('Failed to load lesson', err);
        setIsLoading(false);
      });
  }, [targetLookup]);

  // Scrollspy: Track active heading on scroll & track isScrolled for sticky header
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setIsScrolled((prev) => {
        if (!prev && y > 100) return true;
        if (prev && y < 35) return false;
        return prev;
      });

      if (!lesson?.toc_data || lesson.toc_data.length === 0) return;
      const headings = lesson.toc_data.map((t) => document.getElementById(t.id)).filter(Boolean);
      const scrollPos = y + 120;

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

  // Section-level completion tracking
  const completedSections: string[] = lesson?.progress?.completed_sections || [];

  const handleToggleSection = async (sectionId: string) => {
    if (!lesson) return;
    const current = lesson.progress?.completed_sections || [];
    const next = current.includes(sectionId)
      ? current.filter((id) => id !== sectionId)
      : [...current, sectionId];

    const allTOCIds = lesson.toc_data?.map((t) => t.id) || [];
    const allCompleted = allTOCIds.length > 0 && allTOCIds.every((id) => next.includes(id));

    setLesson({
      ...lesson,
      progress: {
        ...(lesson.progress || { last_scroll_pos: 0, last_audio_pos: 0, is_completed: false }),
        completed_sections: next,
        is_completed: allCompleted ? true : (lesson.progress?.is_completed ?? false),
      },
    });

    try {
      await readerApi.updateProgress(lesson.id, {
        completed_sections: next,
        ...(allCompleted ? { is_completed: true } : {}),
      });
      if (allCompleted && !lesson.progress?.is_completed) {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        });
      }
    } catch (err) {
      console.error('Failed to update section progress', err);
    }
  };

  const handleToggleAllSections = async () => {
    if (!lesson?.toc_data || lesson.toc_data.length === 0) return;
    const allTOCIds = lesson.toc_data.map((t) => t.id);
    const areAllDone = allTOCIds.every((id) => completedSections.includes(id));
    const next = areAllDone ? [] : allTOCIds;

    setLesson({
      ...lesson,
      progress: {
        ...(lesson.progress || { last_scroll_pos: 0, last_audio_pos: 0, is_completed: false }),
        completed_sections: next,
        is_completed: !areAllDone,
      },
    });

    try {
      await readerApi.updateProgress(lesson.id, {
        completed_sections: next,
        is_completed: !areAllDone,
      });
      if (!areAllDone) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    } catch (err) {
      console.error('Failed to update all sections', err);
    }
  };

  // Scroll to TOC heading smoothly with sticky header offset & highlight flash
  const handleScrollToHeading = (item: { id: string; text: string }) => {
    // 1. Try finding by item.id
    let el = document.getElementById(item.id);

    // 2. Try finding by title id
    if (!el) {
      el = document.getElementById(`${item.id}-title`);
    }

    // 3. Fallback: Search headings inside #article-content by matching text
    if (!el) {
      const headings = Array.from(
        document.querySelectorAll<HTMLElement>(
          '#article-content h1, #article-content h2, #article-content h3, #article-content h4, #article-content [id]'
        )
      );
      const cleanTarget = item.text.replace(/^[^\w\s]+/, '').trim().toLowerCase();
      el =
        headings.find((h) => {
          const text = (h.textContent || '').replace(/^[^\w\s]+/, '').trim().toLowerCase();
          return (
            text === cleanTarget ||
            (cleanTarget.length > 3 && text.includes(cleanTarget)) ||
            (text.length > 3 && cleanTarget.includes(text))
          );
        }) || null;
    }

    if (el) {
      // Offset for sticky navbar (56px) + pinned lesson header (~70px) = 126px
      const yOffset = -126;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      setActiveHeadingId(item.id);

      // Flash highlight to draw learner eye directly to the section
      el.classList.add('ring-2', 'ring-sky-400/50', 'bg-sky-500/10', 'rounded-xl', 'transition-all');
      setTimeout(() => {
        el?.classList.remove('ring-2', 'ring-sky-400/50', 'bg-sky-500/10');
      }, 1500);
    }
  };

  // Mark lesson as complete
  const handleToggleComplete = async () => {
    if (!lesson) return;
    const nextStatus = !lesson.progress?.is_completed;
    const allTOCIds = lesson.toc_data?.map((t) => t.id) || [];
    const nextSections = nextStatus ? allTOCIds : [];

    setLesson({
      ...lesson,
      progress: {
        ...(lesson.progress || { last_scroll_pos: 0, last_audio_pos: 0 }),
        is_completed: nextStatus,
        completed_sections: nextSections,
      },
    });

    try {
      await readerApi.updateProgress(lesson.id, {
        is_completed: nextStatus,
        completed_sections: nextSections,
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

  // Find Next / Prev lesson & chapter
  let prevLesson: Lesson | null = null;
  let nextLesson: Lesson | null = null;
  let prevChapter: Chapter | null = null;
  let nextChapter: Chapter | null = null;

  if (course?.chapters) {
    const allLessons: Lesson[] = [];
    course.chapters.forEach((ch) => {
      if (ch.lessons) allLessons.push(...ch.lessons);
    });

    const currentIndex = allLessons.findIndex(
      (l) => l.id === lesson?.id || (lesson?.slug && l.slug === lesson.slug)
    );
    if (currentIndex > 0) prevLesson = allLessons[currentIndex - 1];
    if (currentIndex >= 0 && currentIndex < allLessons.length - 1) {
      nextLesson = allLessons[currentIndex + 1];
    }

    const currentChapIdx = course.chapters.findIndex((c) => c.id === lesson?.chapter_id);
    if (currentChapIdx > 0) prevChapter = course.chapters[currentChapIdx - 1];
    if (currentChapIdx >= 0 && currentChapIdx < course.chapters.length - 1) {
      nextChapter = course.chapters[currentChapIdx + 1];
    }
  }

  // Get a completely random lesson from the course for Shuffle mode
  const getRandomLesson = (): Lesson | null => {
    if (!course?.chapters) return null;
    const all: Lesson[] = [];
    course.chapters.forEach((ch) => {
      if (ch.lessons) all.push(...ch.lessons);
    });
    const candidates = all.filter(
      (l) => l.id !== lesson?.id && (!lesson?.slug || l.slug !== lesson.slug)
    );
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  const navigateToLesson = (target: Lesson, autoPlay = false): string | null => {
    const params = new URLSearchParams();
    if (autoPlay) params.set('autoplay', '1');
    params.set('slot', String(selectedAudioSlot));
    params.set('mode', audioMode);
    if (isShuffle) params.set('shuffle', '1');
    const qs = `?${params.toString()}`;

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Optimistically update lesson metadata so DockedBottomPlayer immediately
    // receives the new lesson's audio URL and title without waiting for the network roundtrip
    setLesson((prev) => (prev ? {
      ...prev,
      id: target.id,
      slug: target.slug,
      title: target.title,
      audio_url: target.audio_url,
      duration_seconds: target.duration_seconds,
      audio_tracks: target.audio_tracks || prev.audio_tracks,
      chapter_id: target.chapter_id || prev.chapter_id,
    } : target));

    if (course) {
      navigate(`/courses/${course.slug || course.id}/${target.slug || target.id}${qs}`);
    } else {
      navigate(`/reader/${target.id}${qs}`);
    }

    const track = target.audio_tracks?.find((t) => t.slot_num === selectedAudioSlot);
    return track?.audio_url || (selectedAudioSlot === 1 ? target.audio_url || null : null);
  };

  const handleActiveSentenceChange = useCallback((sent: SpeechSentence | null) => {
    setActiveSpeechSentence((prev) => {
      if (!prev && !sent) return null;
      if (prev && sent && prev.index === sent.index && prev.text === sent.text) return prev;
      return sent;
    });
  }, []);

  const handleControllerReady = useCallback((ctrl: BrowserSpeechController | null) => {
    setSpeechController((prev) => {
      if (
        prev &&
        ctrl &&
        prev.isPlaying === ctrl.isPlaying &&
        prev.isPaused === ctrl.isPaused &&
        prev.currentIndex === ctrl.currentIndex &&
        prev.speed === ctrl.speed &&
        prev.totalSentences === ctrl.totalSentences
      ) {
        return prev;
      }
      return ctrl;
    });
  }, []);

  const navigateToChapter = (chap: Chapter, autoPlay = false) => {
    if (chap.lessons && chap.lessons.length > 0) {
      navigateToLesson(chap.lessons[0], autoPlay);
    }
  };

  // Unified Next action: respect Shuffle if ON, otherwise advance sequentially
  const handleNextAction = (autoPlay = false): string | null => {
    let target: Lesson | null = null;
    if (isShuffle) {
      target = getRandomLesson();
    } else if (nextLesson) {
      target = nextLesson;
    } else if (nextChapter?.lessons && nextChapter.lessons.length > 0) {
      target = nextChapter.lessons[0];
    }
    if (!target) return null;
    return navigateToLesson(target, autoPlay);
  };

  // Unified Previous action: return to previous question or previous chapter's last lesson
  const handlePrevAction = (autoPlay = false): string | null => {
    let target: Lesson | null = null;
    if (prevLesson) {
      target = prevLesson;
    } else if (prevChapter?.lessons && prevChapter.lessons.length > 0) {
      target = prevChapter.lessons[prevChapter.lessons.length - 1];
    }
    if (!target) return null;
    return navigateToLesson(target, autoPlay);
  };

  // Continuous Audio Machine: automatically advance to next/random lesson when speech or audio finishes
  const handleLessonTTSComplete = () => {
    handleNextAction(true);
  };

  const hasNextToAdvance = Boolean(
    isShuffle || nextLesson || (nextChapter?.lessons && nextChapter.lessons.length > 0)
  );

  const hasPrevToAdvance = Boolean(
    prevLesson || (prevChapter?.lessons && prevChapter.lessons.length > 0)
  );

  const isAutoNext = settings.tts_auto_advance !== false;
  const handleToggleAutoNext = () => {
    updateSettings({ tts_auto_advance: !isAutoNext });
  };

  if (isLoading && !lesson) {
    return (
      <div className="min-h-screen bg-[#070a13] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-sky-500/20 border-t-sky-500 animate-spin" />
          <span className="text-sm font-medium">Loading Lesson Content...</span>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-[#070a13] flex items-center justify-center text-slate-400">
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
    <div className="min-h-screen bg-[#070a13] text-slate-100 flex flex-col font-sans relative">
      {/* Seamless Transition Loading Indicator */}
      {isLoading && (
        <div className="fixed top-0 inset-x-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-500 z-50 animate-pulse shadow-md shadow-sky-500/30" />
      )}

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

          {/* Brand Logo on Mobile */}
          <span
            onClick={() => navigate('/')}
            className="text-sky-400 font-bold hover:underline cursor-pointer shrink-0 sm:hidden text-sm"
          >
            Reader
          </span>

          {/* Breadcrumb Title (Desktop only, hidden on mobile to prevent overcrowding) */}
          <div className="min-w-0 hidden sm:flex items-center gap-2 text-xs truncate">
            <span
              onClick={() => navigate('/')}
              className="text-sky-400 font-bold hover:underline cursor-pointer shrink-0"
            >
              Reader
            </span>
            {course && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span
                  onClick={() => navigate(`/courses/${course.slug || course.id}`)}
                  className="text-slate-400 hover:text-sky-400 cursor-pointer truncate"
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
              <Edit3 className="w-4 h-4 text-sky-400" />
            </button>
          )}

          {/* Sổ tay cá nhân (Personal Notes) */}
          <button
            type="button"
            onClick={() => setIsNotesDrawerOpen(true)}
            className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
              isNotesDrawerOpen
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-xs'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border-slate-700/60'
            }`}
            title="Mở Sổ tay ghi chú cá nhân"
          >
            <FileText className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Ghi chú</span>
          </button>

          {/* Thảo luận & Bình luận (Comments) */}
          <button
            type="button"
            onClick={() => setIsCommentsDrawerOpen(true)}
            className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
              isCommentsDrawerOpen
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-xs'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border-slate-700/60'
            }`}
            title="Thảo luận & Hỏi đáp về bài học"
          >
            <MessageSquare className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Bình luận</span>
          </button>

          {/* Furigana Toggle Button */}
          <button
            type="button"
            onClick={() => updateSettings({ show_furigana: settings.show_furigana === false ? true : false })}
            title={settings.show_furigana === false ? 'Bật Furigana (Hiển thị phiên âm Hiragana trên chữ Hán)' : 'Tắt Furigana (Ẩn phiên âm Hiragana trên chữ Hán)'}
            className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
              settings.show_furigana !== false
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-xs'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-400 border-slate-700/60'
            }`}
          >
            <span className="text-[11px] font-bold font-mono px-1 py-0.5 rounded bg-slate-900/60 border border-slate-700/50 leading-none">
              振
            </span>
            <span className="hidden sm:inline">Furigana</span>
            <span className={`text-[10px] font-bold ${settings.show_furigana !== false ? 'text-sky-400' : 'text-slate-500'}`}>
              {settings.show_furigana !== false ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Font Size & Spacing Controls */}
          <div className="hidden md:flex items-center rounded-xl bg-slate-800/80 p-0.5 text-xs text-slate-400">
            {(['sm', 'base', 'lg'] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => updateSettings({ font_size: sz })}
                className={`px-2 py-1 rounded-lg uppercase text-[10px] font-bold transition-colors ${settings.font_size === sz ? 'bg-slate-700 text-sky-400 shadow-xs' : 'hover:text-white'}`}
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
            {focusMode ? <Minimize2 className="w-4 h-4 text-sky-400" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Mobile TOC Toggle */}
          <button
            type="button"
            onClick={() => setIsTOCOpen(!isTOCOpen)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors lg:hidden"
            title="Mục lục bài học"
          >
            <ListTree className="w-4 h-4" />
          </button>

          {/* Browser Native Speech Engine TTS - Desktop */}
          <button
            type="button"
            onClick={() => setIsSpeechPlayerOpen(!isSpeechPlayerOpen)}
            title="Listen with Browser Native Speech Engine (Auto-detects Japanese/Vietnamese & cleans Furigana)"
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isSpeechPlayerOpen
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700/60'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline">Speech TTS</span>
          </button>

          {/* Mark Completed Button - Desktop */}
          <button
            type="button"
            onClick={handleToggleComplete}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${isCompleted ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60'}`}
          >
            <BookmarkCheck className={`w-3.5 h-3.5 ${isCompleted ? 'text-sky-400' : 'text-slate-400'}`} />
            <span className="hidden md:inline">{isCompleted ? 'Completed' : 'Mark Done'}</span>
          </button>

          {/* Unified User Navigation & Sign In */}
          <div className="h-4 w-px bg-slate-800 mx-0.5 hidden sm:block" />
          <UserNavMenu compactOnMobile={true} />
        </div>
      </header>

      {/* Mobile Full-Screen Course Navigation Page */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 w-full h-[100dvh] bg-[#070a13] flex flex-col lg:hidden animate-in fade-in duration-150">
          {/* Mobile Full-Screen Header */}
          <div className="h-14 px-4 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between shrink-0 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 text-xs font-bold transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Quay lại bài đọc</span>
            </button>
            <div className="text-right">
              <span className="text-xs font-bold text-white block truncate max-w-[170px]">
                {course?.title || 'Danh sách bài học'}
              </span>
              <span className="text-[10px] text-slate-400">
                {searchQuery.trim()
                  ? `${totalMatchingLessons}/${totalLessons} bài học`
                  : `${totalLessons} bài học`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Full-Screen Lessons Tree (Independently Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {searchQuery.trim() && totalMatchingLessons === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400">
                  <Search className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">Không tìm thấy bài học nào</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Không có bài học nào khớp với từ khóa "{searchQuery}".
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-semibold hover:bg-sky-500/30 transition-colors cursor-pointer"
                >
                  Xoá bộ lọc tìm kiếm
                </button>
              </div>
            ) : (
              filteredChapters.map((chap) => {
                const filteredLessons = chap.filteredLessons;
                if (searchQuery.trim() && (!filteredLessons || filteredLessons.length === 0)) {
                  return null;
                }

                return (
                  <div key={chap.id} className="space-y-2">
                    <div className="px-2 text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center justify-between">
                      <span>{chap.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono font-medium">
                        {filteredLessons?.length || 0} bài
                      </span>
                    </div>

                    <div className="space-y-1 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/60">
                      {filteredLessons?.map((les) => {
                        const isCurrent = les.id === lesson.id || les.slug === targetLookup;
                        const lesCompleted = les.progress?.is_completed;

                        return (
                          <button
                            key={les.id}
                            type="button"
                            onClick={() => {
                              navigate(course ? `/courses/${course.slug || course.id}/${les.slug || les.id}` : `/reader/${les.id}`);
                              setIsSidebarOpen(false);
                              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                            }}
                            className={`w-full text-left p-3 rounded-xl flex items-center justify-between gap-3 transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40 shadow-xs'
                                : 'text-slate-300 hover:bg-slate-800/60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {lesCompleted ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-600 shrink-0" />
                              )}
                              <span className="text-xs truncate">{les.title}</span>
                            </div>
                            {les.audio_url && (
                              <Volume2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Docked Bottom Search Bar (Easy thumb-reachability on mobile) */}
          <div className="p-3 bg-slate-900/95 border-t border-slate-800/80 shrink-0 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-sky-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm nhanh bài học, số câu (vd: 27, giới thiệu)..."
                className="w-full pl-9 pr-20 py-2.5 bg-slate-950/80 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 transition-all shadow-inner"
              />
              {searchQuery.trim() && (
                <div className="absolute right-2.5 flex items-center gap-1.5">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold">
                    {totalMatchingLessons}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Xoá tìm kiếm"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3-Column Document Body - Edge-to-Edge Desktop Layout */}
      <div className="flex-1 flex w-full pb-28">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Course Tree Sidebar (Pinned to Far Left Edge)*/}
        {/* ========================================================= */}
        <aside
          className={`hidden lg:flex lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:w-72 xl:w-80 lg:shrink-0 bg-slate-900 border-r border-slate-800/80 flex-col overflow-hidden transition-all ${focusMode ? 'lg:hidden' : ''}`}
        >
          {/* Course Title Badge */}
          {course && (
            <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 shrink-0">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider mb-1">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Course</span>
              </div>
              <h3 className="font-bold text-sm text-white truncate">{course.title}</h3>
            </div>
          )}

          {/* Chapter & Lesson Tree (Independently Scrollable) */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
            {searchQuery.trim() && totalMatchingLessons === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400 space-y-2">
                <Search className="w-5 h-5 text-slate-400" />
                <p className="text-xs font-semibold text-slate-300">Không tìm thấy bài học nào</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[11px] font-semibold hover:bg-sky-500/30 transition-colors cursor-pointer"
                >
                  Xoá bộ lọc
                </button>
              </div>
            ) : (
              filteredChapters.map((chap) => {
                const filteredLessons = chap.filteredLessons;
                if (searchQuery.trim() && (!filteredLessons || filteredLessons.length === 0)) {
                  return null;
                }

                return (
                  <div key={chap.id} className="space-y-1">
                    <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>{chap.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono font-medium">
                        {filteredLessons?.length || 0}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      {filteredLessons?.map((les) => {
                        const isCurrent = les.id === lesson.id || les.slug === targetLookup;
                        const lesCompleted = les.progress?.is_completed;

                        return (
                          <button
                            key={les.id}
                            type="button"
                            onClick={() => {
                              navigate(course ? `/courses/${course.slug || course.id}/${les.slug || les.id}` : `/reader/${les.id}`);
                              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 transition-all cursor-pointer ${isCurrent ? 'bg-sky-500/15 text-sky-300 font-semibold border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              {lesCompleted ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              ) : (
                                <Circle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                              )}
                              <span className="truncate">{les.title}</span>
                            </div>
                            {les.audio_url && (
                              <Volume2 className="w-3 h-3 text-sky-400/80 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Search Bar Docked at Bottom */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/90 shrink-0 backdrop-blur-md">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-sky-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm nhanh bài học, số câu..."
                className="w-full pl-8 pr-16 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 transition-all shadow-inner"
              />
              {searchQuery.trim() && (
                <div className="absolute right-2 flex items-center gap-1">
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 font-semibold">
                    {totalMatchingLessons}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Xoá tìm kiếm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* CENTER COLUMN: Main Reading Article Content               */}
        {/* ========================================================= */}
        <main className="flex-1 min-w-0 px-4 sm:px-8 md:px-12 pb-36 sm:pb-32 pt-0">
          {/* Sticky Pinned Article Header */}
          <div
            className={`sticky top-14 z-20 -mx-4 px-4 sm:-mx-8 sm:px-8 md:-mx-12 md:px-12 bg-[#070a13]/95 backdrop-blur-2xl border-b transition-all duration-200 mb-6 ${
              isScrolled
                ? 'py-2.5 sm:py-3 border-slate-700/80 shadow-xl shadow-black/80'
                : 'py-3.5 sm:py-4 border-slate-800/80 shadow-xs'
            } ${settings.show_furigana === false ? 'hide-furigana' : ''}`}
            data-furigana={settings.show_furigana === false ? 'false' : 'true'}
          >
            <div className="max-w-3xl xl:max-w-4xl mx-auto flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3 min-w-0">
                <h1
                  onClick={() => isScrolled && window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className={`font-extrabold text-white tracking-tight transition-all duration-200 ${
                    isScrolled
                      ? 'text-sm sm:text-base lg:text-lg line-clamp-2 leading-snug cursor-pointer hover:text-sky-300'
                      : 'text-lg sm:text-xl lg:text-2xl leading-tight'
                  }`}
                  title={isScrolled ? `${lesson.title} (Bấm để cuộn lên đầu bài)` : lesson.title}
                >
                  {lesson.title}
                </h1>
              </div>

              {/* Action Pills & Progress Row */}
              <div
                className={`flex flex-wrap items-center gap-2 text-xs text-slate-400 transition-all duration-200 ${
                  isScrolled ? 'text-[11px]' : ''
                }`}
              >
                {isCompleted && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Đã hoàn thành</span>
                  </div>
                )}
                {lesson.toc_data && lesson.toc_data.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700/60 font-medium">
                    <ListTree className="w-3.5 h-3.5 text-sky-400" />
                    <span>{completedSections.length}/{lesson.toc_data.length} mục đã học</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Article Body Content */}
          <div className="max-w-3xl xl:max-w-4xl mx-auto pt-2">
            {/* Markdown Body */}
            <div
              ref={articleContainerRef}
              id="article-content"
              className={settings.show_furigana === false ? 'hide-furigana' : ''}
              data-furigana={settings.show_furigana === false ? 'false' : 'true'}
            >
              <MarkdownRenderer
                content={lesson.raw_markdown || ''}
                fontSize={settings.font_size}
                lineSpacing={settings.line_spacing}
                completedSections={completedSections}
                onToggleSection={handleToggleSection}
                showFurigana={settings.show_furigana !== false}
                tocData={lesson.toc_data}
              />
            </div>

            {/* Chapter Navigation Controls */}
            {(prevChapter || nextChapter) && (
              <div className="mt-12 pt-6 border-t border-slate-800/80 flex items-center justify-between gap-3 text-xs">
                {prevChapter ? (
                  <button
                    type="button"
                    onClick={() => navigateToChapter(prevChapter)}
                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer group"
                  >
                    <ChevronsLeft className="w-4 h-4 text-sky-400 group-hover:-translate-x-0.5 transition-transform" />
                    <div className="text-left">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Chương trước</div>
                      <div className="truncate max-w-[130px] sm:max-w-[200px] font-medium">{prevChapter.title}</div>
                    </div>
                  </button>
                ) : <div />}

                {nextChapter && (
                  <button
                    type="button"
                    onClick={() => navigateToChapter(nextChapter)}
                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer group ml-auto text-right"
                  >
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Chương tiếp theo</div>
                      <div className="truncate max-w-[130px] sm:max-w-[200px] font-medium">{nextChapter.title}</div>
                    </div>
                    <ChevronsRight className="w-4 h-4 text-sky-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
              </div>
            )}

            {/* Bottom Lesson Navigation */}
            <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-center justify-between gap-4">
              {prevLesson ? (
                <button
                  type="button"
                  onClick={() => navigateToLesson(prevLesson)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer group"
                >
                  <ChevronLeft className="w-4 h-4 text-sky-400 group-hover:-translate-x-0.5 transition-transform" />
                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 block font-normal">Bài trước</span>
                    <span className="truncate max-w-[130px] sm:max-w-[200px] block font-medium">{prevLesson.title}</span>
                  </div>
                </button>
              ) : (
                <div />
              )}

              {nextLesson && (
                <button
                  type="button"
                  onClick={() => navigateToLesson(nextLesson)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-all cursor-pointer shadow-lg shadow-sky-600/20 group"
                >
                  <div className="text-right">
                    <span className="text-[10px] text-sky-200 block font-normal">Bài tiếp theo</span>
                    <span className="truncate max-w-[130px] sm:max-w-[200px] block font-medium">{nextLesson.title}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-sky-200 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}
            </div>

            {/* Inline Comments Section */}
            <div className="mt-14 pt-8 border-t border-slate-800">
              <LessonCommentsSection lessonId={lesson.id} />
            </div>
          </div>
        </main>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Sticky Table of Contents (Pinned to Far Right)*/}
        {/* ========================================================= */}
        {lesson.toc_data && lesson.toc_data.length > 0 && !focusMode && (
          <aside className="hidden lg:block w-72 xl:w-80 shrink-0 p-5 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto text-xs border-l border-slate-800/80 bg-slate-900/40">
            {/* TOC Progress Tracker Header */}
            <div className="mb-4 p-3 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <ListTree className="w-3.5 h-3.5 text-sky-400" />
                  Tiến độ các mục
                </span>
                <span className="text-sky-400 font-mono">
                  {completedSections.length}/{lesson.toc_data.length} ({Math.round((completedSections.length / lesson.toc_data.length) * 100)}%)
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min(100, Math.round((completedSections.length / lesson.toc_data.length) * 100))}%` }}
                />
              </div>
              <div className="flex items-center justify-between pt-1 text-[10px]">
                <button
                  type="button"
                  onClick={handleToggleAllSections}
                  className="text-slate-400 hover:text-sky-300 underline cursor-pointer transition-colors"
                >
                  {completedSections.length === lesson.toc_data.length ? 'Bỏ chọn tất cả' : 'Đánh dấu xong tất cả'}
                </button>
                {completedSections.length === lesson.toc_data.length && (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Đã hoàn tất
                  </span>
                )}
              </div>
            </div>

            <nav className="space-y-0.5">
              {lesson.toc_data.map((item) => {
                const isActive = activeHeadingId === item.id;
                const isSectionDone = completedSections.includes(item.id);
                const indentClass = item.level === 3 ? 'pl-4 text-[11px]' : 'pl-1 font-semibold text-xs text-slate-200 mt-2';

                return (
                  <div
                    key={item.id}
                    className={`group flex items-center justify-between gap-1.5 py-1 px-1.5 rounded-lg transition-colors ${
                      isActive ? 'bg-sky-500/15 border-l-2 border-sky-400' : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <a
                      href={`#${item.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleScrollToHeading(item);
                      }}
                      className={`truncate flex-1 leading-snug cursor-pointer ${indentClass} ${
                        isSectionDone
                          ? 'text-emerald-400/90 line-through decoration-emerald-500/40'
                          : isActive
                          ? 'text-sky-300 font-bold'
                          : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                      title={item.text}
                    >
                      {item.text}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleToggleSection(item.id)}
                      title={isSectionDone ? 'Bỏ đánh dấu xong' : 'Đánh dấu đã hoàn thành'}
                      className="p-1 rounded-md text-slate-500 hover:text-emerald-400 cursor-pointer transition-colors shrink-0"
                    >
                      {isSectionDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
                      )}
                    </button>
                  </div>
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
          <div className="fixed inset-x-0 bottom-0 z-50 p-6 bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[80vh] overflow-y-auto lg:hidden animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <span className="font-bold text-sm text-white flex items-center gap-2">
                <ListTree className="w-4 h-4 text-sky-400" />
                Mục lục bài học
              </span>
              <button
                type="button"
                onClick={() => setIsTOCOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress Bar inside Mobile TOC */}
            {lesson.toc_data && lesson.toc_data.length > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300">Tiến độ các mục</span>
                  <span className="text-sky-400 font-mono">
                    {completedSections.length}/{lesson.toc_data.length} ({Math.round((completedSections.length / lesson.toc_data.length) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all rounded-full"
                    style={{ width: `${Math.min(100, Math.round((completedSections.length / lesson.toc_data.length) * 100))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <button
                    type="button"
                    onClick={handleToggleAllSections}
                    className="text-slate-400 hover:text-sky-300 underline cursor-pointer"
                  >
                    {completedSections.length === lesson.toc_data.length ? 'Bỏ chọn tất cả' : 'Đánh dấu xong tất cả'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              {lesson.toc_data?.map((item) => {
                const isSectionDone = completedSections.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-xl hover:bg-slate-800/60"
                  >
                    <a
                      href={`#${item.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setIsTOCOpen(false);
                        handleScrollToHeading(item);
                      }}
                      className={`text-xs truncate flex-1 cursor-pointer ${
                        isSectionDone
                          ? 'text-emerald-400 line-through'
                          : 'text-slate-300 hover:text-sky-400'
                      } ${item.level === 3 ? 'pl-4' : 'font-semibold pl-1'}`}
                    >
                      {item.text}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleToggleSection(item.id)}
                      className="p-1 rounded-md text-slate-500 hover:text-emerald-400 cursor-pointer"
                    >
                      {isSectionDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Browser Native Speech Engine (Headless: Zero DOM popups, all controls inside ArticleTopPlayer) */}
      <BrowserSpeechPlayer
        lessonId={lesson.id}
        headless={true}
        onControllerReady={handleControllerReady}
        rawMarkdown={
          (() => {
            const track = lesson.audio_tracks?.find((t) => t.slot_num === selectedAudioSlot);
            if (track?.audio_script && track.audio_script.trim()) {
              return track.audio_script;
            }
            return lesson.raw_markdown || '';
          })()
        }
        title={
          (() => {
            const track = lesson.audio_tracks?.find((t) => t.slot_num === selectedAudioSlot);
            if (track?.title) {
              return `${lesson.title} (${track.title})`;
            }
            return lesson.title;
          })()
        }
        isOpen={audioMode === 'browser' && isSpeechPlayerOpen}
        onClose={() => {
          setIsSpeechPlayerOpen(false);
          setActiveSpeechSentence(null);
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
          }
        }}
        onLessonComplete={handleLessonTTSComplete}
        hasNextLesson={hasNextToAdvance}
        autoPlay={autoPlayFromUrl && audioMode === 'browser'}
        autoAdvance={isAutoNext}
        hasAudioUrl={!!lesson.audio_url}
        onSwitchToStudioAudio={() => {
          setAudioMode('studio');
          setIsSpeechPlayerOpen(false);
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
          }
        }}
        onRequestGenerateTTS={() => handleGenerateTTS(false)}
        isGeneratingTTS={isGeneratingTTS}
        onActiveSentenceChange={handleActiveSentenceChange}
        onSentenceProgress={handleSentenceProgress}
        onScrollToActiveSentence={scrollToActiveSentence}
        targetSentenceIndex={targetSpeechIndex}
        onTargetSentenceHandled={() => setTargetSpeechIndex(null)}
      />

      {/* Personal Notes Slide-over Drawer */}
      <LessonNotesDrawer
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        isOpen={isNotesDrawerOpen}
        onClose={() => setIsNotesDrawerOpen(false)}
      />

      {/* Lesson Comments Slide-over Drawer (for mobile / fast popup) */}
      <LessonCommentsSection
        lessonId={lesson.id}
        isDrawer={true}
        isOpen={isCommentsDrawerOpen}
        onClose={() => setIsCommentsDrawerOpen(false)}
      />

      {/* Master Docked Bottom Player Bar (Persistent, thumb-reachable, outside article body) */}
      <DockedBottomPlayer
        audioUrl={lesson.audio_url}
        title={lesson.title}
        chapterTitle={course?.chapters?.find((c) => c.id === lesson.chapter_id)?.title}
        duration={lesson.duration_seconds}
        isGeneratingTTS={isGeneratingTTS}
        onGenerateTTS={handleGenerateTTS}
        audioTracks={lesson.audio_tracks}
        activeSlot={selectedAudioSlot}
        onSelectSlot={(slot) => setSelectedAudioSlot(slot)}
        audioMode={audioMode}
        onAudioModeChange={(mode) => {
          setAudioMode(mode);
          if (mode === 'browser') {
            setIsSpeechPlayerOpen(true);
            setIsStudioAudioOpen(false);
          } else {
            setIsSpeechPlayerOpen(false);
            setIsStudioAudioOpen(true);
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
              window.speechSynthesis.cancel();
            }
          }
        }}
        isBrowserSpeechActive={audioMode === 'browser' && (speechController?.isPlaying ?? false)}
        onToggleBrowserSpeech={() => {
          if (speechController) {
            speechController.handleToggle();
          } else {
            setIsSpeechPlayerOpen(!isSpeechPlayerOpen);
          }
        }}
        browserController={speechController}
        activeSentenceSnippet={activeSpeechSentence?.text}
        autoPlay={autoPlayFromUrl}
        isShuffle={isShuffle}
        onToggleShuffle={() => setIsShuffle((prev) => !prev)}
        onNextLesson={hasNextToAdvance ? () => handleNextAction(true) : undefined}
        onPrevLesson={hasPrevToAdvance ? () => handlePrevAction(false) : undefined}
        hasNextLesson={hasNextToAdvance}
        hasPrevLesson={hasPrevToAdvance}
        autoNext={isAutoNext}
        onToggleAutoNext={handleToggleAutoNext}
      />

      {/* Floating Action Menu on Text Selection */}
      {floatingBarPos && selectedText && !isVocaburnModalOpen && (
        <div
          id="selection-floating-bar"
          style={{
            position: 'fixed',
            left: `${floatingBarPos.x}px`,
            top: `${floatingBarPos.y}px`,
          }}
          className="z-50 flex items-center gap-1 p-1 bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        >
          {/* 🔊 Nghe */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleSpeakSelection();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-sky-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Nghe phát âm từ/câu được chọn"
          >
            <Volume2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Nghe</span>
          </button>

          <div className="h-4 w-px bg-slate-700/60" />

          {/* 🎴 Lưu vào Vocaburn */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleOpenVocaburnModal();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-300 hover:text-amber-200 hover:bg-amber-500/20 transition-colors cursor-pointer"
            title="Lưu từ/câu này vào bộ thẻ Vocaburn để ôn tập FSRS"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Lưu Vocaburn</span>
          </button>

          <div className="h-4 w-px bg-slate-700/60" />

          {/* 📋 Sao chép */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleCopySelection();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Sao chép văn bản đã chọn"
          >
            {isCopiedToast ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Đã chép</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Sao chép</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Modal: Lưu thẻ vào Vocaburn LMS Deck */}
      {isVocaburnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-orange-500/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Lưu Thẻ Vào Vocaburn</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">FSRS v6</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Lưu vào <span className="text-sky-300 font-medium">Sổ từ vựng Reader LMS</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVocaburnModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveToVocaburn} className="p-5 space-y-3.5 text-xs">
              {vocaburnSuccessMsg ? (
                <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-center font-bold flex items-center justify-center gap-2 animate-in zoom-in duration-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>{vocaburnSuccessMsg}</span>
                </div>
              ) : (
                <>
                  {/* Mặt trước */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 flex items-center justify-between">
                      <span>Mặt trước (Từ vựng / Câu hỏi) *</span>
                      <span className="text-[10px] text-slate-500 font-normal">Hiển thị khi ôn tập</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={vocaburnCardData.front}
                      onChange={(e) => setVocaburnCardData({ ...vocaburnCardData, front: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none text-slate-100 font-medium"
                      placeholder="VD: 社会人"
                    />
                  </div>

                  {/* Phiên âm / Reading */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 flex items-center justify-between">
                      <span>Cách đọc (Reading / Hiragana / Romaji)</span>
                      <span className="text-[10px] text-slate-500 font-normal">Tự động điền nếu là Kanji</span>
                    </label>
                    <input
                      type="text"
                      value={vocaburnCardData.reading}
                      onChange={(e) => setVocaburnCardData({ ...vocaburnCardData, reading: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none text-slate-100 font-mono"
                      placeholder="VD: しゃかいじん"
                    />
                  </div>

                  {/* Mặt sau */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 flex items-center justify-between">
                      <span>Mặt sau (Giải nghĩa / Bản dịch)</span>
                      <span className="text-[10px] text-slate-500 font-normal">Hiển thị khi lật thẻ</span>
                    </label>
                    <textarea
                      rows={2}
                      value={vocaburnCardData.back}
                      onChange={(e) => setVocaburnCardData({ ...vocaburnCardData, back: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none text-slate-100 resize-none"
                      placeholder="VD: Người đi làm, người đã gia nhập xã hội lao động"
                      autoFocus
                    />
                  </div>

                  {/* Ngữ cảnh / Ví dụ */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 flex items-center justify-between">
                      <span>Ngữ cảnh / Câu ví dụ trích từ bài học</span>
                      <span className="text-[10px] text-slate-500 font-normal">Tự động trích đoạn</span>
                    </label>
                    <textarea
                      rows={2}
                      value={vocaburnCardData.context}
                      onChange={(e) => setVocaburnCardData({ ...vocaburnCardData, context: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none text-slate-300 resize-none font-sans"
                    />
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsVocaburnModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer transition-colors"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingVocaburn || !vocaburnCardData.front.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold cursor-pointer transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
                    >
                      {isSavingVocaburn ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang lưu...</span>
                        </>
                      ) : (
                        <>
                          <Flame className="w-3.5 h-3.5 fill-current" />
                          <span>Lưu vào Vocaburn</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
