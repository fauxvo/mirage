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
  swarm: 'cosmic',
  // Geometric
  rings: 'geometric',
  orb: 'geometric',
  kaleidoscope: 'geometric',
  voronoi: 'geometric',
  grid: 'geometric',
  // Abstract
  fractal: 'abstract',
  matrix: 'abstract',
  waveform: 'abstract',
  lattice: 'abstract',
  // Immersive
  tunnel: 'immersive',
  terrain: 'immersive',
  starburst: 'immersive',
  'starburst-classic': 'immersive',
  'starburst-soft': 'immersive',
  'starburst-sharp': 'immersive',
};

export const CATEGORY_COLORS: Record<string, string> = {
  organic: 'bg-emerald-500/15 text-emerald-400/80 border-emerald-500/20',
  cosmic: 'bg-purple-500/15 text-purple-400/80 border-purple-500/20',
  geometric: 'bg-blue-500/15 text-blue-400/80 border-blue-500/20',
  abstract: 'bg-amber-500/15 text-amber-400/80 border-amber-500/20',
  immersive: 'bg-pink-500/15 text-pink-400/80 border-pink-500/20',
};

export function getSceneCategory(sceneId: string): string {
  if (sceneId.startsWith('starburst')) return 'immersive';
  return SCENE_CATEGORY_MAP[sceneId] || 'abstract';
}
