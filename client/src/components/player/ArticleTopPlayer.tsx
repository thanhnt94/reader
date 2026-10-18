import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Headphones,
  Radio,
  Sparkles,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Languages,
  Activity,
  Sliders,
  ExternalLink,
  Layers,
  SkipForward,
  SkipBack,
  Shuffle
} from 'lucide-react';
import { AudioTrack } from '../../lib/api/readerApi';
import { BrowserSpeechController } from './BrowserSpeechPlayer';

export interface ArticleTopPlayerProps {
  audioUrl?: string | null;
  title: string;
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
  onOpenBrowserSpeechDetail?: () => void;
  activeSentenceSnippet?: string | null;
  browserController?: BrowserSpeechController | null;
  // Continuous Auto-Next & Shuffle across lessons
  autoPlay?: boolean;
  isShuffle?: boolean;
  onToggleShuffle?: () => void;
  onNextLesson?: () => void;
  onPrevLesson?: () => void;
  hasNextLesson?: boolean;
  hasPrevLesson?: boolean;
  autoNext?: boolean;
  onToggleAutoNext?: () => void;
  nextAudioUrl?: string | null;
  prevAudioUrl?: string | null;
}

export const ArticleTopPlayer: React.FC<ArticleTopPlayerProps> = ({
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
  onOpenBrowserSpeechDetail,
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
  nextAudioUrl,
  prevAudioUrl,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number>(activeSlot || 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [internalAutoNext, setInternalAutoNext] = useState<boolean>(true);
  const autoNext = propAutoNext !== undefined ? propAutoNext : internalAutoNext;
  const [transitionCountdown, setTransitionCountdown] = useState<number | null>(null);
  const transitionTimerRef = useRef<any>(null);

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

  // Synchronize audio source without unnecessary pause/reloads
  useEffect(() => {
    if (!audioRef.current) return;
    const targetSrc = effectiveAudioUrl ? effectiveAudioUrl.replace('auth.inmind.site', 'inmind.site') : '';
    const currentSrc = audioRef.current.src || '';

    // If target audio is already loaded or playing on this audio element, do NOT reload/pause!
    if (targetSrc && currentSrc.includes(targetSrc)) {
      return;
    }

    if (targetSrc) {
      audioRef.current.src = targetSrc;
      setCurrentTime(0);
      if (autoPlay && audioMode === 'studio') {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.warn('Autoplay waiting for interaction:', err);
          setIsPlaying(false);
        });
      } else {
        setIsPlaying(false);
      }
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
      setCurrentTime(0);
    }
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

  // Cleanup transition timer on unmount
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  // Handle studio audio ended (Continuous Auto-Next on same unlocked audio element!)
  const handleAudioEnded = () => {
    if (autoNext && nextAudioUrl && audioMode === 'studio' && audioRef.current) {
      // Direct stream advance within the ended event keeps audio permission 100% active!
      const cleanNext = nextAudioUrl.replace('auth.inmind.site', 'inmind.site');
      audioRef.current.src = cleanNext;
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.warn('Continuous playback blocked:', e);
        setIsPlaying(false);
      });
      if (onNextLesson) onNextLesson();
      return;
    }

    setIsPlaying(false);
    if (autoNext && onNextLesson && hasNextLesson) {
      onNextLesson();
    }
  };

  // User-Gesture Next Click: synchronously sets source and starts playback to guarantee zero NotAllowedError!
  const handleNextClick = () => {
    if (audioMode === 'studio' && isPlaying && nextAudioUrl && audioRef.current) {
      const cleanNext = nextAudioUrl.replace('auth.inmind.site', 'inmind.site');
      audioRef.current.src = cleanNext;
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(console.warn);
    }
    if (onNextLesson) onNextLesson();
  };

  // User-Gesture Prev Click: synchronously sets source and starts playback
  const handlePrevClick = () => {
    if (audioMode === 'studio' && isPlaying && prevAudioUrl && audioRef.current) {
      const cleanPrev = prevAudioUrl.replace('auth.inmind.site', 'inmind.site');
      audioRef.current.src = cleanPrev;
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(console.warn);
    }
    if (onPrevLesson) onPrevLesson();
  };

  // Toggle Studio Audio Play/Pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((e) => console.error('Audio playback error:', e));
      setIsPlaying(true);
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

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 border border-slate-800/90 p-4 sm:p-5 shadow-xl backdrop-blur-xl transition-all relative overflow-hidden group">
      {/* Background ambient glow effect when playing */}
      {isPlaying && (
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      )}

      {/* Embedded Hidden HTML5 Audio Element (rendered unconditionally to maintain browser unlock) */}
      <audio
        ref={audioRef}
        src={effectiveAudioUrl ? effectiveAudioUrl.replace('auth.inmind.site', 'inmind.site') : undefined}
        preload="metadata"
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && audioRef.current.duration) {
            setTotalDuration(audioRef.current.duration);
          }
        }}
        onEnded={handleAudioEnded}
      />

      {/* Top Header Row: Source Badge & Dual Mode Switcher */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3 mb-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
            audioMode === 'studio'
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
          }`}>
            {audioMode === 'studio' ? (
              <Headphones className="w-4 h-4" />
            ) : (
              <Radio className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide">
                {audioMode === 'studio' ? 'Bản Thu Studio AI (Edge-TTS)' : 'Trình Duyệt Đọc (Web Speech)'}
              </span>
              {audioMode === 'studio' && effectiveAudioUrl && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  Slot {selectedSlot} HD
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate hidden sm:block">
              {audioMode === 'studio'
                ? 'Giọng đọc Edge-TTS Neural chuẩn Nhật (Nanami) & Việt (Hoài My)'
                : 'Đọc theo từng câu có quét sáng Karaoke & chạm để đọc (Tap-to-speak)'}
            </p>
          </div>
        </div>

        {/* Dual Mode Switcher, Shuffle & Auto Next Pills */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Shuffle Toggle Pill */}
          {onToggleShuffle && (
            <button
              type="button"
              onClick={onToggleShuffle}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isShuffle
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs'
                  : 'bg-slate-950/60 text-slate-500 border border-slate-800 hover:text-slate-400'
              }`}
              title={isShuffle ? 'Nhảy câu ngẫu nhiên (Shuffle): BẬT' : 'Nhảy câu ngẫu nhiên: TẮT'}
            >
              <Shuffle className={`w-3.5 h-3.5 ${isShuffle ? 'text-purple-400' : 'text-slate-500'}`} />
              <span className="hidden md:inline">Shuffle</span>
              <span className={`text-[10px] font-mono px-1 py-0.2 rounded font-bold ${isShuffle ? 'bg-purple-500/30 text-purple-200' : 'bg-slate-800 text-slate-400'}`}>
                {isShuffle ? 'ON' : 'OFF'}
              </span>
            </button>
          )}

          {/* Auto Next Switcher Pill */}
          <button
            type="button"
            onClick={handleToggleAutoNext}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              autoNext
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-xs'
                : 'bg-slate-950/60 text-slate-500 border border-slate-800 hover:text-slate-400'
            }`}
            title={autoNext ? 'Tự động chuyển bài tiếp theo khi hết: BẬT' : 'Tự động chuyển bài: TẮT'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoNext ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="hidden md:inline">Auto Next</span>
            <span className={`text-[10px] font-mono px-1 py-0.2 rounded font-bold ${autoNext ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-800 text-slate-400'}`}>
              {autoNext ? 'ON' : 'OFF'}
            </span>
          </button>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/80 border border-slate-800 shadow-inner">
            <button
              type="button"
              onClick={() => onAudioModeChange('studio')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                audioMode === 'studio'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Nghe file âm thanh Studio AI chất lượng cao"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Studio AI</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onAudioModeChange('browser');
                if (onToggleBrowserSpeech && !isBrowserSpeechActive) {
                  onToggleBrowserSpeech();
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                audioMode === 'browser'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Đọc bằng trình duyệt trực tiếp có highlight karaoke từng câu"
            >
              <Radio className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Trình duyệt</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3 Audio Slots Selector (Shared between Studio AI & Browser Speech) */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/70 border border-slate-800/80 mb-3.5 overflow-x-auto no-scrollbar">
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
              title={item.desc}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
              {item.hasAudio ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Đã có file Audio AI" />
              ) : item.hasScript ? (
                <span className="text-[10px] text-sky-400 font-normal">Kịch bản</span>
              ) : (
                <span className="text-[10px] text-slate-500 font-normal">Trống</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODE 1: STUDIO AUDIO PLAYER CONTROLS                         */}
      {/* ------------------------------------------------------------- */}
      {audioMode === 'studio' && (
        <>
          {effectiveAudioUrl ? (
            <div className="space-y-3">
              {/* Seek Bar & Progress */}
              <div className="space-y-1.5">
                <div className="relative flex items-center group/scrubber">
                  <input
                    type="range"
                    min={0}
                    max={totalDuration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500 hover:accent-sky-400 transition-all"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-0.5">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(totalDuration)}</span>
                </div>
              </div>

              {/* Transition Countdown Notice */}
              {transitionCountdown !== null && (
                <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-bold animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Hết bài! Đang tự động chuyển bài tiếp theo...</span>
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="flex items-center justify-between gap-2 pt-1">
                {/* Left: Speed Cycle & Rewind 10s */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={cycleRate}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-mono font-bold transition-all cursor-pointer active:scale-95"
                    title="Chỉnh tốc độ đọc"
                  >
                    {playbackRate}x
                  </button>

                  <button
                    type="button"
                    onClick={() => skip(-10)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer active:scale-95"
                    title="Lùi lại 10 giây"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {/* Center Cluster: Prev Question -> Play/Pause -> Next Question (or Random) */}
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Prev Question Button */}
                  {onPrevLesson && (
                    <button
                      type="button"
                      disabled={!hasPrevLesson}
                      onClick={handlePrevClick}
                      className={`p-2 sm:p-2.5 rounded-2xl border transition-all cursor-pointer active:scale-95 ${
                        hasPrevLesson
                          ? 'bg-slate-900 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 shadow-xs'
                          : 'bg-slate-950/40 border-slate-800/40 text-slate-600 opacity-40 cursor-not-allowed'
                      }`}
                      title="Chuyển về câu trước"
                    >
                      <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  )}

                  {/* Big Primary Play/Pause Button */}
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-tr from-sky-500 to-sky-400 hover:from-sky-400 hover:to-sky-300 text-slate-950 font-bold flex items-center justify-center shadow-lg shadow-sky-500/25 transition-all cursor-pointer active:scale-95 hover:scale-105"
                    title={isPlaying ? 'Tạm dừng bài đọc' : 'Phát bài đọc'}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current translate-x-0.5" />
                    )}
                  </button>

                  {/* Next Question / Shuffle Random Button */}
                  {onNextLesson && (
                    <button
                      type="button"
                      disabled={!hasNextLesson}
                      onClick={handleNextClick}
                      className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border transition-all cursor-pointer active:scale-95 shadow-md ${
                        hasNextLesson
                          ? isShuffle
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-purple-500/40 shadow-purple-500/25'
                            : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white border-sky-500/40 shadow-sky-500/25'
                          : 'bg-slate-950/40 border-slate-800/40 text-slate-600 opacity-40 cursor-not-allowed'
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
                          <span className="text-xs font-bold">Câu sau</span>
                          <SkipForward className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Right: Fast Forward 10s, Volume & Re-generate */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => skip(10)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer active:scale-95"
                    title="Tua tới 10 giây"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  {/* Volume Control */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={toggleMute}
                      onMouseEnter={() => setShowVolumeSlider(true)}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                      title={isMuted ? 'Bật âm' : 'Tắt âm'}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-4 h-4 text-rose-400" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Regenerate TTS if updated */}
                  {onGenerateTTS && (
                    <button
                      type="button"
                      disabled={isGeneratingTTS}
                      onClick={() => onGenerateTTS(selectedSlot, true)}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                      title={`Tạo lại bản thu âm Edge-TTS Slot ${selectedSlot}`}
                    >
                      <RefreshCw className={`w-4 h-4 ${isGeneratingTTS ? 'animate-spin text-sky-400' : ''}`} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Empty State: Prompt to generate Studio Audio for this slot or Switch to Browser */
            <div className="py-3 sm:py-4 px-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-center sm:text-left">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0 mx-auto sm:mx-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">
                    Slot {selectedSlot} ({slotItems.find((s) => s.slot_num === selectedSlot)?.label}): Chưa có file thu âm
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {slotItems.find((s) => s.slot_num === selectedSlot)?.desc}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                {onGenerateTTS && (
                  <button
                    type="button"
                    disabled={isGeneratingTTS}
                    onClick={() => onGenerateTTS(selectedSlot, false)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-sky-600/30 transition-all cursor-pointer active:scale-95"
                  >
                    {isGeneratingTTS ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang xử lý Slot {selectedSlot}...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Tạo Audio Slot {selectedSlot}</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onAudioModeChange('browser')}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700/60 transition-all cursor-pointer"
                  title="Nghe ngay bằng giọng đọc của máy mà không cần chờ tạo"
                >
                  Nghe bằng Trình duyệt
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODE 2: BROWSER SPEECH PLAYER (INTEGRATED DIRECTLY, NO POPUP)  */}
      {/* ------------------------------------------------------------- */}
      {audioMode === 'browser' && (
        <div className="space-y-3">
          {/* Active Spoken Sentence Glass Card */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-sky-500/30 shadow-inner relative overflow-hidden group">
            <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-500 animate-pulse" />
            <div className="flex items-center justify-between gap-2 mb-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping shrink-0" />
                <span className="font-bold text-sky-300">
                  {slotItems.find((s) => s.slot_num === selectedSlot)?.label}
                </span>
                <span className="text-slate-400 font-mono">
                  Đoạn {Math.min((browserController?.currentIndex ?? 0) + 1, browserController?.totalSentences || 1)} / {browserController?.totalSentences || 1}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {browserController?.currentSentence?.lang || 'Web Speech'}
                </span>
              </div>
            </div>

            {/* Current Sentence Display with Glowing Subtitle Typography */}
            <p className="text-sm sm:text-base font-semibold text-slate-100 min-h-[2.5rem] flex items-center leading-relaxed">
              {browserController?.currentSentence?.text || activeSentenceSnippet || (
                <span className="text-slate-400 italic font-normal">
                  {slotItems.find((s) => s.slot_num === selectedSlot)?.hasScript
                    ? 'Nhấn Phát để bắt đầu đọc kịch bản slot này.'
                    : 'Nhấn Phát để bắt đầu đọc theo nội dung bài học.'}
                </span>
              )}
            </p>

            {/* Sentence Progress Bar */}
            <div className="mt-2.5 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-300 rounded-full"
                style={{
                  width: `${
                    browserController?.totalSentences
                      ? Math.min(100, Math.max(0, (((browserController.currentIndex ?? 0) + 1) / browserController.totalSentences) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Main Controls Row: Prev Lesson, Big Play/Pause, Next Lesson (or Random) */}
          <div className="flex items-center justify-between gap-2 pt-1">
            {/* Speed Cycle Button */}
            <button
              type="button"
              onClick={browserController?.cycleSpeed}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-slate-300 hover:text-white hover:border-slate-700 transition-all cursor-pointer shrink-0"
              title="Tốc độ đọc giọng máy (chạm để đổi)"
            >
              {browserController?.speed ?? 1.0}x
            </button>

            {/* Primary Action Cluster: Prev Question -> Play/Pause -> Next Question */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Prev Question Button */}
              {onPrevLesson && (
                <button
                  type="button"
                  disabled={!hasPrevLesson}
                  onClick={handlePrevClick}
                  className={`p-2 sm:p-2.5 rounded-2xl border transition-all cursor-pointer active:scale-95 ${
                    hasPrevLesson
                      ? 'bg-slate-900 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 shadow-xs'
                      : 'bg-slate-950/40 border-slate-800/40 text-slate-600 opacity-40 cursor-not-allowed'
                  }`}
                  title="Chuyển về câu trước"
                >
                  <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}

              {/* Big Primary Play/Pause Button */}
              <button
                type="button"
                onClick={browserController?.handleToggle || onToggleBrowserSpeech}
                className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 text-slate-950 flex items-center justify-center shadow-lg shadow-sky-500/30 transition-all cursor-pointer active:scale-95 hover:scale-105"
                title={browserController?.isPlaying ? 'Tạm dừng đọc' : 'Phát bằng giọng đọc trình duyệt'}
              >
                {browserController?.isPlaying ? (
                  <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
                ) : (
                  <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />
                )}
              </button>

              {/* Next Question / Shuffle Random Button */}
              {onNextLesson && (
                <button
                  type="button"
                  disabled={!hasNextLesson}
                  onClick={handleNextClick}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border transition-all cursor-pointer active:scale-95 shadow-md ${
                    hasNextLesson
                      ? isShuffle
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-purple-500/40 shadow-purple-500/25'
                        : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white border-sky-500/40 shadow-sky-500/25'
                      : 'bg-slate-950/40 border-slate-800/40 text-slate-600 opacity-40 cursor-not-allowed'
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
                      <span className="text-xs font-bold">Câu sau</span>
                      <SkipForward className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Sentence Stepper: Đoạn trước / Đoạn sau */}
            <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 p-1 rounded-xl shrink-0">
              <button
                type="button"
                onClick={browserController?.handlePrev}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                title="Lùi lại 1 đoạn trong câu"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={browserController?.handleNext}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                title="Tiến 1 đoạn trong câu"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
