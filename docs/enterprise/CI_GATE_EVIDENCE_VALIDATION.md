# Release Evidence Pack CI Gate (GitHub Actions)

## Overview

When a semantic release tag (e.g., `v1.0.0`, `v1.0.0-enterprise.1`) is pushed to the repository, the GitHub Actions workflow `validate-evidence-pack.yml` automatically runs to ensure all evidence pack artifacts are present and properly structured.

**This gate prevents incomplete releases from being published.**

## What the Workflow Validates

The CI gate checks:

1. ✓ Evidence pack directory exists: `docs/enterprise/evidence/<release-tag>/`
2. ✓ Required folder structure:
   - `security/` - TLS, SBOM, vulnerability scan references
   - `iam/` - OIDC validation, RBAC enforcement testing
   - `ops/` - Backup/restore drill reports, incident records
   - `release/` - Gate checklist and sign-off records
   - `ops/incidents/` - Incident templates and drill outputs
3. ✓ Required files exist:
   - `README.md` - Release metadata and folder layout documentation
   - `release/release-metadata.json` - Machine-readable release info (releaseTag, generatedAtUtc, branch, commitSha)
   - `release/gate-status-template.md` - Gate outcomes tracking with sign-off section
   - `security/security-artifacts-checklist.md` - Security artifacts tracking
   - `iam/iam-artifacts-checklist.md` - IAM/access control artifacts tracking
   - `ops/incidents/incident-template.md` - Incident response template
4. ✓ Gate status template completeness:
   - All 8 release gates (A-H) are present as section headers
   - Reviewer sign-off section is present (for manual reviewer coordination)
5. ✓ JSON metadata validity:
   - `release-metadata.json` is valid JSON
   - All required fields present: `releaseTag`, `generatedAtUtc`, `branch`, `commitSha`

## Workflow Trigger

**Trigger Pattern:** Any tag matching `v[0-9]+.[0-9]+.[0-9]+*`

Examples that trigger the workflow:
- `v1.0.0`
- `v1.0.0-enterprise.1`
- `v1.0.0-rc.1`
- `v2.3.45-alpha`

## Release Process with This Gate

### Step 1: Generate Evidence Pack (Before Tagging)

Before you create the release tag, generate the evidence pack:

```bash
RELEASE_TAG="v1.0.0"
scripts/ops/generate-enterprise-evidence-pack.sh "$RELEASE_TAG"
git add docs/enterprise/evidence/"$RELEASE_TAG"/
git commit -m "chore: add evidence pack for $RELEASE_TAG"
git push origin feature-branch  # Complete your PR first
```

### Step 2: Tag the Release (Triggers CI Gate)

Once your PR is merged to the release branch, create the tag:

```bash
git tag -a v1.0.0 -m "Release v1.0.0: [feature summary]"
git push origin v1.0.0
```

This push triggers the `validate-evidence-pack` workflow.

### Step 3: Monitor CI Gate

The workflow automatically runs and validates the evidence pack structure. In GitHub:

1. Go to your repository → **Actions** tab
2. Find the **Validate Enterprise Evidence Pack** workflow
3. Watch for ✅ (pass) or ❌ (fail)
4. Review the run summary for detailed validation results

### Step 4A: If CI Gate Passes ✅

The release can proceed to publication. Evidence pack is ready for reviewers and auditors.

### Step 4B: If CI Gate Fails ❌

The workflow output includes troubleshooting instructions. Common failures:

**Cause:** Evidence pack directory doesn't exist
```bash
# Fix: Generate evidence pack if not yet created
scripts/ops/generate-enterprise-evidence-pack.sh v1.0.0

# Add and re-tag
git add docs/enterprise/evidence/v1.0.0/
git commit -m "chore: add missing evidence pack for v1.0.0"
git push origin feature-branch

# Delete old tag and re-create
git tag -d v1.0.0
git push origin :v1.0.0  # Delete from remote
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

**Cause:** Required files missing from evidence pack
```bash
# Fix: Regenerate evidence pack (idempotent operation)
scripts/ops/generate-enterprise-evidence-pack.sh v1.0.0

# Commit and update tag
git add docs/enterprise/evidence/v1.0.0/
git commit --amend --no-edit
git push origin feature-branch --force
git push origin v1.0.0 --force
```

**Cause:** Gate status template structure invalid
```bash
# Check the template structure
cat docs/enterprise/evidence/v1.0.0/release/gate-status-template.md

# The template must include all 8 gates (A-H) and sign-off section
# Regenerate to reset to baseline
scripts/ops/generate-enterprise-evidence-pack.sh v1.0.0 --force
```

## Evidence Pack Population Workflow

After the CI gate passes, teams populate evidence:

```
docs/enterprise/evidence/v1.0.0/
├── README.md                              ← Auto-generated metadata
├── security/
│   ├── security-artifacts-checklist.md    ← Checklist template
│   ├── sbom.json                          ← Add: Software bill of materials
│   ├── vulnerability-scan.json            ← Add: Vuln scanner output
│   └── image-signature-verification.txt   ← Add: Image signing proof
├── iam/
│   ├── iam-artifacts-checklist.md         ← Checklist template
│   ├── oidc-validation.txt                ← Add: OIDC login test runs
│   ├── rbac-enforcement-test.json         ← Add: Permission denial tests
│   └── access-denied-paths.json           ← Add: Expected 403 responses
├── ops/
│   ├── restore-drill-latest.txt           ← Auto-populated if drill exists
│   └── incidents/
│       ├── incident-template.md           ← Template
│       ├── incident-2026-04-02.md         ← Add: Real incident records
│       └── drills/
│           └── incident-readiness-2026-04.json  ← Add: Drill results
└── release/
    ├── release-metadata.json              ← Auto-generated
    ├── gate-status-template.md            ← Fill in gate statuses
    ├── gate-a-bootstrap.md                ← Add: Gate assessment details
    ├── gate-b-upgrade.md                  ← Add: Upgrade test results
    ├── gate-c-security.md                 ← Add: Security assessment
    ├── gate-d-identity.md                 ← Add: IAM assessment
    ├── gate-e-audit.md                    ← Add: Observability validation
    ├── gate-f-backup.md                   ← Add: Recovery validation
    ├── gate-g-airgap.md                   ← Add: Air-gap readiness
    └── gate-h-documentation.md            ← Add: Docs and support materials
```

## Gate Status Template Format

The `release/gate-status-template.md` file guides release sign-off:

```markdown
# Release Gate Status

- Gate A Install and Bootstrap: PENDING
- Gate B Upgrade and Rollback: PENDING
- Gate C Security Baseline: PENDING
- Gate D Identity and Access: PENDING
- Gate E Audit and Observability: PENDING
- Gate F Backup and Recovery: PENDING
- Gate G Air-Gapped Readiness: PENDING
- Gate H Documentation and Support: PENDING

## Reviewer Sign-off

- Security Lead: _______________ (signature/date)
- Ops Lead: _______________ (signature/date)
- IAM Lead: _______________ (signature/date)
- Release Manager: _______________ (signature/date)
```

Each team fills in their gate status and evidence location. Statuses progress: `PENDING` → `IN_REVIEW` → `APPROVED` → `SIGNED_OFF`.

## Integration with Release Contract

This CI gate operationalizes the **Release Contract** gates:

| Gate | Evidence Location | Team Owner |
|------|------------------|-----------|
| A. Install & Bootstrap | `release/gate-a-bootstrap.md` | Release Manager |
| B. Upgrade & Rollback | `release/gate-b-upgrade.md` | Ops Lead |
| C. Security Baseline | `security/` folder | Security Lead |
| D. Identity & Access | `iam/` folder | IAM Lead |
| E. Audit & Observability | `ops/` folder | Platform Lead |
| F. Backup & Recovery | `ops/restore-drill-latest.txt` | Ops Lead |
| G. Air-Gapped Readiness | `release/gate-g-airgap.md` | Ops Lead |
| H. Documentation & Support | `release/gate-h-documentation.md` | Product Manager |

## Workflow Output Summary

The workflow generates a GitHub Actions summary with:

- Release tag and validation timestamp
- Validation results (5 checks)
- Next steps for evidence population
- Links to evidence pack directories

Example summary:
```
## Evidence Pack Validation Report

Release Tag: v1.0.0
Timestamp: 2026-04-02T10:30:00Z

### Validation Results

✓ Evidence pack directory structure validated
✓ All required folders present
✓ All required files present
✓ Gate status template valid
✓ Release metadata valid

### Next Steps

1. Review release gate evidence structure at: docs/enterprise/evidence/v1.0.0/
2. Populate gate-status-template.md with gate outcomes
3. Attach supporting evidence files to each gate folder
4. Collect reviewer sign-offs
```

## Failure Handling

If the CI gate fails, the workflow provides explicit fix instructions. The workflow exit code is non-zero, preventing downstream release processes from starting (if you have additional steps that depend on this workflow).

To skip or override (not recommended for compliance):
```bash
# This requires workflow approval if GitHub has branch protections
# in place for release branches. It's better to fix the evidence pack
# and re-tag.
```

## Automation Integration (Future)

This gate can be extended to:

- **Slack notifications:** Post to #releases Slack channel on pass/fail
- **Release notes linking:** Auto-generate release notes with evidence pack reference
- **Evidence signing:** Require cryptographic signature of gate-status-template.md by team leads
- **Third-party audit:** Upload evidence pack to external compliance system (e.g., AuditBoard)

## Questions & Troubleshooting

**Q: Can I generate the evidence pack multiple times for the same release?**
A: Yes, `generate-enterprise-evidence-pack.sh` is idempotent. It overwrites baseline files but preserves any evidence files you've added to the folders.

**Q: What if I need to fix evidence after tagging?**
A: Update the files in `docs/enterprise/evidence/<tag>/`, commit, and force-push the tag:
```bash
git add docs/enterprise/evidence/v1.0.0/
git commit --amend --no-edit
git push origin v1.0.0 --force
```

**Q: How long does the workflow take?**
A: Typically 10-15 seconds; it's a read-only validation, no compilation or tests.

**Q: Can multiple releases run validation in parallel?**
A: Yes; each tag is independently validated so multiple release tags can be created simultaneously without conflicts.

## Related Documentation

- [Release Contract](../../RELEASE_CONTRACT.md) - Gate definitions and reviewers
- [Enterprise README](../README.md) - Evidence pack generation workflow
- [Incident Response Runbook](../INCIDENT_RESPONSE_RUNBOOK.md) - Incident evidence requirements
- [scripts/ops README](../../scripts/README.md) - Backup/restore and evidence automation
