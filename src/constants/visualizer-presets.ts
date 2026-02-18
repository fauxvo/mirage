import type { VisualizerConfig, VisualizerColorPalette, CameraMovement } from '@/types/visualizer';
import { getAllSceneMetadata } from '@/components/visualizer/scenes';

export interface ColorPreset {
  id: string;
  name: string;
  colors: VisualizerColorPalette;
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: 'neon-rave',
    name: 'Neon Rave',
    colors: { primary: '#ff00ff', secondary: '#00ffff', accent: '#ffff00', background: '#0a0014' },
  },
  {
    id: 'dark-industrial',
    name: 'Dark Industrial',
    colors: { primary: '#ff3300', secondary: '#666666', accent: '#ff6600', background: '#0a0a0a' },
  },
  {
    id: 'sunset-warm',
    name: 'Sunset Warm',
    colors: { primary: '#ff6b35', secondary: '#f7c59f', accent: '#ff3864', background: '#1a0a00' },
  },
  {
    id: 'ocean-deep',
    name: 'Ocean Deep',
    colors: { primary: '#0077b6', secondary: '#00b4d8', accent: '#90e0ef', background: '#03071e' },
  },
  {
    id: 'arctic-glow',
    name: 'Arctic Glow',
    colors: { primary: '#a8dadc', secondary: '#457b9d', accent: '#f1faee', background: '#0d1b2a' },
  },
  {
    id: 'forest-mystic',
    name: 'Forest Mystic',
    colors: { primary: '#2d6a4f', secondary: '#95d5b2', accent: '#b7e4c7', background: '#081c15' },
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave',
    colors: { primary: '#e040fb', secondary: '#7c4dff', accent: '#18ffff', background: '#12002e' },
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    colors: { primary: '#ffffff', secondary: '#aaaaaa', accent: '#cccccc', background: '#000000' },
  },
];

/**
 * Determine sensible defaults for a scene based on its category.
 */
function getSceneDefaults(sceneId: string): {
  cameraMovement: CameraMovement;
  bloomIntensity: number;
  audioReactivity: number;
  animationSpeed: number;
  particleDensity: number;
  depth: number;
} {
  // Starburst scenes are fullscreen 2D shaders - keep camera static and front-on
  if (sceneId.startsWith('starburst')) {
    return {
      cameraMovement: 'static',
      bloomIntensity: 1.4,
      audioReactivity: 0.7,
      animationSpeed: 0.8,
      particleDensity: 0.5,
      depth: 0.0,
    };
  }

  const allScenes = getAllSceneMetadata();
  const scene = allScenes.find((s) => s.id === sceneId);
  const category = scene?.category ?? 'abstract';

  switch (category) {
    case 'organic':
      return {
        cameraMovement: 'drift',
        bloomIntensity: 1.8,
        audioReactivity: 0.7,
        animationSpeed: 0.8,
        particleDensity: 0.6,
        depth: 0.5,
      };
    case 'cosmic':
      return {
        cameraMovement: 'orbit',
        bloomIntensity: 2.0,
        audioReactivity: 0.8,
        animationSpeed: 1.0,
        particleDensity: 0.7,
        depth: 0.7,
      };
    case 'geometric':
      return {
        cameraMovement: 'orbit',
        bloomIntensity: 1.2,
        audioReactivity: 0.6,
        animationSpeed: 1.0,
        particleDensity: 0.5,
        depth: 0.4,
      };
    case 'abstract':
      return {
        cameraMovement: 'pulse',
        bloomIntensity: 1.5,
        audioReactivity: 0.8,
        animationSpeed: 1.2,
        particleDensity: 0.5,
        depth: 0.5,
      };
    case 'immersive':
      return {
        cameraMovement: 'drift',
        bloomIntensity: 1.6,
        audioReactivity: 0.75,
        animationSpeed: 1.0,
        particleDensity: 0.6,
        depth: 0.8,
      };
    default:
      return {
        cameraMovement: 'orbit',
        bloomIntensity: 1.5,
        audioReactivity: 0.7,
        animationSpeed: 1.0,
        particleDensity: 0.5,
        depth: 0.5,
      };
  }
}

/**
 * Build a complete VisualizerConfig without any AI call.
 * Uses sensible defaults based on the scene category and chosen color preset.
 */
export function buildDefaultConfig(
  sceneId: string,
  colorPresetId: string = 'neon-rave',
  overrides?: Partial<VisualizerConfig>
): VisualizerConfig {
  const preset = COLOR_PRESETS.find((p) => p.id === colorPresetId) ?? COLOR_PRESETS[0];
  const defaults = getSceneDefaults(sceneId);

  return {
    scene: sceneId,
    colorPalette: preset.colors,
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
    ...overrides,
  };
}
