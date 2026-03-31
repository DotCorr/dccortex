#!/bin/bash

# GitHub Branch Protection Rules Setup Script
# Sets up branch protection for dev/main/staging with required status checks

set -e

# Configuration
GITHUB_OWNER="DotCorr"
GITHUB_REPO="dccortex"
BRANCHES=("dev" "main" "staging")

# Required status checks (must match exactly what GitHub Actions reports)
REQUIRED_CHECKS=(
  "Dashboard Lint/Type/Build"
  "Platform API Build"
  "Compose/Helm Static Checks"
  "Enterprise Docs/Policy Structure"
  "SBOM and Vulnerability Scans"
  "Gate Validation"
)

# Verify GitHub token is set
if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ Error: GITHUB_TOKEN environment variable not set"
  echo "   Set it with: export GITHUB_TOKEN=your_token_here"
  exit 1
fi

# Build required checks JSON array
CHECKS_JSON=$(printf '%s\n' "${REQUIRED_CHECKS[@]}" | jq -R . | jq -s .)

# Create protection rule payload
create_protection_payload() {
  cat <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": $CHECKS_JSON
  },
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "dismissal_restrictions": {
      "users": [],
      "teams": [],
      "apps": []
    }
  },
  "restrictions": {
    "users": [],
    "teams": [],
    "apps": []
  },
  "enforce_admins": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
}

echo "🔐 Setting up GitHub branch protection rules..."
echo "   Owner: $GITHUB_OWNER"
echo "   Repo: $GITHUB_REPO"
echo "   Branches: ${BRANCHES[@]}"
echo ""

PAYLOAD=$(create_protection_payload)

for BRANCH in "${BRANCHES[@]}"; do
  echo "📋 Configuring branch: $BRANCH"
  
  RESPONSE=$(curl -s -X PUT \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/$GITHUB_OWNER/$GITHUB_REPO/branches/$BRANCH/protection" \
    -d "$PAYLOAD")
  
  # Check for errors
  if echo "$RESPONSE" | jq -e '.message' &>/dev/null; then
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.message')
    echo "   ❌ Error: $ERROR_MSG"
    
    # Print full response for debugging
    if [ "$DEBUG" = "1" ]; then
      echo "   Response: $RESPONSE"
    fi
  else
    echo "   ✅ Branch protection rule created"
    
    # Extract and confirm settings
    REQUIRED_PR=$(echo "$RESPONSE" | jq -r '.required_pull_request_reviews.required_approving_review_count // "N/A"')
    ENFORCE_ADMINS=$(echo "$RESPONSE" | jq -r '.enforce_admins // "N/A"')
    FORCE_PUSH=$(echo "$RESPONSE" | jq -r '.allow_force_pushes // "N/A"')
    
    echo "   ├─ Require PR reviews: Yes (${REQUIRED_PR} approval)"
    echo "   ├─ Enforce on admins: $ENFORCE_ADMINS"
    echo "   ├─ Allow force pushes: $FORCE_PUSH"
    echo "   └─ Required checks: ${#REQUIRED_CHECKS[@]} checks"
  fi
  echo ""
done

echo "✨ Branch protection setup complete!"
echo ""
echo "⚠️  Note: Rules are configured but won't be enforced until your GitHub org"
echo "   upgrades to GitHub Team plan. Once upgraded, they auto-activate."
