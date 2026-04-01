# Compliance-First Development Framework

**Goal:** Every code change is validated against compliance requirements before commit. Build production-ready, not scrambling at release time.

**Edition model:** DCCortex remains enterprise-first in standards and release discipline, while the community version stays free. Enterprise subscriptions fund long-term support, prioritized feature requests, and direct developer support.

---

## 1. Compliance Responsibility Map

### Core Files & Their Compliance Domains

| File/Module | Compliance Domain | Requirement | Owner |
|-------------|------------------|-------------|-------|
| `dashboard/lib/auth.ts` | AC-1, AC-2 | OIDC/RBAC enforcement at auth layer | IAM Lead |
| `dashboard/lib/permissions.ts` | AC-3 | Permission constants and checks | IAM Lead |
| `dashboard/lib/audit.ts` | AU-1, AU-2 | Immutable audit event logging | Platform Lead |
| `dashboard/lib/prisma.ts` | AU-2 | Immutable audit log middleware | Platform Lead |
| `dashboard/next.config.js` | SC-7 | Security headers (HSTS, nosniff, etc.) | Security Lead |
| `dashboard/app/api/*/route.ts` | AC-3, AU-1 | RBAC gates + audit logging on all admin actions | API Owner |
| `scripts/ops/backup-*.sh` | CP-1, CP-2 | Backup automation and validation | Ops Lead |
| `scripts/ops/restore-*.sh` | CP-2 | Restore safety and validation | Ops Lead |
| `.github/workflows/validate-evidence-pack.yml` | Release Gate | CI validation of evidence completeness | Release Manager |
| `docs/enterprise/policies/*.md` | IR-1, CP-1, MA-1 | Operational policies and runbooks | Ops Lead |

---

## 2. Pre-Commit Compliance Checklist

**Before pushing any code, ask these questions:**

### For every change:
- [ ] Does this change affect a compliance domain (auth, audit, RBAC, backup, security headers, evidence)?
- [ ] If yes, which control(s) does it touch? (Reference table above)
- [ ] Does this change **improve**, **maintain**, or **degrade** the control?
- [ ] If it degrades a control, is the degradation documented with a risk mitigation plan?
- [ ] Are there new evidence artifacts needed? (logs, test runs, policy updates)

### For API routes:
- [ ] RBAC check in place using `requireProjectDataAccess()` or `hasPermission()`?
- [ ] Audit logging for sensitive actions via `logAuditEvent()`?
- [ ] Security headers inherited from `next.config.js`?

### For database/storage changes:
- [ ] Is this table/data subject to immutability or retention requirements?
- [ ] Are audit log entries involved (use Prisma middleware in `dashboard/lib/prisma.ts`)?
- [ ] Backup/restore scripts tested with new schema?

### For operational scripts:
- [ ] Does this support a compliance requirement (backup, restore, audit retention)?
- [ ] Can it be called safely without risk of data loss?
- [ ] Is the script tested with `bash -n` (syntax validation)?
- [ ] Are there safety guards (e.g., `FORCE_RECREATE_DB=true` for destructive ops)?

### For documentation:
- [ ] Does this explain an operational control (runbook, policy, evidence format)?
- [ ] Is the evidence collection process and sign-off defined?
- [ ] Are there references to the compliance matrix and release contract?

---

## 3. Compliance Change Template

Use this template in commit messages to signal compliance impact:

```
feat(feature-area): description of change

Compliance Impact:
- Controls Touched: [e.g., AC-1 (RBAC), AU-1 (Audit)]
- Change Type: [Improvement / Maintenance / Gap Closure]
- Evidence Artifacts: [e.g., new audit event type, policy doc update]
- Risk Mitigation: [if any control is affected negatively]
- Testing: [manual validation, automated tests, drill validation]

Example:
feat(auth): add session timeout enforcement

Compliance Impact:
- Controls Touched: AC-4 (Session Security)
- Change Type: Improvement
- Evidence Artifacts: Session timeout config documented in ADMIN_GUIDE.md
- Testing: Manual test run with timeout validation
```

---

## 4. File-Specific Compliance Rules

### `dashboard/app/api/**` (API Routes)

Every route that touches data or admin functions MUST have:

```typescript
// 1. RBAC check at entry
const auth = await requireProjectDataAccess({ projectId, requiredPermission: 'DATA_WRITE' })
if (auth instanceof NextResponse) return auth

// 2. Audit event on sensitive action
await logAuditEvent({
  action: 'update_project_settings',
  status: 'success',
  target: { type: 'project', id: projectId },
  metadata: { changedFields: ['name', 'description'] }
})
```

### `dashboard/lib/auth.ts`

Permission definitions are the source of truth. When adding new permissions:
- [ ] Define in `PERMISSIONS` constant
- [ ] Document owner role (who can grant this permission)
- [ ] Add to compliance matrix if new domain

### `dashboard/lib/prisma.ts`

Immutability middleware protects audit tables. When adding immutable tables:
- [ ] Add to the `isAuditLogModel` check in the middleware
- [ ] Document why immutability is needed (compliance requirement)
- [ ] Test that updates/deletes throw expected error

### `scripts/ops/**`

Safety-first operations scripts. Before commit:
- [ ] Run `bash -n <script>` for syntax validation
- [ ] Document all environment variables and their defaults
- [ ] Include clear warnings for destructive operations (`FORCE_RECREATE_DB`, etc.)
- [ ] Add to `scripts/README.md` with examples

### `.github/workflows/**`

CI gates block releases. When modifying:
- [ ] Validate that gate continues to fail on missing evidence
- [ ] Smoke test: create a tag and verify workflow runs
- [ ] Document what the gate validates in the workflow comments

---

## 5. Compliance Validation Commands

Run these before committing:

```bash
# Check syntax on all shell scripts
find scripts -name "*.sh" -exec bash -n {} \;

# Verify audit logging is in place (grep for logAuditEvent in API routes)
grep -r "logAuditEvent" dashboard/app/api/

# Verify RBAC checks on all routes
grep -r "requireProjectDataAccess\|hasPermission" dashboard/app/api/

# Check TypeScript for errors (catches permission/auth issues)
npm run type-check --workspace dashboard

# Validate compliance matrix is up-to-date
cat docs/enterprise/COMPLIANCE_CONTROL_MATRIX.md | head -30
```

---

## 6. Red Flags (Stop and Review)

If your change involves ANY of these, pause and verify compliance:

- ❌ Removing or bypassing RBAC checks
- ❌ Removing or relaxing audit logging
- ❌ Changing security headers
- ❌ Modifying backup/restore logic
- ❌ Changing retention policies
- ❌ Adding new admin APIs without permission gates
- ❌ Modifying immutable table schema
- ❌ Changing release gate validation logic
- ❌ Removing policy documentation

**Action:** Reference the compliance matrix, update it if needed, and document the risk mitigation.

---

## 7. Release Gate Validation

Before every release tag, verify:

```bash
# 1. Generate evidence pack
scripts/ops/generate-enterprise-evidence-pack.sh <release-tag>

# 2. CI gate will run automatically on tag push
# 3. Manually verify evidence is complete
ls -la docs/enterprise/evidence/<release-tag>/

# 4. Check compliance matrix status
grep "Implemented\|Verified" docs/enterprise/COMPLIANCE_CONTROL_MATRIX.md | wc -l
```

---

## 8. Escalation Path

**Question during development?** → Check this framework + compliance matrix

**Found a gap?** → Update compliance matrix, mark as "Planned", document owner and timeline

**Need to ship before gap is closed?** → Document exception, get sign-off from Security Lead + Release Manager, add to open issues

**Change affected compliance?** → Update evidence paths and run release gate validation

---

## 9. Examples

### ✅ Good: Adding a new API endpoint

```typescript
// dashboard/app/api/projects/[id]/settings/route.ts

export async function PATCH(req, { params }) {
  // 1. Auth check (compliance: AC-1, AC-3)
  const auth = await requireProjectDataAccess({
    projectId: params.id,
    requiredPermission: 'ORG_MANAGE'
  })
  if (auth instanceof NextResponse) return auth

  const { name, description } = await req.json()

  // 2. Audit the change (compliance: AU-1)
  await logAuditEvent({
    action: 'update_project_settings',
    status: 'success',
    target: { type: 'project', id: params.id },
    metadata: { changedFields: ['name', 'description'] }
  })

  return NextResponse.json({ ok: true })
}
```

### ✅ Good: Commit message

```
feat(projects): add settings update API with RBAC + audit

Compliance Impact:
- Controls Touched: AC-1 (RBAC), AU-1 (Audit)
- Change Type: Improvement (new API properly gated)
- Evidence Artifacts: Audit event logged to immutable table
- Testing: Manual RBAC test + payload validation
```

### ❌ Bad: Missing RBAC or audit

```typescript
// DON'T DO THIS
export async function PATCH(req, { params }) {
  // ❌ No RBAC check!
  // ❌ No audit logging!
  return NextResponse.json({ data: updated })
}
```

---

## 10. Compliance Review Cadence

| Cadence | Action |
|---------|--------|
| **Per PR** | Run checklist above; verify no red flags |
| **Per release tag** | Generate evidence pack; run CI gate; verify all evidence present |
| **Monthly** | Audit log sample export; restore drill run |
| **Quarterly** | Full hardening review; incident readiness drill |

---

## Quick Reference

**Before you commit:**
1. Run syntax checks
2. Check compliance checklist against your change
3. Verify no red flags
4. Update compliance matrix if adding new controls
5. Reference the change in commit message

**Before you tag a release:**
1. Generate evidence pack
2. Run CI gate validation
3. Collect and attach evidence
4. Get sign-offs from control owners

**Peace of mind:** Every change is validated. Production readiness grows incrementally. No surprises at launch.

---

**Questions?** Reference the compliance matrix or this framework. When in doubt, escalate to Security Lead or Release Manager.
