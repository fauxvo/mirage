'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { use } from 'react';
import { Settings, Maximize2, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VisualizerEngine } from '@/components/visualizer/visualizer-engine';
import { VisualizerSettingsPanel } from '@/components/visualizer/visualizer-settings-panel';
import { HelpModal } from '@/components/settings/help-modal';
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
  const isNewSession = id === 'new';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VisualizerEngine | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const colorCycleIndexRef = useRef(0);
  const lerpFrameRef = useRef<number | null>(null);

  const [config, setConfig] = useState<VisualizerConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [colorCycleEnabled, setColorCycleEnabled] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load session or defaults
  useEffect(() => {
    async function load() {
      // Check admin token
      if (!isNewSession) {
        const token = localStorage.getItem(`mirage-admin-${id}`);
        setIsAdmin(!!token);
      } else {
        setIsAdmin(true);
      }

      // Try localStorage first
      const stored = localStorage.getItem(`mirage-config-${id}`);
      if (stored) {
        try {
          setConfig(JSON.parse(stored));
          return;
        } catch {
          /* ignore */
        }
      }

      // Try API for existing sessions
      if (!isNewSession) {
        try {
          const res = await fetch(`/api/sessions/${id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.data.config) {
              const sessionConfig = data.data.config as VisualizerConfig;
              setConfig(sessionConfig);
              localStorage.setItem(`mirage-config-${id}`, JSON.stringify(sessionConfig));
              return;
            }
          }
        } catch {
          /* ignore */
        }
      }

      // Default config
      setConfig(buildDefaultConfig('particles'));
    }
    load();
  }, [id, isNewSession]);

  // Initialize engine (no mic access until user enables audio)
  useEffect(() => {
    if (!config || !canvasRef.current) return;

    const engine = new VisualizerEngine(canvasRef.current, config);
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.dispose();
      engineRef.current = null;
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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
  }, [showSettings, showHelp, initMicAudio]);

  // Debounced save
  const saveConfig = useCallback(
    (newConfig: VisualizerConfig) => {
      localStorage.setItem(`mirage-config-${id}`, JSON.stringify(newConfig));

      if (!isNewSession && isAdmin) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(async () => {
          const token = localStorage.getItem(`mirage-admin-${id}`);
          if (!token) return;
          try {
            await fetch(`/api/sessions/${id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'x-admin-token': token,
              },
              body: JSON.stringify({ config: newConfig }),
            });
          } catch {
            /* ignore */
          }
        }, 1000);
      }
    },
    [id, isNewSession, isAdmin]
  );

  const handleConfigUpdate = useCallback(
    (newConfig: VisualizerConfig) => {
      setConfig(newConfig);
      engineRef.current?.updateConfig(newConfig);
      saveConfig(newConfig);
    },
    [saveConfig]
  );

  const handleQuickChange = useCallback(
    (changes: Partial<VisualizerConfig>) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, ...changes };
        engineRef.current?.updateConfig(changes);
        saveConfig(updated);
        return updated;
      });
    },
    [saveConfig]
  );

  // Color cycling
  useEffect(() => {
    if (!colorCycleEnabled || !config) {
      if (colorCycleRef.current) clearInterval(colorCycleRef.current);
      if (lerpFrameRef.current) cancelAnimationFrame(lerpFrameRef.current);
      return;
    }

    colorCycleRef.current = setInterval(() => {
      colorCycleIndexRef.current = (colorCycleIndexRef.current + 1) % COLOR_PRESETS.length;
      const targetPalette = COLOR_PRESETS[colorCycleIndexRef.current].colors;
      const startPalette = { ...config.colorPalette };
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
  }, [colorCycleEnabled, config, handleQuickChange]);

  const handleToggleAudio = useCallback(
    (enabled: boolean) => {
      setAudioEnabled(enabled);
      engineRef.current?.setAudioEnabled(enabled);
      if (enabled) initMicAudio();
    },
    [initMicAudio]
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
          sessionId={isNewSession ? undefined : id}
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

      {/* Help Modal - rendered at page level so it's not clipped by sidebar */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
