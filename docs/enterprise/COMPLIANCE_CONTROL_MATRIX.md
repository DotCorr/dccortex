# Enterprise Compliance Control Matrix

Purpose: map implementation work to controls so the team can build with compliance in mind from the start.

Note: this is a practical engineering matrix aligned to NIST-style domains. It is not legal advice or a formal certification artifact by itself.

## 1. Control Mapping Table

| Domain | Control Objective | Implementation Requirement | Evidence | Owner | Status |
|---|---|---|---|---|---|
| Access Control | Least privilege access | Role model enforced in API and UI; deny by default | Role tests, API integration tests | IAM Lead | Implemented |
| Access Control | Central identity | OIDC/SAML integration for enterprise IdP | SSO login test logs, config docs | IAM Lead | Implemented |
| Access Control | Session security | Session timeout, secure cookies, token validation | Security test output | App Lead | Planned |
| Audit and Accountability | Action traceability | Log admin and security events with actor/action/target/time | Audit log samples | Platform Lead | Implemented |
| Audit and Accountability | Log integrity | Protect audit log from tampering; retention policy | Storage policy, retention config | Ops Lead | Implemented |
| Configuration Management | Controlled changes | Versioned infra and app configs; PR approval rules | Git history, approvals | Release Manager | Planned |
| Configuration Management | Environment separation | Distinct dev/stage/prod configs and secrets | Env docs, secrets inventory | Ops Lead | Planned |
| Identification and Auth | Strong auth | SSO support and MFA compatibility | SSO test run | IAM Lead | Planned |
| Incident Response | Respond and recover | Incident runbook, severity model, on-call ownership | Incident policy doc | Ops Lead | Implemented |
| Maintenance | Patch management | CVE review process, patch SLA by severity | Patch logs, SLA policy | Security Lead | Planned |
| Media Protection | Data protection at rest | DB and storage encryption strategy documented | Storage and DB config evidence | Ops Lead | Planned |
| System and Comm Protection | Data protection in transit | TLS 1.2+ only, managed cert rotation | TLS scan report | Security Lead | Planned |
| System and Comm Protection | Boundary defense | Port restrictions, ingress allowlist where required | Firewall rules snapshot | Ops Lead | Planned |
| System Integrity | Supply chain trust | Signed images, SBOM, dependency scanning | Signature verification, SBOM files | Security Lead | Planned |
| Contingency Planning | Recovery capability | Backup schedule and tested restore drill | Restore drill report | Ops Lead | Implemented |
| Contingency Planning | RPO/RTO commitments | Defined targets and measured drill results | RPO/RTO evidence | Ops Lead | Planned |

Suggested internal IDs (recommended for tracking):
- `AC-*` Access Control
- `AU-*` Audit and Accountability
- `CM-*` Configuration Management
- `IA-*` Identification and Authentication
- `IR-*` Incident Response
- `MA-*` Maintenance
- `MP-*` Media Protection
- `SC-*` System and Communications Protection
- `SI-*` System Integrity
- `CP-*` Contingency Planning

## 2. Evidence Index (Create and Maintain)

Create a folder per release under `docs/enterprise/evidence/<release-tag>/` with:
- `security/` (scan reports, signature logs, TLS checks)
- `iam/` (SSO test evidence, role enforcement tests)
- `ops/` (backup, restore, monitoring configs)
- `release/` (gate checklist results, artifact digests)

## 3. Policy Set Required for Enterprise Release

Required policy documents:
- Access Control Policy.
- Vulnerability and Patch Management Policy.
- Incident Response Policy.
- Backup and Recovery Policy.
- Logging and Retention Policy.
- Secure SDLC Policy.

## 4. Build Pipeline Compliance Hooks

Each release pipeline must include:
- SBOM generation step.
- Image vulnerability scan step.
- Image signing step.
- Signature verification step before deploy.
- Policy check step to block on Critical vulnerabilities.

## 5. Control Validation Cadence

- Per PR: static checks, unit/integration tests, security lint checks.
- Per release candidate: full gate validation from release contract.
- Quarterly: restore drill, incident simulation, hardening review.

## 6. Open Gaps Tracker Template

Use this template for each unresolved control:

- Control ID/Domain:
- Gap Description:
- Risk Level:
- Mitigation Plan:
- Owner:
- Target Date:
- Exception Expiry Date:

## 7. Pull Request Compliance Addendum (Required)

Each PR touching auth, networking, storage, deployment, or admin flows must include:

- Control IDs impacted (example: `AC-1`, `AU-2`, `SC-3`).
- New evidence artifact paths to be produced at release.
- Risk note if control is partially implemented.
- Follow-up issue ID if deferred.

## 8. Definition of Control Completion

A control row moves from `Planned` -> `Implemented` only when:

- Code/config is merged.
- Automated validation exists (test or policy check).
- Evidence artifact format and location are defined.

A control row moves from `Implemented` -> `Verified` only when:

- Evidence exists for the current release candidate.
- Owner and reviewer sign off.
