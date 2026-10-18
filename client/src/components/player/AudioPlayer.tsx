import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Headphones, X, Radio, RefreshCw } from 'lucide-react';

interface AudioPlayerProps {
  audioUrl: string;
  title?: string;
  duration?: number;
  isOpen?: boolean;
  onClose?: () => void;
  onSwitchToBrowserTTS?: () => void;
  onRegenerateTTS?: () => void;
  isRegenerating?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  title,
  duration = 0,
  isOpen = true,
  onClose,
  onSwitchToBrowserTTS,
  onRegenerateTTS,
  isRegenerating = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);

  // Sync totalDuration when duration prop or audio metadata loads
  useEffect(() => {
    if (duration > 0) {
      setTotalDuration(duration);
    }
  }, [duration]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((e) => console.error('Audio playback failed:', e));
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

  // Speed cycle: 0.8 -> 1.0 -> 1.25 -> 1.5 -> 2.0 -> 0.8
  const cycleRate = () => {
    const rates = [0.8, 1.0, 1.25, 1.5, 2.0];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  // Seek bar change
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

  if (!audioUrl || !isOpen) return null;

  return (
    <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-40 bg-slate-900/95 border-t border-slate-800/90 backdrop-blur-2xl shadow-2xl transition-all">
      <audio
        ref={audioRef}
        src={audioUrl.replace('auth.inmind.site', 'inmind.site')}
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
        onEnded={() => setIsPlaying(false)}
      />

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex flex-col gap-2">
        {/* Top Mini Header: Mode & Switcher Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-1.5 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold text-[10px] border border-emerald-500/30 shrink-0">
              <Headphones className="w-3 h-3 text-emerald-400" />
              <span>Studio Edge-TTS HD</span>
            </span>
            <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
              Giọng đọc AI tự nhiên chất lượng cao
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onSwitchToBrowserTTS && (
              <button
                type="button"
                onClick={() => {
                  if (audioRef.current) audioRef.current.pause();
                  setIsPlaying(false);
                  onSwitchToBrowserTTS();
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-bold cursor-pointer transition-colors"
                title="Chuyển sang chế độ đọc trình duyệt trực tiếp (Karaoke live highlight)"
              >
                <Radio className="w-3 h-3 text-sky-400" />
                <span>Đọc Trình Duyệt</span>
              </button>
            )}

            {onRegenerateTTS && (
              <button
                type="button"
                disabled={isRegenerating}
                onClick={onRegenerateTTS}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Tạo lại file âm thanh Edge-TTS (khi nội dung bài vừa cập nhật)"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-sky-400' : ''}`} />
              </button>
            )}

            {onClose && (
              <button
                type="button"
                onClick={() => {
                  if (audioRef.current) audioRef.current.pause();
                  setIsPlaying(false);
                  onClose();
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Đóng thanh nghe"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar & Timestamps */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-slate-400 w-10 text-right shrink-0">
            {formatTime(currentTime)}
          </span>
          <div className="relative flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={totalDuration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500 hover:accent-sky-400 transition-all"
            />
          </div>
          <span className="text-[11px] font-mono text-slate-500 w-10 text-left shrink-0">
            {formatTime(totalDuration)}
          </span>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center justify-between gap-3">
          {/* Track Info */}
          <div className="flex items-center gap-2.5 min-w-0 max-w-[200px] sm:max-w-xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Headphones className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {title || 'Audio Narration'}
              </p>
              <p className="text-[10px] text-emerald-400/90 font-mono">Edge-TTS Natural</p>
            </div>
          </div>

          {/* Primary Controls */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => skip(-10)}
              title="Lùi lại 10 giây"
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60 transition-colors cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shadow-sky-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer font-bold"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => skip(10)}
              title="Tua tới 10 giây"
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60 transition-colors cursor-pointer active:scale-95"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Speed & Volume Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={cycleRate}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-[11px] font-mono font-bold text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
              title="Tốc độ phát"
            >
              {playbackRate}x
            </button>

            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Bật âm thanh' : 'Tắt tiếng'}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

