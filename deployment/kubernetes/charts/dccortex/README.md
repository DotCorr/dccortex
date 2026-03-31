# DCCortex Helm Chart (Enterprise Mode)

This chart is the Kubernetes packaging baseline for enterprise self-host deployments.

## Current Scope

- Dashboard deployment/service
- Platform API deployment/service
- Ingress routing for dashboard and API

## Required Inputs

- Image repositories and tags
- Postgres secret reference (`postgres.passwordSecretName`)
- Domain and ingress class

## Validate

```bash
helm lint deployment/kubernetes/charts/dccortex
helm template dccortex deployment/kubernetes/charts/dccortex
```

## Install Example

```bash
helm upgrade --install dccortex deployment/kubernetes/charts/dccortex \
  --namespace dccortex --create-namespace \
  --set global.domain=dccortex.local
```
