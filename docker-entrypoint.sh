#!/bin/sh
set -e

echo "[mirage] Running database migrations..."
node /app/migrate.js

# Fix data directory permissions if needed
chown -R nextjs:nodejs /app/data 2>/dev/null || true

echo "[mirage] Starting server..."
exec su-exec nextjs:nodejs "$@"
