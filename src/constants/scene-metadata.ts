/**
 * Scene metadata re-exported from the self-registering scene registry.
 *
 * Import the scenes barrel first so that all scenes have registered their
 * metadata before these helpers are called.
 */
import '@/components/visualizer/scenes';
import { getAllSceneMetadata } from '@/components/visualizer/scenes';

export const SCENE_CATEGORIES = [
  'organic',
  'cosmic',
  'geometric',
  'abstract',
  'immersive',
  'synthwave',
  'psychedelic',
] as const;

export const SCENE_METADATA = getAllSceneMetadata();

export const SCENE_IDS = SCENE_METADATA.map((s) => s.id);
