# Enterprise Release Pack

Purpose: single entry point for enterprise self-host release planning, compliance execution, and final release gates.

## Documents

- [Release Contract](RELEASE_ENTERPRISE_SELF_HOST_1_0.md)
- [Compliance Control Matrix](COMPLIANCE_CONTROL_MATRIX.md)
- [Hardening Guide](HARDENING_GUIDE.md)
- [Incident Response Runbook](INCIDENT_RESPONSE_RUNBOOK.md)
- [Air-Gapped Install Guide](AIRGAP_INSTALL.md)
- [Helm Migration Plan](HELM_MIGRATION_PLAN.md)
- [Operator Guide](OPERATOR_GUIDE.md)
- [Admin Guide](ADMIN_GUIDE.md)
- [Support Policy](SUPPORT_POLICY.md)

## Policy Documents

- [Access Control Policy](policies/ACCESS_CONTROL_POLICY.md)
- [Incident Response Policy](policies/INCIDENT_RESPONSE_POLICY.md)
- [Patch and Vulnerability Policy](policies/PATCH_VULNERABILITY_POLICY.md)
- [Backup and Recovery Policy](policies/BACKUP_RECOVERY_POLICY.md)
- [Logging and Retention Policy](policies/LOGGING_RETENTION_POLICY.md)

## How To Use This Pack

1. Start every release cycle from the Release Contract gates.
2. Track control implementation and evidence in the Compliance Matrix.
3. Apply and verify platform hardening using the Hardening Guide.
4. Validate offline operation using the Air-Gapped Install Guide.
5. Ship Kubernetes enterprise mode using the Helm Migration Plan.
6. Generate evidence pack folders with `scripts/ops/generate-enterprise-evidence-pack.sh <release-tag>`.

## CI Enforcement

Workflows:
- `.github/workflows/ci.yml`
- `.github/workflows/security-supply-chain.yml`
- `.github/workflows/release-gates.yml`

Scripts:
- `scripts/ci/verify-enterprise-structure.sh`
- `scripts/ci/release-gate-check.sh`

## Required Exit Condition

Enterprise release is ready only when all required gates in the Release Contract are green and evidence is attached for the current release candidate.