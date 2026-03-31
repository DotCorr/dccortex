#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
docker compose -f docker-compose.dev.yml build dashboard --no-cache
docker compose -f docker-compose.dev.yml up -d dashboard
