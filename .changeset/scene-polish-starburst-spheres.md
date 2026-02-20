---
'mirage': minor
---

Scene polish, engine hardening, GLSL deduplication, and UX fixes

### Starburst scenes

- Convert starburst-classic, starburst-soft, and starburst-sharp from flat planes to sphere backgrounds (BackSide rendering) with world-space direction so the ray centre slides naturally during camera orbit
- Remove outerFade and vignette-multiply from all 4 starburst shaders so rays extend edge-to-edge and the background colour is never darkened below the palette value
- Add 'fixed' texture motion mode that billboards the logo mesh to always face the camera during orbit, with pattern offsets in camera-local space
- Remove placeholder orb from all 4 starburst scenes — no visual when no texture is uploaded

### Texture system

- Add texture size/opacity controls to all scenes (shader uniforms + material-based)
- Fix point-sprite texture cropping on particle, starfield, vortex, nebula (textureScale now controls point size, not UV crop)
- Prevent texture tiling: inBounds mask for shaders, ClampToEdgeWrapping for materials
- Add texture motion system (spin, bounce, float, swing, fixed) for starburst scenes
- Add texture animation picker and texture motion picker to settings panel
- Centralise shared GLSL texture transform code in shader-chunks.ts (DRY across 18 scenes)
- Remove opacity dual-write: engine-driven setTextureTransform is sole owner of per-frame opacity

### Galaxy scene

- Custom texture now renders as a centred plane at the galaxy core instead of per-particle sprites
- Texture breathes with bass, slowly rotates, and responds to scale/opacity/animation/motion settings
- Core glow sphere still shows when no texture is uploaded

### Engine improvements

- Camera hint guards: orbit/drift/pulse modes skip flat-plane and ground-plane scenes
- Eliminate double getAudioData() call per frame (pulse camera mode)
- Debounce particleDensity changes (300ms) to avoid rapid geometry rebuilds
- CameraHint type system for per-scene camera behaviour

### Color presets

- Add 15 new color presets (23 total) organized by mood, optimized for dark rooms and projectors
- Compact 3-column color preset grid with scrollable container

### Camera

- Change orbit camera to sprinkler-style ±50° oscillation instead of full 360° rotation
- Dynamic camera positioning for flat-plane scenes to fill 16:9 viewports
- Add camera mode selector (static, orbit, drift, pulse) to settings panel

### UI

- Add refresh button to settings panel header
- Mic/MicOff icons for audio toggle
- Set card cues lazy-loaded on expand with error state and retry
- Fix metaballs category: registered as 'organic' to match help text

### API

- Set listing endpoint returns cue count
- Set card fetches cues on demand (eliminates N+1 waterfall)

### Cleanup

- Remove geometric, starburst-flat, and starburst-spin scenes (22 scenes total)
- Consolidate duplicate camera scene sets in visualizer engine
- Deduplicate TextureAnimation/TextureMotion type declarations
