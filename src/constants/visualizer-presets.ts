import type { VisualizerConfig, VisualizerColorPalette, CameraMovement } from '@/types/visualizer';
import { getAllSceneMetadata } from '@/components/visualizer/scenes';

export interface ColorPreset {
  id: string;
  name: string;
  colors: VisualizerColorPalette;
}

export const COLOR_PRESETS: ColorPreset[] = [
  // --- Vibrant ---
  {
    id: 'neon-rave',
    name: 'Neon Rave',
    colors: { primary: '#ff00ff', secondary: '#00ffff', accent: '#ffff00', background: '#0a0014' },
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave',
    colors: { primary: '#e040fb', secondary: '#7c4dff', accent: '#18ffff', background: '#12002e' },
  },
  {
    id: 'cyber-punk',
    name: 'Cyber Punk',
    colors: { primary: '#ff0080', secondary: '#00ff41', accent: '#ffe600', background: '#000000' },
  },
  {
    id: 'toxic',
    name: 'Toxic',
    colors: { primary: '#39ff14', secondary: '#00e676', accent: '#ccff00', background: '#000a00' },
  },
  {
    id: 'northern-lights',
    name: 'Northern Lights',
    colors: { primary: '#00e5ff', secondary: '#76ff03', accent: '#d500f9', background: '#000a08' },
  },
  // --- Warm ---
  {
    id: 'sunset-warm',
    name: 'Sunset Warm',
    colors: { primary: '#ff6b35', secondary: '#f7c59f', accent: '#ff3864', background: '#1a0a00' },
  },
  {
    id: 'molten',
    name: 'Molten',
    colors: { primary: '#ff4500', secondary: '#ff8c00', accent: '#ffd700', background: '#0a0200' },
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    colors: { primary: '#ffd54f', secondary: '#ffb300', accent: '#fff176', background: '#0a0800' },
  },
  {
    id: 'cherry-blossom',
    name: 'Cherry Blossom',
    colors: { primary: '#f48fb1', secondary: '#f06292', accent: '#fce4ec', background: '#0a0008' },
  },
  // --- Cool ---
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
    id: 'midnight',
    name: 'Midnight',
    colors: { primary: '#1565c0', secondary: '#0d47a1', accent: '#42a5f5', background: '#000410' },
  },
  {
    id: 'jade',
    name: 'Jade',
    colors: { primary: '#00897b', secondary: '#26a69a', accent: '#80cbc4', background: '#000a08' },
  },
  // --- Purple ---
  {
    id: 'deep-purple',
    name: 'Deep Purple',
    colors: { primary: '#9b59b6', secondary: '#6c3483', accent: '#d2b4de', background: '#0d001a' },
  },
  {
    id: 'jungle',
    name: 'Jungle',
    colors: { primary: '#00c853', secondary: '#2e7d32', accent: '#76ff03', background: '#001a00' },
  },
  {
    id: 'absinthe',
    name: 'Absinthe',
    colors: { primary: '#aeea00', secondary: '#64dd17', accent: '#c6ff00', background: '#050a00' },
  },
  // --- Dark / Moody ---
  {
    id: 'dark-industrial',
    name: 'Dark Industrial',
    colors: { primary: '#ff3300', secondary: '#666666', accent: '#ff6600', background: '#0a0a0a' },
  },
  {
    id: 'blood-moon',
    name: 'Blood Moon',
    colors: { primary: '#c0392b', secondary: '#6a1b1a', accent: '#e74c3c', background: '#0a0000' },
  },
  {
    id: 'infrared',
    name: 'Infrared',
    colors: { primary: '#d50000', secondary: '#b71c1c', accent: '#ff1744', background: '#0a0000' },
  },
  {
    id: 'forest-mystic',
    name: 'Forest Mystic',
    colors: { primary: '#2d6a4f', secondary: '#95d5b2', accent: '#b7e4c7', background: '#081c15' },
  },
  {
    id: 'emerald',
    name: 'Emerald',
    colors: { primary: '#00e676', secondary: '#1b5e20', accent: '#69f0ae', background: '#000a04' },
  },
  {
    id: 'dark-matter',
    name: 'Dark Matter',
    colors: { primary: '#455a64', secondary: '#37474f', accent: '#78909c', background: '#000000' },
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

  // Flat-plane shader scenes render on a single PlaneGeometry face —
  // orbit/drift causes the camera to view the plane edge-on, showing black.
  const FLAT_PLANE_SCENES = new Set(['fractal', 'kaleidoscope', 'tunnel', 'metaballs']);
  if (FLAT_PLANE_SCENES.has(sceneId)) {
    return {
      cameraMovement: 'static',
      bloomIntensity: 1.5,
      audioReactivity: 0.8,
      animationSpeed: 1.0,
      particleDensity: 0.5,
      depth: 0.5,
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
    textureMotion: 'none',
    patternOffsetX: 0,
    patternOffsetY: 0,
    sceneParams: {},
    ...overrides,
  };
}
