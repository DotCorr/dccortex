#!/usr/bin/env bash

set -euo pipefail

# Generate enterprise release evidence folder structure and baseline artifacts.
# Usage:
#   scripts/ops/generate-enterprise-evidence-pack.sh <release-tag>
# Example:
#   scripts/ops/generate-enterprise-evidence-pack.sh v1.0.0-enterprise.1

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <release-tag>" >&2
  exit 1
fi

RELEASE_TAG="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

EVIDENCE_ROOT="$ROOT_DIR/docs/enterprise/evidence/$RELEASE_TAG"
SECURITY_DIR="$EVIDENCE_ROOT/security"
IAM_DIR="$EVIDENCE_ROOT/iam"
OPS_DIR="$EVIDENCE_ROOT/ops"
RELEASE_DIR="$EVIDENCE_ROOT/release"
INCIDENTS_DIR="$OPS_DIR/incidents"
DRILLS_DIR="$INCIDENTS_DIR/drills"

mkdir -p "$SECURITY_DIR" "$IAM_DIR" "$OPS_DIR" "$RELEASE_DIR" "$INCIDENTS_DIR" "$DRILLS_DIR"

UTC_NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BRANCH_NAME="$(git branch --show-current)"
COMMIT_SHA="$(git rev-parse HEAD)"

cat > "$EVIDENCE_ROOT/README.md" <<EOF
# Evidence Pack: $RELEASE_TAG

Generated: $UTC_NOW
Branch: $BRANCH_NAME
Commit: $COMMIT_SHA

## Folder Layout

- security/: TLS scans, vulnerability reports, signature verification, SBOM references.
- iam/: SSO validation, RBAC enforcement outputs, access denied path tests.
- ops/: backup logs, restore drill reports, incident records.
- release/: gate checklist outputs, build metadata, sign-off records.

## Required Attachments

- Security gate evidence (scan + signatures + TLS).
- IAM gate evidence (OIDC + RBAC tests).
- Audit and observability evidence (audit log samples + export configuration).
- Backup and restore drill report with measured RPO/RTO.
- Incident readiness drill output.
EOF

cat > "$RELEASE_DIR/release-metadata.json" <<EOF
{
  "releaseTag": "$RELEASE_TAG",
  "generatedAtUtc": "$UTC_NOW",
  "branch": "$BRANCH_NAME",
  "commitSha": "$COMMIT_SHA"
}
EOF

cat > "$RELEASE_DIR/gate-status-template.md" <<'EOF'
# Release Gate Status

- Gate A Install and Bootstrap: PENDING
- Gate B Upgrade and Rollback: PENDING
- Gate C Security Baseline: PENDING
- Gate D Identity and Access: PENDING
- Gate E Audit and Observability: PENDING
- Gate F Backup and Recovery: PENDING
- Gate G Air-Gapped Readiness: PENDING
- Gate H Documentation and Support: PENDING

## Reviewer Sign-off

- Security Lead:
- Ops Lead:
- IAM Lead:
- Release Manager:
EOF

cat > "$OPS_DIR/restore-drill-latest.txt" <<EOF
No restore drill report copied automatically.
If available, copy latest report from backups/reports/restore-drill-*.txt into this folder.
EOF

LATEST_DRILL="$(ls -1t backups/reports/restore-drill-*.txt 2>/dev/null | head -n1 || true)"
if [[ -n "$LATEST_DRILL" ]]; then
  cp "$LATEST_DRILL" "$OPS_DIR/"
  echo "Copied restore drill report: $(basename "$LATEST_DRILL")"
fi

cat > "$INCIDENTS_DIR/incident-template.md" <<'EOF'
# Incident Record Template

- Incident ID:
- Severity:
- Detected At (UTC):
- Incident Commander:
- Security Lead:
- Platform Lead:
- Customer Impact:

## Timeline (UTC)

- HH:MM -

## Containment Actions

-

## Recovery Validation

-

## Corrective Actions

- Action:
- Owner:
- Due Date:
EOF

cat > "$SECURITY_DIR/security-artifacts-checklist.md" <<'EOF'
# Security Artifacts Checklist

- [ ] SBOM files attached.
- [ ] Vulnerability scan reports attached.
- [ ] Image signature verification output attached.
- [ ] TLS enforcement evidence attached.
EOF

cat > "$IAM_DIR/iam-artifacts-checklist.md" <<'EOF'
# IAM Artifacts Checklist

- [ ] OIDC login validation evidence attached.
- [ ] RBAC enforcement test output attached.
- [ ] Access denied path test output attached.
EOF

echo "Enterprise evidence pack generated at: $EVIDENCE_ROOT"
