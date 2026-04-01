#!/bin/bash

# Compliance Pre-Commit Validation Script
# Run: bash scripts/compliance/pre-commit-check.sh
# Purpose: Verify that changes maintain or improve compliance posture

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DASHBOARD_DIR="$ROOT_DIR/dashboard"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

FAILED=0
WARNINGS=0

echo -e "${BLUE}===== Compliance Pre-Commit Check =====${NC}\n"

# 1. Check for staged files in compliance-sensitive areas
echo -e "${BLUE}[1] Checking staged changes in compliance domains...${NC}"
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || echo "")

COMPLIANCE_DIRS=(
  "dashboard/lib/auth.ts"
  "dashboard/lib/permissions.ts"
  "dashboard/lib/prisma.ts"
  "dashboard/lib/audit.ts"
  "dashboard/app/api"
  "scripts/ops"
  ".github/workflows"
)

AFFECTED_COMPLIANCE=0
for file in $STAGED_FILES; do
  for dir in "${COMPLIANCE_DIRS[@]}"; do
    if [[ "$file" == *"$dir"* ]]; then
      echo -e "  ${YELLOW}⚠ Compliance domain affected: $file${NC}"
      AFFECTED_COMPLIANCE=1
    fi
  done
done

if [ $AFFECTED_COMPLIANCE -eq 1 ]; then
  echo -e "  ${YELLOW}→ Verify changes against COMPLIANCE_FRAMEWORK.md${NC}\n"
  ((WARNINGS++))
else
  echo -e "  ${GREEN}✓ No compliance domains in staged changes${NC}\n"
fi

# 2. Validate shell scripts
echo -e "${BLUE}[2] Validating shell scripts (syntax check)...${NC}"
SHELL_FILES=$(git diff --cached --name-only "*.sh" 2>/dev/null | grep -E "^scripts/.+\.sh$" || echo "")
if [ -n "$SHELL_FILES" ]; then
  while IFS= read -r file; do
    if [ -f "$ROOT_DIR/$file" ]; then
      if bash -n "$ROOT_DIR/$file" 2>/dev/null; then
        echo -e "  ${GREEN}✓ $file${NC}"
      else
        echo -e "  ${RED}✗ Syntax error in $file${NC}"
        ((FAILED++))
      fi
    fi
  done <<< "$SHELL_FILES"
  echo ""
fi

# 3. Check for RBAC gates in new API routes
echo -e "${BLUE}[3] Checking for RBAC gates in API routes...${NC}"
API_FILES=$(git diff --cached --name-only "dashboard/app/api" 2>/dev/null | grep "route.ts" || echo "")
if [ -n "$API_FILES" ]; then
  while IFS= read -r file; do
    if git diff --cached "$file" | grep -q "export async function"; then
      # Check if this is a new file or modification
      if git show ":$file" &>/dev/null; then
        # File exists in staging, check for RBAC guard
        if git show ":$file" | grep -qE "requireProjectDataAccess|hasPermission|auth\.protect"; then
          echo -e "  ${GREEN}✓ RBAC found in $file${NC}"
        else
          echo -e "  ${YELLOW}⚠ Consider adding RBAC gate to $file${NC}"
          ((WARNINGS++))
        fi
      fi
    fi
  done <<< "$API_FILES"
  echo ""
fi

# 4. Check for audit logging in sensitive operations
echo -e "${BLUE}[4] Checking for audit logging in data modification routes...${NC}"
SENSITIVE_OPS=$(git diff --cached "dashboard/app/api" 2>/dev/null | grep -E "METHOD.*POST|PUT|PATCH|DELETE" || echo "")
if [ -n "$SENSITIVE_OPS" ]; then
  if git diff --cached "dashboard/app/api" | grep -q "logAuditEvent"; then
    echo -e "  ${GREEN}✓ Audit logging found${NC}\n"
  else
    echo -e "  ${YELLOW}⚠ Consider adding logAuditEvent() for data modifications${NC}\n"
    ((WARNINGS++))
  fi
fi

# 5. Type check (if TypeScript files)
echo -e "${BLUE}[5] Running TypeScript type check...${NC}"
TS_FILES=$(git diff --cached --name-only "dashboard" 2>/dev/null | grep -E "\.(ts|tsx)$" || echo "")
if [ -n "$TS_FILES" ]; then
  if cd "$DASHBOARD_DIR" && npm run type-check 2>&1 | tail -5; then
    echo -e "  ${GREEN}✓ Type check passed${NC}\n"
  else
    echo -e "  ${RED}✗ Type check failed${NC}\n"
    ((FAILED++))
  fi
fi

# 6. Compliance matrix check
echo -e "${BLUE}[6] Compliance matrix status...${NC}"
if [ -f "$ROOT_DIR/docs/enterprise/COMPLIANCE_CONTROL_MATRIX.md" ]; then
  IMPLEMENTED=$(grep -c "Implemented" "$ROOT_DIR/docs/enterprise/COMPLIANCE_CONTROL_MATRIX.md" || echo "0")
  echo -e "  ${GREEN}✓ $IMPLEMENTED controls implemented${NC}\n"
else
  echo -e "  ${YELLOW}⚠ No compliance matrix found${NC}\n"
fi

# 7. Summary
echo -e "${BLUE}========================================${NC}"
if [ $FAILED -eq 0 ]; then
  if [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All compliance checks passed${NC}"
    echo -e "You're good to commit!\n"
    exit 0
  else
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) - review before committing${NC}"
    echo -e "Check COMPLIANCE_FRAMEWORK.md for guidance\n"
    exit 0
  fi
else
  echo -e "${RED}✗ $FAILED critical issue(s) found${NC}"
  echo -e "Please fix the errors above before committing\n"
  exit 1
fi
