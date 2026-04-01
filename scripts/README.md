# DCCortex scripts

| Script | Purpose |
|--------|--------|
| `dashboard-rebuild.sh` | Rebuild dashboard image (no-cache) and restart container. Use after Dockerfile/entrypoint changes so migrations run and auth works. |
| `ops/backup-postgres.sh` | Create PostgreSQL backup dump, checksum, metadata, and apply retention cleanup. |
| `ops/restore-postgres.sh` | Restore a backup dump into a target PostgreSQL database with safety guard for primary DB. |
| `ops/backup-restore-drill.sh` | Run backup + restore verification drill into ephemeral DB and generate a drill report. |
| `ops/audit-log-retention.sh` | Enforce audit log retention window by purging records older than configured threshold. |

Run from repo root: `./scripts/dashboard-rebuild.sh` or `bash scripts/dashboard-rebuild.sh`.

Backup examples from repo root:
- `./scripts/ops/backup-postgres.sh`
- `RESTORE_DB_NAME=dccortex_restore FORCE_RECREATE_DB=true ./scripts/ops/restore-postgres.sh backups/postgres/<file>.dump`
- `./scripts/ops/backup-restore-drill.sh`
- `AUDIT_LOG_RETENTION_DAYS=365 ./scripts/ops/audit-log-retention.sh`
