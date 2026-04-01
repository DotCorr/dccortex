# Quick Compliance Checklist

**Before you commit, answer YES to all applicable items:**

## Universal (All Changes)

- [ ] I read the change I'm about to commit
- [ ] Does this change affect a compliance domain? (auth, audit, RBAC, backup, security headers)
  - If YES → Go to domain-specific section below
  - If NO → You're good, commit away
- [ ] No red flags from this list:
  - [ ] Removing/bypassing RBAC checks?
  - [ ] Removing/relaxing audit logging?
  - [ ] Changing security headers or TLS/CORS config?
  - [ ] Modifying backup/restore logic?
  - [ ] Changing retention or deletion policies?
  - [ ] Removing compliance documentation?

---

## For API Routes (dashboard/app/api/**/route.ts)

- [ ] Does this route handle sensitive data or user actions? (If unsure, assume YES)
- [ ] RBAC check in place? (`requireProjectDataAccess()` or `hasPermission()`)
  - [ ] Using correct permission level for action? (READ vs WRITE vs ADMIN)
  - [ ] Check returns NextResponse on failure?
- [ ] Audit logging for sensitive actions? (`logAuditEvent({ action, status, target, metadata })`)
  - [ ] Action name is descriptive?
  - [ ] Metadata captures what changed?
  - [ ] Status is 'success' or 'error'?
- [ ] No authentication bypass? (Check for exposed endpoints)

---

## For Auth/Permissions (dashboard/lib/auth.ts, permissions.ts)

- [ ] New permission defined? (Add to PERMISSIONS constant with owner role)
- [ ] Existing permission removed? (Update compliance matrix, document reason)
- [ ] Permission grants checked? (Verify owner role can actually grant this)
- [ ] Edge cases handled? (Anonymous, expired tokens, etc.)

---

## For Database/Prisma (dashboard/lib/prisma.ts, schema changes)

- [ ] New table or sensitive field added?
  - [ ] Marked immutable if audit-critical? (Prisma middleware will protect it)
  - [ ] Documented in compliance matrix?
- [ ] Schema migration written properly?
  - [ ] Backwards compatible?
  - [ ] Retention policy applied (if logs/audit)?
  - [ ] Tested with restore script?

---

## For Scripts (scripts/ops/*)

- [ ] Script runs without errors? (`bash -n script.sh`)
- [ ] Dangerous operations guarded? (Require `FORCE_DESTROY=true` flags)
- [ ] Safety checks in place?
  - [ ] Validates environment/files exist before operating?
  - [ ] Prints what it's about to do?
- [ ] Tested with dry-run if applicable?
- [ ] Documented in scripts/README.md?

---

## For Configuration (headers, CORS, TLS, next.config.js)

- [ ] Security headers still enforced?
  - [ ] HSTS?
  - [ ] X-Frame-Options?
  - [ ] X-Content-Type-Options?
  - [ ] Content-Security-Policy?
- [ ] CORS not opened to `*`?
- [ ] No debug/verbose modes enabled in production?

---

## For Documentation (policy, runbook, evidence format)

- [ ] Evidence collection process clear?
- [ ] Sign-off roles defined?
- [ ] References to compliance matrix?
- [ ] Runbooks tested (at least walkthrough)?

---

## Before You Push

1. **Run:** `bash scripts/compliance/pre-commit-check.sh`
   - Script will validate syntax, RBAC presence, audit logging, type-check
2. **Reference:** Check this checklist one more time
3. **Commit message:** Include `Compliance Impact:` section (see COMPLIANCE_FRAMEWORK.md examples)
4. **Push:** When ready, `git push origin feature-branch`

---

## Red Flag? Found Something Suspicious?

✋ **STOP** – Don't push yet.

1. Reference the compliance matrix: `docs/enterprise/COMPLIANCE_CONTROL_MATRIX.md`
2. Document the risk: Update the matrix with risk status
3. Escalate to Security Lead if:
   - Removing a control
   - Degrading a control without mitigation
   - Unsure if change affects compliance
4. Close the gap in next iteration (mark as "Planned")

---

## Help & References

- **Full Framework:** [COMPLIANCE_FRAMEWORK.md](../COMPLIANCE_FRAMEWORK.md)
- **Control Matrix:** [COMPLIANCE_CONTROL_MATRIX.md](../docs/enterprise/COMPLIANCE_CONTROL_MATRIX.md)
- **Running Checks:** `bash scripts/compliance/pre-commit-check.sh`
- **Install Auto-Hook:** `bash scripts/compliance/install-hooks.sh`

---

**Questions?** Ask in PRs or escalate to Security Lead. Better to clarify now than at audit time.
