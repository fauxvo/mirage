// Barrel import — triggers self-registration for all scenes
import './aurora-scene';
import './particle-scene';
import './geometric-scene';
import './nebula-scene';
import './ocean-scene';
import './lava-scene';
import './galaxy-scene';
import './starfield-scene';
import './dna-scene';
import './rings-scene';
import './kaleidoscope-scene';
import './fractal-scene';
import './orb-scene';
import './metaballs-scene';
import './waveform-scene';
import './voronoi-scene';
import './tunnel-scene';
import './terrain-scene';
import './matrix-scene';
import './vortex-scene';
import './starburst-scene';
import './starburst-soft-scene';
import './starburst-sharp-scene';

export { createScene, getAvailableScenes, getSceneMetadata, getAllSceneMetadata } from './scene-registry';
export type { SceneHandler, SceneParamDef, SceneRegistration } from './types';
