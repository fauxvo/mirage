'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Music,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractPlaylistId } from '@/lib/youtube';

export interface YouTubePlayerBarHandle {
  togglePlayPause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
}

/** Bar heights in pixels: collapsed = 32 (h-8), expanded = 64 (h-16) */
const BAR_HEIGHT_COLLAPSED = 32;
const BAR_HEIGHT_EXPANDED = 64;

interface YouTubePlayerBarProps {
  playlistUrl: string;
  visible?: boolean;
  /** Reports the bar's current height in px (0 on unmount, 32 collapsed, 64 expanded) */
  onBarHeightChange?: (height: number) => void;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const YouTubePlayerBar = forwardRef<YouTubePlayerBarHandle, YouTubePlayerBarProps>(
  function YouTubePlayerBar({ playlistUrl, visible = true, onBarHeightChange }, ref) {
    const playerRef = useRef<YT.Player | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [isReady, setIsReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(50);
    const [isMuted, setIsMuted] = useState(false);
    const [trackTitle, setTrackTitle] = useState('');
    const [trackArtist, setTrackArtist] = useState('');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [hasError, setHasError] = useState(false);

    const playlistId = extractPlaylistId(playlistUrl);
    const instanceId = useId().replace(/:/g, '');

    const updateTrackInfo = useCallback(() => {
      if (!playerRef.current) return;
      const data = playerRef.current.getVideoData();
      if (data) {
        setTrackTitle(data.title || '');
        setTrackArtist(data.author || '');
      }
    }, []);

    // Notify parent of bar height changes (cleanup reports 0 on unmount)
    useEffect(() => {
      onBarHeightChange?.(isCollapsed ? BAR_HEIGHT_COLLAPSED : BAR_HEIGHT_EXPANDED);
      return () => onBarHeightChange?.(0);
    }, [isCollapsed, onBarHeightChange]);

    // Load YouTube IFrame API
    useEffect(() => {
      if (!playlistId) return;

      const container = containerRef.current;

      // If API already loaded, initialize player directly
      if (window.YT?.Player) {
        initPlayer();
        return;
      }

      // Set up callback
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevCallback?.();
        initPlayer();
      };

      // Check if script is already being loaded
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }

      function initPlayer() {
        if (!container || playerRef.current) return;

        // Create a div for the player inside our container
        const playerDiv = document.createElement('div');
        playerDiv.id = `yt-player-${instanceId}`;
        container.appendChild(playerDiv);

        playerRef.current = new YT.Player(playerDiv.id, {
          height: '1',
          width: '1',
          playerVars: {
            listType: 'playlist',
            list: playlistId!,
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              setIsReady(true);
              event.target.setVolume(50);
            },
            onStateChange: (event) => {
              const state = event.data;
              setIsPlaying(state === YT.PlayerState.PLAYING);

              if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.PAUSED) {
                updateTrackInfo();
                setDuration(event.target.getDuration());
              }
            },
            onError: () => {
              setTrackTitle('Playlist unavailable');
              setHasError(true);
              setIsReady(false);
            },
          },
        });
      }

      return () => {
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        playerRef.current?.destroy();
        playerRef.current = null;
        setIsReady(false);
        setHasError(false);
        // Remove stale player div(s) so re-runs don't accumulate DOM nodes
        if (container) container.innerHTML = '';
        // Restore previous callback to avoid stale closure accumulation
        window.onYouTubeIframeAPIReady = prevCallback;
      };
    }, [playlistId, updateTrackInfo, instanceId]);

    // Progress polling
    useEffect(() => {
      if (isPlaying) {
        progressTimerRef.current = setInterval(() => {
          if (document.hidden || !playerRef.current) return;
          setCurrentTime(playerRef.current.getCurrentTime());
          setDuration(playerRef.current.getDuration());
        }, 250);
      } else {
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
      }

      return () => {
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      };
    }, [isPlaying]);

    const togglePlayPause = useCallback(() => {
      if (!playerRef.current || !isReady) return;
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    }, [isPlaying, isReady]);

    const nextTrack = useCallback(() => {
      if (!playerRef.current || !isReady) return;
      playerRef.current.nextVideo();
    }, [isReady]);

    const prevTrack = useCallback(() => {
      if (!playerRef.current || !isReady) return;
      playerRef.current.previousVideo();
    }, [isReady]);

    const seekFromEvent = useCallback(
      (clientX: number, bar: HTMLElement) => {
        if (!playerRef.current || !duration) return;
        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        playerRef.current.seekTo(ratio * duration, true);
        setCurrentTime(ratio * duration);
      },
      [duration]
    );

    const handleSeekMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const bar = e.currentTarget;
        seekFromEvent(e.clientX, bar);

        const handleMouseMove = (ev: MouseEvent) => seekFromEvent(ev.clientX, bar);
        const handleMouseUp = () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
      },
      [seekFromEvent]
    );

    const handleSeekTouchStart = useCallback(
      (e: React.TouchEvent<HTMLDivElement>) => {
        const bar = e.currentTarget;
        seekFromEvent(e.touches[0].clientX, bar);

        const handleTouchMove = (ev: TouchEvent) => {
          ev.preventDefault();
          seekFromEvent(ev.touches[0].clientX, bar);
        };
        const handleTouchEnd = () => {
          window.removeEventListener('touchmove', handleTouchMove);
          window.removeEventListener('touchend', handleTouchEnd);
        };
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd);
      },
      [seekFromEvent]
    );

    const handleSeekKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!playerRef.current || !duration) return;
        let newTime = currentTime;
        if (e.key === 'ArrowRight') newTime = Math.min(duration, currentTime + 5);
        else if (e.key === 'ArrowLeft') newTime = Math.max(0, currentTime - 5);
        else return;
        e.preventDefault();
        playerRef.current.seekTo(newTime, true);
        setCurrentTime(newTime);
      },
      [currentTime, duration]
    );

    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      setVolume(val);
      setIsMuted(val === 0);
      playerRef.current?.setVolume(val);
      if (val > 0) {
        playerRef.current?.unMute();
      } else {
        playerRef.current?.mute();
      }
    }, []);

    const toggleMute = useCallback(() => {
      if (!playerRef.current) return;
      if (isMuted) {
        playerRef.current.unMute();
        playerRef.current.setVolume(volume || 50);
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    }, [isMuted, volume]);

    // Expose imperative methods
    useImperativeHandle(
      ref,
      () => ({
        togglePlayPause,
        nextTrack,
        prevTrack,
      }),
      [togglePlayPause, nextTrack, prevTrack]
    );

    if (!playlistId) return null;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
      <>
        {/* Hidden player container — always rendered so the iframe persists across collapse toggles */}
        <div
          ref={containerRef}
          className="fixed -left-[9999px] -top-[9999px] w-px h-px overflow-hidden"
        />

        {/* Collapsed: minimal strip */}
        {isCollapsed ? (
          <div
            className={cn(
              'fixed bottom-0 left-0 right-0 z-40 h-8 bg-black/90 backdrop-blur-md border-t border-white/10 flex items-center px-4 gap-3',
              'transition-opacity duration-300',
              visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
          >
            <button
              onClick={togglePlayPause}
              className="text-white/60 hover:text-white transition-colors"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
            <span className="text-[10px] text-white/40 truncate flex-1">
              {trackTitle || 'YouTube Playlist'}
            </span>
            <button
              onClick={() => setIsCollapsed(false)}
              className="text-white/30 hover:text-white/60 transition-colors"
              aria-label="Expand player"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div
            className={cn(
              'fixed bottom-0 left-0 right-0 z-40 h-16 bg-black/90 backdrop-blur-md border-t border-white/10',
              'transition-opacity duration-300',
              visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
          >
            <div className="h-full flex items-center px-4 gap-4">
              {/* Left: Track info */}
              <div className="w-56 shrink-0 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded bg-white/[0.06]">
                    <Music className="w-3.5 h-3.5 text-white/30" />
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'text-xs truncate font-medium',
                        hasError ? 'text-red-400/70' : 'text-white/70'
                      )}
                    >
                      {trackTitle || 'No track loaded'}
                    </p>
                    {trackArtist && (
                      <p className="text-[10px] text-white/30 truncate">{trackArtist}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Center: Controls + Progress */}
              <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
                {/* Transport controls */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={prevTrack}
                    disabled={!isReady}
                    className="text-white/50 hover:text-white transition-colors disabled:opacity-30"
                    aria-label="Previous track"
                    title="Previous track (Shift+Left)"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={togglePlayPause}
                    disabled={!isReady}
                    className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    title="Play/Pause (Space)"
                  >
                    {isPlaying ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5 ml-0.5" />
                    )}
                  </button>
                  <button
                    onClick={nextTrack}
                    disabled={!isReady}
                    className="text-white/50 hover:text-white transition-colors disabled:opacity-30"
                    aria-label="Next track"
                    title="Next track (Shift+Right)"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Progress bar */}
                <div className="w-full max-w-md flex items-center gap-2">
                  <span className="text-[10px] text-white/30 tabular-nums w-8 text-right">
                    {formatTime(currentTime)}
                  </span>
                  <div
                    role="slider"
                    aria-label="Seek"
                    aria-valuenow={Math.round(currentTime)}
                    aria-valuemin={0}
                    aria-valuemax={Math.round(duration)}
                    tabIndex={0}
                    className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer group relative"
                    onMouseDown={handleSeekMouseDown}
                    onTouchStart={handleSeekTouchStart}
                    onKeyDown={handleSeekKeyDown}
                  >
                    <div
                      className="h-full bg-white/40 rounded-full group-hover:bg-white/60 transition-colors"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/30 tabular-nums w-8">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>

              {/* Right: Volume + Collapse */}
              <div className="w-40 shrink-0 flex items-center justify-end gap-2">
                <button
                  onClick={toggleMute}
                  className="text-white/40 hover:text-white/70 transition-colors"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  aria-label="Volume"
                  className="w-20 h-1 accent-white/60 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white/70"
                />
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="text-white/30 hover:text-white/60 transition-colors ml-1"
                  aria-label="Collapse player"
                  title="Collapse player"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
);
