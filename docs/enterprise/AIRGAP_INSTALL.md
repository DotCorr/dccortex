# Air-Gapped Installation Guide

Purpose: install and run the platform in an environment with no internet access.

## 1. Preconditions

- Offline network and target hosts prepared.
- Trusted transfer path available (signed media or secure artifact mirror).
- Operator has enterprise install bundle and checksums.

## 2. Build Air-Gap Bundle (Connected Environment)

Bundle must include:
- All required container images as tar archives.
- Compose files and environment templates.
- Helm chart package(s).
- Migration scripts and release docs.
- SBOM and signature metadata.

Example workflow:
1. Pull all release images by digest.
2. Export images using `docker save`.
3. Export Helm dependencies and chart package.
4. Package docs, scripts, and checksums.
5. Sign the final bundle manifest.

## 3. Verify Bundle Integrity (Offline Site)

Before import:
- Verify checksums.
- Verify signatures.
- Confirm bundle version and release tag.

Record verification output in release evidence.

## 4. Import Images and Artifacts

1. Load images into local registry or local runtime cache.
2. Update compose/helm values to point to local registry.
3. Import migration and seed artifacts.

## 5. Deploy Using Compose (Offline)

1. Copy `.env` template and set local values.
2. Start stack from local images only.
3. Run health checks.
4. Run initial admin bootstrap.

## 6. Deploy Using Helm (Offline)

1. Push chart and images to local internal repositories.
2. Install chart with internal registry references.
3. Validate ingress, TLS, and service health.
4. Run migration job and smoke tests.

## 7. Offline Operations

- Define process for patch bundles and emergency hotfix bundles.
- Maintain dependency mirror refresh process in connected staging environment.
- Keep offline vulnerability review process with imported scan data.

## 8. Air-Gap Validation Checklist

- [ ] No external network egress required at runtime.
- [ ] All images sourced from internal mirror/cache.
- [ ] Bootstrap and login succeed offline.
- [ ] Backup and restore validated offline.
- [ ] Upgrade and rollback validated offline.

## 9. Known Pitfalls

- Hidden external calls in package managers or telemetry SDKs.
- Runtime dependency on public certificate or identity endpoints.
- Incomplete image list for migration and job containers.

## 10. Required Evidence

Store under release evidence folder:
- Integrity verification logs.
- Import logs.
- Deployment logs.
- Offline smoke test output.

## 11. Air-Gap Bundle Manifest (Required)

Every bundle must include a machine-readable manifest file containing:

- Release tag and commit SHA.
- Image list with digest and archive filename.
- Helm chart versions and dependency digests.
- Checksums for all files.
- Signature metadata.

Recommended filename: `enterprise-bundle-manifest.json`.

## 12. Air-Gap Validation Phases

Validate in this order before customer delivery:

1. Bundle integrity and signature verification.
2. Image import into internal registry.
3. Fresh install on clean offline host/cluster.
4. Admin bootstrap and login.
5. Upgrade and rollback offline.
6. Backup and restore offline.

Mark bundle as release-ready only after all phases pass.
