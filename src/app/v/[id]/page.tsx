'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { Settings, Maximize2, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VisualizerEngine } from '@/components/visualizer/visualizer-engine';
import { VisualizerSettingsPanel } from '@/components/visualizer/visualizer-settings-panel';
import { HelpModal } from '@/components/settings/help-modal';
import { CueSwitcherBar, type CueSummary } from '@/components/visualizer/cue-switcher-bar';
import { CueToast } from '@/components/visualizer/cue-toast';
import {
  YouTubePlayerBar,
  type YouTubePlayerBarHandle,
} from '@/components/visualizer/youtube-player-bar';
import { extractPlaylistId } from '@/lib/youtube';
import { buildDefaultConfig, COLOR_PRESETS } from '@/constants/visualizer-presets';
import type { VisualizerConfig, VisualizerColorPalette } from '@/types/visualizer';

function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const c = hex.replace('#', '');
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bv = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bv.toString(16).padStart(2, '0')}`;
}

function lerpPalette(
  a: VisualizerColorPalette,
  b: VisualizerColorPalette,
  t: number
): VisualizerColorPalette {
  return {
    primary: lerpColor(a.primary, b.primary, t),
    secondary: lerpColor(a.secondary, b.secondary, t),
    accent: lerpColor(a.accent, b.accent, t),
    background: lerpColor(a.background, b.background, t),
  };
}

export default function VisualizerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const isNewSession = id === 'new';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VisualizerEngine | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const colorCycleIndexRef = useRef(0);
  const lerpFrameRef = useRef<number | null>(null);
  const activeCueIdRef = useRef<string | null>(null);
  // Store full cue data (config + textureUrl) for switching
  const cueDataRef = useRef<Map<string, { config: VisualizerConfig; textureUrl: string | null }>>(
    new Map()
  );

  const [config, setConfig] = useState<VisualizerConfig | null>(null);
  const configRef = useRef<VisualizerConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [colorCycleEnabled, setColorCycleEnabled] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [cues, setCues] = useState<CueSummary[]>([]);
  const [activeCueId, setActiveCueId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [setName, setSetName] = useState('');
  const [setDescription, setSetDescription] = useState<string | null>(null);
  const [setYoutubePlaylistUrl, setSetYoutubePlaylistUrl] = useState<string | null>(null);
  const [setIsPublic, setSetIsPublic] = useState(false);
  const [youtubeBarHeight, setYoutubeBarHeight] = useState(0);
  const cueFadeFrameRef = useRef<number | null>(null);
  const switchCueRef = useRef<((cueId: string) => void) | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const youtubePlayerRef = useRef<YouTubePlayerBarHandle>(null);

  // Helper to keep configRef in sync with config state
  const updateConfig = useCallback((c: VisualizerConfig) => {
    configRef.current = c;
    setConfig(c);
  }, []);

  // Load set or defaults
  const cueParam = searchParams.get('cue');
  useEffect(() => {
    async function load() {
      if (isNewSession) {
        setIsOwner(true);
        // Try localStorage first
        const stored = localStorage.getItem(`mirage-config-${id}`);
        if (stored) {
          try {
            updateConfig(JSON.parse(stored));
            return;
          } catch {
            /* ignore */
          }
        }
        updateConfig(buildDefaultConfig('particles'));
        return;
      }

      // Try localStorage cache first
      const stored = localStorage.getItem(`mirage-config-${id}`);
      if (stored) {
        try {
          updateConfig(JSON.parse(stored));
        } catch {
          /* ignore */
        }
      }

      // Fetch set from API
      try {
        const res = await fetch(`/api/sets/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            const setData = data.data;
            if (setData.isOwner) {
              setIsOwner(true);
            }

            // Store set metadata
            setSetName(setData.name || '');
            setSetDescription(setData.description ?? null);
            setSetYoutubePlaylistUrl(setData.youtubePlaylistUrl ?? null);
            setSetIsPublic(setData.isPublic ?? false);

            // Store cues for the switcher
            if (setData.cues && setData.cues.length > 0) {
              const sortedCues = [...setData.cues].sort(
                (a: { position: number }, b: { position: number }) => a.position - b.position
              );

              // Build cue summaries and data map
              const cueSummaries: CueSummary[] = sortedCues.map(
                (c: { id: string; name: string; position: number }) => ({
                  id: c.id,
                  name: c.name,
                  position: c.position,
                })
              );
              setCues(cueSummaries);

              // Build data map for cue switching
              const dataMap = new Map<
                string,
                { config: VisualizerConfig; textureUrl: string | null }
              >();
              for (const cue of sortedCues) {
                dataMap.set(cue.id, {
                  config: cue.config as VisualizerConfig,
                  textureUrl: (cue.textureUrl as string | null) ?? null,
                });
              }
              cueDataRef.current = dataMap;

              // Load the requested cue, or fall back to first
              const targetCue =
                (cueParam && sortedCues.find((c: { id: string }) => c.id === cueParam)) ||
                sortedCues[0];

              activeCueIdRef.current = targetCue.id;
              setActiveCueId(targetCue.id);
              const cueConfig = targetCue.config as VisualizerConfig;
              updateConfig(cueConfig);
              localStorage.setItem(`mirage-config-${id}`, JSON.stringify(cueConfig));

              // Sync engine if it was already initialized from stale cache
              if (engineRef.current) {
                engineRef.current.updateConfig(cueConfig);
                if (cueConfig.customTextureUrl) {
                  engineRef.current.loadTexture(cueConfig.customTextureUrl);
                } else {
                  engineRef.current.clearTexture();
                }
              }
              return;
            }
          }
        }
      } catch {
        /* ignore */
      }

      // Default config if nothing loaded
      if (!stored) {
        updateConfig(buildDefaultConfig('particles'));
      }
    }
    load();
  }, [id, isNewSession, cueParam, updateConfig]);

  // Initialize engine (no mic access until user enables audio)
  useEffect(() => {
    if (!config || !canvasRef.current) return;

    const engine = new VisualizerEngine(canvasRef.current, config);
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.dispose();
      engineRef.current = null;
      if (cueFadeFrameRef.current) {
        cancelAnimationFrame(cueFadeFrameRef.current);
        cueFadeFrameRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
    };
    // Only run on initial config load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config !== null]);

  // Lazily request microphone when audio is enabled.
  // Deferred so the browser permission prompt only appears when
  // the user explicitly turns on audio-reactive mode.
  const initMicAudio = useCallback(() => {
    if (audioCtxRef.current) return; // already set up

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        audioStreamRef.current = stream;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        // NOT connected to destination (no feedback)
        engineRef.current?.setAnalyser(analyser);
        engineRef.current?.setAudioEnabled(true);
      })
      .catch(() => {
        setAudioEnabled(false);
        engineRef.current?.setAudioEnabled(false);
      });
  }, []);

  const stopMicAudio = useCallback(() => {
    engineRef.current?.setAnalyser(null);
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
  }, []);

  const dismissToast = useCallback(() => setToastMessage(null), []);

  // Auto-hide controls
  useEffect(() => {
    const handleMove = () => {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    };

    window.addEventListener('mousemove', handleMove);
    handleMove();

    return () => {
      window.removeEventListener('mousemove', handleMove);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLButtonElement
      )
        return;

      // YouTube controls: Space = play/pause, Shift+Arrow = next/prev
      if (e.key === ' ' && youtubePlayerRef.current && setYoutubePlaylistUrl) {
        e.preventDefault();
        youtubePlayerRef.current.togglePlayPause();
        return;
      }
      if (e.shiftKey && e.key === 'ArrowRight' && youtubePlayerRef.current) {
        e.preventDefault();
        youtubePlayerRef.current.nextTrack();
        return;
      }
      if (e.shiftKey && e.key === 'ArrowLeft' && youtubePlayerRef.current) {
        e.preventDefault();
        youtubePlayerRef.current.prevTrack();
        return;
      }

      // 1-9: Switch cues by position
      const digit = parseInt(e.key);
      if (digit >= 1 && digit <= 9 && cues.length > 0) {
        const sorted = [...cues].sort((a, b) => a.position - b.position);
        const target = sorted[digit - 1];
        if (target) switchCueRef.current?.(target.id);
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'f':
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen();
          break;
        case 's':
          setShowSettings((prev) => !prev);
          break;
        case 'h':
          setShowHelp((prev) => !prev);
          break;
        case 'm':
          setAudioEnabled((prev) => {
            const next = !prev;
            engineRef.current?.setAudioEnabled(next);
            if (next) initMicAudio();
            else stopMicAudio();
            return next;
          });
          break;
        case 'escape':
          if (showHelp) setShowHelp(false);
          else if (showSettings) setShowSettings(false);
          else if (document.fullscreenElement) document.exitFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showSettings, showHelp, initMicAudio, stopMicAudio, cues, setYoutubePlaylistUrl]);

  // Debounced save
  const saveConfig = useCallback(
    (newConfig: VisualizerConfig) => {
      localStorage.setItem(`mirage-config-${id}`, JSON.stringify(newConfig));

      if (!isNewSession && isOwner && activeCueIdRef.current) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(async () => {
          try {
            await fetch(`/api/sets/${id}/cues/${activeCueIdRef.current}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ config: newConfig }),
            });
          } catch {
            /* ignore */
          }
        }, 1000);
      }
    },
    [id, isNewSession, isOwner]
  );

  // Flush any pending debounced save immediately
  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    // Persist current config to the active cue right now
    const currentConfig = configRef.current;
    if (!isNewSession && isOwner && activeCueIdRef.current && currentConfig) {
      // Update the cue data map with the latest config
      const existing = cueDataRef.current.get(activeCueIdRef.current);
      if (existing) {
        cueDataRef.current.set(activeCueIdRef.current, {
          ...existing,
          config: currentConfig,
        });
      }

      fetch(`/api/sets/${id}/cues/${activeCueIdRef.current}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: currentConfig }),
      }).catch(() => {
        /* ignore */
      });
    }
  }, [id, isNewSession, isOwner]);

  const handleConfigUpdate = useCallback(
    (newConfig: VisualizerConfig) => {
      updateConfig(newConfig);
      engineRef.current?.updateConfig(newConfig);
      saveConfig(newConfig);
    },
    [saveConfig, updateConfig]
  );

  const handleQuickChange = useCallback(
    (changes: Partial<VisualizerConfig>) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, ...changes };
        configRef.current = updated;
        engineRef.current?.updateConfig(changes);
        saveConfig(updated);
        return updated;
      });
    },
    [saveConfig]
  );

  // Cue switching with palette crossfade
  const switchCue = useCallback(
    (cueId: string) => {
      if (cueId === activeCueIdRef.current) return;

      // Flush pending save for the current cue
      flushSave();

      // Load the target cue's config
      const cueData = cueDataRef.current.get(cueId);
      if (!cueData) return;

      // Cancel any in-progress crossfade
      if (cueFadeFrameRef.current) {
        cancelAnimationFrame(cueFadeFrameRef.current);
        cueFadeFrameRef.current = null;
      }

      // Update active cue
      activeCueIdRef.current = cueId;
      setActiveCueId(cueId);

      const cueConfig = cueData.config;
      const oldPalette = configRef.current?.colorPalette;
      const sceneChanged = configRef.current?.scene !== cueConfig.scene;

      // Show toast
      const matchingCue = cues.find((c) => c.id === cueId);
      if (matchingCue) {
        setToastMessage(`${matchingCue.position}. ${matchingCue.name}`);
      }

      // Apply non-palette config changes immediately
      const configWithoutPalette = { ...cueConfig };
      if (oldPalette && !sceneChanged) {
        // Keep old palette temporarily for crossfade
        configWithoutPalette.colorPalette = oldPalette;
      }

      updateConfig(sceneChanged ? cueConfig : configWithoutPalette);
      engineRef.current?.updateConfig(sceneChanged ? cueConfig : configWithoutPalette);
      localStorage.setItem(`mirage-config-${id}`, JSON.stringify(cueConfig));

      // Handle texture
      if (cueConfig.customTextureUrl) {
        engineRef.current?.loadTexture(cueConfig.customTextureUrl);
      } else {
        engineRef.current?.clearTexture();
      }

      // Palette crossfade (skip if scene changed — it requires dispose+recreate anyway)
      if (oldPalette && !sceneChanged) {
        const startPalette = { ...oldPalette };
        const targetPalette = cueConfig.colorPalette;
        const startTime = performance.now();
        const duration = 500;

        const animateFade = (now: number) => {
          const t = Math.min((now - startTime) / duration, 1);
          const smoothT = t * t * (3 - 2 * t); // smoothstep
          const lerped = lerpPalette(startPalette, targetPalette, smoothT);

          const fadeConfig = { ...cueConfig, colorPalette: lerped };
          updateConfig(fadeConfig);
          engineRef.current?.updateConfig({ colorPalette: lerped });

          if (t < 1) {
            cueFadeFrameRef.current = requestAnimationFrame(animateFade);
          } else {
            cueFadeFrameRef.current = null;
            // Ensure final state is exact target
            updateConfig(cueConfig);
            engineRef.current?.updateConfig({ colorPalette: targetPalette });
          }
        };

        cueFadeFrameRef.current = requestAnimationFrame(animateFade);
      }

      // Update URL without navigation
      history.replaceState(null, '', `/v/${id}?cue=${cueId}`);
    },
    [id, cues, flushSave, updateConfig]
  );

  // Keep switchCueRef in sync (avoids stale closure in keyboard handler)
  switchCueRef.current = switchCue;

  // Color cycling — uses configRef to avoid restarting the interval on every config change
  useEffect(() => {
    if (!colorCycleEnabled || !configRef.current) {
      if (colorCycleRef.current) clearInterval(colorCycleRef.current);
      if (lerpFrameRef.current) cancelAnimationFrame(lerpFrameRef.current);
      return;
    }

    colorCycleRef.current = setInterval(() => {
      colorCycleIndexRef.current = (colorCycleIndexRef.current + 1) % COLOR_PRESETS.length;
      const targetPalette = COLOR_PRESETS[colorCycleIndexRef.current].colors;
      const currentPalette = configRef.current?.colorPalette;
      if (!currentPalette) return;
      const startPalette = { ...currentPalette };
      const startTime = performance.now();
      const duration = 1000; // 1s transition

      const animate = (now: number) => {
        const t = Math.min((now - startTime) / duration, 1);
        const smoothT = t * t * (3 - 2 * t); // smoothstep
        const lerped = lerpPalette(startPalette, targetPalette, smoothT);
        handleQuickChange({ colorPalette: lerped });

        if (t < 1) {
          lerpFrameRef.current = requestAnimationFrame(animate);
        }
      };

      lerpFrameRef.current = requestAnimationFrame(animate);
    }, 8000);

    return () => {
      if (colorCycleRef.current) clearInterval(colorCycleRef.current);
      if (lerpFrameRef.current) cancelAnimationFrame(lerpFrameRef.current);
    };
  }, [colorCycleEnabled, handleQuickChange]);

  const handleToggleAudio = useCallback(
    (enabled: boolean) => {
      setAudioEnabled(enabled);
      engineRef.current?.setAudioEnabled(enabled);
      if (enabled) {
        initMicAudio();
      } else {
        stopMicAudio();
      }
    },
    [initMicAudio, stopMicAudio]
  );

  const hasYoutubePlaylist = useMemo(
    () => !isNewSession && !!setYoutubePlaylistUrl && !!extractPlaylistId(setYoutubePlaylistUrl),
    [isNewSession, setYoutubePlaylistUrl]
  );

  if (!config) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white/50 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black"
      style={{ cursor: controlsVisible ? 'default' : 'none' }}
    >
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Controls overlay */}
      <div
        className={cn(
          'absolute top-4 right-4 flex gap-2 transition-opacity duration-300',
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <button
          onClick={() => handleToggleAudio(!audioEnabled)}
          className="p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white/70 hover:text-white transition-colors backdrop-blur-sm"
          title={audioEnabled ? 'Mute audio (M)' : 'Enable audio (M)'}
        >
          {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
        <button
          onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen();
          }}
          className="p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white/70 hover:text-white transition-colors backdrop-blur-sm"
          title="Fullscreen (F)"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={cn(
            'p-2 rounded-lg transition-colors backdrop-blur-sm',
            showSettings
              ? 'bg-white/20 text-white'
              : 'bg-black/50 hover:bg-black/70 text-white/70 hover:text-white'
          )}
          title="Settings (S)"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <VisualizerSettingsPanel
          config={config}
          setContext={
            isNewSession
              ? undefined
              : {
                  setId: id,
                  activeCueId: activeCueId ?? undefined,
                  isOwner,
                  cues,
                  cueConfigs: cueDataRef.current,
                  onSwitchCue: switchCue,
                  onCuesChange: (newCues) => setCues(newCues),
                  onCueAdded: (cue, cueConfig) => {
                    setCues((prev) => [...prev, cue]);
                    cueDataRef.current.set(cue.id, { config: cueConfig, textureUrl: null });
                    switchCue(cue.id);
                  },
                  onCueDeleted: (cueId) => {
                    setCues((prev) => {
                      const remaining = prev.filter((c) => c.id !== cueId);
                      if (activeCueIdRef.current === cueId && remaining.length > 0) {
                        const sorted = [...remaining].sort((a, b) => a.position - b.position);
                        switchCue(sorted[0].id);
                      }
                      return remaining;
                    });
                    cueDataRef.current.delete(cueId);
                  },
                  onCueRenamed: (cueId, name) => {
                    setCues((prev) => prev.map((c) => (c.id === cueId ? { ...c, name } : c)));
                  },
                  name: setName,
                  description: setDescription,
                  youtubePlaylistUrl: setYoutubePlaylistUrl,
                  isPublic: setIsPublic,
                  onMetadataChange: (fields) => {
                    if (fields.name !== undefined) setSetName(fields.name);
                    if (fields.description !== undefined)
                      setSetDescription(fields.description ?? null);
                    if (fields.youtubePlaylistUrl !== undefined)
                      setSetYoutubePlaylistUrl(fields.youtubePlaylistUrl ?? null);
                    if (fields.isPublic !== undefined) setSetIsPublic(fields.isPublic);
                  },
                }
          }
          audioInputEnabled={audioEnabled}
          colorCycleEnabled={colorCycleEnabled}
          onToggleAudioInput={handleToggleAudio}
          onToggleColorCycle={setColorCycleEnabled}
          onConfigUpdate={handleConfigUpdate}
          onQuickChange={handleQuickChange}
          onClose={() => setShowSettings(false)}
          onShowHelp={() => setShowHelp(true)}
        />
      )}

      {/* YouTube player bar */}
      {hasYoutubePlaylist && (
        <YouTubePlayerBar
          ref={youtubePlayerRef}
          playlistUrl={setYoutubePlaylistUrl!}
          visible={controlsVisible}
          onBarHeightChange={setYoutubeBarHeight}
        />
      )}

      {/* Cue switcher bar */}
      {!isNewSession && cues.length > 0 && (
        <CueSwitcherBar
          visible={controlsVisible}
          cues={cues}
          activeCueId={activeCueId}
          onSwitchCue={switchCue}
          bottomOffset={youtubeBarHeight > 0 ? youtubeBarHeight + 16 : 16}
        />
      )}

      {/* Cue switch toast */}
      <CueToast message={toastMessage} onDismiss={dismissToast} />

      {/* Help Modal - rendered at page level so it's not clipped by sidebar */}
      {showHelp && (
        <HelpModal onClose={() => setShowHelp(false)} hasYoutubePlaylist={hasYoutubePlaylist} />
      )}
    </div>
  );
}
