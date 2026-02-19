'use client';

import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
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

export function extractPlaylistId(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('list');
  } catch {
    return null;
  }
}

export interface YouTubePlayerBarHandle {
  togglePlayPause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
}

interface YouTubePlayerBarProps {
  playlistUrl: string;
  onVisibilityChange?: (visible: boolean) => void;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const YouTubePlayerBar = forwardRef<YouTubePlayerBarHandle, YouTubePlayerBarProps>(
  function YouTubePlayerBar({ playlistUrl, onVisibilityChange }, ref) {
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

    const playlistId = extractPlaylistId(playlistUrl);

    const updateTrackInfo = useCallback(() => {
      if (!playerRef.current) return;
      const data = playerRef.current.getVideoData();
      if (data) {
        setTrackTitle(data.title || '');
        setTrackArtist(data.author || '');
      }
    }, []);

    // Notify parent of visibility changes (cleanup resets to false on unmount)
    useEffect(() => {
      onVisibilityChange?.(!isCollapsed);
      return () => onVisibilityChange?.(false);
    }, [isCollapsed, onVisibilityChange]);

    // Load YouTube IFrame API
    useEffect(() => {
      if (!playlistId) return;

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
        if (!containerRef.current || playerRef.current) return;

        // Create a div for the player inside our container
        const playerDiv = document.createElement('div');
        playerDiv.id = 'yt-player-' + Date.now();
        containerRef.current.appendChild(playerDiv);

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
            modestbranding: 1,
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
              setIsReady(false);
            },
          },
        });
      }

      return () => {
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        playerRef.current?.destroy();
        playerRef.current = null;
      };
    }, [playlistId, updateTrackInfo]);

    // Progress polling
    useEffect(() => {
      if (isPlaying) {
        progressTimerRef.current = setInterval(() => {
          if (playerRef.current) {
            setCurrentTime(playerRef.current.getCurrentTime());
            setDuration(playerRef.current.getDuration());
          }
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

    const handleSeek = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!playerRef.current || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        playerRef.current.seekTo(ratio * duration, true);
        setCurrentTime(ratio * duration);
      },
      [duration]
    );

    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      setVolume(val);
      setIsMuted(val === 0);
      playerRef.current?.setVolume(val);
      if (val > 0) playerRef.current?.unMute();
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
          <div className="fixed bottom-0 left-0 right-0 z-40 h-8 bg-black/90 backdrop-blur-md border-t border-white/10 flex items-center px-4 gap-3">
            <button
              onClick={togglePlayPause}
              className="text-white/60 hover:text-white transition-colors"
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
            <span className="text-[10px] text-white/40 truncate flex-1">
              {trackTitle || 'YouTube Playlist'}
            </span>
            <button
              onClick={() => setIsCollapsed(false)}
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-black/90 backdrop-blur-md border-t border-white/10">
            <div className="h-full flex items-center px-4 gap-4">
              {/* Left: Track info */}
              <div className="w-56 shrink-0 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded bg-white/[0.06]">
                    <Music className="w-3.5 h-3.5 text-white/30" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-white/70 truncate font-medium">
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
                    title="Previous track (Shift+Left)"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={togglePlayPause}
                    disabled={!isReady}
                    className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30"
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
                    className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer group relative"
                    onClick={handleSeek}
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
                  className="w-20 h-1 accent-white/60 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white/70"
                />
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="text-white/30 hover:text-white/60 transition-colors ml-1"
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
