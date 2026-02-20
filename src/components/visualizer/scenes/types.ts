import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';

/** Texture transform values computed by the engine each frame. */
export interface TextureTransform {
  /** Effective opacity (base * animation multiplier). */
  opacity: number;
  /** UV-space rotation in radians. */
  rotation: number;
  /** UV-space X offset. */
  offsetX: number;
  /** UV-space Y offset. */
  offsetY: number;
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
