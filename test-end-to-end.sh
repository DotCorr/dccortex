#!/bin/bash

# End-to-End Test Script for DCCortex

echo "🧪 DCCortex End-to-End Test"
echo "============================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if API is running
echo "1. Checking Platform API..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo -e "${GREEN}✅ Platform API is running${NC}"
else
    echo -e "${RED}❌ Platform API is not running${NC}"
    echo "   Start it with: docker-compose up"
    exit 1
fi
echo ""

# Test compilation
echo "2. Testing compilation..."
SCRIPT=$(cat <<'EOF'
model User {
  id: uuid primary
  email: string unique
  name: string
}

route GET /users {
  auth required
  @ai { Get all users from database }
}
EOF
)

RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/compile/compile \
  -H "Content-Type: application/json" \
  -d "{
    \"script\": $(echo "$SCRIPT" | jq -Rs .),
    \"projectName\": \"test-app\",
    \"userId\": \"test-user\",
    \"appId\": \"test-app\"
  }")

SUCCESS=$(echo "$RESPONSE" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
    echo -e "${GREEN}✅ Compilation successful${NC}"
    echo "$RESPONSE" | jq '.stats'
    
    # Check AI usage if available
    AI_USAGE=$(echo "$RESPONSE" | jq -r '.aiUsage // empty')
    if [ ! -z "$AI_USAGE" ]; then
        echo -e "${YELLOW}📊 AI Usage:${NC}"
        echo "$RESPONSE" | jq '.aiUsage'
    fi
else
    echo -e "${RED}❌ Compilation failed${NC}"
    echo "$RESPONSE" | jq '.errors'
    exit 1
fi
echo ""

# Test deployment
echo "3. Testing deployment..."
DEPLOY_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/apps/test-user/test-app/deploy \
  -H "Content-Type: application/json" \
  -d "{
    \"script\": $(echo "$SCRIPT" | jq -Rs .),
    \"projectName\": \"test-app\"
  }")

DEPLOY_SUCCESS=$(echo "$DEPLOY_RESPONSE" | jq -r '.success')

if [ "$DEPLOY_SUCCESS" = "true" ]; then
    URL=$(echo "$DEPLOY_RESPONSE" | jq -r '.url')
    echo -e "${GREEN}✅ Deployment successful${NC}"
    echo "   URL: $URL"
    echo ""
    echo "4. Add to /etc/hosts:"
    echo -e "${YELLOW}   echo \"127.0.0.1 test-user-test-app.localhost\" | sudo tee -a /etc/hosts${NC}"
    echo ""
    echo "5. Test app:"
    echo -e "${YELLOW}   curl $URL/health${NC}"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    echo "$DEPLOY_RESPONSE" | jq '.error'
    exit 1
fi
echo ""

# Test usage tracking
echo "6. Testing usage tracking..."
USAGE_RESPONSE=$(curl -s http://localhost:3001/api/v1/usage/test-user)

if echo "$USAGE_RESPONSE" | jq -e '.success' > /dev/null; then
    echo -e "${GREEN}✅ Usage tracking working${NC}"
    echo "$USAGE_RESPONSE" | jq '.stats'
else
    echo -e "${YELLOW}⚠️  Usage tracking not configured (AI API key missing)${NC}"
fi
echo ""

echo -e "${GREEN}✨ End-to-end test complete!${NC}"

