# CI Gate Scripts

These scripts are used by GitHub Actions workflows in `.github/workflows/`.

## Scripts

- `verify-enterprise-structure.sh`: validates required enterprise docs and policy files exist.
- `release-gate-check.sh`: runs static deploy checks, Helm lint, and application quality gates.

## Local Usage

From repository root:

```bash
bash scripts/ci/verify-enterprise-structure.sh
bash scripts/ci/release-gate-check.sh
```

## Notes

- `release-gate-check.sh` performs full installs/build checks and can take several minutes.
- For local fast checks, run `verify-enterprise-structure.sh` only.
