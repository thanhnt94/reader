import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, Sparkles } from 'lucide-react';
import axios from 'axios';

export interface TimestampItem {
  id: string;
  sentence_idx: number;
  start: number;
  end: number;
  lang: string;
  text: string;
}

interface KaraokeAudioPlayerProps {
  audioUrl: string;
  timestampsUrl?: string | null;
  duration?: number;
  onSentenceChange?: (sentence: TimestampItem | null) => void;
  autoScroll?: boolean;
}

export const KaraokeAudioPlayer: React.FC<KaraokeAudioPlayerProps> = ({
  audioUrl,
  timestampsUrl,
  duration = 0,
  onSentenceChange,
  autoScroll = true,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [timestamps, setTimestamps] = useState<TimestampItem[]>([]);
  const [activeSentence, setActiveSentence] = useState<TimestampItem | null>(null);

  // Fetch timestamps JSON
  useEffect(() => {
    if (timestampsUrl) {
      axios
        .get(timestampsUrl)
        .then((res) => {
          if (Array.isArray(res.data)) {
            setTimestamps(res.data);
          }
        })
        .catch((err) => console.warn('Could not load timestamps JSON', err));
    } else {
      setTimestamps([]);
    }
  }, [timestampsUrl]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((e) => console.error('Audio play error:', e));
      setIsPlaying(true);
    }
  };

  // Skip ±10s
  const skip = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(totalDuration, audioRef.current.currentTime + seconds));
  };

  // Change Playback Speed
  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  // Seek bar
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  // Time update listener
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const time = audioRef.current.currentTime;
    setCurrentTime(time);

    // Find active sentence
    const active = timestamps.find((t) => t.start <= time && time <= t.end + 0.1);
    if (active?.id !== activeSentence?.id) {
      setActiveSentence(active || null);
      if (onSentenceChange) {
        onSentenceChange(active || null);
      }

      // Smooth scroll if autoScroll is enabled
      if (autoScroll && active) {
        const activeElements = document.getElementsByClassName('karaoke-active');
        if (activeElements.length > 0) {
          activeElements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 border-t border-slate-800/80 backdrop-blur-xl px-4 py-2.5 sm:py-3 shadow-2xl">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setTotalDuration(audioRef.current.duration || duration);
          }
        }}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="max-w-4xl mx-auto flex flex-col gap-1.5 sm:gap-2">
        {/* Active Karaoke Sentence Banner */}
        {activeSentence && (
          <div className="flex items-center gap-2 text-xs text-amber-300 font-medium truncate py-0.5 animate-in fade-in">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{activeSentence.text}</span>
          </div>
        )}

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Controls: Skip -10, Play/Pause, Skip +10 */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => skip(-10)}
              title="Rewind 10s"
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-emerald-500/25 transition-transform active:scale-95"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => skip(10)}
              title="Forward 10s"
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RotateCw className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>

          {/* Time & Scrubber */}
          <div className="flex-1 flex items-center gap-2 sm:gap-3">
            <span className="text-[11px] font-mono text-slate-400 w-10 text-right">
              {formatTime(currentTime)}
            </span>

            <input
              type="range"
              min={0}
              max={totalDuration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />

            <span className="text-[11px] font-mono text-slate-400 w-10">
              {formatTime(totalDuration)}
            </span>
          </div>

          {/* Speed & Volume */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg bg-slate-800/80 p-0.5 text-[11px] font-semibold text-slate-300">
              {[0.8, 1.0, 1.25, 1.5].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => handleRateChange(rate)}
                  className={`px-1.5 py-0.5 rounded-md transition-colors ${playbackRate === rate ? 'bg-emerald-500 text-slate-950 font-bold' : 'hover:text-white'}`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            <Volume2 className="w-4 h-4 text-slate-400 hidden sm:block" />
          </div>
        </div>
      </div>
    </div>
  );
};
