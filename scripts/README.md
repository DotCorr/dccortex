# DCCortex scripts

| Script | Purpose |
|--------|--------|
| `dashboard-rebuild.sh` | Rebuild dashboard image (no-cache) and restart container. Use after Dockerfile/entrypoint changes so migrations run and auth works. |

Run from repo root: `./scripts/dashboard-rebuild.sh` or `bash scripts/dashboard-rebuild.sh`.
