#!/usr/bin/env bash
set -euo pipefail

echo "[Gate] Enterprise structure"
bash scripts/ci/verify-enterprise-structure.sh

echo "[Gate] Docker compose render"
docker compose -f docker-compose.yml config > /tmp/dccortex-compose.yml

echo "[Gate] Helm chart lint"
helm lint deployment/kubernetes/charts/dccortex

echo "[Gate] Dashboard install and quality"
pushd dashboard >/dev/null
npm ci
npm run lint
npm run type-check
npm run build
popd >/dev/null

echo "[Gate] Platform API install and build"
pushd platform-api >/dev/null
npm ci
npm run build
popd >/dev/null

echo "All automated enterprise release gates passed."
