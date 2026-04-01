#!/usr/bin/env bash

set -euo pipefail

# Restore PostgreSQL dump into target database.
# Usage:
#   scripts/ops/restore-postgres.sh /path/to/backup.dump
#   RESTORE_DB_NAME=... scripts/ops/restore-postgres.sh /path/to/backup.dump

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /path/to/backup.dump" >&2
  exit 1
fi

DUMP_FILE="$1"
if [[ ! -f "$DUMP_FILE" ]]; then
  echo "dump file not found: $DUMP_FILE" >&2
  exit 1
fi

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

POSTGRES_USER="${POSTGRES_USER:-dccortex}"
POSTGRES_DB="${POSTGRES_DB:-dccortex_dashboard}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
TARGET_DB="${RESTORE_DB_NAME:-$POSTGRES_DB}"
FORCE_RECREATE="${FORCE_RECREATE_DB:-false}"

if ! docker compose ps "$POSTGRES_SERVICE" >/dev/null 2>&1; then
  echo "postgres service '$POSTGRES_SERVICE' not found in compose project" >&2
  exit 1
fi

if [[ "$TARGET_DB" == "$POSTGRES_DB" ]] && [[ "$FORCE_RECREATE" != "true" ]]; then
  echo "Refusing to restore into primary database without FORCE_RECREATE_DB=true" >&2
  exit 1
fi

if [[ "$FORCE_RECREATE" == "true" ]]; then
  echo "Recreating target database: $TARGET_DB"
  docker compose exec -T "$POSTGRES_SERVICE" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" postgres <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TARGET_DB' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "$TARGET_DB";
CREATE DATABASE "$TARGET_DB";
SQL
else
  echo "Ensuring target database exists: $TARGET_DB"
  docker compose exec -T "$POSTGRES_SERVICE" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" postgres <<SQL
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$TARGET_DB') THEN
    EXECUTE format('CREATE DATABASE %I', '$TARGET_DB');
  END IF;
END
$$;
SQL
fi

echo "Restoring dump into database: $TARGET_DB"
cat "$DUMP_FILE" | docker compose exec -T "$POSTGRES_SERVICE" pg_restore -U "$POSTGRES_USER" -d "$TARGET_DB" --clean --if-exists --no-owner --no-acl

echo "Restore complete"
