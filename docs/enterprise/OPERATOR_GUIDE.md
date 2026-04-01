# Enterprise Operator Guide

Purpose: run, maintain, and recover DCCortex enterprise deployments.

## 1. Core Responsibilities

- Install and upgrade platform releases.
- Operate backups and restore drills.
- Manage runtime configuration and secrets.
- Monitor health, logs, and security events.

## 2. Day-0 Bring-Up

1. Validate host/cluster hardening baseline.
2. Validate secrets and environment configuration.
3. Deploy with Compose or Helm package.
4. Confirm readiness/liveness and first admin login.

## 3. Day-1 Operations

- Check service health and error rates.
- Review failed auth and admin audit events.
- Verify backup job success.
- Track resource saturation and capacity trend.
- Keep incident timeline templates ready from INCIDENT_RESPONSE_RUNBOOK.md.

## 4. Upgrade Procedure

1. Read release notes and migration notes.
2. Take pre-upgrade backup and verify snapshot integrity.
3. Execute versioned upgrade command.
4. Run post-upgrade smoke tests.
5. If failed, execute rollback runbook.

## 5. Recovery Procedure

1. Identify outage type (app, DB, infra, network).
2. Restore latest valid backup to staging target.
3. Validate data integrity and service health.
4. Promote restored stack and document RPO/RTO result.

## 6. Evidence Required Per Release

- Install log
- Upgrade log
- Rollback log
- Backup and restore drill output
- Security scan outputs
- Incident response readiness drill output

## 7. Evidence Pack Generation and Release Tagging

Before release-candidate sign-off:

1. Run `scripts/ops/generate-enterprise-evidence-pack.sh <release-tag>`.
2. Commit evidence pack to main release branch.
3. Create semantic version tag: `git tag -a v1.0.0 -m "Release v1.0.0"`.
4. Push tag: `git push origin v1.0.0`.
5. GitHub Actions workflow `validate-evidence-pack` automatically runs (see [CI Gate Evidence Validation](CI_GATE_EVIDENCE_VALIDATION.md)).
6. Wait for workflow to pass ✅ (typically 10-15 seconds).
7. If workflow fails ❌, fix evidence pack and re-tag (see CI gate docs for details).
8. Once CI gate passes, attach gate evidence into `security/`, `iam/`, `ops/`, and `release/` folders.
9. Update gate status template and collect reviewer sign-off.

Reference: [CI Gate Evidence Validation](CI_GATE_EVIDENCE_VALIDATION.md) for detailed release process and troubleshooting.
