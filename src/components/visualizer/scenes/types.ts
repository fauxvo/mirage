import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';

export interface SceneHandler {
  update(bass: number, mid: number, high: number): void;
  updateConfig(config: Partial<VisualizerConfig>): void;
  setTexture?(texture: THREE.Texture | null): void;
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
  options?: string[];
}

/** Optional feature flags a scene can declare to surface extra controls. */
export type SceneFeature =
  | 'textureScale'
  | 'textureOpacity'
  | 'textureAnimation'
  | 'textureMotion'
  | 'patternOffset';

export interface SceneRegistration {
  id: string;
  name: string;
  description: string;
  category: string;
  audioDescription: string;
  params: SceneParamDef[];
  /** Features beyond basic texture support that this scene handles. */
  features?: SceneFeature[];
}
