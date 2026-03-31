#!/usr/bin/env bash
set -euo pipefail

required_files=(
  "docs/enterprise/README.md"
  "docs/enterprise/RELEASE_ENTERPRISE_SELF_HOST_1_0.md"
  "docs/enterprise/COMPLIANCE_CONTROL_MATRIX.md"
  "docs/enterprise/HARDENING_GUIDE.md"
  "docs/enterprise/AIRGAP_INSTALL.md"
  "docs/enterprise/HELM_MIGRATION_PLAN.md"
  "docs/enterprise/OPERATOR_GUIDE.md"
  "docs/enterprise/ADMIN_GUIDE.md"
  "docs/enterprise/SUPPORT_POLICY.md"
  "docs/enterprise/policies/ACCESS_CONTROL_POLICY.md"
  "docs/enterprise/policies/INCIDENT_RESPONSE_POLICY.md"
  "docs/enterprise/policies/PATCH_VULNERABILITY_POLICY.md"
  "docs/enterprise/policies/BACKUP_RECOVERY_POLICY.md"
  "docs/enterprise/policies/LOGGING_RETENTION_POLICY.md"
)

missing=0
for f in "${required_files[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing required enterprise file: $f"
    missing=1
  fi
done

if [[ $missing -ne 0 ]]; then
  echo "Enterprise structure validation failed."
  exit 1
fi

echo "Enterprise structure validation passed."
