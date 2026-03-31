#!/bin/bash

# Stop local development servers to free up ports for Docker

echo "🛑 Stopping local servers on ports 3000 and 3001..."

# Kill processes on port 3000 (dashboard)
if lsof -ti:3000 > /dev/null 2>&1; then
  echo "Killing process on port 3000..."
  lsof -ti:3000 | xargs kill -9
  echo "✅ Port 3000 freed"
else
  echo "ℹ️  No process on port 3000"
fi

# Kill processes on port 3001 (platform-api)
if lsof -ti:3001 > /dev/null 2>&1; then
  echo "Killing process on port 3001..."
  lsof -ti:3001 | xargs kill -9
  echo "✅ Port 3001 freed"
else
  echo "ℹ️  No process on port 3001"
fi

echo ""
echo "✅ Done! You can now run: docker-compose -f docker-compose.dev.yml up"

