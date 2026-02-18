# Mirage - Claude Code Instructions

## Project Overview

A standalone, self-hosted web app for real-time 3D music visualization. 23 scenes powered by Three.js, mic audio input, shareable sessions via API, texture uploads to S3, and per-scene bespoke settings. No AI dependency.

## Tech Stack

- **Runtime**: Bun
- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite via Drizzle ORM + better-sqlite3
- **3D**: Three.js with UnrealBloomPass post-processing
- **Validation**: Zod 4
- **UI**: Tailwind CSS v4
- **Testing**: Vitest + React Testing Library
- **Storage**: S3-compatible (optional, falls back to base64)

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server (port 4444)
bun run build        # Production build
npm test             # Run tests (use npm, not bun)
npm test -- --run    # Run tests once
bun run lint         # ESLint check
bun run format       # Prettier format
bun run db:generate  # Generate Drizzle migrations
bun run db:push      # Push schema to DB
```

## Project Structure

```
src/
├── app/                  # Next.js App Router
│   ├── api/
│   │   ├── sessions/     # CRUD for visualizer sessions
│   │   ├── upload/       # Texture upload (S3 or base64)
│   │   ├── health/       # Health check endpoint
│   │   └── openapi/      # OpenAPI spec
│   ├── v/[id]/           # Main visualizer page
│   └── sessions/         # Session management page
├── components/
│   ├── visualizer/       # Engine + scenes
│   │   └── scenes/       # 23 scene implementations
│   ├── settings/         # Shared UI controls
│   └── sessions/         # Session list components
├── constants/            # Presets, metadata
├── db/
│   ├── schema/           # Drizzle table definitions
│   └── repositories/     # Data access
├── lib/                  # Utilities, S3, auth helpers
├── types/                # TypeScript types
└── test/                 # Test setup
```

## Key Architecture

### Sessions
- `POST /api/sessions` (API key required) creates a session with `{sessionId, adminToken, url}`
- Admin token stored in `localStorage[mirage-admin-${sessionId}]`
- `GET /v/{id}` is public (shareable), PUT/DELETE require admin token
- `/v/new` = local-only mode until first save

### Audio
- Mic input via `getUserMedia`, connected to AnalyserNode (NOT destination)
- Bass/mid/high frequency bands drive scene reactivity

### Scenes
- 23 scenes self-register via `registerScene(id, factory, metadata)`
- Each declares `SceneParamDef[]` for per-scene settings
- Settings panel auto-generates controls from scene metadata

### Textures
- S3 configured: upload via `/api/upload`, store URL in session
- S3 not configured: client-side base64 optimization, store in config JSON

## Environment Variables

```bash
DATABASE_URL=./data/mirage.db
MIRAGE_API_KEY=          # Optional - if unset, API is open
S3_BUCKET=               # Optional - if unset, textures use base64
S3_REGION=us-east-1
S3_ENDPOINT=             # For MinIO/R2
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=true # Required for MinIO
```

## Testing

- Use `npm test`, NOT `bun test`
- Tests use `.test.ts` or `.test.tsx` suffix
- Mock `better-sqlite3` in tests that touch the DB
