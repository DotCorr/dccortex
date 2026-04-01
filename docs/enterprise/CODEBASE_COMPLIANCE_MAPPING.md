# Codebase Compliance Mapping

**Goal:** Understand which files implement which compliance controls. Use this to make informed changes without breaking compliance.

---

## Quick Lookup by Control

| Control | Domain | Primary Files | Responsible | Status |
|---------|--------|--------------|-------------|--------|
| AC-1 | Access Control | `dashboard/lib/auth.ts` `dashboard/lib/permissions.ts` | IAM Lead | Implemented |
| AC-2 | Session Security | `middleware.ts` | App Lead | Planned |
| AC-3 | RBAC Enforcement | `dashboard/app/api/**` `dashboard/lib/permissions.ts` | API Owner | Implemented |
| AC-4 | Permission Audit | `dashboard/lib/audit.ts` `dashboard/lib/prisma.ts` | Platform Lead | Implemented |
| AU-1 | Audit Logging | `dashboard/lib/audit.ts` `dashboard/lib/prisma.ts` | Platform Lead | Implemented |
| AU-2 | Audit Immutability | `dashboard/lib/prisma.ts` `prisma/schema.prisma` | Platform Lead | Implemented |
| AU-3 | Audit Retention | `scripts/ops/audit-retention.sh` | Ops Lead | Implemented |
| CP-1 | Backup Automation | `scripts/ops/backup-*.sh` `docker-compose.yml` | Ops Lead | Implemented |
| CP-2 | Restore Validation | `scripts/ops/restore-*.sh` | Ops Lead | Implemented |
| DE-1 | Evidence Packaging | `scripts/ops/generate-enterprise-evidence-pack.sh` | Release Manager | Implemented |
| DE-2 | Release Gates | `.github/workflows/validate-evidence-pack.yml` | CI/CD Lead | Implemented |
| IR-1 | Incident Response | `docs/enterprise/INCIDENT_RESPONSE_RUNBOOK.md` `scripts/ops/incident-*.sh` | Security Lead | Implemented |
| IR-2 | Evidence Templates | `docs/enterprise/evidence/` | Security Lead | Implemented |
| SC-1 | Security Headers | `dashboard/next.config.js` `middleware.ts` | Security Lead | Implemented |
| SC-2 | TLS/HTTPS | `docker-compose.yml` `.github/workflows/` | Ops Lead | Implemented |
| SC-3 | Supply Chain | `scripts/ops/*sbom*` `scripts/ops/*image*` | Security Lead | Planned |

---

## Quick Lookup by File/Module

### 📁 dashboard/lib/ (Core Infrastructure)

#### `auth.ts` — OIDC/SSO Integration
**Controls Implemented:**
- AC-1 (Identity Provider configuration)
- AC-3 (Role-based access)

**Key Functions:**
- `getSession()` — Get current user session
- `requireAuth()` — Middleware guard for protected pages
- `requireProjectDataAccess()` — API guard with permission level check

**Before modifying:**
- [ ] Verify session flows are still authenticated
- [ ] Test SSO login still works
- [ ] Check permission levels are correctly enforced
- [ ] No bypass paths created

**Evidence Location:** Audit logs in `immutable_audit_log.permission_grant` events

---

#### `permissions.ts` — Permission Constants & Checks
**Controls Implemented:**
- AC-1 (Permission matrix definition)
- AC-3 (Permission enforcement)
- AC-4 (Permission grant audit)

**Key Objects:**
- `PERMISSIONS` — Master permission constant, source of truth
- `hasPermission(user, permission)` — Check if user has permission
- `canGrant(user, permission)` — Check if user can grant permission to others

**Before modifying:**
- [ ] Every new permission added has an owner role (who can grant it)
- [ ] Documentation updated with business justification
- [ ] Permission audit logging added to schema
- [ ] No circular dependencies (Admin can't grant Admin)

**Evidence Location:** 
- Definition: `dashboard/lib/permissions.ts` line X
- Audit trail: `immutable_audit_log.permission_grant` events
- Usage: Grepped in all `dashboard/app/api/**` routes

---

#### `audit.ts` — Audit Event Logging
**Controls Implemented:**
- AU-1 (Event capture and logging)
- AU-3 (Retention management)
- IR-2 (Evidence artifact generation)

**Key Functions:**
- `logAuditEvent({ action, status, actor, target, metadata })` — Log immutable event
- `getAuditLog(filters)` — Query audit events (read-only)
- `extractAuditEvidence(dateRange)` — Export evidence for compliance

**Before modifying:**
- [ ] New event types registered in constant list
- [ ] Event schema includes actor, timestamp, target, status
- [ ] No update/delete access to audit logs (read-only enforced)
- [ ] Retention script tested

**Evidence Location:** `immutable_audit_log` table (PostgreSQL)

---

#### `prisma.ts` — ORM & Immutability Middleware
**Controls Implemented:**
- AU-2 (Immutable audit log enforcement)
- AU-1 (Middleware audit capture)

**Key Functions:**
- Prisma middleware for all queries
- Blocks all UPDATE/DELETE on audit_log table
- Logs all data modifications to audit table

**Before modifying:**
- [ ] Audit log protection still enforced
- [ ] New tables requiring immutability added to middleware check
- [ ] No bypasses via raw SQL queries
- [ ] Tested that audit_log DELETE throws error

**Evidence Location:** Tested in unit tests + manual validation

---

### 📁 dashboard/app/api/ (API Endpoints)

**Protection Pattern:**
Every route MUST follow this pattern:

```typescript
// 1. RBAC CHECK (AC-3)
const auth = await requireProjectDataAccess({
  projectId,
  requiredPermission: 'WRITE' // or READ, ADMIN
})
if (auth instanceof NextResponse) return auth

// 2. AUDIT LOG (AU-1)
await logAuditEvent({
  action: 'create_user_account',
  status: 'success',
  target: { type: 'user', id: userId },
  metadata: { email, role }
})
```

**Red Flags (Stop if you see these):**
- ❌ Route without RBAC check
- ❌ Route without audit logging for writes
- ❌ Permission check that returns 404 instead of 403 (obscures permissions)
- ❌ Sensitive data logged without sanitization

**Controls Implemented:**
- AC-3 (RBAC gates on all sensitive routes)
- AU-1 (Audit logging for all data modifications)

---

### 📁 scripts/ops/ (Operational Automation)

#### `backup-*.sh` — Database Backup Automation
**Controls Implemented:**
- CP-1 (Backup creation and verification)
- AU-2 (Immutable backup archive with checksums)

**Before modifying:**
- [ ] Backup still runs without human intervention
- [ ] Checksum validation still works
- [ ] Backup directory permissions correct (read-only)
- [ ] Old backups still auto-pruned per retention
- [ ] Tested restore from backup works

**Evidence Location:** Backup archives in `/backups/` with checksums

---

#### `restore-*.sh` — Restore Validation & Safety
**Controls Implemented:**
- CP-2 (Restore validation and rollback safety)
- IR-1 (Incident response drill support)

**Before modifying:**
- [ ] Restore requires explicit confirmation (`FORCE_RESTORE=true`)
- [ ] Dry-run validation before actual restore
- [ ] Pre-restore and post-restore sanity checks
- [ ] Tested restoration doesn't corrupt data
- [ ] Audit logs present in restored data

**Evidence Location:** Restore validation logs + audit event capture

---

#### `audit-retention.sh` — Audit Log Retention & Archival
**Controls Implemented:**
- AU-3 (Immutable audit log retention)
- CP-1 (Archive to cold storage)

**Before modifying:**
- [ ] Retention period config matches policy
- [ ] Old events still archived to immutable location
- [ ] Archived events not deleted from production DB
- [ ] Archive verification checksums still work
- [ ] Tested that retention doesn't lose events

**Evidence Location:** Archive metadata file with dates and checksums

---

#### `generate-enterprise-evidence-pack.sh` — Release Evidence Assembly
**Controls Implemented:**
- DE-1 (Evidence artifact generation for release)
- IR-2 (Incident response templates)

**Before modifying:**
- [ ] Evidence pack includes all required fields
- [ ] Release metadata (tag, date, sign-off) captured
- [ ] Policy/compliance matrix included
- [ ] Evidence paths correct and accessible
- [ ] Package structure validated

**Evidence Location:** `docs/enterprise/evidence/` directory structure

---

### 📁 .github/workflows/ (CI/Release Gates)

#### `validate-evidence-pack.yml` — Release Gate
**Controls Implemented:**
- DE-2 (Release evidence validation)
- IR-1 (Incident response readiness check)

**Before modifying:**
- [ ] Gate still triggers on semantic version tags
- [ ] Gate fails if evidence pack incomplete
- [ ] All control evidence paths validated
- [ ] Tested by tagging a release and verifying gate runs

**Evidence Location:** Workflow validation output in GitHub Actions logs

---

### 📁 Configuration Files

#### `dashboard/next.config.js` — Security Headers (SC-1)
**Security Headers Set:**
- HSTS (Strict-Transport-Security)
- X-Frame-Options (clickjacking protection)
- X-Content-Type-Options: nosniff
- Content-Security-Policy (XSS protection)

**Before modifying:**
- [ ] All headers still present
- [ ] No debug modes enabled
- [ ] CSP doesn't weaken restrictions
- [ ] Tested in browser DevTools

---

#### `middleware.ts` — Auth Middleware & Session (AC-2, SC-1)
**Controls Implemented:**
- AC-2 (Session validation and timeout)
- AC-1 (Auth redirect on failed session)

**Before modifying:**
- [ ] Session check still blocks unauthenticated access
- [ ] Auth redirect still works
- [ ] Session timeout config respected
- [ ] No bypass paths created

---

#### `docker-compose.yml` — Infrastructure Configuration (SC-2, CP-1)
**Security Aspects:**
- PostgreSQL volume with backup strategy
- Redis cluster configuration
- Service network isolation
- Environment variable management

**Before modifying:**
- [ ] Database persistence still configured
- [ ] Services not exposed unintentionally
- [ ] Backup volumes still mounted
- [ ] Production baseline still valid

---

### 📁 docs/enterprise/ (Policy & Runbooks)

#### `INCIDENT_RESPONSE_RUNBOOK.md` — Incident Response (IR-1)
**Controls Implemented:**
- IR-1 (Incident response procedures)
- IR-2 (Evidence artifact templates)

**Before modifying:**
- [ ] Severity levels and escalation clear
- [ ] Role responsibilities defined
- [ ] Evidence collection templates present
- [ ] Tested in tabletop exercise

---

#### `COMPLIANCE_CONTROL_MATRIX.md` — Status & Evidence Paths (Master Reference)
**Controls Implemented:**
- All 16 controls tracked and linked

**Before modifying:**
- [ ] Update when implementing new controls
- [ ] Update evidence paths as they change
- [ ] Mark status as Planned/In Progress/Implemented/Verified
- [ ] Link to evidence directories

---

## Change Impact Matrix

**When you modify this file...** → **Check these controls & files:**

| File Modified | Check These Controls | Related Files |
|---------------|---------------------|---------------|
| `dashboard/lib/auth.ts` | AC-1, AC-3 | `permissions.ts`, all `api/**/route.ts` |
| `dashboard/lib/permissions.ts` | AC-3, AC-4 | `audit.ts`, all `api/**/route.ts` |
| `dashboard/app/api/**/route.ts` | AC-3, AU-1 | `permissions.ts`, `audit.ts` |
| `dashboard/lib/prisma.ts` | AU-2, AU-1 | `schema.prisma`, audit retention script |
| `middleware.ts` | AC-2, SC-1 | `auth.ts`, `next.config.js` |
| `scripts/ops/backup-*.sh` | CP-1, AU-2 | `docker-compose.yml`, audit table |
| `scripts/ops/restore-*.sh` | CP-2, IR-1 | Incident response runbook |
| `.github/workflows/validate-evidence-pack.yml` | DE-2, IR-1 | Evidence generation script |
| `docker-compose.yml` | SC-2, CP-1 | Infrastructure security, backup config |
| `next.config.js` | SC-1 | Security headers validation |

---

## Testing Checklist by Control

### AC-1: OIDC/SSO
```bash
# Test SSO login flow works end-to-end
# Verify roles assigned correctly
# Check audit log captures permission grants
```

### AC-3: RBAC Enforcement
```bash
# Test unauthorized user gets 403 on protected route
# Test authorized user gets 200
# Verify permission check uses correct permission level
```

### AU-1: Audit Logging
```bash
# Make a data change (create/update/delete)
# Verify audit event appears in immutable_audit_log
# Check event includes actor, action, timestamp, target
```

### AU-2: Immutability
```bash
# Try to UPDATE an audit log row: should fail
# Try to DELETE an audit log row: should fail
# Verify error message is clear
```

### CP-1/CP-2: Backup & Restore
```bash
# Run backup script
# Verify backup file created with checksum
# Stop services
# Run restore script with dry-run
# Verify restored data matches original
# Start services and verify they work
```

### DE-2: Release Gates
```bash
# Tag a release: git tag -a v1.0.0
# Push tag: git push origin v1.0.0
# Watch CI gate run
# Verify gate passes/fails based on evidence completeness
```

---

## Questions by Role

### For Feature Developers
**Q: I'm adding a new user-facing API. What compliance do I need?**
A: Add RBAC check with `requireProjectDataAccess()` + audit log with `logAuditEvent()`. See AC-3 and AU-1 sections above.

**Q: How do I know what permission to use?**
A: Check `dashboard/lib/permissions.ts` for options. If adding new permission, coordinate with IAM Lead.

**Q: My change doesn't touch any of these files, am I good?**
A: Probably yes, but check the Change Impact Matrix above. When in doubt, run `bash scripts/compliance/pre-commit-check.sh`.

### For Platform/Ops
**Q: I'm updating the backup script. What do I need to test?**
A: Backup creation, checksum validation, and restore dry-run. See CP-1 testing section.

**Q: Should I rotate the audit log retention?**
A: Yes, monthly. Use `scripts/ops/audit-retention.sh` to archive and prune.

**Q: We're doing a disaster recovery drill. What's the process?**
A: See `docs/enterprise/INCIDENT_RESPONSE_RUNBOOK.md` and use `scripts/ops/restore-*.sh --dry-run`.

### For Security/Audit
**Q: How do I verify a control is implemented?**
A: Check the compliance matrix for status and evidence path. Extract and review evidence.

**Q: We found a permission granted to wrong user. How do we audit?**
A: Query `immutable_audit_log.permission_grant` events. Use `scripts/ops/extract-control-evidence-AC4.sh`.

**Q: Can audit logs be modified or deleted?**
A: No, Prisma middleware in `dashboard/lib/prisma.ts` prevents all updates and deletes on the audit log table.

---

## Compliance-as-Code Verification

Run these commands to verify control implementations:

```bash
# Check RBAC in all API routes
grep -r "requireProjectDataAccess\|hasPermission" dashboard/app/api/ | wc -l
# Should be non-zero

# Check audit logging in sensitive routes
grep -r "logAuditEvent" dashboard/app/api/ | wc -l
# Should match number of write/delete/update operations

# Check immutability middleware is present
grep -A 10 "isAuditLogModel\|UPDATE.*audit" dashboard/lib/prisma.ts
# Should show middleware guarding against updates

# Check security headers are set
grep -E "HSTS|CSP|X-Frame|X-Content" dashboard/next.config.js
# Should show multiple security headers

# Check backup scripts have checksum validation
grep -E "sha256|checksum|verify" scripts/ops/backup-*.sh
# Should show checksum validation present
```

---

**When in doubt:** Read [COMPLIANCE_FRAMEWORK.md](../../COMPLIANCE_FRAMEWORK.md) and use the [Quick Checklist](COMPLIANCE_CHECKLIST.md). Escalate to Security Lead if unsure.
