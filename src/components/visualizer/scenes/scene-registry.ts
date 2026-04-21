import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import type { SceneHandler, SceneRegistration } from './types';

type SceneFactory = (
  scene: THREE.Scene,
  config: VisualizerConfig,
  camera?: THREE.PerspectiveCamera,
  renderer?: THREE.WebGLRenderer
) => SceneHandler;

const registry = new Map<string, SceneFactory>();
const metadataRegistry = new Map<string, SceneRegistration>();

export function registerScene(
  id: string,
  factory: SceneFactory,
  metadata?: SceneRegistration
): void {
  registry.set(id, factory);
  if (metadata) {
    metadataRegistry.set(id, metadata);
  }
}

const DEFAULT_SCENE = 'particles';

export function createScene(
  id: string,
  scene: THREE.Scene,
  config: VisualizerConfig,
  camera?: THREE.PerspectiveCamera,
  renderer?: THREE.WebGLRenderer
): SceneHandler {
  let factory = registry.get(id);
  if (!factory) {
    console.warn(
      `Scene "${id}" not found in registry. Falling back to "${DEFAULT_SCENE}". Available: ${Array.from(registry.keys()).join(', ')}`
    );
    factory = registry.get(DEFAULT_SCENE)!;
  }
  return factory(scene, config, camera, renderer);
}

export function getAvailableScenes(): string[] {
  return Array.from(registry.keys());
}

export function getSceneMetadata(id: string): SceneRegistration | undefined {
  return metadataRegistry.get(id);
}

export function getAllSceneMetadata(): SceneRegistration[] {
  return Array.from(metadataRegistry.values());
}
