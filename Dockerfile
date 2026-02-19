FROM node:20-alpine AS base

# Install bun
RUN npm install -g bun

# --- Dependencies ---
FROM base AS deps
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# --- Build ---
FROM base AS builder
WORKDIR /app

RUN apk add --no-cache git

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Create data directory and push schema for build-time prerendering
RUN mkdir -p data
RUN bun run db:push

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN bun run build

# --- Runtime ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN apk add --no-cache su-exec

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy drizzle migrations
COPY --from=builder /app/drizzle ./drizzle

# Create data directory for SQLite
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Copy migration script and entrypoint
COPY migrate.js /app/migrate.js
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 4444

# Unraid Docker manager reads these labels
LABEL net.unraid.docker.webui="http://[IP]:[PORT:4444]/"
LABEL net.unraid.docker.icon="https://raw.githubusercontent.com/fauxvo/mirage/main/public/icon.png"
LABEL net.unraid.docker.managed="dockerman"

ENV PORT=4444
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL=/app/data/mirage.db

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4444/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
