# Adding New Compliance Controls

**Goal:** Incrementally add compliance controls to the codebase without disrupting existing functionality. Each control is independently testable and auditable.

---

## 5-Step Process

### Step 1: Define the Control

Document what you're implementing in the compliance matrix:

```markdown
| Control | Domain | Description | Owner | Status | Evidence Path | Target |
|---------|--------|-------------|-------|--------|----------------|--------|
| NEW-1 | [Domain] | [What it does] | [Owner] | Planned | [Path to evidence] | v1.1.0 |
```

Example:
```markdown
| CA-1 | Configuration Audit | API configuration changes logged | Platform Lead | Planned | docs/enterprise/controls/CA-1.md | v1.1.0 |
```

### Step 2: Create a Control Document

File: `docs/enterprise/controls/[CONTROL-ID].md`

```markdown
# CA-1: API Configuration Audit

**Scope:** All configuration modifications to deployed APIs

**Requirement:** Every configuration change must be logged with:
- Timestamp
- Actor (who made the change)
- What changed (field + old/new values)
- Approval status

**Implementation:**
- Location: dashboard/app/api/settings/route.ts
- Evidence: Audit log entries in immutable_audit_log table
- Validation: Monthly log export with sample review

**Evidence Collection:**
```bash
# Run this to generate evidence
scripts/ops/extract-control-evidence.sh CA-1 <start-date> <end-date>
```

**Acceptance Criteria:**
- [ ] Configuration change endpoint logs audit event
- [ ] Audit events include actor, timestamp, old/new values
- [ ] Cannot update/delete audit events (immutable)
- [ ] Evidence can be extracted cleanly

**Timeline:** [When this control is expected to be complete]
```

### Step 3: Implement the Control

Add the necessary code. Use this template:

**For Audit Logging:**

```typescript
// dashboard/app/api/config/route.ts
import { logAuditEvent } from '@/lib/audit'

export async function PATCH(req: Request) {
  const auth = await requireProjectDataAccess({
    projectId,
    requiredPermission: 'ORG_MANAGE'
  })
  if (auth instanceof NextResponse) return auth

  const { oldConfig, newConfig } = await req.json()
  const changedFields = Object.keys(newConfig).filter(
    key => newConfig[key] !== oldConfig[key]
  )

  // Log the change (CA-1 evidence)
  await logAuditEvent({
    action: 'update_api_config',
    status: 'success',
    actor: auth.user.id,
    target: { type: 'api_config', id: apiId },
    metadata: {
      changedFields,
      oldValues: oldConfig,
      newValues: newConfig
    }
  })

  return NextResponse.json({ success: true })
}
```

**For Access Control:**

```typescript
// Add permission constant
export const PERMISSIONS = {
  // ... existing ...
  CONFIG_MANAGE: {
    name: 'CONFIG_MANAGE',
    description: 'Manage API configuration',
    owner: 'ORG_ADMIN' // Only org admins can grant
  }
}

// Use in route
const auth = await requireProjectDataAccess({
  projectId,
  requiredPermission: 'CONFIG_MANAGE'
})
```

### Step 4: Create Evidence Extraction Script

File: `scripts/ops/extract-control-evidence-[CONTROL-ID].sh`

```bash
#!/bin/bash
# Extracts evidence for control CA-1

CONTROL_ID="CA-1"
START_DATE="${1:-$(date -d '30 days ago' +%Y-%m-%d)}"
END_DATE="${2:-$(date +%Y-%m-%d)}"
OUTPUT_DIR="docs/enterprise/evidence/$CONTROL_ID"

mkdir -p "$OUTPUT_DIR"

# Export audit logs for config changes
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c \
  "SELECT created_at, actor_id, action, target, metadata 
   FROM immutable_audit_log 
   WHERE action = 'update_api_config' 
   AND created_at BETWEEN '$START_DATE' AND '$END_DATE'
   ORDER BY created_at DESC" \
  > "$OUTPUT_DIR/audit_log_export_${START_DATE}_to_${END_DATE}.csv"

# Create summary
echo "Evidence for $CONTROL_ID extracted to $OUTPUT_DIR"
echo "Date Range: $START_DATE to $END_DATE"
echo "Total events: $(wc -l < "$OUTPUT_DIR"/*.csv)"
```

### Step 5: Add to Release Evidence Pack

Update `.github/workflows/validate-evidence-pack.yml`:

```yaml
- name: Validate Control Evidence - CA-1
  run: |
    if [ -f "docs/enterprise/evidence/CA-1/audit_log_export.csv" ]; then
      echo "✓ CA-1 evidence present"
      lines=$(wc -l < "docs/enterprise/evidence/CA-1/audit_log_export.csv")
      [ $lines -gt 1 ] || (echo "✗ CA-1 evidence empty" && exit 1)
    else
      echo "⚠ CA-1 evidence not ready (acceptable for pre-release)"
    fi
```

---

## Incremental Implementation Strategy

### Phase 1: Infrastructure (Foundation)
- Audit logging middleware
- Immutable audit tables
- RBAC framework
- Security headers

### Phase 2: Core Controls (Operational)
- Session security
- API configuration audit
- Permission grant tracking
- Backup/restore automation

### Phase 3: Advanced Controls (Governance)
- Incident response runbooks
- Supply chain tracking (SBOM, image signing)
- Encryption key audit
- Formal approval workflows

### Phase 4: Formal Audit (Certification-Ready)
- Third-party validation
- Formal certifications (SOC2, FedRAMP)
- Continuous monitoring

---

## Testing a New Control

Before marking as "Implemented":

### 1. Manual Verification
```bash
# Can you trigger the control and see evidence?
bash scripts/ops/extract-control-evidence-CA-1.sh
ls -la docs/enterprise/evidence/CA-1/
```

### 2. Evidence Extraction
```bash
# Does the evidence script work without errors?
bash scripts/ops/extract-control-evidence-CA-1.sh 2024-01-01 2024-01-31
# Check output is populated
```

### 3. CI Gate Validation
```bash
# Tag a release and verify gate validates this control
git tag -a v1.1.0 -m "Release with CA-1"
git push origin v1.1.0
# Watch: CI gate runs and validates CA-1 evidence
```

### 4. Evidence Sign-Off
Update control document:
```markdown
**Verified:** 2026-04-01 by [Owner Name]
**Evidence:** docs/enterprise/evidence/CA-1/audit_log_export_2024-01-01_to_2024-01-31.csv
**Finding:** ✓ 47 configuration changes logged, all with timestamps and actor IDs
```

---

## Compliance Matrix Update

Once control is implemented and verified:

**Before:**
```markdown
| CA-1 | Configuration Audit | [Description] | Platform Lead | **Planned** | dashb/app/api/... | v1.1.0 |
```

**After:**
```markdown
| CA-1 | Configuration Audit | [Description] | Platform Lead | **Implemented** | docs/enterprise/evidence/CA-1/ | v1.1.0 |
```

---

## Dependency Management

Some controls depend on others. Map dependencies:

```
Session Security (CS-1)
  ├── RBAC Framework (AC-1)
  └── Audit Logging (AU-1)

Incident Response (IR-1)
  └── Audit Logging (AU-1)
  └── Backup/Restore (CP-2)

Release Evidence Gate (RG-1)
  ├── Audit Logging (AU-1)
  ├── Evidence Packaging (EV-1)
  └── CI Validation (CD-1)
```

**Rule:** Don't mark a control implemented until its dependencies are done.

---

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Control needs refactoring mid-implementation | Document blocker in matrix, update timeline |
| Evidence extraction script fails | Add safety checks, test with sample data first |
| Control works but doesn't feel complete | Map against regulatory requirement, adjust scope |
| Forgot to add evidence to CI gate | Add validation step before tagging release |
| Evidence grows too large | Rotate old evidence, compress, archive |

---

## Questions?

- **What's a good first control?** → Session timeout or API rate limiting (clear, contained, testable)
- **How long does a control take?** → Simple (1 day), medium (3 days), complex (1 week)
- **Can I implement multiple controls in parallel?** → Yes, if independent. Coordinate if sharing dependencies.
- **What if a control is too big?** → Break it into sub-controls (e.g., "Audit Logging" → "API Audit", "Permission Audit", "Configuration Audit")

---

**Next Control to Implement?**

Reference the [COMPLIANCE_CONTROL_MATRIX.md](COMPLIANCE_CONTROL_MATRIX.md) and pick the highest-priority "Planned" item.

Then follow the 5-step process above. Done! That's one more control operational, one more step closer to production readiness.
