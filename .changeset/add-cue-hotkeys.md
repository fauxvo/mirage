---
'mirage': minor
---

Add keyboard cue switching (1-9), smooth palette crossfade, and in-visualizer cue/set management.

- Press 1-9 to switch cues by position with smooth 500ms palette crossfade transition
- Toast notification on cue switch showing position and name
- Settings panel tabs: Scene, Cues, Set (Cues/Set only when viewing a set)
- Cue management panel: drag-and-drop reorder, add, delete, inline rename
- Set settings panel: edit name, description, YouTube URL, public toggle with debounced save
- Help modal updated with 1-9 shortcut documentation
- DRY: dashboard cues list reuses shared CueManagementPanel component
- Dashboard set edit redirects to visualizer (single source of truth)
- Simplify set-form to create-only (edit via visualizer)
- Fix cue reorder transaction (sync better-sqlite3 doesn't support async transactions)
- Add scrollbar-hidden CSS utility
- Export shared CATEGORY_COLORS from scene-categories
