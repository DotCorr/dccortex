# Enterprise Self-Host 1.0 Release Contract

Purpose: define the non-negotiable release gates, checklists, and evidence required to ship Enterprise Self-Host 1.0.

## 1. Release Scope

This release must support:
- Self-hosted deployment on Linux VM using Docker Compose.
- Enterprise deployment path on Kubernetes using Helm.
- Air-gapped installation flow.
- Identity, security, operations, and support requirements expected in enterprise procurement.

Out of scope:
- Feature requests that do not affect deployability, security posture, or supportability.

## 2. Release Artifacts (Required)

All artifacts below are mandatory:
- Container images (versioned and signed).
- SBOM for each image (SPDX or CycloneDX).
- Vulnerability scan report for each image.
- Compose package and install guide.
- Helm charts and values documentation.
- Migration and rollback runbooks.
- Backup and restore runbook with drill evidence.
- Operator guide, admin guide, hardening guide.
- Support policy and LTS policy.

## 3. Release Gates (All Must Pass)

### Gate A: Install and Bootstrap
- [ ] Fresh install succeeds on supported Linux baseline.
- [ ] Platform starts with no manual patching of manifests/compose files.
- [ ] Admin can complete first-login bootstrap flow.
- [ ] Health endpoints show healthy state.

Evidence:
- Install logs.
- Environment file used (sanitized).
- Version and build metadata.

### Gate B: Upgrade and Rollback
- [ ] Upgrade from N-1 to N completes without data loss.
- [ ] Rollback from N to N-1 completes and service recovers.
- [ ] Schema migration is versioned and reversible where possible.
- [ ] Post-upgrade smoke tests pass.

Evidence:
- Migration logs.
- Rollback logs.
- Data integrity checks before/after.

### Gate C: Security Baseline
- [ ] TLS enforced for all external endpoints.
- [ ] Secrets are externalized (not hardcoded in images).
- [ ] Image signing enabled and verified.
- [ ] No Critical vulnerabilities in release images.
- [ ] High vulnerabilities are documented with risk acceptance or fixes.

Evidence:
- TLS config snapshot.
- Signature verification output.
- Scan reports and exception approvals.

### Gate D: Identity and Access
- [ ] OIDC SSO login works with at least one provider.
- [ ] Role-based access checks enforced in API and UI.
- [ ] Privileged actions require privileged roles.
- [ ] Access-denied paths are tested.

Evidence:
- Access test suite output.
- Role matrix and enforcement notes.

### Gate E: Audit and Observability
- [ ] Security events are logged (auth success/failure, role changes, config changes).
- [ ] Admin actions are logged with actor, timestamp, action, target.
- [ ] Logs are exportable to external SIEM.
- [ ] Metrics and health dashboards available.

Evidence:
- Sample audit logs.
- SIEM forwarding config.
- Metrics dashboard snapshot.

### Gate F: Backup and Recovery
- [ ] Scheduled backups configured.
- [ ] Restore test executed successfully.
- [ ] Declared RPO and RTO are met during drill.
- [ ] Recovery runbook validated by a second operator.

Evidence:
- Backup job output.
- Restore drill report.
- RPO/RTO measurement notes.

### Gate G: Air-Gapped Readiness
- [ ] Offline image bundle can be imported and run.
- [ ] No runtime dependency on external registries.
- [ ] Dependency mirrors documented.
- [ ] Offline install guide validated on clean host.

Evidence:
- Offline installation logs.
- Image manifest list and checksums.

### Gate H: Documentation and Support
- [ ] Operator guide complete.
- [ ] Admin guide complete.
- [ ] Hardening guide complete.
- [ ] Incident response and patch policy published.

Evidence:
- Document version list.
- Internal doc review sign-off.

## 4. Exit Criteria for Engineering

The release branch can be tagged only when:
- All gates are green.
- Exceptions have explicit owner, risk statement, and expiry date.
- Final release candidate has reproducible build hash.

## 5. Required Workstreams (Parallel)

Run these in parallel and close together:
- Packaging: Compose + Helm + install automation.
- Security: hardening, scanning, signatures, secrets.
- IAM: OIDC/SAML adapters, RBAC enforcement, role tests.
- Ops: backup/restore, monitoring, log forwarding.
- Docs: operator/admin/hardening/support runbooks.

## 6. PR Checklist (Use on Every PR)

- [ ] Threat impact reviewed (auth, data, privilege, network).
- [ ] Audit event impact reviewed.
- [ ] Config and env vars documented.
- [ ] Migration impact documented.
- [ ] Rollback impact documented.
- [ ] Tests added or updated.

## 7. Release Day Checklist

- [ ] Freeze branch and dependencies.
- [ ] Run full gate validation suite.
- [ ] Generate and sign artifacts.
- [ ] Publish docs and release notes.
- [ ] Run post-release smoke tests.
- [ ] Start enhanced monitoring window.

## 8. Ownership

Define named owners before release candidate:
- Release Manager:
- Security Lead:
- Platform Lead:
- IAM Lead:
- Operations Lead:
- Documentation Lead:

## 9. Engineering Execution Cadence

Use one release train per target version (example: `v1.0.0-enterprise.1`).

- Week 1-2: packaging parity + CI gate wiring.
- Week 3-4: IAM, RBAC, and audit event completion.
- Week 5-6: backup/restore drills and air-gap validation.
- Week 7+: hardening evidence, upgrade/rollback evidence, release sign-off.

Required recurring ceremonies:
- Weekly gate status review (all gate owners present).
- Weekly risk register review (exceptions with expiry only).
- Release-candidate rehearsal before final tag.

## 10. CI/CD Gate Wiring (Required)

Every release pipeline must fail fast on these checks:

- Build and unit/integration tests.
- SBOM generation for each image.
- Vulnerability scan policy check (block critical).
- Image signing and signature verification.
- Migration dry-run and smoke tests.
- Helm render + lint + install test (enterprise mode).
- Compose install smoke test (baseline mode).

## 11. Release Sign-Off Record (Fill Before Tag)

- Release tag:
- Commit SHA:
- Build timestamp (UTC):
- Compose package version:
- Helm chart version:
- Security sign-off (name/date):
- Ops sign-off (name/date):
- IAM sign-off (name/date):
- Documentation sign-off (name/date):
- Final decision: `GO` / `NO-GO`
