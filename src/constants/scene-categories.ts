/**
 * Client-safe scene-to-category mapping.
 *
 * This is a static lookup table that avoids importing the scene registry
 * (which pulls in Three.js). Keep in sync with the scene registrations
 * in src/components/visualizer/scenes/.
 */
export const SCENE_CATEGORY_MAP: Record<string, string> = {
  // Organic
  aurora: 'organic',
  particles: 'organic',
  ocean: 'organic',
  lava: 'organic',
  metaballs: 'organic',
  // Cosmic
  galaxy: 'cosmic',
  starfield: 'cosmic',
  nebula: 'cosmic',
  vortex: 'cosmic',
  // Geometric
  geometric: 'geometric',
  rings: 'geometric',
  orb: 'geometric',
  kaleidoscope: 'geometric',
  voronoi: 'geometric',
  // Abstract
  fractal: 'abstract',
  dna: 'abstract',
  matrix: 'abstract',
  waveform: 'abstract',
  // Immersive
  tunnel: 'immersive',
  terrain: 'immersive',
  starburst: 'immersive',
  'starburst-classic': 'immersive',
  'starburst-flat': 'immersive',
  'starburst-soft': 'immersive',
  'starburst-sharp': 'immersive',
  'starburst-spin': 'immersive',
};

export function getSceneCategory(sceneId: string): string {
  if (sceneId.startsWith('starburst')) return 'immersive';
  return SCENE_CATEGORY_MAP[sceneId] || 'abstract';
}
