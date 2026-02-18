# Mirage - Claude Code Instructions

## Project Overview

Mirage is a standalone, self-hosted web app for real-time 3D music visualization. It features 26 scenes powered by Three.js, microphone audio input, shareable sessions via REST API, texture uploads to S3-compatible storage, and per-scene bespoke settings. No AI dependency. Runs on port 4444.

## Tech Stack

- **Runtime**: Bun (use `bun` for install/run, NOT npm/yarn/node)
- **Framework**: Next.js 16 (App Router, React 19, React Compiler)
- **Database**: SQLite via Drizzle ORM + better-sqlite3
- **3D Engine**: Three.js 0.182 with post-processing (UnrealBloomPass, ACESFilmic tone mapping)
- **Validation**: Zod 4
- **UI**: Tailwind CSS v4 (PostCSS plugin), lucide-react icons
- **Testing**: Vitest + React Testing Library (jsdom)
- **Storage**: S3-compatible (optional, falls back to base64-in-config)
- **IDs**: nanoid (12-char session IDs, 32-char admin tokens)
- **Formatting**: Prettier (100 width, 2 tab, single quotes, trailing commas)

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server (port 4444)
bun run build        # Production build
npm test             # Run tests (IMPORTANT: use npm, NOT bun test)
npm test -- --run    # Run tests once (not watch)
bun run lint         # ESLint check (max-warnings 0)
bun run format       # Prettier format
bun run db:generate  # Generate Drizzle migration files
bun run db:push      # Push schema to database
```

### Testing Exception

**Always use `npm test` for running tests, NOT `bun test`.** Bun's test runner has vitest mocking issues. Use npm for all test execution.

## Project Structure

```
mirage/
├── data/                         # SQLite database (mirage.db)
├── drizzle/                      # Migration SQL files + metadata
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/
│   │   │   ├── health/route.ts   # GET - health check
│   │   │   ├── openapi/route.ts  # GET - OpenAPI 3.0 spec
│   │   │   ├── sessions/
│   │   │   │   ├── route.ts      # POST - create session
│   │   │   │   └── [id]/route.ts # GET/PUT/DELETE session
│   │   │   └── upload/route.ts   # POST - texture upload (S3)
│   │   ├── v/[id]/page.tsx       # Main visualizer page (client)
│   │   ├── sessions/page.tsx     # Session management list
│   │   ├── page.tsx              # Landing page
│   │   └── layout.tsx            # Root layout (metadata, dark mode)
│   │
│   ├── components/
│   │   ├── visualizer/
│   │   │   ├── visualizer-engine.ts          # Three.js engine class
│   │   │   ├── visualizer-settings-panel.tsx # Settings sidebar UI
│   │   │   └── scenes/                       # 24 scene implementations
│   │   │       ├── index.ts                  # Barrel import (triggers registration)
│   │   │       ├── scene-registry.ts         # Registry: createScene, getAvailableScenes
│   │   │       ├── types.ts                  # SceneHandler, SceneParamDef, SceneRegistration
│   │   │       ├── starburst-utils.ts        # Shared starburst opacity animations
│   │   │       └── [scene-name]-scene.ts     # Individual scene files (self-registering)
│   │   ├── settings/
│   │   │   ├── slider-control.tsx            # Reusable range slider
│   │   │   └── help-modal.tsx                # Full-screen help/guide modal
│   │   └── sessions/
│   │       └── session-list.tsx              # Session list with actions
│   │
│   ├── constants/
│   │   ├── scene-metadata.ts       # Scene categories, metadata helpers
│   │   └── visualizer-presets.ts   # COLOR_PRESETS[], buildDefaultConfig()
│   │
│   ├── db/
│   │   ├── index.ts                # getDb() singleton (WAL mode, foreign keys)
│   │   ├── schema/
│   │   │   ├── index.ts            # Schema barrel export
│   │   │   └── sessions.ts         # sessions table definition
│   │   └── repositories/
│   │       └── session.repository.ts # SessionRepository CRUD class
│   │
│   ├── lib/
│   │   ├── api-key.ts              # validateApiKey() header check
│   │   ├── api-utils.ts            # successResponse(), errorResponse() helpers
│   │   ├── creator-token.ts        # generateSessionId(), generateAdminToken()
│   │   ├── s3.ts                   # S3 client, upload/delete operations
│   │   ├── schemas.ts              # Zod schemas (config, session, JSON schema export)
│   │   └── utils.ts                # cn() (clsx+merge), formatDuration(), Logger
│   │
│   ├── types/
│   │   ├── api.ts                  # ApiResponse<T>, SessionResponse
│   │   └── visualizer.ts           # VisualizerConfig, VisualizerColorPalette
│   │
│   └── test/
│       └── setup.ts                # Jest-DOM matchers setup
│
├── package.json
├── next.config.ts                  # serverExternalPackages: ['better-sqlite3'], transpilePackages: ['three']
├── tsconfig.json                   # ES2017, bundler resolution, strict, @/ alias
├── drizzle.config.ts               # SQLite dialect, ./data/mirage.db
├── vitest.config.ts                # jsdom, globals, @/ alias
├── eslint.config.js                # next/core-web-vitals + typescript
├── postcss.config.mjs              # Tailwind CSS v4
├── Dockerfile                      # Production image
├── docker-compose.yml              # Docker Compose setup
└── unraid-template.xml             # Unraid container template
```

## Architecture

### Layered Design

```
Client (page.tsx) → VisualizerEngine (Three.js) → SceneHandlers
API Routes → lib/schemas (Zod) → Repositories → Database (Drizzle/SQLite)
```

### Sessions & Authentication

- `POST /api/sessions` creates a session → returns `{sessionId, adminToken, url}`
- API key required for creation: `MIRAGE_API_KEY` header or `Authorization: Bearer`
- Admin token stored in `localStorage[mirage-admin-${sessionId}]`
- `GET /v/{id}` is public (shareable URL), PUT/DELETE require `x-admin-token` header
- `/v/new` = local-only mode (localStorage, no server session)
- Config stored as JSON text in SQLite `sessions.config` column

### API Response Format

```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: string }
```

### API Routes

| Method | Path               | Auth                     | Description           |
| ------ | ------------------ | ------------------------ | --------------------- |
| POST   | /api/sessions      | API key                  | Create session        |
| GET    | /api/sessions/[id] | None                     | Read session (public) |
| PUT    | /api/sessions/[id] | Admin token              | Update config/texture |
| DELETE | /api/sessions/[id] | Admin token              | Delete session        |
| POST   | /api/upload        | Admin token + session ID | Upload texture to S3  |
| GET    | /api/health        | None                     | Health check          |
| GET    | /api/openapi       | None                     | OpenAPI 3.0 spec      |

### Visualizer Engine (`visualizer-engine.ts`)

Central Three.js orchestrator class handling:

- **Renderer**: WebGL with antialias, pixel ratio capped at 2
- **Post-processing**: EffectComposer → RenderPass → UnrealBloomPass → OutputPass
- **Tone mapping**: ACESFilmic (exposure 1.2)
- **Scene background**: Color + FogExp2 from config palette + depth
- **Camera modes**: static, orbit, drift, pulse (audio-reactive)
- **Audio**: AnalyserNode (NOT connected to destination — no feedback)
- **Texture**: TextureLoader, supports data URLs and S3 URLs
- **Config updates**: Partial config patches via `updateConfig()`

### Scene System

26 scenes organized into 5 categories:

| Category  | Scenes                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| Organic   | aurora, particles, ocean, lava, metaballs                                                                      |
| Cosmic    | galaxy, starfield, nebula, vortex                                                                              |
| Geometric | geometric, rings, orb, kaleidoscope, voronoi                                                                   |
| Abstract  | fractal, dna, matrix, waveform                                                                                 |
| Immersive | tunnel, terrain, starburst, starburst-classic, starburst-flat, starburst-soft, starburst-sharp, starburst-spin |

**Scene Registration Pattern:**

- Each scene file calls `registerScene(id, factory, metadata)` at module scope
- `scenes/index.ts` barrel-imports all scenes → triggers self-registration
- Scene registry provides `createScene()`, `getAvailableScenes()`, `getAllSceneMetadata()`
- Fallback to 'particles' if requested scene not found

**SceneHandler Interface:**

```typescript
interface SceneHandler {
  update(bass: number, mid: number, high: number): void;
  updateConfig(config: Partial<VisualizerConfig>): void;
  setTexture?(texture: THREE.Texture | null): void;
  dispose(): void;
}
```

**Adding a New Scene:**

1. Create `src/components/visualizer/scenes/my-scene.ts`
2. Implement the class with update/updateConfig/dispose methods
3. Create `SceneRegistration` metadata (id, name, description, category, params)
4. Call `registerScene('my-scene', factory, METADATA)` at bottom of file
5. Add `import './my-scene';` to `scenes/index.ts`

**Per-Scene Parameters (`SceneParamDef`):**

```typescript
interface SceneParamDef {
  key: string; // stored in config.sceneParams[key]
  label: string;
  type: 'slider' | 'toggle' | 'select';
  min?: number;
  max?: number;
  step?: number; // slider
  options?: { label: string; value: string }[]; // select
  default: unknown;
}
```

### Audio System

- Microphone input via `getUserMedia()` (permission deferred until user enables audio)
- AudioContext + AnalyserNode with FFT size 256
- Frequency bands: bass (0-200Hz), mid (200Hz-1.2kHz), high (1.2kHz-2.4kHz)
- `audioReactivity` config (0-1) scales influence on scenes
- Audio NOT connected to destination (no speaker feedback)

### Texture System

- **S3 configured**: Upload via `/api/upload` → S3 bucket → URL stored in session
- **S3 not configured**: Client-side optimization → base64 stored in config JSON
- Texture properties: scale (0.2-3.0), opacity (0-1), animation mode
- Animation modes: none, pulse, breathe, flash, strobe
- Starburst scenes also support `patternOffsetX` for horizontal positioning

### Color System

- 8 built-in presets: Neon Rave, Dark Industrial, Sunset Warm, Ocean Deep, Arctic Glow, Forest Mystic, Vaporwave, Monochrome
- Palette structure: `{ primary, secondary, accent, background }` (hex strings)
- Custom color picker for manual palette editing
- Auto-cycle mode: smooth lerp transitions between presets (8s interval, 1s transition)
- `buildDefaultConfig(sceneId)` returns scene-aware defaults per category

### Config Validation (Zod)

All config changes validated against `VisualizerConfigSchema`:

- 17 properties (scene, palette, density, speed, bloom, audio reactivity, camera, wireframe, symmetry folds, depth, color cycle, texture scale/opacity/animation/URL, pattern offset, scene params)
- API requests validated before database writes
- Invalid config falls back to defaults

## Database

- SQLite at `./data/mirage.db`
- WAL mode + foreign keys enabled
- Single table: `sessions` (id, admin_token, config JSON, texture_url, timestamps)
- Run migrations: `bun run db:push`
- Schema changes: edit `src/db/schema/`, then `bun run db:generate` + `bun run db:push`

## Environment Variables

```bash
# Database
DATABASE_URL=./data/mirage.db

# API Security (optional - if unset, session creation is open)
MIRAGE_API_KEY=your-secret-key

# S3 Storage (all optional - if unset, textures use base64 in config)
S3_BUCKET=mirage-textures
S3_REGION=us-east-1
S3_ENDPOINT=                   # For MinIO/R2: http://localhost:9000
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=true       # Required for MinIO/R2/non-AWS
```

## Code Style

- Use `bun` for package management and script running (NOT npm/yarn/node)
- Exception: use `npm test` for tests (bun has vitest issues)
- Prettier: 100 char width, 2-space indent, single quotes, trailing commas
- ESLint: max-warnings 0, unused vars with leading underscore allowed
- Run `bun run lint && bun run format` before committing
- Prefer editing existing files over creating new ones
- Follow existing patterns for consistency

## Security Considerations

- Admin tokens are secrets — never expose in public API responses
- API key validation uses constant-time comparison where possible
- S3 credentials are server-side only
- File upload validates MIME type and size (<10MB images only)
- All user input validated via Zod schemas before database writes
- No shell execution — no command injection surface

## Deployment

- **Docker**: `Dockerfile` + `docker-compose.yml` included
- **Unraid**: Template XML for Unraid Community Apps
- **Port**: 4444 (configurable in docker-compose)
- **Data**: Mount `./data/` for persistent SQLite database
- **S3**: Optional — configure env vars for texture storage
