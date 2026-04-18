---
'mirage': minor
---

Add video scene for fullscreen looping video playback with cue integration

- New "Video" scene in the Immersive category that plays uploaded videos fullscreen on loop
- Upload API extended to accept video files up to 250MB (streamed to S3, no in-memory buffering)
- Video upload UI in settings panel with progress percentage, filename display, and local fallback
- Each cue can have its own video — switch between video and visualizer cues seamlessly
- Single scene param: audio toggle (muted by default)
- UI audit fixes: focus indicators on toggles, touch targets, contrast improvements, theming consistency
