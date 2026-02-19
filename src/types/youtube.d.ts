/* YouTube IFrame API type declarations */

declare namespace YT {
  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }

  interface PlayerEvent {
    target: Player;
  }

  interface OnStateChangeEvent {
    target: Player;
    data: PlayerState;
  }

  interface VideoData {
    title: string;
    video_id: string;
    author: string;
  }

  interface PlayerOptions {
    height?: string | number;
    width?: string | number;
    videoId?: string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (event: PlayerEvent) => void;
      onStateChange?: (event: OnStateChangeEvent) => void;
      onError?: (event: PlayerEvent) => void;
    };
  }

  class Player {
    constructor(elementId: string | HTMLElement, options: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    nextVideo(): void;
    previousVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    getPlayerState(): PlayerState;
    getCurrentTime(): number;
    getDuration(): number;
    getVolume(): number;
    setVolume(volume: number): void;
    isMuted(): boolean;
    mute(): void;
    unMute(): void;
    getVideoData(): VideoData;
    getPlaylistIndex(): number;
    destroy(): void;
  }
}

interface Window {
  onYouTubeIframeAPIReady?: () => void;
  YT?: typeof YT;
}
