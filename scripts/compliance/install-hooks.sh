#!/bin/bash

# Installation: Add this to .git/hooks/pre-commit to run automatically before commits
# Run manually: bash scripts/compliance/pre-commit-check.sh

# Step 1: Make the script executable
chmod +x "$(dirname "$0")/pre-commit-check.sh"

# Step 2: Copy to git hooks (optional - automatic enforcement)
HOOKS_DIR="$(git rev-parse --git-dir)/hooks"
mkdir -p "$HOOKS_DIR"

cat > "$HOOKS_DIR/pre-commit" <<'EOF'
#!/bin/bash
# Auto-run compliance check before commit
scripts/compliance/pre-commit-check.sh
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "Compliance check failed. Either:"
  echo "  1. Fix the errors above, or"
  echo "  2. Run: git commit --no-verify (skip check, not recommended)"
  exit 1
fi
exit 0
EOF

chmod +x "$HOOKS_DIR/pre-commit"

echo "✓ Pre-commit hook installed"
echo "  Compliance check will run automatically before each commit"
echo "  Reference: bash scripts/compliance/pre-commit-check.sh"
