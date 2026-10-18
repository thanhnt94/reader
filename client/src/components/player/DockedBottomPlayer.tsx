import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Headphones,
  Radio,
  RefreshCw,
  SkipForward,
  SkipBack,
  Shuffle,
  ChevronUp,
  ChevronDown,
  Sliders,
  Subtitles,
  ListVideo,
  Clock,
  AlignLeft,
  X,
  Gauge,
  Check
} from 'lucide-react';
import { AudioTrack } from '../../lib/api/readerApi';
import { BrowserSpeechController } from './BrowserSpeechPlayer';

export interface ChapterItem {
  id?: number;
  start: number;
  end?: number;
  title: string;
}

export interface SubtitleItem {
  id?: number;
  start: number;
  end: number;
  lang?: string;
  speaker?: string;
  text: string;
}

export interface TrackMetadata {
  chapters?: ChapterItem[];
  subtitles?: SubtitleItem[];
  total_duration?: number;
}

export interface DockedBottomPlayerProps {
  audioUrl?: string | null;
  title: string;
  chapterTitle?: string;
  duration?: number;
  isGeneratingTTS?: boolean;
  onGenerateTTS?: (slot?: number, force?: boolean) => void;
  // Multi-slot audio tracks
  audioTracks?: AudioTrack[];
  activeSlot?: number;
  onSelectSlot?: (slot: number) => void;
  // Mode selection: 'studio' (file MP3 Edge-TTS) or 'browser' (Web Speech API Karaoke)
  audioMode: 'studio' | 'browser';
  onAudioModeChange: (mode: 'studio' | 'browser') => void;
  // Browser Speech Player state & triggers
  isBrowserSpeechActive?: boolean;
  onToggleBrowserSpeech?: () => void;
  activeSentenceSnippet?: string | null;
  browserController?: BrowserSpeechController | null;
  // Continuous Auto-Next & Shuffle across lessons
  autoPlay?: boolean;
  isShuffle?: boolean;
  onToggleShuffle?: () => void;
  onNextLesson?: () => string | null | void;
  onPrevLesson?: () => string | null | void;
  hasNextLesson?: boolean;
  hasPrevLesson?: boolean;
  autoNext?: boolean;
  onToggleAutoNext?: () => void;
}

export const DockedBottomPlayer: React.FC<DockedBottomPlayerProps> = ({
  audioUrl,
  title,
  duration = 0,
  isGeneratingTTS = false,
  onGenerateTTS,
  audioTracks,
  activeSlot = 1,
  onSelectSlot,
  audioMode,
  onAudioModeChange,
  isBrowserSpeechActive = false,
  onToggleBrowserSpeech,
  activeSentenceSnippet,
  browserController,
  autoPlay = false,
  isShuffle = false,
  onToggleShuffle,
  onNextLesson,
  onPrevLesson,
  hasNextLesson = false,
  hasPrevLesson = false,
  autoNext: propAutoNext,
  onToggleAutoNext,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number>(activeSlot || 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [internalAutoNext, setInternalAutoNext] = useState<boolean>(true);
  const autoNext = propAutoNext !== undefined ? propAutoNext : internalAutoNext;

  // Rich metadata (YouTube-style chapters & Subtitles) state
  const [isCCActive, setIsCCActive] = useState(true);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [hoverSeekInfo, setHoverSeekInfo] = useState<{ time: number; x: number; chapter?: string } | null>(null);
  const [drawerActiveTab, setDrawerActiveTab] = useState<'chapters' | 'subtitles' | 'settings'>('chapters');
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  const handleToggleAutoNext = () => {
    if (onToggleAutoNext) {
      onToggleAutoNext();
    } else {
      setInternalAutoNext((prev) => !prev);
    }
  };

  // Sync selectedSlot when activeSlot prop changes
  useEffect(() => {
    if (activeSlot && activeSlot !== selectedSlot) {
      setSelectedSlot(activeSlot);
    }
  }, [activeSlot]);

  // Ensure selectedSlot is valid for current lesson's audioTracks
  useEffect(() => {
    if (audioTracks && audioTracks.length > 0) {
      const hasCurrentSlot = audioTracks.some((t) => t.slot_num === selectedSlot);
      if (!hasCurrentSlot) {
        setSelectedSlot(1);
        if (onSelectSlot) onSelectSlot(1);
      }
    }
  }, [audioTracks, selectedSlot, onSelectSlot]);

  // Determine current active track and audio URL
  const currentTrack = audioTracks?.find((t) => t.slot_num === selectedSlot);
  const effectiveAudioUrl = currentTrack?.audio_url || (selectedSlot === 1 ? audioUrl : null);
  const effectiveDuration = currentTrack?.duration_seconds || (selectedSlot === 1 ? duration : 0);

  // Sync totalDuration when duration changes
  useEffect(() => {
    if (effectiveDuration > 0) {
      setTotalDuration(effectiveDuration);
    }
  }, [effectiveDuration]);

  // Parse JSON chapters & subtitles from currentTrack.audio_script
  const parsedTrackData = useMemo<TrackMetadata | null>(() => {
    if (!currentTrack?.audio_script) return null;
    const str = currentTrack.audio_script.trim();
    if (!str.startsWith('{')) return null;
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }, [currentTrack?.audio_script]);

  const rawChapters: ChapterItem[] = parsedTrackData?.chapters || [];
  const rawSubtitles: SubtitleItem[] = parsedTrackData?.subtitles || [];

  // Derive chapters with explicit end time
  const chapters: ChapterItem[] = useMemo(() => {
    return rawChapters.map((ch, idx) => {
      const nextStart = rawChapters[idx + 1]?.start;
      return {
        ...ch,
        end: ch.end !== undefined ? ch.end : (nextStart !== undefined ? nextStart : (totalDuration || 99999))
      };
    });
  }, [rawChapters, totalDuration]);

  // Active chapter based on currentTime
  const activeChapter = useMemo(() => {
    if (!chapters.length) return null;
    return chapters.find((ch) => currentTime >= ch.start && currentTime < (ch.end ?? 99999)) || chapters[chapters.length - 1];
  }, [chapters, currentTime]);

  // Derive continuous subtitles (no gaps between sentences, smooth YouTube CC display)
  const subtitles: SubtitleItem[] = useMemo(() => {
    return rawSubtitles.map((sub, idx) => {
      const nextStart = rawSubtitles[idx + 1]?.start;
      return {
        ...sub,
        end: nextStart !== undefined ? nextStart : (sub.end + 1.0)
      };
    });
  }, [rawSubtitles]);

  // Active subtitle based on currentTime (seamless across sentences)
  const activeSubtitle = useMemo(() => {
    if (!subtitles.length) return null;
    return subtitles.find((sub) => currentTime >= sub.start && currentTime < sub.end) || null;
  }, [subtitles, currentTime]);

  // Keep HTML5 audio playbackRate strictly in sync with playbackRate state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // High-precision (60 FPS / ~16ms) timeline tracking for frame-perfect subtitles at all playback speeds (0.8x - 2.0x)
  useEffect(() => {
    let animId: number;
    let lastTime = -1;

    const tick = () => {
      if (audioRef.current && !audioRef.current.paused) {
        const ct = audioRef.current.currentTime;
        // High-precision 50ms threshold avoids React thrashing while ensuring frame-perfect subtitle match
        if (Math.abs(ct - lastTime) >= 0.05) {
          lastTime = ct;
          setCurrentTime(ct);
        }
        animId = requestAnimationFrame(tick);
      }
    };

    if (isPlaying && audioMode === 'studio') {
      animId = requestAnimationFrame(tick);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying, audioMode]);

  // Centralized robust track loader and player
  const loadAndPlayTrack = (url: string, autoStart: boolean = true) => {
    if (!audioRef.current) return;
    const cleanUrl = url.replace('auth.inmind.site', 'inmind.site');
    const currentSrc = audioRef.current.src || '';

    if (!currentSrc.includes(cleanUrl)) {
      audioRef.current.src = cleanUrl;
      audioRef.current.load();
    }
    audioRef.current.currentTime = 0;
    setCurrentTime(0);

    if (autoStart) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.warn('Autoplay waiting for interaction:', err);
          setIsPlaying(false);
        });
      }
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Jump to specific timestamp
  const seekToTime = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    setCurrentTime(seconds);
    if (audioRef.current.paused) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  // Hover Seekbar Handler for YouTube-style chapter preview
  const handleSeekbarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!totalDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const hoverTime = ratio * totalDuration;

    let matchedChapterTitle: string | undefined;
    if (chapters.length > 0) {
      const matched = chapters.find((ch) => hoverTime >= ch.start && hoverTime < (ch.end ?? 99999));
      matchedChapterTitle = matched?.title;
    }

    setHoverSeekInfo({
      time: hoverTime,
      x: clickX,
      chapter: matchedChapterTitle
    });
  };

  const handleSeekbarMouseLeave = () => {
    setHoverSeekInfo(null);
  };

  // Auto-scroll transcript drawer to active subtitle
  useEffect(() => {
    if (isExpanded && drawerActiveTab === 'subtitles' && transcriptScrollRef.current) {
      const activeEl = transcriptScrollRef.current.querySelector('[data-active-sub="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentTime, isExpanded, drawerActiveTab]);

  // Synchronize audio source without unnecessary pause/reloads
  useEffect(() => {
    if (!audioRef.current) return;
    const targetSrc = effectiveAudioUrl ? effectiveAudioUrl.replace('auth.inmind.site', 'inmind.site') : '';
    const currentSrc = audioRef.current.src || '';

    if (!targetSrc) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      setIsPlaying(false);
      setCurrentTime(0);
      return;
    }

    // If target audio is already loaded on this audio element, do NOT reload/pause!
    const isAlreadyLoaded = currentSrc.includes(targetSrc) || (targetSrc && currentSrc.endsWith(targetSrc));
    if (isAlreadyLoaded) {
      return;
    }

    // When switching to a new lesson/track:
    // If user was currently playing or autoPlay is active, automatically play the new track!
    const wasPlaying = isPlaying || (audioRef.current && !audioRef.current.paused);
    const shouldPlay = Boolean((wasPlaying || autoPlay) && audioMode === 'studio');

    loadAndPlayTrack(targetSrc, shouldPlay);
  }, [effectiveAudioUrl, selectedSlot, autoPlay, audioMode]);

  // Pause studio audio if user switches away to browser speech mode
  useEffect(() => {
    if (audioMode === 'browser' && isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    }
  }, [audioMode]);

  // Handle studio audio ended (Continuous Auto-Next on same unlocked audio element!)
  const handleAudioEnded = () => {
    if (autoNext && onNextLesson && hasNextLesson) {
      const nextTargetAudio = onNextLesson();
      if (audioMode === 'studio' && nextTargetAudio) {
        loadAndPlayTrack(nextTargetAudio, true);
      }
      return;
    }

    setIsPlaying(false);
  };

  // User-Gesture Next Click: synchronously sets source and starts playback
  const handleNextClick = () => {
    if (onNextLesson) {
      const nextTargetAudio = onNextLesson();
      if (audioMode === 'studio' && nextTargetAudio) {
        loadAndPlayTrack(nextTargetAudio, true);
      }
    }
  };

  // User-Gesture Prev Click: synchronously sets source and starts playback
  const handlePrevClick = () => {
    if (onPrevLesson) {
      const prevTargetAudio = onPrevLesson();
      if (audioMode === 'studio' && prevTargetAudio) {
        loadAndPlayTrack(prevTargetAudio, true);
      }
    }
  };

  // Toggle Studio Audio Play/Pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (!audioRef.current.paused) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioRef.current.ended || audioRef.current.currentTime >= (audioRef.current.duration || 9999)) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
      }
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => console.error('Audio playback error:', e));
    }
  };

  // Skip forward / backward
  const skip = (seconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(totalDuration || 9999, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Cycle speed: 0.8x -> 1.0x -> 1.25x -> 1.5x -> 2.0x -> 0.8x
  const cycleRate = () => {
    const rates = [0.8, 1.0, 1.25, 1.5, 2.0];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  // Seek bar scrubber
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  // Volume slider
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
    }
  };

  // Toggle Mute
  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioRef.current.muted = nextMuted;
  };

  // Format time mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0;

  const slotItems = [1, 2, 3].map((num) => {
    const track = audioTracks?.find((t) => t.slot_num === num);
    return {
      slot_num: num,
      label: track?.title || `Slot ${num}`,
      desc: track?.description || `Kịch bản audio Slot ${num}`,
      hasAudio: Boolean(track?.audio_url || (num === 1 && audioUrl)),
      hasScript: Boolean(track?.audio_script && track.audio_script.trim()),
    };
  });

  const isCurrentActivePlaying =
    audioMode === 'studio' ? isPlaying : Boolean(browserController?.isPlaying || isBrowserSpeechActive);

  return (
    <aside
      aria-label="Audio Player Dock"
      className="fixed bottom-0 inset-x-0 z-40 bg-[#070a13]/95 backdrop-blur-2xl border-t border-slate-800/90 shadow-2xl transition-all duration-200"
    >
      {/* Floating Real-time Subtitle Capsule (YouTube-style CC HUD: Pure Black BG, Crisp White Multi-line Text) */}
      {(() => {
        if (!isCCActive) return null;
        let text = '';
        let isNanami = false;
        let hasActive = false;

        if (audioMode === 'studio') {
          if (activeSubtitle && (isPlaying || currentTime > 0)) {
            hasActive = true;
            text = activeSubtitle.text;
            isNanami = Boolean(
              activeSubtitle.speaker?.toLowerCase().includes('nanami') ||
              activeSubtitle.lang === 'ja' ||
              /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(activeSubtitle.text)
            );
          }
        } else {
          // Browser Web Speech Mode
          if (isCurrentActivePlaying) {
            const browserText = browserController?.currentSentence?.text || activeSentenceSnippet;
            if (browserText) {
              hasActive = true;
              text = browserText;
              isNanami = Boolean(
                browserController?.currentSentence?.lang?.startsWith('ja') ||
                /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(browserText)
              );
            }
          }
        }

        if (!hasActive || !text) return null;

        return (
          <div
            onClick={() => {
              setDrawerActiveTab('subtitles');
              setIsExpanded(true);
            }}
            className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-[92vw] sm:w-auto max-w-[94vw] sm:max-w-xl md:max-w-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-md sm:rounded-lg bg-black/90 border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-md flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150 z-50 cursor-pointer hover:bg-black/95 transition-all group"
            title="Nhấp để xem toàn bộ phụ đề"
          >
            {/* YouTube CC Speaker Badge */}
            <span
              className={`text-[10px] sm:text-[11px] font-bold uppercase px-2 py-0.5 rounded tracking-wide shrink-0 mt-0.5 shadow-xs ${
                isNanami
                  ? 'bg-rose-600/90 text-white border border-rose-400/40'
                  : 'bg-sky-600/90 text-white border border-sky-400/40'
              }`}
            >
              {isNanami ? 'Nanami 🇯🇵' : 'Hoài My 🇻🇳'}
            </span>

            {/* Subtitle Content (YouTube CC: Multi-line, Crisp White Text, No Truncation) */}
            <div className="flex-1 min-w-0 max-h-28 sm:max-h-36 overflow-y-auto pr-1">
              <p className="text-white text-xs sm:text-sm md:text-[15px] font-medium leading-relaxed tracking-wide whitespace-normal break-words drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                {text}
              </p>
            </div>

            {/* Dismiss Subtitle Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCCActive(false);
              }}
              className="p-1 rounded text-white/50 hover:text-white hover:bg-white/20 shrink-0 -mr-1 transition-colors"
              title="Tắt phụ đề nổi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })()}


      {/* Embedded Hidden HTML5 Audio Element (rendered unconditionally to maintain browser unlock) */}
      <audio
        ref={audioRef}
        preload="auto"
        onPlay={() => {
          setIsPlaying(true);
          if (audioRef.current) {
            audioRef.current.playbackRate = playbackRate;
          }
        }}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            if (audioRef.current.duration) {
              setTotalDuration(audioRef.current.duration);
            }
            audioRef.current.playbackRate = playbackRate;
          }
        }}
        onEnded={handleAudioEnded}
      />

      {/* Top Edge Interactive Scrubber Track (Thin, full-width with hover scrub & YouTube chapter markers) */}
      <div
        className="relative w-full h-1.5 sm:h-2 group/bar cursor-pointer bg-slate-800/80 hover:h-2.5 sm:hover:h-3 transition-all"
        onMouseMove={handleSeekbarMouseMove}
        onMouseLeave={handleSeekbarMouseLeave}
      >
        {/* Glow fill */}
        <div
          className="h-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-all rounded-r-full"
          style={{
            width: `${
              audioMode === 'studio'
                ? progressPercent
                : browserController?.totalSentences
                ? Math.min(
                    100,
                    Math.max(
                      0,
                      (((browserController.currentIndex ?? 0) + 1) / browserController.totalSentences) * 100
                    )
                  )
                : 0
            }%`,
          }}
        />

        {/* Chapter tick dividers (YouTube style) */}
        {chapters.map((ch, idx) => {
          if (idx === 0) return null;
          const leftPct = (ch.start / (totalDuration || 1)) * 100;
          if (leftPct <= 0 || leftPct >= 100) return null;
          return (
            <div
              key={idx}
              className="absolute top-0 bottom-0 w-[2px] bg-slate-950/90 z-20 pointer-events-none group-hover/bar:bg-slate-950"
              style={{ left: `${leftPct}%` }}
            />
          );
        })}

        {/* Hover preview tooltip */}
        {hoverSeekInfo && (
          <div
            className="absolute bottom-4 sm:bottom-5 -translate-x-1/2 z-50 pointer-events-none px-2.5 py-1 rounded-lg bg-slate-900/95 border border-sky-500/40 shadow-2xl backdrop-blur-md text-[11px] flex flex-col items-center gap-0.5 whitespace-nowrap animate-in fade-in zoom-in-95 duration-100"
            style={{ left: `${hoverSeekInfo.x}px` }}
          >
            {hoverSeekInfo.chapter && (
              <span className="font-bold text-sky-300 max-w-[220px] truncate">{hoverSeekInfo.chapter}</span>
            )}
            <span className="font-mono text-slate-300">{formatTime(hoverSeekInfo.time)}</span>
          </div>
        )}

        {/* Invisible range input overlaid on top */}
        {audioMode === 'studio' && (
          <input
            type="range"
            min={0}
            max={totalDuration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title="Kéo để tua nhanh âm thanh"
          />
        )}
      </div>

      {/* Slide-Up Expanded Drawer (Subtitles, Chapters, Scripts & Audio Settings) */}
      {isExpanded && (
        <div className="px-3 py-3 sm:px-6 bg-slate-900/95 border-b border-slate-800/80 animate-in slide-in-from-bottom duration-150 max-h-[60vh] sm:max-h-[50vh] overflow-y-auto">
          <div className="max-w-7xl mx-auto flex flex-col gap-2.5">
            {/* Drawer Tab Switcher Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 gap-2">
              <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
                {chapters.length > 0 && audioMode === 'studio' && (
                  <button
                    type="button"
                    onClick={() => setDrawerActiveTab('chapters')}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      drawerActiveTab === 'chapters'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ListVideo className="w-3.5 h-3.5" />
                    <span>Phân đoạn ({chapters.length})</span>
                  </button>
                )}
                {subtitles.length > 0 && audioMode === 'studio' && (
                  <button
                    type="button"
                    onClick={() => setDrawerActiveTab('subtitles')}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      drawerActiveTab === 'subtitles'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                    <span>Phụ đề ({subtitles.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDrawerActiveTab('settings')}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    drawerActiveTab === 'settings'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Cài đặt & Slot</span>
                </button>
              </div>

              {/* Close Drawer Button */}
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all shrink-0"
                title="Đóng bảng mở rộng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab 1: Web Speech Karaoke Display */}
            {audioMode === 'browser' ? (
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-sky-500/30">
                <div className="flex items-center justify-between text-[11px] font-bold text-sky-400 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping shrink-0" />
                    Phụ đề Karaoke (Đoạn {Math.min((browserController?.currentIndex ?? 0) + 1, browserController?.totalSentences || 1)} / {browserController?.totalSentences || 1})
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300">
                    {browserController?.currentSentence?.lang || 'Web Speech'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed">
                  {browserController?.currentSentence?.text || activeSentenceSnippet || 'Đang chờ phát âm...'}
                </p>
              </div>
            ) : drawerActiveTab === 'chapters' && chapters.length > 0 ? (
              /* Tab 2: Chapters List */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                {chapters.map((ch, idx) => {
                  const isCurrent = activeChapter?.title === ch.title && activeChapter?.start === ch.start;
                  return (
                    <button
                      key={ch.id || idx}
                      type="button"
                      onClick={() => seekToTime(ch.start)}
                      className={`flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-sky-500/25 border border-sky-500/60 text-sky-100 shadow-md ring-1 ring-sky-500/40'
                          : 'bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] text-slate-500 font-mono block">Phần {idx + 1}</span>
                        <span className="text-xs font-semibold truncate block">{ch.title}</span>
                      </div>
                      <span className="font-mono text-[11px] text-sky-400 shrink-0 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
                        {formatTime(ch.start)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : drawerActiveTab === 'subtitles' && subtitles.length > 0 ? (
              /* Tab 3: Synced Live Subtitles */
              <div ref={transcriptScrollRef} className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {subtitles.map((sub, idx) => {
                  const isCurrent = currentTime >= sub.start && currentTime <= sub.end;
                  return (
                    <div
                      key={sub.id || idx}
                      data-active-sub={isCurrent ? 'true' : 'false'}
                      onClick={() => seekToTime(sub.start)}
                      className={`p-2 rounded-xl flex items-start gap-2.5 text-xs transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-sky-500/25 border border-sky-500/60 text-white shadow-md ring-1 ring-sky-500/40'
                          : 'bg-slate-950/40 hover:bg-slate-800/60 border border-slate-800/60 text-slate-300'
                      }`}
                    >
                      <span className="font-mono text-[10px] text-slate-400 mt-0.5 shrink-0">
                        {formatTime(sub.start)}
                      </span>
                      {(() => {
                        const isSubNanami = Boolean(
                          sub.speaker?.toLowerCase().includes('nanami') ||
                          sub.lang === 'ja' ||
                          /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(sub.text)
                        );
                        return (
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                              isSubNanami
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            }`}
                          >
                            {isSubNanami ? 'Nanami 🇯🇵' : 'Hoài My 🇻🇳'}
                          </span>
                        );
                      })()}
                      <p
                        className={`flex-1 ${
                          sub.lang === 'ja' ? 'font-medium text-amber-200 tracking-wide font-sans text-sm' : ''
                        }`}
                      >
                        {sub.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Tab 4: Comprehensive Audio Settings & Slots */
              <div className="space-y-2.5 py-1 text-xs">
                {/* Engine Mode & Voice Slots */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 font-semibold mr-1">Chế độ:</span>
                    <button
                      type="button"
                      onClick={() => onAudioModeChange('studio')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        (audioMode as string) === 'studio'
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-xs'
                          : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
                      }`}
                    >
                      <Headphones className="w-3.5 h-3.5" />
                      <span>Audio AI Studio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onAudioModeChange('browser')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        (audioMode as string) === 'browser'
                          ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40 shadow-xs'
                          : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>Web Speech</span>
                    </button>
                  </div>

                  {/* Slots */}
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-400 font-semibold mr-1">Kịch bản:</span>
                    {slotItems.map((item) => {
                      const isSelected = selectedSlot === item.slot_num;
                      return (
                        <button
                          key={item.slot_num}
                          type="button"
                          onClick={() => {
                            setSelectedSlot(item.slot_num);
                            onSelectSlot?.(item.slot_num);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40 font-bold'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          Slot {item.slot_num}
                          {item.hasAudio && (
                            <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Speed, Controls & Volume */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  {/* Speed Selector */}
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-400 font-semibold mr-1">Tốc độ:</span>
                    {[0.8, 1.0, 1.25, 1.5, 2.0].map((rate) => {
                      const isCurrentRate =
                        (audioMode as string) === 'studio' ? playbackRate === rate : browserController?.speed === rate;
                      return (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => {
                            if ((audioMode as string) === 'studio') {
                              setPlaybackRate(rate);
                              if (audioRef.current) audioRef.current.playbackRate = rate;
                            } else if (browserController?.handleSpeedChange) {
                              browserController.handleSpeedChange(rate);
                            }
                          }}
                          className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                            isCurrentRate
                              ? 'bg-sky-500/30 text-sky-200 border border-sky-500/50'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {rate}x
                        </button>
                      );
                    })}
                  </div>

                  {/* Auto-Next & Shuffle Switches */}
                  <div className="flex items-center gap-2">
                    {onToggleShuffle && (
                      <button
                        type="button"
                        onClick={onToggleShuffle}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isShuffle
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        <span>Shuffle {isShuffle ? 'ON' : 'OFF'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleToggleAutoNext}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        autoNext
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Auto-Next {autoNext ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>

                  {/* Volume & Re-generate */}
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={toggleMute}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="w-4 h-4 text-rose-400" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                      />
                      <span className="text-[11px] font-mono text-slate-400 w-7 text-right">
                        {Math.round((isMuted ? 0 : volume) * 100)}%
                      </span>
                    </div>

                    {onGenerateTTS && (
                      <button
                        type="button"
                        disabled={isGeneratingTTS}
                        onClick={() => onGenerateTTS(selectedSlot, true)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-semibold cursor-pointer text-xs transition-all"
                        title="Tạo lại bản thu Edge-TTS"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingTTS ? 'animate-spin text-sky-400' : ''}`} />
                        <span>Tạo lại</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MOBILE 2-ROW COMPLETE BAR (< sm / Phone screens)          */}
      {/* 100% full functions, title hidden on mobile, 0 squish    */}
      {/* ========================================================= */}
      <div className="flex sm:hidden flex-col gap-1.5 px-3 py-2 w-full">
        {/* Row 1: Engine Mode + Slots + Active Chapter / Time */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: Mode + Slots */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Audio Engine Mode */}
            <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => onAudioModeChange('studio')}
                className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  audioMode === 'studio'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Phát Audio AI Studio"
              >
                <Headphones className="w-3 h-3" />
                <span>AI</span>
              </button>
              <button
                type="button"
                onClick={() => onAudioModeChange('browser')}
                className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  audioMode === 'browser'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Đọc từng câu Web Speech"
              >
                <Radio className="w-3 h-3" />
                <span>Web</span>
              </button>
            </div>

            {/* Slot Pills */}
            <div className="flex items-center gap-0.5">
              {slotItems.map((item) => {
                const isSelected = selectedSlot === item.slot_num;
                return (
                  <button
                    key={item.slot_num}
                    type="button"
                    onClick={() => {
                      setSelectedSlot(item.slot_num);
                      onSelectSlot?.(item.slot_num);
                    }}
                    title={`${item.label}: ${item.desc}`}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40 font-bold'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    S{item.slot_num}
                    {item.hasAudio && (
                      <span className="ml-0.5 inline-block w-1 h-1 rounded-full bg-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Active Chapter & Time */}
          <div className="flex items-center gap-1.5 min-w-0 justify-end">
            {activeChapter && (
              <button
                type="button"
                onClick={() => {
                  setDrawerActiveTab('chapters');
                  setIsExpanded(true);
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-[10px] text-sky-300 font-medium truncate max-w-[130px] cursor-pointer"
                title={`Phân đoạn: ${activeChapter.title}`}
              >
                <Clock className="w-2.5 h-2.5 shrink-0 text-sky-400" />
                <span className="truncate">{activeChapter.title}</span>
              </button>
            )}
            <span className="text-[10px] font-mono text-slate-400 shrink-0">
              {audioMode === 'studio' ? (
                <>
                  <span className="text-slate-200">{formatTime(currentTime)}</span>
                  <span>/</span>
                  <span>{formatTime(totalDuration)}</span>
                </>
              ) : (
                <span>Đoạn {(browserController?.currentIndex ?? 0) + 1}/{browserController?.totalSentences || 1}</span>
              )}
            </span>
          </div>
        </div>

        {/* Row 2: Playback Controls & Utility Actions */}
        <div className="flex items-center justify-between gap-1">
          {/* Left Sub-group: Rewind, Prev, Big Play, Next, Forward */}
          <div className="flex items-center gap-1">
            {/* Rewind 10s */}
            {audioMode === 'studio' && (
              <button
                type="button"
                onClick={() => skip(-10)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 active:scale-95 transition-all cursor-pointer"
                title="Lùi 10 giây"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Prev */}
            {onPrevLesson && (
              <button
                type="button"
                disabled={!hasPrevLesson}
                onClick={handlePrevClick}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer active:scale-95 ${
                  hasPrevLesson
                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                    : 'bg-slate-950/40 border-slate-900 text-slate-700 cursor-not-allowed opacity-30'
                }`}
                title="Câu trước"
              >
                <SkipBack className="w-4 h-4" />
              </button>
            )}

            {/* Big Primary Play/Pause CTA */}
            <button
              type="button"
              onClick={
                audioMode === 'studio'
                  ? togglePlay
                  : browserController?.handleToggle || onToggleBrowserSpeech
              }
              className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-400 to-sky-500 hover:from-sky-300 hover:to-sky-400 text-slate-950 font-bold flex items-center justify-center shadow-lg shadow-sky-500/30 active:scale-95 transition-all cursor-pointer"
              title={isCurrentActivePlaying ? 'Tạm dừng' : 'Phát âm thanh'}
            >
              {isCurrentActivePlaying ? (
                <Pause className="w-4.5 h-4.5 fill-current" />
              ) : (
                <Play className="w-4.5 h-4.5 fill-current translate-x-0.5" />
              )}
            </button>

            {/* Next */}
            {onNextLesson && (
              <button
                type="button"
                disabled={!hasNextLesson}
                onClick={handleNextClick}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer active:scale-95 ${
                  hasNextLesson
                    ? isShuffle
                      ? 'bg-purple-600/30 border-purple-500/40 text-purple-300'
                      : 'bg-sky-600/30 border-sky-500/40 text-sky-300'
                    : 'bg-slate-950/40 border-slate-900 text-slate-700 cursor-not-allowed opacity-30'
                }`}
                title={isShuffle ? 'Ngẫu nhiên' : 'Tiếp theo'}
              >
                {isShuffle ? <Shuffle className="w-4 h-4" /> : <SkipForward className="w-4 h-4" />}
              </button>
            )}

            {/* Forward 10s */}
            {audioMode === 'studio' && (
              <button
                type="button"
                onClick={() => skip(10)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 active:scale-95 transition-all cursor-pointer"
                title="Tua tới 10 giây"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Sub-group: CC, Chapters, Shuffle, Auto, Speed, Drawer */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Subtitle / CC Toggle */}
            {subtitles.length > 0 && audioMode === 'studio' && (
              <button
                type="button"
                onClick={() => setIsCCActive(!isCCActive)}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  isCCActive
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-xs'
                    : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}
                title={isCCActive ? 'Tắt phụ đề trực tiếp' : 'Bật phụ đề trực tiếp'}
              >
                <Subtitles className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Chapters Toggle */}
            {chapters.length > 0 && audioMode === 'studio' && (
              <button
                type="button"
                onClick={() => {
                  setDrawerActiveTab('chapters');
                  setIsExpanded(!isExpanded);
                }}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  isExpanded && drawerActiveTab === 'chapters'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
                title="Danh sách phân đoạn"
              >
                <ListVideo className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Shuffle */}
            {onToggleShuffle && (
              <button
                type="button"
                onClick={onToggleShuffle}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  isShuffle
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs'
                    : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}
                title={isShuffle ? 'Shuffle: BẬT' : 'Shuffle: TẮT'}
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Auto-Next */}
            <button
              type="button"
              onClick={handleToggleAutoNext}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                autoNext
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                  : 'bg-slate-900 text-slate-500 border border-slate-800'
              }`}
              title={autoNext ? 'Tự động chuyển: BẬT' : 'Tự động chuyển: TẮT'}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Speed Cycle Button */}
            <button
              type="button"
              onClick={audioMode === 'studio' ? cycleRate : browserController?.cycleSpeed}
              className="px-1.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono font-bold text-slate-300 cursor-pointer"
              title="Đổi tốc độ phát"
            >
              {audioMode === 'studio' ? playbackRate : browserController?.speed ?? 1.0}x
            </button>

            {/* Drawer Toggle */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                isExpanded
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
              title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* DESKTOP MAIN BAR (hidden sm:flex): Spacious 3 columns     */}
      {/* ========================================================= */}
      <div className="hidden sm:flex items-center justify-between gap-4 px-6 py-3 max-w-7xl mx-auto">
        {/* LEFT COLUMN: Lesson Info, Chapter Pill & Slot Switcher */}
        <div className="flex items-center gap-2.5 min-w-0 max-w-[38%]">
          {/* Audio Engine Mode Switcher */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => onAudioModeChange('studio')}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                audioMode === 'studio'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Phát Audio AI Studio chất lượng cao (Edge-TTS)"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Audio AI</span>
            </button>
            <button
              type="button"
              onClick={() => onAudioModeChange('browser')}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                audioMode === 'browser'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Đọc từng câu bằng giọng Web Speech của trình duyệt"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Trình duyệt</span>
            </button>
          </div>

          <div className="min-w-0">
            {/* Title */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[190px]" title={title}>
                {title}
              </span>
            </div>

            {/* Sub-row: Active Chapter Pill & Slot Pills */}
            <div className="flex items-center gap-1.5 mt-0.5">
              {activeChapter && (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerActiveTab('chapters');
                    setIsExpanded(true);
                  }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-[10px] text-sky-300 font-medium truncate max-w-[160px] cursor-pointer transition-all"
                  title={`Phân đoạn hiện tại: ${activeChapter.title} (Nhấp để xem danh sách)`}
                >
                  <Clock className="w-2.5 h-2.5 shrink-0 text-sky-400" />
                  <span className="truncate">{activeChapter.title}</span>
                </button>
              )}

              {/* Slot Selector Pills */}
              <div className="flex items-center gap-1">
                {slotItems.map((item) => {
                  const isSelected = selectedSlot === item.slot_num;
                  return (
                    <button
                      key={item.slot_num}
                      type="button"
                      onClick={() => {
                        setSelectedSlot(item.slot_num);
                        onSelectSlot?.(item.slot_num);
                      }}
                      title={`${item.label}: ${item.desc}`}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40 font-bold'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      S{item.slot_num}
                      {item.hasAudio && (
                        <span className="ml-1 inline-block w-1 h-1 rounded-full bg-emerald-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Playback Controls (Prev, Big Play, Next) */}
        <div className="flex flex-col items-center justify-center gap-1">
          <div className="flex items-center gap-3">
            {/* Desktop Speed Selector with Popover Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSpeedMenuOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer text-xs font-mono font-bold ${
                  playbackRate !== 1.0
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-xs'
                    : 'bg-slate-900 text-slate-300 hover:text-white border-slate-800 hover:bg-slate-800'
                }`}
                title="Tốc độ phát âm thanh (Nhấp để chọn tốc độ)"
              >
                <Gauge className="w-3.5 h-3.5 text-sky-400" />
                <span>{audioMode === 'studio' ? playbackRate : browserController?.speed ?? 1.0}x</span>
              </button>

              {/* Speed Popover Menu */}
              {isSpeedMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsSpeedMenuOpen(false)} />
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-36 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
                      Tốc độ phát
                    </div>
                    {[0.8, 1.0, 1.25, 1.5, 2.0].map((rate) => {
                      const isSelected =
                        audioMode === 'studio' ? playbackRate === rate : browserController?.speed === rate;
                      return (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => {
                            if (audioMode === 'studio') {
                              setPlaybackRate(rate);
                              if (audioRef.current) audioRef.current.playbackRate = rate;
                            } else if (browserController?.handleSpeedChange) {
                              browserController.handleSpeedChange(rate);
                            }
                            setIsSpeedMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-sky-500/20 text-sky-300 font-bold'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span className="font-mono">{rate}x</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-sky-400" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Rewind 10s */}
            {audioMode === 'studio' && (
              <button
                type="button"
                onClick={() => skip(-10)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                title="Lùi lại 10 giây"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            {/* Prev Question Button */}
            {onPrevLesson && (
              <button
                type="button"
                disabled={!hasPrevLesson}
                onClick={handlePrevClick}
                className={`p-2 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                  hasPrevLesson
                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 shadow-xs'
                    : 'bg-slate-950/40 border-slate-900 text-slate-600 opacity-30 cursor-not-allowed'
                }`}
                title="Câu trước"
              >
                <SkipBack className="w-4.5 h-4.5" />
              </button>
            )}

            {/* Big Primary Play/Pause CTA */}
            <button
              type="button"
              onClick={
                audioMode === 'studio'
                  ? togglePlay
                  : browserController?.handleToggle || onToggleBrowserSpeech
              }
              className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-400 to-sky-500 hover:from-sky-300 hover:to-sky-400 text-slate-950 font-bold flex items-center justify-center shadow-lg shadow-sky-500/30 transition-all cursor-pointer active:scale-95 hover:scale-105"
              title={isCurrentActivePlaying ? 'Tạm dừng' : 'Phát âm thanh'}
            >
              {isCurrentActivePlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current translate-x-0.5" />
              )}
            </button>

            {/* Next Question / Shuffle Random Button */}
            {onNextLesson && (
              <button
                type="button"
                disabled={!hasNextLesson}
                onClick={handleNextClick}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border transition-all cursor-pointer active:scale-95 shadow-md ${
                  hasNextLesson
                    ? isShuffle
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-purple-500/40 shadow-purple-500/25'
                      : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white border-sky-500/40 shadow-sky-500/25'
                    : 'bg-slate-950/40 border-slate-900 text-slate-600 opacity-30 cursor-not-allowed'
                }`}
                title={isShuffle ? 'Nhảy ngẫu nhiên sang câu khác (Shuffle)' : 'Chuyển sang câu tiếp theo'}
              >
                {isShuffle ? (
                  <>
                    <Shuffle className="w-4 h-4" />
                    <span className="text-xs font-bold">Random</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-bold">Tiếp</span>
                    <SkipForward className="w-4 h-4" />
                  </>
                )}
              </button>
            )}

            {/* Fast-Forward 10s */}
            {audioMode === 'studio' && (
              <button
                type="button"
                onClick={() => skip(10)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                title="Tua tới 10 giây"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Time Scrubber Timestamp */}
          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
            {audioMode === 'studio' ? (
              <>
                <span className="text-slate-200">{formatTime(currentTime)}</span>
                <span>/</span>
                <span>{formatTime(totalDuration)}</span>
              </>
            ) : (
              <span>
                Đoạn {(browserController?.currentIndex ?? 0) + 1} / {browserController?.totalSentences || 1}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CC, Chapters, Auto-Next, Shuffle, Drawer */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Subtitle / CC Toggle */}
          {subtitles.length > 0 && audioMode === 'studio' && (
            <button
              type="button"
              onClick={() => setIsCCActive(!isCCActive)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isCCActive
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-xs'
                  : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-300'
              }`}
              title={isCCActive ? 'Phụ đề trực tiếp (HUD): ĐANG BẬT' : 'Phụ đề trực tiếp: TẮT'}
            >
              <Subtitles className="w-4 h-4" />
            </button>
          )}

          {/* Chapters List Toggle */}
          {chapters.length > 0 && audioMode === 'studio' && (
            <button
              type="button"
              onClick={() => {
                setDrawerActiveTab('chapters');
                setIsExpanded(!isExpanded);
              }}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isExpanded && drawerActiveTab === 'chapters'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
              title="Danh sách phân đoạn (YouTube Chapters)"
            >
              <ListVideo className="w-4 h-4" />
            </button>
          )}

          {/* Shuffle Toggle Pill */}
          {onToggleShuffle && (
            <button
              type="button"
              onClick={onToggleShuffle}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isShuffle
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs'
                  : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-300'
              }`}
              title={isShuffle ? 'Nhảy ngẫu nhiên (Shuffle): BẬT' : 'Nhảy ngẫu nhiên: TẮT'}
            >
              <Shuffle className={`w-3.5 h-3.5 ${isShuffle ? 'text-purple-400' : 'text-slate-500'}`} />
              <span className="text-[10px] font-mono font-bold hidden md:inline">
                {isShuffle ? 'ON' : 'OFF'}
              </span>
            </button>
          )}

          {/* Auto Next Switcher Pill */}
          <button
            type="button"
            onClick={handleToggleAutoNext}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              autoNext
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-300'
            }`}
            title={autoNext ? 'Tự động chuyển bài: BẬT' : 'Tự động chuyển bài: TẮT'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoNext ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="text-[10px] font-mono font-bold hidden md:inline">
              Auto {autoNext ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Expand Drawer Button */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isExpanded
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
            }`}
            title={isExpanded ? 'Thu nhỏ bảng phụ đề & cài đặt' : 'Mở rộng phụ đề & kịch bản'}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
};
