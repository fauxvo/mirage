---
'mirage': minor
---

Enhanced cue editing with live visualizer preview, patternOffsetY support, and scene-specific settings.

- Edit cues directly in the visualizer at `/v/[setId]?cue=[cueId]` with full live preview
- Cue switcher bar at bottom of visualizer for quick switching between cues
- Add patternOffsetY config property through full stack (types, Zod, presets, all 6 starburst scenes)
- Scene-specific feature flags control which settings appear per scene (texture, offsets)
- Per-cue texture uploads via x-cue-id header
- Fix R2 texture CORS by prioritizing same-origin proxy route over public URL
- Fix microphone resource leak: properly stop MediaStream tracks and close AudioContext on disable
- Fix stale config closure in flushSave using configRef
- Fix color cycle interval restarting on every config change
- Remove DNA scene
- Remove unused admin page, cue form, and key-reveal-modal (inlined)
- Slim global scrollbar styling matching SyncDJ
