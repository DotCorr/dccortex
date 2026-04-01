#!/usr/bin/env bash

set -euo pipefail

# Purge old audit logs based on retention period.
# Default retention is 365 days.

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
AUDIT_LOG_RETENTION_DAYS="${AUDIT_LOG_RETENTION_DAYS:-365}"

if [[ ! "$AUDIT_LOG_RETENTION_DAYS" =~ ^[0-9]+$ ]] || [[ "$AUDIT_LOG_RETENTION_DAYS" -lt 30 ]]; then
  echo "AUDIT_LOG_RETENTION_DAYS must be an integer >= 30" >&2
  exit 1
fi

echo "Applying audit log retention: ${AUDIT_LOG_RETENTION_DAYS} days"

docker compose exec -T "$POSTGRES_SERVICE" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
WITH purged AS (
  DELETE FROM audit_logs
  WHERE created_at < NOW() - (${AUDIT_LOG_RETENTION_DAYS} || ' days')::interval
  RETURNING id
)
SELECT COUNT(*) AS deleted_rows FROM purged;
SQL

echo "Audit log retention run complete"
