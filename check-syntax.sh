#!/bin/bash

# Syntax Checker Script
# Automatically checks for syntax errors in TypeScript/JavaScript files

set -e

echo "🔍 Checking syntax errors..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Check Dashboard (Next.js)
echo -e "\n${YELLOW}Checking Dashboard (Next.js)...${NC}"
cd dashboard
if npm run build --no-lint 2>&1 | grep -q "Failed to compile\|Syntax Error\|Expression expected"; then
    echo -e "${RED}❌ Syntax errors found in Dashboard${NC}"
    npm run build --no-lint 2>&1 | grep -A 5 "Failed to compile\|Syntax Error\|Expression expected" || true
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Dashboard syntax OK${NC}"
fi
cd ..

# Check Platform API (TypeScript)
echo -e "\n${YELLOW}Checking Platform API (TypeScript)...${NC}"
cd platform-api
if npx tsc --noEmit --skipLibCheck 2>&1 | grep -q "error TS"; then
    echo -e "${RED}❌ TypeScript errors found in Platform API${NC}"
    npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -10
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Platform API syntax OK${NC}"
fi
cd ..

# Check Compiler
echo -e "\n${YELLOW}Checking Compiler...${NC}"
cd compiler
if [ -f "tsconfig.json" ]; then
    if npx tsc --noEmit --skipLibCheck 2>&1 | grep -q "error TS"; then
        echo -e "${RED}❌ TypeScript errors found in Compiler${NC}"
        npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -10
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ Compiler syntax OK${NC}"
    fi
fi
cd ..

# Summary
echo -e "\n${YELLOW}=== Summary ===${NC}"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All syntax checks passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS project(s) with syntax errors${NC}"
    exit 1
fi




