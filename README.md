# Mirage

A standalone, self-hosted web app for real-time 3D music visualization. 26 scenes powered by Three.js, microphone audio input, shareable sessions, admin dashboard, and optional Cloudflare R2 storage for textures.

## Quick Start

```bash
bun install
bun run dev
```

Open [http://localhost:4444](http://localhost:4444).

## Features

- **26 Three.js scenes** across 5 categories (Organic, Cosmic, Geometric, Abstract, Immersive)
- **Audio-reactive** — connect your mic and visuals respond to music in real time
- **Shareable sessions** — create a session via the API, share the URL
- **Custom textures** — upload images as overlays on any scene
- **Color presets** — 8 built-in palettes plus custom colors and auto-cycling
- **Per-scene parameters** — each scene exposes its own tunable controls
- **Post-processing** — bloom, tone mapping, fog depth

## Texture Storage (Cloudflare R2)

Mirage supports two modes for custom texture images:

| Mode                 | How it works                                                                   | When to use                                                    |
| -------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| **Base64 (default)** | Images are optimized client-side and stored as data URLs in the session config | No setup needed — works out of the box                         |
| **Cloudflare R2**    | Images are uploaded to an R2 bucket and served through a proxy route           | Better for larger images, multiple sessions, or production use |

### Setting up R2

Run the interactive setup script:

```bash
bash scripts/setup-r2.sh
```

The script will:

1. **Ask for your Cloudflare Account ID** — found in the dashboard URL or R2 overview sidebar
2. **Ask for a Cloudflare API Token** — needs "Edit R2" permission ([create one here](https://dash.cloudflare.com/profile/api-tokens))
3. **Create the R2 bucket** automatically via the Cloudflare API
4. **Open the R2 API Tokens page** — you create an S3-compatible token here (the one manual step)
5. **Ask you to paste the Access Key ID and Secret** from step 4
6. **Test the credentials** against the bucket
7. **Write everything to `.env`**

After setup, restart Mirage (`bun run dev`) and texture uploads will automatically use R2.

### How textures are served

When R2 is configured, uploaded textures are served through `/api/textures/...` — a built-in proxy route. This means your R2 bucket doesn't need to be publicly accessible.

If you later enable public access (r2.dev subdomain or custom domain), add the URL to `.env`:

```bash
S3_PUBLIC_URL=https://your-bucket.r2.dev
```

This bypasses the proxy for faster direct serving.

### Manual R2 configuration

If you prefer to configure R2 manually instead of using the script, add these to your `.env`:

```bash
S3_BUCKET=mirage-textures
S3_REGION=auto
S3_ENDPOINT=https://<your-account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=<your-access-key>
S3_SECRET_ACCESS_KEY=<your-secret-key>
S3_FORCE_PATH_STYLE=true
```

## Admin Dashboard

Mirage includes an admin dashboard at `/admin` for managing API keys and admin users.

### First-time setup

Set an initial admin username and password via environment variables:

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password   # min 8 characters
```

On first login, Mirage seeds the database with this admin user. After that, you can create additional admins and API keys from the dashboard.

### Generating ADMIN_SESSION_SECRET

The `ADMIN_SESSION_SECRET` is used to sign admin session JWTs. If not set, it falls back to `ADMIN_PASSWORD`. For production, generate a dedicated secret:

```bash
# Using openssl (recommended)
openssl rand -base64 32

# Using Node.js / Bun
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Add it to your `.env`:

```bash
ADMIN_SESSION_SECRET=your-generated-secret-here
```

### API key management

From the admin dashboard you can create and revoke API keys. Keys use the format `mk_` + 32 random characters. The full key is shown once at creation and stored as a SHA-256 hash. If no API keys exist in the database, session creation is open (no auth required).

## Environment Variables

| Variable               | Required | Default            | Description                                            |
| ---------------------- | -------- | ------------------ | ------------------------------------------------------ |
| `DATABASE_URL`         | No       | `./data/mirage.db` | SQLite database path                                   |
| `ADMIN_USERNAME`       | No       | —                  | Initial admin username (required for first-time setup) |
| `ADMIN_PASSWORD`       | No       | —                  | Initial admin password (min 8 chars)                   |
| `ADMIN_SESSION_SECRET` | No       | —                  | JWT signing secret (falls back to `ADMIN_PASSWORD`)    |
| `S3_BUCKET`            | No       | —                  | R2/S3 bucket name                                      |
| `S3_REGION`            | No       | `us-east-1`        | Use `auto` for R2                                      |
| `S3_ENDPOINT`          | No       | —                  | R2: `https://<account-id>.r2.cloudflarestorage.com`    |
| `S3_ACCESS_KEY_ID`     | No       | —                  | R2 API token access key                                |
| `S3_SECRET_ACCESS_KEY` | No       | —                  | R2 API token secret key                                |
| `S3_FORCE_PATH_STYLE`  | No       | `true`             | Required for R2/MinIO                                  |
| `S3_PUBLIC_URL`        | No       | —                  | Public URL for direct texture serving (bypasses proxy) |

## API

| Method   | Path                       | Auth                     | Description                   |
| -------- | -------------------------- | ------------------------ | ----------------------------- |
| `POST`   | `/api/sessions`            | API key                  | Create session                |
| `GET`    | `/api/sessions/[id]`       | None                     | Read session (public)         |
| `PUT`    | `/api/sessions/[id]`       | Admin token              | Update config/texture         |
| `DELETE` | `/api/sessions/[id]`       | Admin token              | Delete session                |
| `POST`   | `/api/upload`              | Admin token + session ID | Upload texture to R2          |
| `GET`    | `/api/textures/[...path]`  | None                     | Proxy texture from R2         |
| `GET`    | `/api/health`              | None                     | Health check + storage status |
| `POST`   | `/api/admin/auth/login`    | None                     | Admin login                   |
| `POST`   | `/api/admin/auth/logout`   | Session                  | Admin logout                  |
| `GET`    | `/api/admin/users`         | Session                  | List admin users              |
| `POST`   | `/api/admin/users`         | Session                  | Create admin user             |
| `DELETE` | `/api/admin/users/[id]`    | Session                  | Delete admin user             |
| `GET`    | `/api/admin/api-keys`      | Session                  | List API keys                 |
| `POST`   | `/api/admin/api-keys`      | Session                  | Create API key                |
| `DELETE` | `/api/admin/api-keys/[id]` | Session                  | Revoke API key                |

## Docker

```bash
docker compose up -d
```

Mirage runs on port 4444. Mount `./data/` for persistent storage. Pass R2 env vars through `docker-compose.yml` or a `.env` file.

## Development

```bash
bun install          # Install dependencies
bun run dev          # Dev server (port 4444)
bun run build        # Production build
npm test             # Run tests (use npm, not bun)
bun run lint         # ESLint
bun run format       # Prettier
```

## Tech Stack

Next.js 16 (App Router) / React 19 / Three.js / Drizzle ORM / SQLite / Tailwind CSS v4 / Zod / Bun
