#!/usr/bin/env bash

set -euo pipefail

# Run backup + restore verification drill.
# 1) create backup
# 2) restore into ephemeral db
# 3) run row-count sanity checks
# 4) drop ephemeral db

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

POSTGRES_USER="${POSTGRES_USER:-dccortex}"
POSTGRES_DB="${POSTGRES_DB:-dccortex_dashboard}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
DRILL_DB="${DRILL_DB_NAME:-${POSTGRES_DB}_restore_drill}"
REPORT_DIR="${DRILL_REPORT_DIR:-$ROOT_DIR/backups/reports}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT_PATH="$REPORT_DIR/restore-drill-$TIMESTAMP.txt"

mkdir -p "$REPORT_DIR"

LATEST_DUMP_BEFORE="$(ls -1t backups/postgres/*.dump 2>/dev/null | head -n1 || true)"

scripts/ops/backup-postgres.sh

LATEST_DUMP_AFTER="$(ls -1t backups/postgres/*.dump 2>/dev/null | head -n1 || true)"
DUMP_TO_USE="$LATEST_DUMP_AFTER"
if [[ -z "$DUMP_TO_USE" ]]; then
  DUMP_TO_USE="$LATEST_DUMP_BEFORE"
fi
if [[ -z "$DUMP_TO_USE" ]]; then
  echo "No dump file available" >&2
  exit 1
fi

RESTORE_DB_NAME="$DRILL_DB" FORCE_RECREATE_DB=true scripts/ops/restore-postgres.sh "$DUMP_TO_USE"

TABLE_COUNT="$(docker compose exec -T "$POSTGRES_SERVICE" psql -U "$POSTGRES_USER" -d "$DRILL_DB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d ' ')"
USER_COUNT="$(docker compose exec -T "$POSTGRES_SERVICE" psql -U "$POSTGRES_USER" -d "$DRILL_DB" -tAc "SELECT count(*) FROM users;" | tr -d ' ' || echo "n/a")"
ORG_COUNT="$(docker compose exec -T "$POSTGRES_SERVICE" psql -U "$POSTGRES_USER" -d "$DRILL_DB" -tAc "SELECT count(*) FROM organizations;" | tr -d ' ' || echo "n/a")"
PROJECT_COUNT="$(docker compose exec -T "$POSTGRES_SERVICE" psql -U "$POSTGRES_USER" -d "$DRILL_DB" -tAc "SELECT count(*) FROM projects;" | tr -d ' ' || echo "n/a")"

cat > "$REPORT_PATH" <<EOF
Restore Drill Report
Timestamp (UTC): $TIMESTAMP
Source DB: $POSTGRES_DB
Restore DB: $DRILL_DB
Backup Used: $DUMP_TO_USE

Validation Results:
- public table count: $TABLE_COUNT
- users row count: $USER_COUNT
- organizations row count: $ORG_COUNT
- projects row count: $PROJECT_COUNT
EOF

docker compose exec -T "$POSTGRES_SERVICE" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" postgres <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DRILL_DB' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "$DRILL_DB";
SQL

echo "Restore drill complete"
echo "Report: $REPORT_PATH"
