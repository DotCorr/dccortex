# Getting Started with Compliance-First Development

Auto-hook is now installed. Here's how to use the compliance framework starting **right now**.

---

## Your First Commit with Compliance Validation

**The hook is now active.** Next time you commit, it will automatically validate your changes.

### Scenario: You're about to commit a new feature

**Step 1: Make your changes**
```bash
# Edit files...
git add dashboard/app/api/users/route.ts
```

**Step 2: Before committing, check the checklist**
```bash
# Open and skim: docs/enterprise/COMPLIANCE_CHECKLIST.md
# Ask yourself: "Does this touch auth, RBAC, audit, or security headers?"
```

**Step 3: Write your commit message with compliance impact**
```bash
git commit -m "feat(users): add user profile edit endpoint with RBAC + audit

Compliance Impact:
- Controls Touched: AC-3 (RBAC), AU-1 (Audit)
- Change Type: Improvement
- Testing: Tested with authorized and unauthorized users
"
```

**Step 4: Hook runs automatically** ✅
```
===== Compliance Pre-Commit Check =====

[1] Checking staged changes in compliance domains...
  ⚠ Compliance domain affected: dashboard/app/api/users/route.ts
  → Verify changes against COMPLIANCE_FRAMEWORK.md

[2] Validating shell scripts (syntax check)...
  ✓ No shell scripts in staged changes

[3] Checking for RBAC gates in API routes...
  ✓ RBAC found in dashboard/app/api/users/route.ts

[4] Checking for audit logging in data modification routes...
  ✓ Audit logging found

[5] Running TypeScript type check...
  ✓ Type check passed

[6] Compliance matrix status...
  ✓ 7 controls implemented

========================================
✓ All compliance checks passed
You're good to commit!
```

**Commit succeeds.** ✓

---

## If the Hook Finds a Problem

**Scenario: You forgot audit logging**

```bash
git commit -m "feat(users): add user profile endpoint"
```

**Hook output:**
```
===== Compliance Pre-Commit Check =====

[3] Checking for RBAC gates in API routes...
  ✓ RBAC found in dashboard/app/api/users/route.ts

[4] Checking for audit logging in data modification routes...
  ⚠ Consider adding logAuditEvent() for data modifications

⚠ 1 warning(s) - review before committing
Check COMPLIANCE_FRAMEWORK.md for guidance

```

**You can:**
1. **Fix it** (recommended):
   ```bash
   # Edit the file to add audit logging
   # Then run: git add dashboard/app/api/users/route.ts
   # Then run: git commit again (hook will re-check)
   ```

2. **Override** (not recommended, creates audit trail):
   ```bash
   git commit --no-verify -m "feat(users): add user profile endpoint"
   # Warning: This skips compliance checks!
   ```

---

## Red Flags the Hook Won't Catch (But Code Review Will)

Some compliance issues need human review. The hook catches **automation**, but **CODE_REVIEW_COMPLIANCE.md** catches **logic**:

- ❌ **Permission level too permissive** (e.g., used READ when should be WRITE)
- ❌ **Audit metadata incomplete** (e.g., logged the action but not what changed)
- ❌ **New permission added without owner** (e.g., a permission that anyone can grant)
- ❌ **Immutability disabled** (e.g., allowing updates to audit logs)

**Use the code review template:**
- Reference: [CODE_REVIEW_COMPLIANCE.md](CODE_REVIEW_COMPLIANCE.md)
- When reviewing PRs, ask: "Does this pattern match the checklist?"

---

## Quick Reference When You're Uncertain

| Question | Answer Document |
|----------|-----------------|
| "Is this compliance-related?" | [COMPLIANCE_CHECKLIST.md](COMPLIANCE_CHECKLIST.md) (universal section) |
| "What should my commit message include?" | [COMPLIANCE_FRAMEWORK.md](../../COMPLIANCE_FRAMEWORK.md#3-compliance-change-template) (section 3) |
| "What guard code do I need?" | [COMPLIANCE_FRAMEWORK.md](../../COMPLIANCE_FRAMEWORK.md#4-file-specific-compliance-rules) (section 4) |
| "Should I bypass compliance check?" | No. Contact security lead instead. |
| "How do I review someone else's compliance?" | [CODE_REVIEW_COMPLIANCE.md](CODE_REVIEW_COMPLIANCE.md) (use template) |
| "We're adding a new control, what's the process?" | [ADDING_CONTROLS.md](ADDING_CONTROLS.md) (5-step process) |
| "Where do I find what controls live where?" | [CODEBASE_COMPLIANCE_MAPPING.md](CODEBASE_COMPLIANCE_MAPPING.md) |

---

## Timeline: From Now Until Production

### This Week
- [ ] Team reads [COMPLIANCE_CHECKLIST.md](COMPLIANCE_CHECKLIST.md) (5 min)
- [ ] First PR lands with compliance impact section
- [ ] Team uses hook on actual commits
- [ ] First review uses [CODE_REVIEW_COMPLIANCE.md](CODE_REVIEW_COMPLIANCE.md) template

### This Sprint
- [ ] All PRs reference compliance controls touched
- [ ] No commits bypass hook (no `--no-verify`)
- [ ] Code reviewers flag red flags early
- [ ] Compliance matrix stays up-to-date

### Before Release
- [ ] All 16 controls checked and tracked
- [ ] Evidence collected (not scrambled)
- [ ] CI gates validate evidence presence
- [ ] Tag release, gates pass, deploy

**Result:** Production launch with compliance already built in. No surprises.

---

## Common Workflows

### Adding a New Permission

**File:** `dashboard/lib/permissions.ts`

**Checklist:**
- [ ] Permission defined in PERMISSIONS constant
- [ ] Owner role specified (who can grant it)
- [ ] Business justification documented in comment
- [ ] Used in at least one API route with `hasPermission()` check
- [ ] Update compliance matrix if new domain

**Commit message:**
```
feat(permissions): add ORG_SETTINGS permission

Compliance Impact:
- Controls Touched: AC-3 (Permission Matrix)
- Change Type: Improvement
- Owner: ORG_ADMIN (only org admins can grant)
- Used in: dashboard/app/api/settings/route.ts
```

---

### Adding Audit Logging to an Existing Route

**File:** `dashboard/app/api/*/route.ts`

**Pattern:**
```typescript
// After RBAC check and logic, add:
await logAuditEvent({
  action: 'create_resource',
  status: 'success',
  target: { type: 'resource', id: resourceId },
  metadata: { changedFields: ['name', 'description'] }
})
```

**Commit message:**
```
feat(audit): add audit logging to settings update endpoint

Compliance Impact:
- Controls Touched: AU-1 (Audit Logging)
- Change Type: Improvement
- Evidence: immutable_audit_log table
- Testing: Verified log entry created on settings change
```

---

### Reviewing a PR with Compliance Questions

**Use this template in PR comments:**

```markdown
## Compliance Review

**Question:** Does this endpoint need RBAC?
- [ ] User-facing data modification → YES, needs RBAC
- [ ] Admin-only action → YES, needs RBAC
- [ ] Public read → NO, but verify intentional

**Observation:** I see RBAC check ✓

**Question:** Is audit logging present for mutations?
- Route modifies data (POST/PUT/PATCH/DELETE)
- [ ] Audit event logged with action + target + metadata

**Observation:** I see logAuditEvent() ✓

**Approval:** Compliance looks good. Approved ✓
```

---

### If You Hit a Red Flag

**Red flag:** Code wants to bypass RBAC for "debugging"

**Action:**
1. Stop and comment in PR:
   ```markdown
   ## Compliance Red Flag 🚨
   
   This adds a DEBUG_BYPASS flag that skips RBAC enforcement. This is a security risk.
   
   Alternatives:
   - Add an explicit admin action (logged and trackable)
   - Use a debug/test environment with separate RBAC
   - Add specific debug permissions that are audited
   
   Escalate to @security-lead before approval.
   ```

2. Tag the security lead for sign-off
3. Document the risk in the PR description
4. Create a follow-up issue to close the gap

---

## Dashboard: Check Your Compliance Status

**Run this to see current status:**

```bash
# See which controls are implemented
grep "Implemented" docs/enterprise/COMPLIANCE_CONTROL_MATRIX.md | wc -l

# See which need work
grep "Planned" docs/enterprise/COMPLIANCE_CONTROL_MATRIX.md

# Verify hook is installed
cat .git/hooks/pre-commit | head -5
```

---

## Help & Escalation

| Question | Contact |
|----------|---------|
| "What permission should I use?" | IAM Lead (reference `dashboard/lib/permissions.ts`) |
| "Is this a compliance issue?" | Security Lead or reference COMPLIANCE_FRAMEWORK.md |
| "The hook is blocking my commit" | Run check manually: `bash scripts/compliance/pre-commit-check.sh` |
| "I need to override the hook" | **Don't.** Instead, escalate to Security Lead |
| "We need a new control" | Reference ADDING_CONTROLS.md and escalate with the process |

---

## You're Ready

✅ **Hook installed**
✅ **Checklists in place**
✅ **Code review template ready**
✅ **Evidence collection initialized**

**Next action:** Make your next commit and watch the hook validate it.

**Peace of mind:** From this point forward, every commit validates compliance. Features and compliance grow together instead of competing at release time.

---

**Questions?** Reference [COMPLIANCE_FRAMEWORK.md](../../COMPLIANCE_FRAMEWORK.md) or ask in a PR with the compliance checklist.
