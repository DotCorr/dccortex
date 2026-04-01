# Incident Response Runbook

Purpose: provide a deterministic response flow for security and availability incidents, with evidence capture required for enterprise releases.

## 1. Severity Model

- Sev-1: active security breach, major data exposure risk, or production outage affecting most users.
- Sev-2: major functional degradation, elevated error rates, or confirmed privilege abuse with contained scope.
- Sev-3: limited-scope production defect with workaround.
- Sev-4: low-risk operational issue or false positive requiring documentation only.

Escalation policy:
- Sev-1 and Sev-2 require immediate incident channel activation and timeline logging.
- Sev-1 requires executive notification and customer communication plan.

## 2. Roles and Ownership

- Incident Commander: owns coordination, decision log, and status updates.
- Security Lead: owns containment, evidence integrity, and threat assessment.
- Platform Lead: owns service mitigation, rollback, and recovery.
- Communications Lead: owns stakeholder/customer updates.
- Scribe: maintains timeline and evidence index during response.

## 3. Trigger Conditions

Start this runbook immediately when one of the following is observed:
- Unusual admin activity, privilege escalation, or unauthorized role changes.
- Repeated auth failures from abnormal sources.
- Unexpected data mutations or missing records.
- High-severity vulnerability with known exploitation path.
- Production outage breaching declared SLO/SLA threshold.

## 4. Response Workflow

1. Detect and Declare
- Open incident record with unique ID: INC-YYYYMMDD-HHMM.
- Set initial severity and assign Incident Commander.
- Create incident timeline document under docs/enterprise/evidence/<release-tag>/ops/incidents/.

2. Contain
- Isolate affected services, credentials, or user sessions.
- Disable risky admin workflows when needed.
- Snapshot critical logs and DB state before destructive fixes.

3. Investigate
- Confirm blast radius: users, orgs, projects, data types affected.
- Correlate audit logs, auth events, deployment history, and infra metrics.
- Preserve chain-of-custody notes for each evidence artifact.

4. Eradicate
- Remove root cause (credentials, malicious payload, vulnerable dependency, misconfig).
- Patch and redeploy with tracked commit SHA.
- Rotate impacted secrets/tokens.

5. Recover
- Validate service health and key business flows.
- Confirm backup integrity and restore readiness if data repair is required.
- Monitor for recurrence during enhanced watch window.

6. Post-Incident
- Complete postmortem within 5 business days.
- Define corrective actions with owner and due date.
- Link corrective actions to release gate evidence.

## 5. Evidence Checklist

Required evidence artifacts per incident:
- Incident timeline file with UTC timestamps.
- Audit log export for incident window.
- Access-control changes during incident window.
- Deployment and rollback logs.
- Recovery validation output and final severity rationale.
- Corrective action register with owner and deadline.

Store under:
- docs/enterprise/evidence/<release-tag>/ops/incidents/

## 6. Communication Templates

Internal status update:
- Incident ID:
- Current Severity:
- Customer Impact:
- Mitigation in Progress:
- Next Update Time (UTC):

Resolution summary:
- Root Cause:
- Duration:
- Data/Customer Impact:
- Corrective Actions:
- Owner Sign-off:

## 7. Readiness Drill

Run quarterly incident simulation and record:
- Time to detect.
- Time to contain.
- Time to recover.
- Runbook gaps identified.

Attach simulation output to release evidence under ops/incidents/drills/.
