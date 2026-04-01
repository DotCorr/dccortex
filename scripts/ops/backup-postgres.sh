#!/usr/bin/env bash

set -euo pipefail

# Backup PostgreSQL from the compose postgres service.
# Outputs:
# - custom-format dump (.dump)
# - SHA256 checksum (.sha256)
# - metadata json (.meta.json)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose is required" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups/postgres}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
POSTGRES_USER="${POSTGRES_USER:-dccortex}"
POSTGRES_DB="${POSTGRES_DB:-dccortex_dashboard}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASENAME="dccortex_${POSTGRES_DB}_${TIMESTAMP}"
DUMP_PATH="$BACKUP_DIR/$BASENAME.dump"
SUM_PATH="$DUMP_PATH.sha256"
META_PATH="$DUMP_PATH.meta.json"

mkdir -p "$BACKUP_DIR"

if ! docker compose ps "$POSTGRES_SERVICE" >/dev/null 2>&1; then
  echo "postgres service '$POSTGRES_SERVICE' not found in compose project" >&2
  exit 1
fi

echo "Creating backup: $DUMP_PATH"

docker compose exec -T "$POSTGRES_SERVICE" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl > "$DUMP_PATH"

if [[ ! -s "$DUMP_PATH" ]]; then
  echo "backup failed: dump is empty" >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$DUMP_PATH" > "$SUM_PATH.tmp"
  mv "$SUM_PATH.tmp" "$SUM_PATH"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$DUMP_PATH" > "$SUM_PATH.tmp"
  mv "$SUM_PATH.tmp" "$SUM_PATH"
else
  echo "warning: sha256sum/shasum not found, skipping checksum" >&2
fi

FILE_SIZE="$(wc -c < "$DUMP_PATH" | tr -d ' ')"
cat > "$META_PATH" <<EOF
{
  "createdAtUtc": "$TIMESTAMP",
  "database": "$POSTGRES_DB",
  "user": "$POSTGRES_USER",
  "service": "$POSTGRES_SERVICE",
  "format": "pg_dump custom",
  "sizeBytes": $FILE_SIZE,
  "path": "$(basename "$DUMP_PATH")"
}
EOF

# Retention cleanup
if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] && [[ "$RETENTION_DAYS" -gt 0 ]]; then
  find "$BACKUP_DIR" -type f \( -name '*.dump' -o -name '*.sha256' -o -name '*.meta.json' \) -mtime "+$RETENTION_DAYS" -delete
fi

echo "Backup complete"
echo "Dump: $DUMP_PATH"
[[ -f "$SUM_PATH" ]] && echo "Checksum: $SUM_PATH"
echo "Metadata: $META_PATH"
