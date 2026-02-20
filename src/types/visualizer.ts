// Visualizer configuration types

export type VisualizerScene = string;
export type CameraMovement = 'static' | 'orbit' | 'drift' | 'pulse';
export type TextureAnimation = 'none' | 'pulse' | 'breathe' | 'flash' | 'strobe';
export type TextureMotion = 'none' | 'fixed' | 'spin' | 'bounce' | 'float' | 'swing';

export interface VisualizerColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

export interface VisualizerConfig {
  scene: VisualizerScene;
  colorPalette: VisualizerColorPalette;
  particleDensity: number; // 0-1
  animationSpeed: number; // 0.5-2.0
  bloomIntensity: number; // 0-3
  audioReactivity: number; // 0-1
  cameraMovement: CameraMovement;
  wireframe: boolean; // Toggle wireframe overlay
  symmetry: number; // 1-12, fold count for kaleidoscope-style effects
  depth: number; // 0-1, controls fog/depth perception
  colorCycleSpeed: number; // 0-2, how fast colors shift over time
  sceneParams?: Record<string, number | boolean | string>;
  customTextureUrl: string | null; // base64 data URL for custom texture
  textureScale: number; // 0.2-3.0, scale of the centred texture (default 1.0)
  textureOpacity: number; // 0-1, opacity of the centred texture (default 1.0)
  textureAnimation: TextureAnimation; // animated opacity mode (default 'none')
  textureMotion: TextureMotion; // texture movement mode (default 'none')
  patternOffsetX: number; // -1 to 1, horizontal offset of the pattern centre (starburst only, default 0)
  patternOffsetY: number; // -1 to 1, vertical offset of the pattern centre (starburst only, default 0)
}
