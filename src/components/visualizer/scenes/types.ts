import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';

/**
 * Typed userData contract between the engine and scene handlers.
 * The engine sets `scene.userData.camera` before creating scenes.
 */
export interface SceneUserData {
  camera: THREE.Camera;
}

/** Texture transform values computed by the engine each frame. */
export interface TextureTransform {
  /** Effective opacity (base * animation multiplier). */
  opacity: number;
  /** UV-space Z rotation in radians. */
  rotation: number;
  /** Y-axis mesh rotation in radians (for 'rotate' motion). */
  rotationY: number;
  /** UV-space X offset. */
  offsetX: number;
  /** UV-space Y offset. */
  offsetY: number;
  /** Extra scale multiplier from motion (e.g. bounce squash). 1 = no change. */
  scale: number;
  /** Tint color in 0-1 range. {1,1,1} = no tint. */
  tintColor: { r: number; g: number; b: number };
}

export interface SceneHandler {
  update(bass: number, mid: number, high: number): void;
  updateConfig(config: Partial<VisualizerConfig>): void;
  setTexture?(texture: THREE.Texture | null): void;
  /** Engine-driven texture animation/motion. Scenes that implement this receive per-frame transforms. */
  setTextureTransform?(transform: TextureTransform): void;
  dispose(): void;
}

export interface SceneParamDef {
  key: string;
  label: string;
  type: 'slider' | 'toggle' | 'select';
  min?: number;
  max?: number;
  step?: number;
  default: number | boolean | string;
  options?: { label: string; value: string }[];
}

/** Optional feature flags a scene can declare to surface extra controls. */
export type SceneFeature =
  | 'textureScale'
  | 'textureOpacity'
  | 'textureAnimation'
  | 'textureMotion'
  | 'patternOffset';

/**
 * Hint for how the engine should position the camera for this scene.
 * - 'centered': Head-on at (0,0,Z) — for flat-plane shaders and sphere starbursts.
 * - 'small-plane': Like 'centered' but auto-calculates Z to fill a 12×12 plane.
 * - 'low-angle': Ground-plane scenes with a viewAngle slider (consumed by the engine, not the scene).
 * - 'default': Elevated angle at (0,2,6).
 */
export type CameraHint = 'centered' | 'small-plane' | 'low-angle' | 'default';

export interface SceneRegistration {
  id: string;
  name: string;
  description: string;
  category: string;
  audioDescription: string;
  params: SceneParamDef[];
  /** Features beyond basic texture support that this scene handles. */
  features?: SceneFeature[];
  /** How the engine should position the camera. Defaults to 'default'. */
  cameraHint?: CameraHint;
}
