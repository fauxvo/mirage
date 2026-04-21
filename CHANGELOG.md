# mirage

## 0.4.0

### Minor Changes

- [#33](https://github.com/fauxvo/mirage/pull/33) [`b8d4479`](https://github.com/fauxvo/mirage/commit/b8d44795dd96a448895d3f4b1808338c265d9939) Thanks [@fauxvo](https://github.com/fauxvo)! - Add video scene for fullscreen looping video playback with cue integration
  - New "Video" scene in the Immersive category that plays uploaded videos fullscreen on loop
  - Upload API extended to accept video files up to 250MB (streamed to S3, no in-memory buffering)
  - Video upload UI in settings panel with progress percentage, filename display, and local fallback
  - Each cue can have its own video — switch between video and visualizer cues seamlessly
  - Single scene param: audio toggle (muted by default)
  - UI audit fixes: focus indicators on toggles, touch targets, contrast improvements, theming consistency

## 0.3.0

### Minor Changes

- [#29](https://github.com/fauxvo/mirage/pull/29) [`044b47a`](https://github.com/fauxvo/mirage/commit/044b47a1f5cb1d98bc2807238eea87c42c48b05b) Thanks [@fauxvo](https://github.com/fauxvo)! - Scene polish, engine hardening, GLSL deduplication, and UX fixes

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
  - Remove geometric, starburst-flat, and starburst-spin scenes
  - Add swarm, grid, and lattice scenes (25 scenes total)
  - Consolidate duplicate camera scene sets in visualizer engine
  - Deduplicate TextureAnimation/TextureMotion type declarations

### Patch Changes

- [#28](https://github.com/fauxvo/mirage/pull/28) [`5e254c8`](https://github.com/fauxvo/mirage/commit/5e254c83077bdb8084528ccd513292ce7bfb106f) Thanks [@fauxvo](https://github.com/fauxvo)! - Fix post-login redirect to go to /dashboard instead of landing page
  - Change default redirect after successful login from `/` to `/dashboard`
  - Add debug logging to login API route for visibility with `DEBUG=true`

- [#26](https://github.com/fauxvo/mirage/pull/26) [`5b6f716`](https://github.com/fauxvo/mirage/commit/5b6f7163aa0c61a8606e9656b3689ff692af8c9c) Thanks [@fauxvo](https://github.com/fauxvo)! - Fix SQLITE_READONLY errors and seed race condition in Docker/Unraid deployments
  - Run database migrations as `nextjs` user via `su-exec` so the SQLite file is created with correct ownership (was running as root, causing SQLITE_READONLY for the server process)
  - Replace boolean seed guard with promise singleton pattern to prevent concurrent `ensureAdminSeeded()` calls from racing through the async gap and seeding twice
  - Simplify `chown` in entrypoint (directory only, no `-R` or error suppression)

## 0.2.0

### Minor Changes

- [#16](https://github.com/fauxvo/mirage/pull/16) [`61505f3`](https://github.com/fauxvo/mirage/commit/61505f3efb6ebd84c76fe91eba115f50a7ebdbfb) Thanks [@fauxvo](https://github.com/fauxvo)! - Add per-user API key management with usage tracking and rate limiting
  - Replace legacy MIRAGE_API_KEY env var with DB-managed API keys
  - Per-user key CRUD: users manage their own keys, admins see all
  - Usage tracking: log requests to api_usage table with response times
  - In-memory sliding window rate limiting (100 req/min per key)
  - Admin usage dashboard with period selector and per-key stats
  - New routes: /api/keys (user), /api/admin/usage (admin)
  - API key IDs changed from integer auto-increment to text (nanoid)

- [#19](https://github.com/fauxvo/mirage/pull/19) [`77f4408`](https://github.com/fauxvo/mirage/commit/77f4408ce8922e1d75bd711d631191e7038bf2a5) Thanks [@fauxvo](https://github.com/fauxvo)! - Add keyboard cue switching (1-9), smooth palette crossfade, and in-visualizer cue/set management.
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

- [#15](https://github.com/fauxvo/mirage/pull/15) [`b85db32`](https://github.com/fauxvo/mirage/commit/b85db324c5feeb85f065d9e329afe82c412aaa50) Thanks [@fauxvo](https://github.com/fauxvo)! - Add dashboard UI with sidebar navigation, account settings, and password change
  - New `/dashboard` route with auth-protected layout and sidebar navigation
  - Sections: My Sets (placeholder), API Keys (admin), Account, Users (admin), Usage (admin)
  - Password change endpoint at `PUT /api/auth/password`
  - Mobile-responsive hamburger menu
  - Reuses existing admin components (ApiKeyList, AdminUserList)

- [#17](https://github.com/fauxvo/mirage/pull/17) [`3ac0cba`](https://github.com/fauxvo/mirage/commit/3ac0cba5ce22a2d09bdba9dccf04e9f25084b521) Thanks [@fauxvo](https://github.com/fauxvo)! - Replace sessions with sets and cues data model, add full dashboard management UI.
  - Sets are user-owned collections containing multiple cues (visualizer configurations)
  - New API routes for CRUD operations on sets and cues, with cue reordering
  - Dashboard "My Sets" section with expandable set cards, inline cue management
  - Drag-and-drop cue reordering via @dnd-kit with optimistic updates
  - Dedicated form pages for creating/editing sets and cues (scene selector, color preset picker)
  - Reusable delete confirmation modal (no browser dialogs)
  - Method-aware proxy: only GET on public sets bypasses auth; mutations always require auth
  - Upload route supports atomic texture persistence via optional x-cue-id header
  - Client-safe scene-category mapping for badge styling without Three.js imports

- [#10](https://github.com/fauxvo/mirage/pull/10) [`33c7698`](https://github.com/fauxvo/mirage/commit/33c769861a6378a8435d4718e609fa8fe99ee9e4) Thanks [@fauxvo](https://github.com/fauxvo)! - Add user authentication and role-based access control, replacing admin-only auth with a two-tier user system supporting registration, login, JWT sessions, and admin user management.

- [#21](https://github.com/fauxvo/mirage/pull/21) [`db49fcf`](https://github.com/fauxvo/mirage/commit/db49fcf3c38b5b573c65d4c8ecd61bf954188482) Thanks [@fauxvo](https://github.com/fauxvo)! - Add YouTube music player bar and dashboard set editing modal.
  - Embed YouTube IFrame player as a full-width bottom bar when a set has a playlist URL
  - Transport controls: play/pause, prev/next track, seekable progress bar, volume slider
  - Collapse/expand toggle for minimal or full player bar
  - Keyboard shortcuts: Space (play/pause), Shift+Arrow (next/prev track)
  - CueSwitcherBar shifts up when YouTube bar is visible
  - Help modal conditionally shows YouTube shortcuts
  - Dashboard set card "Edit" button opens inline edit modal (name, description, YouTube URL, public toggle)
  - YouTube IFrame API type declarations for TypeScript

- [#18](https://github.com/fauxvo/mirage/pull/18) [`744b42b`](https://github.com/fauxvo/mirage/commit/744b42b77857faff4c00d8a65ae25a0b9228863a) Thanks [@fauxvo](https://github.com/fauxvo)! - Enhanced cue editing with live visualizer preview, patternOffsetY support, and scene-specific settings.
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

### Patch Changes

- [#13](https://github.com/fauxvo/mirage/pull/13) [`70b4833`](https://github.com/fauxvo/mirage/commit/70b4833f20dfe3059ac2993ddc840a85754b6ce8) Thanks [@fauxvo](https://github.com/fauxvo)! - Add GitHub Actions workflow to build and push Docker images to GitHub Container Registry (ghcr.io).

- [#13](https://github.com/fauxvo/mirage/pull/13) [`7f2ab67`](https://github.com/fauxvo/mirage/commit/7f2ab672e46f65442d05be10edeef15be1c223a8) Thanks [@fauxvo](https://github.com/fauxvo)! - Fix admin seeding to require all three env vars: ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD.

- [#25](https://github.com/fauxvo/mirage/pull/25) [`e59602e`](https://github.com/fauxvo/mirage/commit/e59602ed93c10131c9560627959f20b181308973) Thanks [@fauxvo](https://github.com/fauxvo)! - Fix Unraid template variables not persisting, add DEBUG env var for production logging, and improve admin seed reliability.
  - **Unraid template**: Move to `unraid/mirage.xml`, fix XML structure (full open/close tags instead of self-closing), add missing `<Shell>` and `<TemplateURL/>` fields
  - **DEBUG env var**: Set `DEBUG=true` to enable verbose logging in production/Docker (previously all non-error logs were silenced)
  - **Admin seed**: Fix `seeded` flag to only set after success (allows retry on error), add detailed logging for all seed outcomes
  - **Docker entrypoint**: Print environment diagnostics at startup with masked secrets
  - **Env var sync**: `DEBUG` now consistent across `.env.example`, `docker-compose.yml`, `Dockerfile`, and Unraid template

  **Note for HTTPS users:** The Unraid template now explicitly defaults `SECURE_COOKIES=false` for HTTP self-hosting. The `docker-compose.yml` preserves the previous auto-detect behavior (empty = `true` in production). If you access Mirage over HTTPS via a reverse proxy and use the Unraid template, set `SECURE_COOKIES=true` in your container config.

## 0.1.0

Initial release.
