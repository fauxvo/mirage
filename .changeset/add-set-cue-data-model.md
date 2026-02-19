---
'mirage': minor
---

Replace sessions with sets and cues data model, add full dashboard management UI.

- Sets are user-owned collections containing multiple cues (visualizer configurations)
- New API routes for CRUD operations on sets and cues, with cue reordering
- Dashboard "My Sets" section with expandable set cards, inline cue management
- Drag-and-drop cue reordering via @dnd-kit with optimistic updates
- Dedicated form pages for creating/editing sets and cues (scene selector, color preset picker)
- Reusable delete confirmation modal (no browser dialogs)
- Method-aware proxy: only GET on public sets bypasses auth; mutations always require auth
- Upload route supports atomic texture persistence via optional x-cue-id header
- Client-safe scene-category mapping for badge styling without Three.js imports
