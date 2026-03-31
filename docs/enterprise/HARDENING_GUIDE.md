# Enterprise Hardening Guide (Template)

Purpose: provide a repeatable baseline hardening profile for self-hosted enterprise deployments.

## 1. Host Baseline

- Supported OS: Ubuntu LTS or RHEL-compatible baseline.
- Keep host fully patched.
- Disable password SSH logins; use key-based auth only.
- Restrict sudo access to named operators.
- Enable time sync and audit logging.

## 2. Network Baseline

Allow only required inbound ports:
- 443/tcp (required).
- 80/tcp (optional redirect to 443).
- 22/tcp (restricted to admin CIDRs).

Deny everything else by default.

Outbound controls:
- Allow only required package mirrors, container registry endpoints, and optional AI provider endpoints.

## 3. Container Runtime Baseline

- Run rootless where supported.
- Use pinned image versions, not floating tags.
- Drop unnecessary Linux capabilities.
- Run with read-only root filesystem where possible.
- Set CPU and memory limits for all services.

## 4. Secrets and Configuration

- Do not bake secrets into images.
- Store secrets in environment injection mechanism or secret manager.
- Rotate secrets on schedule and on incident.
- Maintain a secrets inventory with ownership.

## 5. TLS and Certificates

- Enforce TLS 1.2+.
- Disable weak ciphers and legacy protocols.
- Automate certificate renewal and alert before expiry.
- Use HSTS for external endpoints.

## 6. Identity and Access

- Enable SSO integration (OIDC/SAML).
- Require MFA at IdP layer.
- Enforce RBAC and least privilege for all admin actions.
- Remove inactive users and stale tokens.

## 7. Logging and Monitoring

- Enable structured logs for API, auth, admin actions, and system events.
- Forward logs to SIEM.
- Set retention and access policy.
- Monitor health, latency, error rates, and resource saturation.

## 8. Database Hardening

- Restrict DB network exposure to internal network.
- Enforce auth and least privilege DB users.
- Enable backup encryption.
- Validate restore procedures regularly.

## 9. Backup and Disaster Recovery

- Define backup schedule and retention policy.
- Test restore at least quarterly.
- Track RPO and RTO against targets.
- Document emergency recovery steps with owner roles.

## 10. Validation Checklist

- [ ] Host patched and baseline applied.
- [ ] Firewall policy verified.
- [ ] TLS scan passed.
- [ ] Secrets rotation verified.
- [ ] RBAC and SSO tests passed.
- [ ] Logging and SIEM forwarding verified.
- [ ] Backup and restore drill passed.

## 11. STIG/CIS Mapping Notes

For each hardening control, add references to relevant CIS benchmark items and any required STIG overlays used by the customer.

Template fields:
- Control Name:
- Baseline Setting:
- Reference (CIS/STIG):
- Verification Method:
- Exception Process:

## 12. Verification Runbook (Operator Checklist)

Run and record outputs for:

- Host patch status and kernel version.
- Open port inventory on host and containers.
- TLS protocol/cipher scan for public endpoints.
- Secrets presence scan (no plaintext secrets in repos/images).
- Container runtime policy checks (limits, capabilities, filesystem).
- Log forwarding path and retention validation.

Store outputs under release evidence folder before sign-off.

## 13. Hardening Exception Policy

If a control cannot be applied for customer or platform reasons:

- Record exception with control name and reason.
- Assign owner and expiration date.
- Define compensating control.
- Re-review at every release candidate.

No open-ended exceptions allowed for enterprise release.
