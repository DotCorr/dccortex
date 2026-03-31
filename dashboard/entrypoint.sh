#!/bin/sh
set -e
# Regenerate Prisma client from current schema (so appScreen etc. exist in deployed image)
echo "[entrypoint] Generating Prisma client..."
npx prisma generate
# Apply migrations so tables exist
echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy
echo "[entrypoint] Done. Starting app..."
exec "$@"
