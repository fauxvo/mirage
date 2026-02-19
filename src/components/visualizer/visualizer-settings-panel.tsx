'use client';

import { useState, useRef, useEffect } from 'react';
import {
  X,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Upload,
  Trash2,
  HelpCircle,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getAllSceneMetadata,
  getSceneMetadata,
} from '@/components/visualizer/scenes/scene-registry';
import { buildDefaultConfig, COLOR_PRESETS } from '@/constants/visualizer-presets';
import { SliderControl, TextureAnimationPicker } from '@/components/settings/slider-control';
import type { VisualizerConfig } from '@/types/visualizer';

interface VisualizerSettingsPanelProps {
  config: VisualizerConfig;
  setId?: string;
  audioInputEnabled: boolean;
  colorCycleEnabled: boolean;
  onToggleAudioInput: (enabled: boolean) => void;
  onToggleColorCycle: (enabled: boolean) => void;
  onConfigUpdate: (config: VisualizerConfig) => void;
  onQuickChange: (changes: Partial<VisualizerConfig>) => void;
  onClose: () => void;
  onShowHelp: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  organic: 'Organic',
  cosmic: 'Cosmic',
  geometric: 'Geometric',
  abstract: 'Abstract',
  immersive: 'Immersive',
};

// Keys that map to top-level config fields for backward compatibility
const TOP_LEVEL_PARAM_KEYS = new Set(['particleDensity', 'symmetry', 'wireframe']);

export function VisualizerSettingsPanel({
  config,
  setId,
  audioInputEnabled,
  colorCycleEnabled,
  onToggleAudioInput,
  onToggleColorCycle,
  onConfigUpdate,
  onQuickChange,
  onClose,
  onShowHelp,
}: VisualizerSettingsPanelProps) {
  const [textureError, setTextureError] = useState<string | null>(null);
  const [textureUploading, setTextureUploading] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCustomColors, setShowCustomColors] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Check if R2/S3 storage is configured
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStorageAvailable(!!data.storageConfigured))
      .catch(() => setStorageAvailable(false));
  }, []);

  const allScenes = getAllSceneMetadata();
  const categories = [...new Set(allScenes.map((s) => s.category))];

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const currentScene = allScenes.find((s) => s.id === config.scene);
    return new Set(currentScene ? [currentScene.category] : []);
  });

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const MAX_INPUT_SIZE = 10 * 1024 * 1024; // 10MB input limit (will be optimized down)
  const MAX_OUTPUT_SIZE = 512 * 1024; // 512KB after optimization
  const TARGET_DIMENSION = 1024; // Max width/height for the texture

  /**
   * Optimize an image: resize to max 1024px on longest side,
   * compress as JPEG at decreasing quality until under 512KB.
   */
  const optimizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        // Calculate target dimensions (preserve aspect ratio)
        let { width, height } = img;
        if (width > TARGET_DIMENSION || height > TARGET_DIMENSION) {
          const scale = TARGET_DIMENSION / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Try decreasing quality until under limit
        const qualities = [0.85, 0.7, 0.5, 0.3];
        for (const q of qualities) {
          const dataUrl = canvas.toDataURL('image/jpeg', q);
          if (dataUrl.length <= MAX_OUTPUT_SIZE * 1.37) {
            // base64 is ~1.37x raw size
            resolve(dataUrl);
            return;
          }
        }

        // Last resort: lowest quality
        resolve(canvas.toDataURL('image/jpeg', 0.2));
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  };

  const uploadToStorage = async (file: File): Promise<string> => {
    if (!setId) {
      throw new Error('Set required for cloud upload');
    }

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'x-set-id': setId,
      },
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || 'Upload failed');
    }

    const data = await res.json();
    return data.data.url;
  };

  const handleTextureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTextureError(null);

    if (!file.type.startsWith('image/')) {
      setTextureError('Please select an image file');
      return;
    }
    if (file.size > MAX_INPUT_SIZE) {
      setTextureError('Image must be under 10MB');
      return;
    }

    try {
      // Use R2/S3 storage when available and we have a session
      if (storageAvailable && setId) {
        setTextureUploading(true);
        const url = await uploadToStorage(file);
        onQuickChange({ customTextureUrl: url });
      } else {
        // Fall back to client-side base64 optimization
        if (file.size <= MAX_OUTPUT_SIZE) {
          const reader = new FileReader();
          reader.onload = () => {
            onQuickChange({ customTextureUrl: reader.result as string });
          };
          reader.onerror = () => setTextureError('Failed to read file');
          reader.readAsDataURL(file);
        } else {
          const optimized = await optimizeImage(file);
          onQuickChange({ customTextureUrl: optimized });
        }
      }
    } catch (err) {
      setTextureError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setTextureUploading(false);
    }

    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleRemoveTexture = () => {
    onQuickChange({ customTextureUrl: null });
    setTextureError(null);
  };

  const handleCopyUrl = async () => {
    if (!setId) return;
    const url = `${window.location.origin}/v/${setId}`;
    await navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const sceneMeta = getSceneMetadata(config.scene);
  const currentSceneMeta = allScenes.find((s) => s.id === config.scene);

  return (
    <div
      className={cn(
        'absolute top-0 right-0 bottom-0 z-20 w-80',
        'bg-black/90 backdrop-blur-xl border-l border-white/10',
        'flex flex-col overflow-hidden',
        'animate-slide-in-right'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 className="text-white font-semibold text-sm">Visualizer Settings</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onShowHelp}
            className="p-1 text-white/50 hover:text-white rounded transition-colors"
            title="Help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-white/50 hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Share URL — only shown for saved sets */}
        {setId && (
          <section>
            <label className="block text-white/70 text-xs font-medium mb-2 uppercase tracking-wider">
              Share Set
            </label>
            <div className="flex gap-2">
              <div className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white/50 font-mono truncate">
                {typeof window !== 'undefined' ? window.location.origin : ''}/v/{setId}
              </div>
              <button
                onClick={handleCopyUrl}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition-colors"
                title="Copy URL"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </section>
        )}

        {/* Scene Type - Category Grid */}
        <section>
          <label className="block text-white/70 text-xs font-medium mb-2 uppercase tracking-wider">
            Scene Type
          </label>
          {currentSceneMeta && (
            <div className="mb-2 px-2.5 py-1.5 bg-white/5 rounded-lg">
              <p className="text-white text-xs font-medium">{currentSceneMeta.name}</p>
              <p className="text-white/40 text-[10px] leading-tight mt-0.5">
                {currentSceneMeta.audioDescription}
              </p>
            </div>
          )}
          <div className="space-y-1">
            {categories.map((category) => {
              const scenes = allScenes.filter((s) => s.category === category);
              const isExpanded = expandedCategories.has(category);
              const hasSelected = scenes.some((s) => s.id === config.scene);

              return (
                <div key={category}>
                  <button
                    onClick={() => toggleCategory(category)}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-colors',
                      hasSelected
                        ? 'bg-white/15 text-white'
                        : 'bg-white/5 text-white/40 hover:text-white/60'
                    )}
                  >
                    <span>{CATEGORY_LABELS[category] ?? category}</span>
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="grid grid-cols-2 gap-1 mt-1 mb-1">
                      {scenes.map((scene) => (
                        <button
                          key={scene.id}
                          onClick={() => onQuickChange({ scene: scene.id })}
                          className={cn(
                            'px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-left',
                            config.scene === scene.id
                              ? 'bg-white/20 text-white border border-white/30'
                              : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-transparent'
                          )}
                        >
                          {scene.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Color Presets */}
        <section>
          <label className="block text-white/70 text-xs font-medium mb-2 uppercase tracking-wider">
            Color Preset
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {COLOR_PRESETS.map((preset) => {
              const isActive =
                config.colorPalette.primary === preset.colors.primary &&
                config.colorPalette.secondary === preset.colors.secondary &&
                config.colorPalette.accent === preset.colors.accent &&
                config.colorPalette.background === preset.colors.background;

              return (
                <button
                  key={preset.id}
                  onClick={() => {
                    onQuickChange({ colorPalette: preset.colors });
                    setShowCustomColors(false);
                  }}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all',
                    isActive && !showCustomColors
                      ? 'bg-white/20 border border-white/30'
                      : 'bg-white/5 border border-transparent hover:bg-white/10'
                  )}
                >
                  <div className="flex gap-0.5 shrink-0">
                    {Object.values(preset.colors).map((color, i) => (
                      <div
                        key={i}
                        className="w-3 h-3 rounded-full border border-white/10"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-white/60 truncate">{preset.name}</span>
                </button>
              );
            })}
            {/* Custom toggle */}
            <button
              onClick={() => setShowCustomColors(!showCustomColors)}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all',
                showCustomColors
                  ? 'bg-white/20 border border-white/30'
                  : 'bg-white/5 border border-transparent hover:bg-white/10'
              )}
            >
              <div className="flex gap-0.5 shrink-0">
                {Object.values(config.colorPalette).map((color, i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full border border-white/10"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-white/60 truncate">Custom</span>
            </button>
          </div>
          {/* Custom color pickers */}
          {showCustomColors && (
            <div className="mt-2 space-y-2 p-2.5 bg-white/5 rounded-lg">
              {(
                [
                  ['primary', 'Primary'],
                  ['secondary', 'Secondary'],
                  ['accent', 'Accent'],
                  ['background', 'Background'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <label className="text-white/50 text-[10px] font-medium">{label}</label>
                  <div className="flex items-center gap-2">
                    <span className="text-white/30 text-[10px] font-mono">
                      {config.colorPalette[key]}
                    </span>
                    <input
                      type="color"
                      value={config.colorPalette[key]}
                      onChange={(e) =>
                        onQuickChange({
                          colorPalette: { ...config.colorPalette, [key]: e.target.value },
                        })
                      }
                      className="w-6 h-6 rounded border border-white/20 bg-transparent cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Color Cycle Toggle */}
          <div className="mt-2 flex items-center justify-between">
            <div>
              <label className="text-white/50 text-[10px] font-medium">Auto-Cycle Colors</label>
              <p className="text-white/25 text-[9px] mt-0.5">
                {colorCycleEnabled ? 'Cycling every 8s' : 'Rotate through all presets'}
              </p>
            </div>
            <button
              onClick={() => onToggleColorCycle(!colorCycleEnabled)}
              className={cn(
                'w-10 h-5 rounded-full transition-colors relative shrink-0',
                colorCycleEnabled ? 'bg-white/30' : 'bg-white/10'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                  colorCycleEnabled ? 'translate-x-[20px]' : 'translate-x-0'
                )}
              />
            </button>
          </div>
        </section>

        {/* Audio Input Toggle */}
        <section>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-white/70 text-xs font-medium uppercase tracking-wider">
                Audio Input
              </label>
              <p className="text-white/30 text-[10px] mt-0.5">
                {audioInputEnabled ? 'Visuals react to music' : 'Calm ambient animations'}
              </p>
            </div>
            <button
              onClick={() => onToggleAudioInput(!audioInputEnabled)}
              className={cn(
                'w-10 h-5 rounded-full transition-colors relative shrink-0',
                audioInputEnabled ? 'bg-white/30' : 'bg-white/10'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                  audioInputEnabled ? 'translate-x-[20px]' : 'translate-x-0'
                )}
              />
            </button>
          </div>
        </section>

        {/* Bloom Intensity */}
        <SliderControl
          label="Bloom Intensity"
          value={config.bloomIntensity}
          min={0}
          max={3}
          step={0.1}
          onChange={(v) => onQuickChange({ bloomIntensity: v })}
        />

        {/* Audio Reactivity - only meaningful when audio input is on */}
        {audioInputEnabled && (
          <SliderControl
            label="Audio Reactivity"
            value={config.audioReactivity}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => onQuickChange({ audioReactivity: v })}
          />
        )}

        {/* Animation Speed */}
        <SliderControl
          label="Animation Speed"
          value={config.animationSpeed}
          min={0.5}
          max={2}
          step={0.1}
          onChange={(v) => onQuickChange({ animationSpeed: v })}
        />

        {/* Dynamic per-scene controls from metadata */}
        {sceneMeta?.params.map((param) => {
          // Backward-compatible: particleDensity, symmetry, wireframe use top-level config
          if (TOP_LEVEL_PARAM_KEYS.has(param.key)) {
            if (param.type === 'slider') {
              const configKey = param.key as keyof VisualizerConfig;
              return (
                <SliderControl
                  key={param.key}
                  label={param.label}
                  value={(config[configKey] as number) ?? (param.default as number)}
                  min={param.min!}
                  max={param.max!}
                  step={param.step!}
                  onChange={(v) => onQuickChange({ [param.key]: v })}
                />
              );
            }
            if (param.type === 'toggle') {
              const configKey = param.key as keyof VisualizerConfig;
              const currentValue = (config[configKey] as boolean) ?? (param.default as boolean);
              return (
                <section key={param.key}>
                  <div className="flex items-center justify-between">
                    <label className="text-white/70 text-xs font-medium uppercase tracking-wider">
                      {param.label}
                    </label>
                    <button
                      onClick={() => onQuickChange({ [param.key]: !currentValue })}
                      className={cn(
                        'w-10 h-5 rounded-full transition-colors relative shrink-0',
                        currentValue ? 'bg-white/30' : 'bg-white/10'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                          currentValue ? 'translate-x-[20px]' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>
                </section>
              );
            }
            return null;
          }

          // Non-top-level params use sceneParams
          if (param.type === 'slider') {
            return (
              <SliderControl
                key={param.key}
                label={param.label}
                value={(config.sceneParams?.[param.key] as number) ?? (param.default as number)}
                min={param.min!}
                max={param.max!}
                step={param.step!}
                onChange={(v) =>
                  onQuickChange({
                    sceneParams: { ...config.sceneParams, [param.key]: v },
                  })
                }
              />
            );
          }
          if (param.type === 'toggle') {
            const currentValue =
              (config.sceneParams?.[param.key] as boolean) ?? (param.default as boolean);
            return (
              <section key={param.key}>
                <div className="flex items-center justify-between">
                  <label className="text-white/70 text-xs font-medium uppercase tracking-wider">
                    {param.label}
                  </label>
                  <button
                    onClick={() =>
                      onQuickChange({
                        sceneParams: { ...config.sceneParams, [param.key]: !currentValue },
                      })
                    }
                    className={cn(
                      'w-10 h-5 rounded-full transition-colors relative shrink-0',
                      currentValue ? 'bg-white/30' : 'bg-white/10'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                        currentValue ? 'translate-x-[20px]' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>
              </section>
            );
          }
          return null;
        })}

        {/* Custom Texture */}
        <section>
          <label className="block text-white/70 text-xs font-medium mb-2 uppercase tracking-wider">
            Custom Texture
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleTextureUpload}
            className="hidden"
          />
          {config.customTextureUrl ? (
            <div className="space-y-2">
              <div className="relative w-full h-20 rounded-lg overflow-hidden bg-white/5 border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={config.customTextureUrl}
                  alt="Custom texture"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/70 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3 h-3" />
                  Replace
                </button>
                <button
                  onClick={handleRemoveTexture}
                  className="flex-1 py-1.5 bg-white/10 hover:bg-red-500/30 rounded-lg text-white/70 hover:text-red-300 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3 h-3" />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={textureUploading}
              className="w-full py-3 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 hover:border-white/30 rounded-lg text-white/50 hover:text-white/70 text-xs font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {textureUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload Image (logo, photo, etc.)
                </>
              )}
            </button>
          )}
          {textureError && <p className="mt-1 text-red-400 text-[10px]">{textureError}</p>}
          <p className="mt-1 text-white/30 text-[10px]">
            Applied as texture across all scenes. Large images auto-optimized.
          </p>
        </section>

        {/* Texture Scale + Opacity - only shown when a texture is active */}
        {config.customTextureUrl && (
          <>
            <SliderControl
              label="Texture Size"
              value={config.textureScale ?? 1.0}
              min={0.2}
              max={3}
              step={0.1}
              onChange={(v) => onQuickChange({ textureScale: v })}
            />
            <SliderControl
              label="Texture Opacity"
              value={config.textureOpacity ?? 1.0}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => onQuickChange({ textureOpacity: v })}
            />
            {/* Texture Animation - cycle button for starburst scenes */}
            {config.scene.startsWith('starburst') && (
              <TextureAnimationPicker
                value={config.textureAnimation ?? 'none'}
                onChange={(v) => onQuickChange({ textureAnimation: v })}
              />
            )}
          </>
        )}

        {/* Pattern Offset - starburst scenes only */}
        {config.scene.startsWith('starburst') && (
          <SliderControl
            label="Pattern Offset"
            value={config.patternOffsetX ?? 0}
            min={-1}
            max={1}
            step={0.05}
            onChange={(v) => onQuickChange({ patternOffsetX: v })}
          />
        )}

        {/* Reset */}
        <section>
          <button
            onClick={() => {
              const defaults = buildDefaultConfig(config.scene);
              onConfigUpdate(defaults);
            }}
            className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white/70 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Defaults
          </button>
        </section>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="px-4 py-3 border-t border-white/10 text-white/30 text-[10px] space-y-0.5">
        <p>F: Fullscreen &middot; S: Settings &middot; M: Mic Toggle</p>
        <p>Esc: Close Panel or Exit Fullscreen</p>
      </div>
    </div>
  );
}
