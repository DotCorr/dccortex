# Helm Migration Plan (Enterprise Mode)

Purpose: migrate from Compose-based deployment to Kubernetes with Helm while keeping functional parity and rollback safety.

## 1. Migration Goals

- Preserve behavior between Compose and Helm deployments.
- Avoid breaking environment variable and config semantics.
- Provide clear rollback path at every phase.

## 2. Current State and Target State

Current state:
- Compose-based runtime for dashboard, platform API, postgres, redis.

Target state:
- Helm chart(s) deploying stateless services and optional stateful dependencies.
- Traefik (or approved ingress controller) managed in Kubernetes.

## 3. Non-Negotiable Design Rules

- One source of truth for app config keys.
- Secret values never stored in chart defaults.
- Every chart value has documented default and security notes.
- Migrations run as controlled jobs with idempotency checks.

## 4. Phased Delivery

### Phase 1: Packaging Parity
- Define chart structure and values schema.
- Render manifests for app services only.
- Validate config parity against Compose.

Exit criteria:
- Chart renders without manual edits.
- Service startup parity in test environment.

### Phase 2: Stateful Strategy
- Decide stateful ownership model:
  - Managed external DB/Redis preferred for enterprise.
  - In-cluster only when customer requires and accepts ops overhead.
- Implement persistence classes and backup integration if in-cluster.

Exit criteria:
- Data path documented.
- Backup and restore validated.

### Phase 3: Ingress and TLS
- Define ingress model and TLS management.
- Validate routing, auth callbacks, and public endpoints.

Exit criteria:
- End-to-end HTTPS works.
- Callback URLs verified.

### Phase 4: Upgrade and Rollback Controls
- Add chart versioning policy.
- Add pre-upgrade checks and post-upgrade smoke tests.
- Define rollback command and data rollback guidance.

Exit criteria:
- N-1 to N upgrade tested.
- Rollback tested.

### Phase 5: Air-Gap and Compliance
- Support private registry references.
- Provide offline chart/image bundle process.
- Integrate signature and SBOM policy checks.

Exit criteria:
- Air-gap install test passes.
- Compliance evidence package complete.

## 5. Helm Deliverables

Required chart deliverables:
- `Chart.yaml` and `values.yaml` with documented schema.
- Templates for Deployment/StatefulSet/Service/Ingress/ConfigMap/Secret refs.
- Optional migration Job templates.
- Example values files for:
  - Pilot.
  - Enterprise standard.
  - Air-gapped environment.

## 6. Validation Matrix

For each release candidate, validate:
- Install.
- Upgrade.
- Rollback.
- Backup restore.
- SSO login.
- RBAC enforcement.
- Audit event generation.

## 7. Risks and Mitigations

- Risk: config drift between Compose and Helm.
  - Mitigation: single env key registry and parity tests.
- Risk: migration job failure on upgrade.
  - Mitigation: preflight checks and dry-run strategy.
- Risk: ingress misconfiguration in customer clusters.
  - Mitigation: ingress compatibility matrix and tested defaults.

## 8. Definition of Helm GA

Helm enterprise mode can be marked GA only when:
- Install/upgrade/rollback tests are automated.
- Air-gap flow is documented and validated.
- Security controls from release contract are passing.
- Support team runbooks are complete.

## 9. Work Breakdown Structure (Execution)

Track these streams as separate epics:

- Chart foundation: chart skeleton, values schema, lint/test harness.
- Runtime services: dashboard + platform-api deployments/services/config.
- Stateful dependencies: external DB/Redis path plus optional in-cluster path.
- Ingress and TLS: ingress templates, cert strategy, callback URL validation.
- Release controls: upgrade hooks, rollback procedures, smoke tests.
- Enterprise constraints: air-gap registry support, signed artifacts, evidence output.

Each epic must define:

- Owner
- Acceptance tests
- Evidence artifacts
- Rollback impact

## 10. Helm GA Checklist

- [ ] Helm lint and template validation in CI.
- [ ] Install test in clean namespace.
- [ ] Upgrade N-1 -> N test.
- [ ] Rollback N -> N-1 test.
- [ ] External DB/Redis mode validated.
- [ ] Ingress + TLS + auth callback validated.
- [ ] Air-gap values and private registry validated.
- [ ] Ops runbook and support playbook approved.
