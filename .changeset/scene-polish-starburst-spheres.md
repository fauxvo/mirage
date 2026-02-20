---
'mirage': minor
---

Scene polish: full-screen sphere starbursts, texture controls, color presets, and camera improvements

### Starburst scenes

- Convert starburst-classic, starburst-soft, and starburst-sharp from flat planes to sphere backgrounds (BackSide rendering) with world-space direction so the ray centre slides naturally during camera orbit
- Remove outerFade and vignette-multiply from all 4 starburst shaders so rays extend edge-to-edge and the background colour is never darkened below the palette value
- Add 'fixed' texture motion mode that billboards the logo mesh to always face the camera during orbit, with pattern offsets in camera-local space

### Texture system

- Add texture size/opacity controls to all 22 scenes (shader uniforms + material-based)
- Fix point-sprite texture cropping on particle, galaxy, starfield, vortex, nebula (textureScale now controls point size, not UV crop)
- Prevent texture tiling: inBounds mask for shaders, ClampToEdgeWrapping for materials
- Add texture motion system (spin, bounce, float, swing, fixed) for starburst scenes
- Add texture animation picker and texture motion picker to settings panel

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
- Set card cues lazy-loaded on expand

### Cleanup

- Remove geometric, starburst-flat, and starburst-spin scenes (22 scenes total)
- Consolidate duplicate camera scene sets in visualizer engine
- Deduplicate TextureAnimation/TextureMotion type declarations
