# Code Review & Compliance Validation

**Goal:** During code reviews, verify that changes maintain or improve compliance posture. This checklist is for reviewers to use when evaluating PRs.

---

## Code Review Compliance Template

Use this template when reviewing PRs that touch compliance-sensitive files.

### 1. Pre-Review (Automated)

- [ ] Pre-commit check passed? (Check PR status checks)
- [ ] TypeScript type check passed?
- [ ] No manual bypasses? (i.e., `git commit --no-verify` on compliance files?)

### 2. Review Header Questions

Ask these first to understand scope:

- [ ] **What compliance domains does this PR touch?**
  - [ ] Access Control (auth, permissions, RBAC)
  - [ ] Audit (logging, evidence, retention)
  - [ ] Contingency Planning (backup, restore)
  - [ ] Incident Response (runbooks, templates)
  - [ ] Security Configuration (headers, TLS, CORS)
  - [ ] Other: _______________

- [ ] **Is this control improvement, maintenance, or degradation?**
  - [ ] Improvement (adding/strengthening control)
  - [ ] Maintenance (keeping control as-is)
  - [ ] Degradation (reducing control scope — needs justification)

- [ ] **What is the risk level?**
  - [ ] Low (documentation, non-sensitive paths)
  - [ ] Medium (configuration, new permissions, new audit events)
  - [ ] High (removes control, touches immutability, changes RBAC logic)

### 3. Line-by-Line Review

#### For API Route Changes

```typescript
// Check this pattern is followed:
export async function PATCH(req) {
  // 1. RBAC Check (AC-3)
  const auth = await requireProjectDataAccess({
    projectId,
    requiredPermission: 'WRITE' // or appropriate level
  })
  if (auth instanceof NextResponse) return auth

  // 2. Action logic here

  // 3. Audit Logging (AU-1)
  await logAuditEvent({
    action: 'description_of_action',
    status: 'success', // or 'error'
    target: { type: 'resource_type', id: resourceId },
    metadata: { whatChanged: 'description' }
  })

  return NextResponse.json({ success: true })
}
```

**Questions:**
- [ ] Is RBAC check at the top of the function?
- [ ] Does permission level match the operation? (READ for GET, WRITE/DELETE for mutations)
- [ ] Is audit logging present for all mutations?
- [ ] Does audit metadata capture what changed?
- [ ] No sensitive data (passwords, tokens) in logs?

#### For Permission Changes

```typescript
// Before approving change to PERMISSIONS constant:
export const PERMISSIONS = {
  NEW_PERMISSION: {
    name: 'NEW_PERMISSION',
    description: 'What this permission allows',
    owner: 'ORG_ADMIN' // Only org admins can grant
  }
}
```

**Questions:**
- [ ] Does the permission match a specific business action?
- [ ] Is there a clear owner role (who can grant this)?
- [ ] No circular dependencies (e.g., ADMIN can't grant ADMIN)?
- [ ] Updated in compliance matrix with owner role?
- [ ] Audit logging added for permission grants?

#### For Database/Schema Changes

```typescript
// If modifying schema or adding new table:
// 1. Check if audit-critical
// 2. Add to immutability middleware if sensitive
// 3. Test that immutability works if applicable
```

**Questions:**
- [ ] Is this table part of the audit trail?
- [ ] Should it be immutable? (If yes, is it in the middleware?)
- [ ] Retention policy defined?
- [ ] Tested with restore script?
- [ ] Migration is backwards-compatible?

#### For Script Changes

```bash
#!/bin/bash
# Questions for ops scripts:

# 1. Is danger guarded?
if [ "$FORCE_DESTROY_DATABASE" != "true" ]; then
  echo "This will delete data. Set FORCE_DESTROY_DATABASE=true to continue"
  exit 1
fi

# 2. Are safety checks present?
[ -f "$BACKUP" ] || { echo "Backup not found"; exit 1; }

# 3. Is output clear?
echo "[BACKUP] Starting backup of production database..."
```

**Questions:**
- [ ] Destructive operations guarded with FORCE_ flag?
- [ ] Safety checks validate inputs before operating?
- [ ] Output is clear about what's happening?
- [ ] Tested with dry-run mode?
- [ ] Documented in scripts/README.md?

#### For Configuration Changes

```javascript
// For next.config.js:
const nextConfig = {
  headers: async () => {
    return [{
      source: '/(.*)',
      headers: [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains'
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        }
        // ... other headers
      ]
    }]
  }
}
```

**Questions:**
- [ ] All security headers still present?
- [ ] No debug modes enabled?
- [ ] CORS not overly permissive (not `*`)?
- [ ] TLS/HSTS config correct?

### 4. Risk Assessment

Approve with caution if ANY of these are true:

- ❌ **RBAC removed or bypassed** — Requires Security Lead sign-off
- ❌ **Audit logging removed or weakened** — Requires Security Lead sign-off
- ❌ **Immutability disabled** — Requires Security Lead + Platform Lead sign-off
- ❌ **Security header removed** — Requires Security Lead sign-off
- ❌ **Backup/restore logic changed** — Requires Ops Lead sign-off + test run
- ❌ **Permission matrix changed without documentation** — Requires IAM Lead sign-off
- ❌ **No audit log for data modification** — Request addition before approval

**Exception Process:**
If red flag is unavoidable:
1. Document risk in PR description
2. Get explicit sign-off from control owner (Security/Ops/IAM Lead)
3. Create follow-up issue to close gap
4. Hold in "Approved with Risk" state until risk is mitigated

### 5. Evidence & Testing

- [ ] If control implementation: Link to evidence directory
- [ ] If control change: Updated compliance matrix included
- [ ] If operational script: Dry-run tested and output shown
- [ ] If sensitive: Manual testing walkthrough documented

**Check:**
```bash
# Reviewer should ask:
# "Show me the test run output"
# "Link to the evidence directory"
# "What did you test this change with?"
```

### 6. Documentation

- [ ] Commit message follows template:
  ```
  feat(area): description

  Compliance Impact:
  - Controls Touched: AC-1, AU-1
  - Change Type: Improvement
  - Evidence: [link to evidence]
  - Testing: [what was tested]
  ```

- [ ] Code comments explain _why_ compliance matters (not just _what_ it does)
  ```typescript
  // ✓ Good
  // AC-3: Require ORG_MANAGE permission before allowing config changes
  const auth = await requireProjectDataAccess({
    requiredPermission: 'ORG_MANAGE'
  })

  // ✗ Bad
  // Check permission
  const auth = await requireProjectDataAccess()
  ```

---

## Compliance Review Workflow

### For Authors

**Before submitting PR:**
1. [ ] Run compliance pre-commit check
2. [ ] Fill out compliance impact section in PR description
3. [ ] Reference evidence locations if control-related
4. [ ] Link to compliance framework docs

**PR Description Template:**
```markdown
## Description
[What you changed]

## Compliance Impact
- **Controls Touched:** [e.g., AC-3 RBAC, AU-1 Audit]
- **Change Type:** Improvement / Maintenance / Degradation
- **Evidence:** [Link to new evidence, if applicable]
- **Testing:** [How you validated the control]
- **Risk:** [Any risks identified during development]

## Red Flags (Check if applicable)
- [ ] Removes or weakens RBAC
- [ ] Removes or weakens audit logging
- [ ] Disables immutability
- [ ] Changes security headers
- [ ] Modifies backup/restore logic
- [ ] Changes permission matrix
```

### For Reviewers

**Review checklist (use at top of PR):**
```markdown
## Compliance Review

- [ ] No red flags present
- [ ] Security domains (if touched) reviewed
- [ ] Pre-commit checks passed
- [ ] Evidence location valid (if control-related)
- [ ] Commit message includes compliance impact
- [ ] Testing documented
- [ ] Risk mitigations in place (if needed)

**Compliance verdict:**
- [ ] Approve — No compliance impact
- [ ] Approve — Improves compliance
- [ ] Approve with Concern — Needs risk mitigation
- [ ] Request Changes — Red flag found
```

### For Compliance/Security Lead (Final Gate)

Add to GitHub branch protection:
- Require code review from `@security/leads` for files in: `dashboard/lib/auth.ts`, `dashboard/lib/permissions.ts`, `.github/workflows/`, `scripts/ops/`

Review checklist:
```markdown
## Security Lead Review

For high-risk PRs (touches security domains):

- [ ] RBAC logic correct
- [ ] Audit logging captures everything needed
- [ ] No authentication bypasses
- [ ] No privilege escalation paths
- [ ] Evidence collection process valid

**Approved by:** @security-lead
**Risk Level:** Low / Medium / High
```

---

## Common Findings & Responses

| Finding | Response | Action |
|---------|----------|--------|
| "No RBAC check on new API endpoint" | Request addition | Requires fix before merge |
| "Audit logging missing for data change" | Request addition | Requires fix before merge |
| "New permission added without owner role" | Request clarification | Requires documentation before merge |
| "Changed backup retention from 30 to 7 days" | Document risk | Requires Ops Lead approval |
| "Removed old audit event type" | Document retention plan | Reference retention script |
| "Added exception to immutability check" | High risk | Requires Security Lead + Platform Lead sign-off + issue tracking |

---

## Examples

### ✅ Good PR — Easy Approval

```markdown
## Description
Add user profile update API endpoint

## Compliance Impact
- Controls Touched: AC-3 (RBAC), AU-1 (Audit)
- Change Type: Improvement
- Evidence: User profile updates logged to immutable_audit_log
- Testing: Manual test with authorized and unauthorized users
- Risk: None

## Changes
- [dashboard/app/api/users/[id]/profile/route.ts](link): New endpoint with RBAC + audit
```

**Reviewer Assessment:**
- Has RBAC guard ✓
- Has audit logging ✓
- Tested with unauthorized user ✓
- No red flags ✓

**Verdict:** Approve ✓

---

### ⚠️  Review Required PR — Needs Clarification

```markdown
## Description
Optimize permission check performance

## Compliance Impact
- Controls Touched: AC-3 (RBAC)
- Change Type: Maintenance
- Risk: Changed permission resolution logic, needs validation

## Changes
- [dashboard/lib/permissions.ts](link): Cache permission lookups
```

**Reviewer Concern:**
- How do you invalidate the cache if permissions change?
- Does audit logging still capture permission grants?
- Tested with permission revocation?

**Response Needed:**
- Show cache invalidation logic
- Run permission revocation test
- Get IAM Lead approval

**Verdict:** Request Changes → Retest → Approve

---

### 🚫 Red Flag PR — Escalate

```markdown
## Description
Bypass RBAC for admin troubleshooting

## Changes
- [dashboard/lib/permissions.ts](link): Add DEBUG_BYPASS permission
- [dashboard/app/api/debug/route.ts](link): Endpoint without permission check
```

**Reviewer Finding:**
- ❌ RBAC bypassed for "debugging"
- ❌ No audit logging on debug endpoint
- ❌ High privilege escalation risk

**Required Action:**
- Reject without secure alternative
- Escalate to Security Lead
- Suggest: Add explicit logged admin action instead

**Verdict:** Request Changes (Critical) → Escalate

---

## Approval Levels

| Change Type | Reviewer | Approval Required |
|-------------|----------|------------------|
| Documentation only | Any developer | 1 approval |
| Feature with RBAC + audit correctly applied | Any developer | 1 approval |
| Configuration changes (security headers, CORS, TLS) | Security Lead | 1 approval |
| Permission matrix changes | IAM Lead | 1 approval |
| Backup/restore changes | Ops Lead | 1 approval + test run documented |
| Removes/weakens control | Security Lead + Platform Lead | 2 approvals + exception document |
| Audit logging changes | Platform Lead | 1 approval |

---

## Quick Reference for Reviewers

```bash
# Check if RBAC guard is present in API routes
git diff -- 'dashboard/app/api' | grep -c "requireProjectDataAccess"
# Should match number of new export async function

# Check if audit logging added for new mutations
git diff -- 'dashboard/app/api' | grep -c "logAuditEvent"
# Should be present for POST/PUT/PATCH/DELETE

# Check if permissions.ts changed - needs IAM review
git diff -- 'dashboard/lib/permissions.ts' | head -20

# Check if security headers changed
git diff -- 'dashboard/next.config.js' | grep -E "header|CSP|HSTS"

# Check if immutability middleware touched
git diff -- 'dashboard/lib/prisma.ts' | grep -E "update|delete|audit"
```

---

## Team Escalation Paths

**Question during review?** → Reference [COMPLIANCE_FRAMEWORK.md](../../COMPLIANCE_FRAMEWORK.md) + ask in PR comment

**Red flag found?** → Tag relevant lead:
- RBAC/permissions issue → @security-lead
- Audit logging issue → @platform-lead
- Backup/restore issue → @ops-lead
- General compliance question → @security-lead

**Concern about whole approach?** → Bring to compliance working group meeting

---

**Remember:** Compliance reviews protect the whole team. A 2-minute review comment saves days of firefighting later.
