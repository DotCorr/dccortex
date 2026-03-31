#!/bin/bash

# DCCortex Production Startup Script
# This script starts all services except the frontend (which should be started manually)

set -e

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "🚀 Starting DCCortex Production Services..."

# Check if .env file exists, create from .env.example or create default
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "✅ Created .env from .env.example"
  else
    # Create default .env
    cat > .env << 'EOF'
# Database
POSTGRES_USER=dccortex
POSTGRES_PASSWORD=dccortex_dev
POSTGRES_DB=dccortex_dashboard
POSTGRES_PORT=5432

# Platform API
PLATFORM_API_PORT=3001
PLATFORM_API_DOMAIN=api.localhost
NODE_ENV=production

# Frontend
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:3001

# Docker
DOMAIN=localhost
DOCKER_NETWORK=dccortex_default

# Traefik
TRAEFIK_HTTP_PORT=80
TRAEFIK_HTTPS_PORT=443
TRAEFIK_DASHBOARD_PORT=8080
TRAEFIK_DOMAIN=traefik.localhost

# AI APIs (update these)
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# Database URL
DATABASE_URL=postgresql://dccortex:dccortex_dev@postgres:5432/dccortex_dashboard
EOF
    echo "✅ Created default .env file"
  fi
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Stop any existing containers (but keep user org containers running)
echo "🛑 Stopping compose-managed containers..."
docker-compose stop 2>/dev/null || true
docker-compose rm -f 2>/dev/null || true

# Ensure network exists (create if it doesn't, use existing if it does)
echo "🌐 Ensuring network exists..."
if ! docker network inspect dccortex_default > /dev/null 2>&1; then
  docker network create dccortex_default --driver bridge
  echo "✅ Created dccortex_default network"
else
  echo "✅ Using existing dccortex_default network"
fi

# Start Docker services (postgres, platform-api, traefik)
echo "📦 Starting Docker services..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check platform-api health
echo "🏥 Checking platform-api health..."
for i in {1..30}; do
  if command -v curl > /dev/null 2>&1; then
    if curl -f http://localhost:${PLATFORM_API_PORT:-3001}/health > /dev/null 2>&1; then
      echo "✅ Platform API is healthy"
      break
    fi
  elif command -v wget > /dev/null 2>&1; then
    if wget --quiet --spider http://localhost:${PLATFORM_API_PORT:-3001}/health > /dev/null 2>&1; then
      echo "✅ Platform API is healthy"
      break
    fi
  else
    # Just check if container is running
    if docker-compose ps platform-api | grep -q "Up"; then
      echo "✅ Platform API container is running"
      break
    fi
  fi
  if [ $i -eq 30 ]; then
    echo "⚠️  Platform API health check timeout (container may still be starting)"
    echo "   Check logs with: docker-compose logs platform-api"
  fi
  sleep 2
done

# Check postgres health
echo "🏥 Checking PostgreSQL health..."
for i in {1..30}; do
  if docker-compose exec -T postgres pg_isready -U ${POSTGRES_USER:-dccortex} > /dev/null 2>&1; then
    echo "✅ PostgreSQL is healthy"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ PostgreSQL failed to start"
    exit 1
  fi
  sleep 2
done

echo ""
echo "✅ All backend services are running!"
echo ""
echo "📊 Services:"
echo "   - PostgreSQL: localhost:${POSTGRES_PORT:-5432}"
echo "   - Platform API: http://localhost:${PLATFORM_API_PORT:-3001}"
echo "   - Traefik Dashboard: http://localhost:${TRAEFIK_DASHBOARD_PORT:-8080}"
echo ""
echo "🎯 Next step: Start the frontend manually:"
echo "   cd dashboard && npm run dev"
echo ""

