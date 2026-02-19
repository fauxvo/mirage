---
'mirage': minor
---

Add YouTube music player bar and dashboard set editing modal.

- Embed YouTube IFrame player as a full-width bottom bar when a set has a playlist URL
- Transport controls: play/pause, prev/next track, seekable progress bar, volume slider
- Collapse/expand toggle for minimal or full player bar
- Keyboard shortcuts: Space (play/pause), Shift+Arrow (next/prev track)
- CueSwitcherBar shifts up when YouTube bar is visible
- Help modal conditionally shows YouTube shortcuts
- Dashboard set card "Edit" button opens inline edit modal (name, description, YouTube URL, public toggle)
- YouTube IFrame API type declarations for TypeScript
