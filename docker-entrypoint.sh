#!/bin/sh
set -e

echo "[mirage] ============================================"
echo "[mirage]  Mirage — Starting up"
echo "[mirage] ============================================"

# Print environment diagnostics
echo "[mirage] Environment:"
echo "[mirage]   NODE_ENV=${NODE_ENV:-not set}"
echo "[mirage]   DATABASE_URL=${DATABASE_URL:-not set}"
echo "[mirage]   DEBUG=${DEBUG:-not set}"
echo "[mirage]   ADMIN_USERNAME=${ADMIN_USERNAME:-not set}"
echo "[mirage]   ADMIN_EMAIL=$([ -n "$ADMIN_EMAIL" ] && echo 'set' || echo 'NOT SET')"
echo "[mirage]   ADMIN_PASSWORD=$([ -n "$ADMIN_PASSWORD" ] && echo 'set' || echo 'NOT SET')"
echo "[mirage]   JWT_SECRET=$([ -n "$JWT_SECRET" ] && echo 'set' || echo 'NOT SET (will fall back to ADMIN_PASSWORD)')"
echo "[mirage]   SECURE_COOKIES=${SECURE_COOKIES:-not set (auto-detect)}"
echo "[mirage]   ALLOW_REGISTRATION=${ALLOW_REGISTRATION:-not set (defaults to true)}"

# Fix ownership of the data directory.
# When a host volume is mounted (e.g. on Unraid), it's typically owned by root,
# which the nextjs user (uid 1001) can't write to.
chown -R nextjs:nodejs /app/data 2>/dev/null || true

# Check for existing database
if [ -f "${DATABASE_URL:-/app/data/mirage.db}" ]; then
  echo "[mirage] Existing database found at ${DATABASE_URL:-/app/data/mirage.db}"
else
  echo "[mirage] No database found — will create a fresh one"
fi

echo "[mirage] Running database migrations..."
node /app/migrate.js

echo "[mirage] Starting server on port ${PORT:-4444}..."
exec su-exec nextjs:nodejs "$@"
