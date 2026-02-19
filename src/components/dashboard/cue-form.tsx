'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import type { VisualizerConfig, VisualizerColorPalette, CameraMovement } from '@/types/visualizer';

export interface SceneOption {
  id: string;
  name: string;
  category: string;
}

export interface PresetOption {
  id: string;
  name: string;
  colors: VisualizerColorPalette;
}

interface CueFormProps {
  mode: 'create' | 'edit';
  setId: string;
  cueId?: string;
  scenes: SceneOption[];
  categories: readonly string[];
  colorPresets: PresetOption[];
}

function getCategoryDefaults(category: string): {
  cameraMovement: CameraMovement;
  bloomIntensity: number;
  audioReactivity: number;
  animationSpeed: number;
  particleDensity: number;
  depth: number;
} {
  if (category === 'immersive') {
    return {
      cameraMovement: 'drift',
      bloomIntensity: 1.6,
      audioReactivity: 0.75,
      animationSpeed: 1.0,
      particleDensity: 0.6,
      depth: 0.8,
    };
  }
  const map: Record<
    string,
    {
      cameraMovement: CameraMovement;
      bloomIntensity: number;
      audioReactivity: number;
      animationSpeed: number;
      particleDensity: number;
      depth: number;
    }
  > = {
    organic: {
      cameraMovement: 'drift',
      bloomIntensity: 1.8,
      audioReactivity: 0.7,
      animationSpeed: 0.8,
      particleDensity: 0.6,
      depth: 0.5,
    },
    cosmic: {
      cameraMovement: 'orbit',
      bloomIntensity: 2.0,
      audioReactivity: 0.8,
      animationSpeed: 1.0,
      particleDensity: 0.7,
      depth: 0.7,
    },
    geometric: {
      cameraMovement: 'orbit',
      bloomIntensity: 1.2,
      audioReactivity: 0.6,
      animationSpeed: 1.0,
      particleDensity: 0.5,
      depth: 0.4,
    },
    abstract: {
      cameraMovement: 'pulse',
      bloomIntensity: 1.5,
      audioReactivity: 0.8,
      animationSpeed: 1.2,
      particleDensity: 0.5,
      depth: 0.5,
    },
  };
  return (
    map[category] ?? {
      cameraMovement: 'orbit' as CameraMovement,
      bloomIntensity: 1.5,
      audioReactivity: 0.7,
      animationSpeed: 1.0,
      particleDensity: 0.5,
      depth: 0.5,
    }
  );
}

function buildClientConfig(
  sceneId: string,
  category: string,
  palette: VisualizerColorPalette
): VisualizerConfig {
  const isStarburst = sceneId.startsWith('starburst');
  const defaults = isStarburst
    ? {
        cameraMovement: 'static' as CameraMovement,
        bloomIntensity: 1.4,
        audioReactivity: 0.7,
        animationSpeed: 0.8,
        particleDensity: 0.5,
        depth: 0.0,
      }
    : getCategoryDefaults(category);

  return {
    scene: sceneId,
    colorPalette: palette,
    particleDensity: defaults.particleDensity,
    animationSpeed: defaults.animationSpeed,
    bloomIntensity: defaults.bloomIntensity,
    audioReactivity: defaults.audioReactivity,
    cameraMovement: defaults.cameraMovement,
    wireframe: false,
    symmetry: 6,
    depth: defaults.depth,
    colorCycleSpeed: 0.5,
    customTextureUrl: null,
    textureScale: 1.0,
    textureOpacity: 1.0,
    textureAnimation: 'none',
    patternOffsetX: 0,
    sceneParams: {},
  };
}

function findMatchingPreset(
  palette: VisualizerColorPalette,
  presets: PresetOption[]
): string | null {
  for (const p of presets) {
    if (
      p.colors.primary === palette.primary &&
      p.colors.secondary === palette.secondary &&
      p.colors.accent === palette.accent &&
      p.colors.background === palette.background
    ) {
      return p.id;
    }
  }
  return null;
}

const CATEGORY_LABELS: Record<string, string> = {
  organic: 'Organic',
  cosmic: 'Cosmic',
  geometric: 'Geometric',
  abstract: 'Abstract',
  immersive: 'Immersive',
};

export function CueForm({ mode, setId, cueId, scenes, categories, colorPresets }: CueFormProps) {
  const router = useRouter();
  const [cueName, setCueName] = useState('');
  const [selectedScene, setSelectedScene] = useState('particles');
  const [selectedPreset, setSelectedPreset] = useState('neon-rave');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(mode === 'edit');

  useEffect(() => {
    if (mode !== 'edit' || !cueId) return;

    async function fetchCue() {
      try {
        const res = await fetch(`/api/sets/${setId}/cues/${cueId}`);
        const data = await res.json();
        if (!data.success) {
          setError(data.error || 'Failed to load cue');
          return;
        }
        const cue = data.data;
        setCueName(cue.name);
        if (cue.config?.scene) setSelectedScene(cue.config.scene);
        if (cue.config?.colorPalette) {
          const match = findMatchingPreset(cue.config.colorPalette, colorPresets);
          if (match) setSelectedPreset(match);
        }
      } catch {
        setError('Failed to load cue');
      } finally {
        setFetching(false);
      }
    }

    fetchCue();
  }, [mode, setId, cueId, colorPresets]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const scene = scenes.find((s) => s.id === selectedScene);
    const preset = colorPresets.find((p) => p.id === selectedPreset);
    if (!scene || !preset) {
      setError('Invalid selection');
      setLoading(false);
      return;
    }

    const config = buildClientConfig(scene.id, scene.category, preset.colors);

    try {
      const url =
        mode === 'create' ? `/api/sets/${setId}/cues` : `/api/sets/${setId}/cues/${cueId}`;
      const method = mode === 'create' ? 'POST' : 'PUT';
      const body: Record<string, unknown> = { name: cueName, config };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Something went wrong');
        return;
      }
      router.push('/dashboard');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  const scenesByCategory = categories.reduce(
    (acc, cat) => {
      acc[cat] = scenes.filter((s) => s.category === cat);
      return acc;
    },
    {} as Record<string, SceneOption[]>
  );

  return (
    <div className="max-w-2xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Sets
      </Link>

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white/90 mb-1">
          {mode === 'create' ? 'Add Cue' : 'Edit Cue'}
        </h1>
        <p className="text-sm text-white/30">
          {mode === 'create'
            ? 'Choose a scene and color preset. Fine-tune settings in the visualizer.'
            : 'Update this cue\u2019s scene, colors, or name.'}
        </p>
      </div>

      {fetching ? (
        <div className="rounded-lg border border-white/[0.06] p-8">
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 rounded-full bg-white/10 animate-pulse" />
            <span className="text-xs text-white/25">Loading cue...</span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <label htmlFor="cue-name" className="text-xs font-medium text-white/50">
              Name <span className="text-white/20">*</span>
            </label>
            <input
              id="cue-name"
              type="text"
              value={cueName}
              onChange={(e) => setCueName(e.target.value)}
              placeholder="Intro, Drop, Bridge..."
              required
              maxLength={100}
              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>

          {/* Scene selector */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-white/50">Scene</label>
            <div className="space-y-4">
              {categories.map((cat) => {
                const catScenes = scenesByCategory[cat];
                if (!catScenes || catScenes.length === 0) return null;
                return (
                  <div key={cat}>
                    <p className="text-[10px] font-medium tracking-wide uppercase text-white/20 mb-2">
                      {CATEGORY_LABELS[cat] || cat}
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                      {catScenes.map((scene) => {
                        const active = selectedScene === scene.id;
                        return (
                          <button
                            key={scene.id}
                            type="button"
                            onClick={() => setSelectedScene(scene.id)}
                            className={`px-2.5 py-2 rounded-lg text-xs text-left transition-all ${
                              active
                                ? 'bg-white/[0.1] text-white/90 border border-white/20 shadow-[0_0_12px_rgba(255,255,255,0.04)]'
                                : 'bg-white/[0.02] text-white/40 border border-white/[0.06] hover:bg-white/[0.05] hover:text-white/60'
                            }`}
                          >
                            {scene.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Color preset selector */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-white/50">Color Preset</label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {colorPresets.map((preset) => {
                const active = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPreset(preset.id)}
                    title={preset.name}
                    className={`group relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all ${
                      active
                        ? 'bg-white/[0.08] border border-white/20'
                        : 'bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/[0.08]">
                      <div
                        className="absolute top-0 left-0 w-1/2 h-1/2"
                        style={{ backgroundColor: preset.colors.primary }}
                      />
                      <div
                        className="absolute top-0 right-0 w-1/2 h-1/2"
                        style={{ backgroundColor: preset.colors.secondary }}
                      />
                      <div
                        className="absolute bottom-0 left-0 w-1/2 h-1/2"
                        style={{ backgroundColor: preset.colors.accent }}
                      />
                      <div
                        className="absolute bottom-0 right-0 w-1/2 h-1/2"
                        style={{ backgroundColor: preset.colors.background }}
                      />
                    </div>
                    {active && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-black" />
                      </div>
                    )}
                    <span className="text-[9px] text-white/30 group-hover:text-white/50 truncate w-full text-center leading-tight">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !cueName.trim()}
              className="px-5 py-2.5 bg-white text-black text-xs font-medium rounded-lg hover:bg-white/90 disabled:opacity-50 transition-all"
            >
              {loading
                ? mode === 'create'
                  ? 'Adding...'
                  : 'Saving...'
                : mode === 'create'
                  ? 'Add Cue'
                  : 'Save Changes'}
            </button>
            <Link
              href="/dashboard"
              className="px-4 py-2.5 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
