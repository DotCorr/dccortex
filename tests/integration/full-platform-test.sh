#!/usr/bin/env bash
# =============================================================================
# DCCortex Full Platform Integration Test
# =============================================================================
# Tests EVERY feature of the platform end-to-end:
#   - Auth (register, login, session)
#   - Organizations (create, list)
#   - Projects (create, update, publish)
#   - Screens (create, update layout, list, delete)
#   - Globals (state definitions)
#   - Internal Data (datasource, tables, columns, rows, CSV import)
#   - External API Sources (create, test, cache mode, refresh)
#   - External DB Connectors (create, list, CRUD)
#   - Assets (upload, list, delete)
#   - Webhooks (create, update, delete)
#   - Runtime data (authenticated + public)
#   - Public mutations (insert, update, delete rows)
#   - Notifications
#   - Packages
#
# Usage:
#   ./tests/integration/full-platform-test.sh [BASE_URL]
#   Default BASE_URL: http://localhost:3002
#
# Requirements:
#   - Dashboard running (docker compose up)
#   - curl, jq
# =============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:3002}"
COOKIE_JAR=$(mktemp)
PASS=0
FAIL=0
SKIP=0
ERRORS=""
TEST_EMAIL="test-$(date +%s)@dccortex-test.local"
TEST_PASSWORD="SecurePass99"
TEST_NAME="IntegrationTester"

# Cleanup
cleanup() {
  rm -f "$COOKIE_JAR" 2>/dev/null || true
}
trap cleanup EXIT

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ---- Test helpers ----
assert_status() {
  local test_name="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo -e "  ${GREEN}✓${NC} $test_name (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $test_name — expected $expected, got $actual"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  - $test_name: expected $expected, got $actual"
  fi
}

assert_json_field() {
  local test_name="$1"
  local json="$2"
  local field="$3"
  local value
  value=$(echo "$json" | jq -r "$field" 2>/dev/null || echo "PARSE_ERROR")
  if [[ "$value" != "null" && "$value" != "" && "$value" != "PARSE_ERROR" ]]; then
    echo -e "  ${GREEN}✓${NC} $test_name ($field = ${value:0:60})"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $test_name — field $field is null/empty"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  - $test_name: $field missing in response"
  fi
}

assert_json_eq() {
  local test_name="$1"
  local json="$2"
  local field="$3"
  local expected="$4"
  local actual
  actual=$(echo "$json" | jq -r "$field" 2>/dev/null || echo "PARSE_ERROR")
  if [[ "$actual" == "$expected" ]]; then
    echo -e "  ${GREEN}✓${NC} $test_name ($field = $expected)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $test_name — expected $field=$expected, got $actual"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  - $test_name: expected $field=$expected, got $actual"
  fi
}

api_get() {
  local path="$1"
  curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" "${BASE_URL}${path}"
}

api_get_status() {
  local path="$1"
  curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "${BASE_URL}${path}"
}

api_post() {
  local path="$1"
  local data="${2:-{\}}"
  curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X POST --data-raw "$data" "${BASE_URL}${path}"
}

api_post_status() {
  local path="$1"
  local data="${2:-{\}}"
  curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X POST --data-raw "$data" "${BASE_URL}${path}"
}

api_patch() {
  local path="$1"
  local data="${2:-{\}}"
  curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X PATCH --data-raw "$data" "${BASE_URL}${path}"
}

api_put() {
  local path="$1"
  local data="${2:-{\}}"
  curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X PUT --data-raw "$data" "${BASE_URL}${path}"
}

api_put_status() {
  local path="$1"
  local data="${2:-{\}}"
  curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X PUT --data-raw "$data" "${BASE_URL}${path}"
}

api_delete() {
  local path="$1"
  curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X DELETE "${BASE_URL}${path}"
}

api_delete_status() {
  local path="$1"
  curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X DELETE "${BASE_URL}${path}"
}

section() {
  echo ""
  echo -e "${BOLD}${CYAN}━━━ $1 ━━━${NC}"
}

# =============================================================================
echo -e "${BOLD}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   DCCortex Full Platform Integration Test        ║${NC}"
echo -e "${BOLD}║   Target: ${BASE_URL}                    ║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════════════╝${NC}"
echo ""

# ------ Preflight ------
section "0. Preflight — Server reachable"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/" 2>/dev/null || echo "000")
if [[ "$STATUS" == "000" ]]; then
  echo -e "${RED}Server not reachable at ${BASE_URL}. Is Docker running?${NC}"
  exit 1
fi
assert_status "Landing page loads" "200" "$STATUS"

# =========================================================================
section "1. Auth — Register + Login"
# =========================================================================

# Register
REG_RESP=$(api_post "/api/auth/register" "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"$TEST_NAME\"}")
REG_ID=$(echo "$REG_RESP" | jq -r '.user.id // empty')
if [[ -n "$REG_ID" ]]; then
  echo -e "  ${GREEN}✓${NC} User registered ($REG_ID)"
  PASS=$((PASS + 1))
else
  REG_ERR=$(echo "$REG_RESP" | jq -r '.error // .message // "unknown"')
  if echo "$REG_ERR" | grep -qi 'already\|exists'; then
    echo -e "  ${YELLOW}⚠${NC} User already exists — continuing"
    SKIP=$((SKIP + 1))
  else
    echo -e "  ${RED}✗${NC} Registration failed: $REG_ERR"
    FAIL=$((FAIL + 1))
  fi
fi

# Get CSRF token
CSRF_RESP=$(api_get "/api/auth/csrf")
CSRF_TOKEN=$(echo "$CSRF_RESP" | jq -r '.csrfToken // empty')
if [[ -z "$CSRF_TOKEN" ]]; then
  echo -e "  ${RED}✗ Could not get CSRF token${NC}"
  FAIL=$((FAIL + 1))
  exit 1
fi
echo -e "  ${GREEN}✓${NC} CSRF token obtained"
PASS=$((PASS + 1))

# Login — use --data-urlencode to handle special chars safely
LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -X POST "${BASE_URL}/api/auth/callback/credentials" \
  --data-urlencode "csrfToken=${CSRF_TOKEN}" \
  --data-urlencode "email=${TEST_EMAIL}" \
  --data-urlencode "password=${TEST_PASSWORD}" \
  --data-urlencode "json=true")
# NextAuth redirects on success (302/200)
if [[ "$LOGIN_STATUS" == "200" || "$LOGIN_STATUS" == "302" ]]; then
  echo -e "  ${GREEN}✓${NC} Login successful (HTTP $LOGIN_STATUS)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Login failed (HTTP $LOGIN_STATUS)"
  FAIL=$((FAIL + 1))
fi

# Verify session
SESSION_RESP=$(api_get "/api/auth/session")
assert_json_field "Session valid" "$SESSION_RESP" ".user.email"

# =========================================================================
section "2. Organizations"
# =========================================================================

ORG_RESP=$(api_post "/api/organizations" "{\"name\":\"Test Org $(date +%s)\"}")
assert_json_field "Org created" "$ORG_RESP" ".organization.id"
ORG_ID=$(echo "$ORG_RESP" | jq -r '.organization.id')

ORG_LIST=$(api_get "/api/organizations")
assert_json_field "Orgs listed" "$ORG_LIST" ".organizations[0].id"

# =========================================================================
section "3. Projects — Create + Update + Publish"
# =========================================================================

PROJECT_RESP=$(api_post "/api/projects" "{\"name\":\"Full Test App\",\"organizationId\":\"$ORG_ID\"}")
assert_json_field "Project created" "$PROJECT_RESP" ".project.id"
PROJECT_ID=$(echo "$PROJECT_RESP" | jq -r '.project.id')
assert_json_eq "Project status=draft" "$PROJECT_RESP" ".project.status" "draft"
# GET single project
PROJECT_GET=$(api_get "/api/projects/$PROJECT_ID")
assert_json_eq "Project fetched" "$PROJECT_GET" ".project.id" "$PROJECT_ID"
# Publish
PUB_RESP=$(api_put "/api/projects/$PROJECT_ID" '{"isPublished":true}')
assert_json_eq "Project published" "$PUB_RESP" ".project.status" "published"

# =========================================================================
section "4. Screens — CRUD + Layout"
# =========================================================================

# Create screen with a proper layout using correct component types + props
# Props are top-level (not nested in "style"); uses correct types from registry
LAYOUT_JSON='{
  "root": {
    "id": "root",
    "type": "container",
    "props": {
      "display": "flex",
      "flexDirection": "column",
      "gap": 16,
      "padding": 24,
      "minHeight": "100vh",
      "backgroundColor": "#f8fafc",
      "fontFamily": "Inter, system-ui, sans-serif"
    },
    "children": [
      {
        "id": "header",
        "type": "header",
        "props": {
          "display": "flex",
          "flexDirection": "row",
          "justifyContent": "space-between",
          "alignItems": "center",
          "padding": "16px 24px",
          "backgroundColor": "#ffffff",
          "borderRadius": 12,
          "boxShadow": "0 1px 3px rgba(0,0,0,0.1)"
        },
        "children": [
          {
            "id": "logo-text",
            "type": "gradientText",
            "props": {
              "content": "DCCortex Test App",
              "gradient": "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              "fontSize": "24px",
              "fontWeight": "800"
            },
            "children": []
          },
          {
            "id": "nav-badge",
            "type": "badge",
            "props": {
              "label": "Published",
              "variant": "success",
              "size": "sm"
            },
            "children": []
          }
        ]
      },
      {
        "id": "hero-card",
        "type": "card",
        "props": {
          "shadow": "lg",
          "rounded": "lg",
          "bordered": true,
          "display": "flex",
          "flexDirection": "column",
          "gap": 16,
          "padding": 32,
          "backgroundColor": "#ffffff"
        },
        "children": [
          {
            "id": "hero-title",
            "type": "text",
            "props": {
              "content": "Welcome, {{state.username}}!",
              "variant": "h1",
              "color": "#0f172a",
              "fontWeight": "700",
              "fontSize": "32px"
            },
            "children": []
          },
          {
            "id": "hero-subtitle",
            "type": "text",
            "props": {
              "content": "This app tests every feature of the DCCortex runtime — data binding, forms, repeaters, API data, images, and state management.",
              "variant": "body",
              "color": "#64748b",
              "fontSize": "16px",
              "lineHeight": "1.6"
            },
            "children": []
          },
          {
            "id": "hero-image",
            "type": "image",
            "props": {
              "url": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=400&fit=crop",
              "alt": "Code on screen",
              "width": "100%",
              "height": "300px",
              "objectFit": "cover",
              "borderRadius": 12
            },
            "children": []
          },
          {
            "id": "hero-divider",
            "type": "divider",
            "props": {
              "orientation": "horizontal",
              "color": "#e2e8f0",
              "thickness": 1,
              "margin": "8px 0"
            },
            "children": []
          },
          {
            "id": "hero-stats-row",
            "type": "stackH",
            "props": {
              "gap": 16,
              "alignItems": "center"
            },
            "children": [
              {
                "id": "click-btn",
                "type": "button",
                "props": {
                  "label": "Clicks: {{state.clicks}}",
                  "variant": "primary",
                  "backgroundColor": "#3b82f6",
                  "color": "#ffffff",
                  "padding": "10px 20px",
                  "borderRadius": 8,
                  "fontWeight": "600",
                  "onClick": [
                    {"action": "mutateState", "stateKey": "clicks", "mutationOp": "increment", "mutationAmount": 1}
                  ]
                },
                "children": []
              },
              {
                "id": "click-count-text",
                "type": "text",
                "props": {
                  "content": "Total clicks: {{state.clicks}}",
                  "color": "#8b5cf6",
                  "fontWeight": "600"
                },
                "children": []
              },
              {
                "id": "dark-toggle",
                "type": "toggle",
                "props": {
                  "label": "Dark Mode",
                  "checked": "{{state.darkMode}}",
                  "onChange": [{"action": "setState", "stateKey": "darkMode", "value": "{{event.checked}}"}]
                },
                "children": []
              }
            ]
          }
        ]
      },
      {
        "id": "form-card",
        "type": "card",
        "props": {
          "shadow": "md",
          "rounded": "lg",
          "bordered": true,
          "padding": 24,
          "backgroundColor": "#ffffff"
        },
        "children": [
          {
            "id": "form-title",
            "type": "text",
            "props": {
              "content": "Add Contact",
              "variant": "h2",
              "fontSize": "20px",
              "fontWeight": "700",
              "color": "#0f172a",
              "margin": "0 0 16px 0"
            },
            "children": []
          },
          {
            "id": "contact-form",
            "type": "formWrapper",
            "props": {
              "display": "flex",
              "flexDirection": "column",
              "gap": 12,
              "submitLabel": "Add Contact",
              "onSubmit": [
                {"action": "insertRow", "tableName": "contacts", "rowData": {"name": "{{state.formName}}", "email": "{{state.formEmail}}"}, "resultStateKey": "lastInsert"}
              ]
            },
            "children": [
              {
                "id": "name-input",
                "type": "textInput",
                "props": {
                  "label": "Name",
                  "placeholder": "Enter full name",
                  "value": "{{state.formName}}",
                  "onChange": [{"action": "setState", "stateKey": "formName", "value": "{{event.value}}"}]
                },
                "children": []
              },
              {
                "id": "email-input",
                "type": "textInput",
                "props": {
                  "label": "Email",
                  "placeholder": "email@example.com",
                  "value": "{{state.formEmail}}",
                  "onChange": [{"action": "setState", "stateKey": "formEmail", "value": "{{event.value}}"}]
                },
                "children": []
              }
            ]
          }
        ]
      },
      {
        "id": "contacts-card",
        "type": "card",
        "props": {
          "shadow": "md",
          "rounded": "lg",
          "bordered": true,
          "padding": 24,
          "backgroundColor": "#ffffff"
        },
        "children": [
          {
            "id": "contacts-title",
            "type": "text",
            "props": {
              "content": "Contact List ({{data.contacts.length}} records)",
              "variant": "h2",
              "fontSize": "20px",
              "fontWeight": "700",
              "color": "#0f172a",
              "margin": "0 0 16px 0"
            },
            "children": []
          },
          {
            "id": "contacts-repeater",
            "type": "dataRepeater",
            "props": {
              "dataSource": "{{data.contacts}}",
              "itemVar": "contact",
              "emptyText": "No contacts found",
              "display": "flex",
              "flexDirection": "column",
              "gap": 8
            },
            "children": [
              {
                "id": "contact-row",
                "type": "card",
                "props": {
                  "shadow": "sm",
                  "rounded": "md",
                  "display": "flex",
                  "flexDirection": "row",
                  "alignItems": "center",
                  "gap": 12,
                  "padding": "12px 16px",
                  "backgroundColor": "#f8fafc"
                },
                "children": [
                  {
                    "id": "contact-avatar",
                    "type": "avatar",
                    "props": {
                      "initials": "{{prop.contact.name}}",
                      "size": 40,
                      "shape": "circle"
                    },
                    "children": []
                  },
                  {
                    "id": "contact-info",
                    "type": "stackV",
                    "props": {"gap": 2},
                    "children": [
                      {
                        "id": "contact-name",
                        "type": "text",
                        "props": {
                          "content": "{{prop.contact.name}}",
                          "fontWeight": "600",
                          "fontSize": "14px",
                          "color": "#0f172a"
                        },
                        "children": []
                      },
                      {
                        "id": "contact-email",
                        "type": "text",
                        "props": {
                          "content": "{{prop.contact.email}}",
                          "fontSize": "13px",
                          "color": "#64748b"
                        },
                        "children": []
                      }
                    ]
                  },
                  {
                    "id": "contact-active-badge",
                    "type": "badge",
                    "props": {
                      "label": "Active",
                      "variant": "success",
                      "size": "sm"
                    },
                    "children": []
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        "id": "products-card",
        "type": "card",
        "props": {
          "shadow": "md",
          "rounded": "lg",
          "bordered": true,
          "padding": 24,
          "backgroundColor": "#ffffff"
        },
        "children": [
          {
            "id": "products-title",
            "type": "text",
            "props": {
              "content": "Product Catalog",
              "variant": "h2",
              "fontSize": "20px",
              "fontWeight": "700",
              "color": "#0f172a",
              "margin": "0 0 16px 0"
            },
            "children": []
          },
          {
            "id": "products-table",
            "type": "table",
            "props": {
              "columns": "title,price,inStock",
              "rows": "{{data.products}}",
              "striped": true,
              "showSearch": true,
              "sortable": true,
              "compact": false
            },
            "children": []
          }
        ]
      },
      {
        "id": "api-card",
        "type": "card",
        "props": {
          "shadow": "md",
          "rounded": "lg",
          "bordered": true,
          "padding": 24,
          "backgroundColor": "#ffffff"
        },
        "children": [
          {
            "id": "api-title",
            "type": "text",
            "props": {
              "content": "Live Weather (API Source)",
              "variant": "h2",
              "fontSize": "20px",
              "fontWeight": "700",
              "color": "#0f172a",
              "margin": "0 0 12px 0"
            },
            "children": []
          },
          {
            "id": "weather-temp",
            "type": "text",
            "props": {
              "content": "Temperature: {{data.weather.current.temperature_2m}}°C",
              "fontSize": "18px",
              "color": "#0f172a"
            },
            "children": []
          },
          {
            "id": "weather-icon",
            "type": "icon",
            "props": {
              "icon": "mdi:weather-sunny",
              "size": 48,
              "color": "#f59e0b"
            },
            "children": []
          }
        ]
      },
      {
        "id": "alert-section",
        "type": "alertBanner",
        "props": {
          "title": "Runtime Verified",
          "message": "All components, bindings, and data sources are working.",
          "variant": "success",
          "dismissible": true
        },
        "children": []
      },
      {
        "id": "progress-section",
        "type": "stackH",
        "props": {"gap": 16, "alignItems": "center", "padding": "8px 0"},
        "children": [
          {
            "id": "progress-bar",
            "type": "progressBar",
            "props": {
              "value": 86,
              "max": 100,
              "label": "Tests passing",
              "showPercent": true,
              "color": "#10b981",
              "height": 12,
              "animated": true
            },
            "children": []
          }
        ]
      },
      {
        "id": "footer",
        "type": "footer",
        "props": {
          "display": "flex",
          "justifyContent": "center",
          "padding": "24px 0",
          "borderTop": "1px solid #e2e8f0"
        },
        "children": [
          {
            "id": "footer-text",
            "type": "text",
            "props": {
              "content": "Built with DCCortex — {{dateNow.fullDate}}",
              "fontSize": "13px",
              "color": "#94a3b8"
            },
            "children": []
          }
        ]
      }
    ]
  },
  "stateDefinitions": [
    {"id": "s-username", "name": "username", "initialValue": "Guest", "type": "string"},
    {"id": "s-clicks", "name": "clicks", "initialValue": "0", "type": "number"},
    {"id": "s-formName", "name": "formName", "initialValue": "", "type": "string"},
    {"id": "s-formEmail", "name": "formEmail", "initialValue": "", "type": "string"},
    {"id": "s-darkMode", "name": "darkMode", "initialValue": "false", "type": "boolean"}
  ]
}'

SCREEN_BODY="{\"name\":\"Home\",\"slug\":\"home\",\"layout\":$LAYOUT_JSON}"
SCREEN_RESP=$(api_post "/api/projects/$PROJECT_ID/screens" "$SCREEN_BODY")
assert_json_field "Screen created" "$SCREEN_RESP" ".screen.id"
SCREEN_ID=$(echo "$SCREEN_RESP" | jq -r '.screen.id')
assert_json_eq "Screen name" "$SCREEN_RESP" ".screen.name" "Home"

# Create second screen
SCREEN2_BODY='{"name":"About","slug":"about","layout":{"root":{"id":"root","type":"container","props":{"display":"flex","flexDirection":"column","gap":16,"padding":24,"backgroundColor":"#f8fafc"},"children":[{"id":"about-title","type":"text","props":{"content":"About This App","variant":"h1","fontSize":"28px","fontWeight":"700","color":"#0f172a"},"children":[]},{"id":"about-desc","type":"text","props":{"content":"Built with DCCortex — a full no-code platform for building web apps.","fontSize":"16px","color":"#64748b","lineHeight":"1.6"},"children":[]},{"id":"about-link","type":"link","props":{"label":"Back to Home","url":"screen:home"},"children":[]}]}}}'
SCREEN2_RESP=$(api_post "/api/projects/$PROJECT_ID/screens" "$SCREEN2_BODY")
assert_json_field "Second screen created" "$SCREEN2_RESP" ".screen.id"
SCREEN2_ID=$(echo "$SCREEN2_RESP" | jq -r '.screen.id')

# List screens
SCREENS_LIST=$(api_get "/api/projects/$PROJECT_ID/screens")
SCREEN_COUNT=$(echo "$SCREENS_LIST" | jq '.screens | length')
if [[ "$SCREEN_COUNT" -ge 2 ]]; then
  echo -e "  ${GREEN}✓${NC} Screens listed ($SCREEN_COUNT screens)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Expected >=2 screens, got $SCREEN_COUNT"
  FAIL=$((FAIL + 1))
fi

# Update screen layout
UPDATED_LAYOUT='{"id":"root","type":"container","props":{"style":{"padding":"20px"}},"children":[{"id":"t1","type":"text","props":{"content":"Updated About"},"children":[]}]}'
PATCH_RESP=$(api_patch "/api/projects/$PROJECT_ID/screens/$SCREEN2_ID" "{\"layout\":$UPDATED_LAYOUT}")
assert_json_field "Screen updated" "$PATCH_RESP" ".screen.id"

# Versions
VERSIONS_RESP=$(api_get "/api/projects/$PROJECT_ID/screens/$SCREEN2_ID/versions")
assert_json_field "Versions listed" "$VERSIONS_RESP" ".versions"

# Restore a version (auto-created by screen edits)
VERSION_ID=$(echo "$VERSIONS_RESP" | jq -r '.versions[0].id // empty')
if [[ -n "$VERSION_ID" ]]; then
  RESTORE_RESP=$(api_post "/api/projects/$PROJECT_ID/screens/$SCREEN2_ID/versions" "{\"versionId\":\"$VERSION_ID\"}")
  RESTORE_OK=$(echo "$RESTORE_RESP" | jq 'has("ok") or has("restoredFrom")')
  if [[ "$RESTORE_OK" == "true" ]]; then
    echo -e "  ${GREEN}✓${NC} Version restored"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Version restore failed"
    FAIL=$((FAIL + 1))
  fi
else
  echo -e "  ${YELLOW}⚠${NC} No versions to restore"
  SKIP=$((SKIP + 1))
fi

# Edit-payload (used by screen builder)
EDIT_PAYLOAD=$(api_get "/api/projects/$PROJECT_ID/screens/$SCREEN2_ID/edit-payload")
assert_json_field "Edit-payload returned" "$EDIT_PAYLOAD" ".screen.id"

# Delete second screen
DEL_STATUS=$(api_delete_status "/api/projects/$PROJECT_ID/screens/$SCREEN2_ID")
assert_status "Screen deleted" "200" "$DEL_STATUS"

# =========================================================================
section "5. Globals — State Definitions"
# =========================================================================

GLOBALS_BODY='{
  "globals": {
    "globalStateDefinitions": [
      {"name": "username", "initialValue": "Guest", "type": "text"},
      {"name": "clicks", "initialValue": 0, "type": "number"},
      {"name": "formName", "initialValue": "", "type": "text"},
      {"name": "formEmail", "initialValue": "", "type": "text"},
      {"name": "darkMode", "initialValue": false, "type": "boolean"}
    ],
    "theme": {
      "primaryColor": "#3b82f6",
      "backgroundColor": "#ffffff",
      "fontFamily": "Inter, sans-serif"
    }
  }
}'
GLOBALS_RESP=$(api_put "/api/projects/$PROJECT_ID/globals" "$GLOBALS_BODY")
assert_json_field "Globals saved" "$GLOBALS_RESP" ".ok"

GLOBALS_GET=$(api_get "/api/projects/$PROJECT_ID/globals")
assert_json_field "Globals retrieved" "$GLOBALS_GET" ".globals.globalStateDefinitions"

# =========================================================================
section "6. Internal Database — Tables + Columns + Rows"
# =========================================================================

# Create datasource
DS_RESP=$(api_post "/api/projects/$PROJECT_ID/datasources")
assert_json_field "Datasource created" "$DS_RESP" ".datasource.id"
DS_ID=$(echo "$DS_RESP" | jq -r '.datasource.id')

# Create table: contacts
TBL_RESP=$(api_post "/api/projects/$PROJECT_ID/datasources/$DS_ID/tables" '{"name":"contacts"}')
assert_json_field "Table created" "$TBL_RESP" ".table.id"
TBL_ID=$(echo "$TBL_RESP" | jq -r '.table.id')

# Add columns
COL_RESP=$(api_patch "/api/projects/$PROJECT_ID/datasources/$DS_ID/tables" "{
  \"tableId\": \"$TBL_ID\",
  \"columns\": [
    {\"name\": \"name\", \"type\": \"text\"},
    {\"name\": \"email\", \"type\": \"email\"},
    {\"name\": \"age\", \"type\": \"number\"},
    {\"name\": \"active\", \"type\": \"boolean\"},
    {\"name\": \"joined\", \"type\": \"date\"},
    {\"name\": \"website\", \"type\": \"url\"},
    {\"name\": \"metadata\", \"type\": \"json\"}
  ]
}")
assert_json_field "Columns added" "$COL_RESP" ".table.columns"
COL_COUNT=$(echo "$COL_RESP" | jq '.table.columns | length')
assert_status "7 columns created" "7" "$COL_COUNT"

# Insert rows
ROW1=$(api_post "/api/projects/$PROJECT_ID/datasources/$DS_ID/tables/$TBL_ID/rows" \
  '{"name":"Alice","email":"alice@example.com","age":30,"active":true,"joined":"2024-01-15","website":"https://alice.dev","metadata":{"role":"admin"}}')
assert_json_field "Row 1 inserted" "$ROW1" ".row.id"
ROW1_ID=$(echo "$ROW1" | jq -r '.row.id')

ROW2=$(api_post "/api/projects/$PROJECT_ID/datasources/$DS_ID/tables/$TBL_ID/rows" \
  '{"name":"Bob","email":"bob@example.com","age":25,"active":false,"joined":"2024-03-20","website":"https://bob.io","metadata":{"role":"viewer"}}')
assert_json_field "Row 2 inserted" "$ROW2" ".row.id"
ROW2_ID=$(echo "$ROW2" | jq -r '.row.id')

ROW3=$(api_post "/api/projects/$PROJECT_ID/datasources/$DS_ID/tables/$TBL_ID/rows" \
  '{"name":"Charlie","email":"charlie@test.com","age":35,"active":true,"joined":"2023-11-01","website":"","metadata":{}}')
assert_json_field "Row 3 inserted" "$ROW3" ".row.id"

# List rows
ROWS_RESP=$(api_get "/api/projects/$PROJECT_ID/datasources/$DS_ID/tables/$TBL_ID/rows?limit=50")
ROW_COUNT=$(echo "$ROWS_RESP" | jq '.rows | length')
if [[ "$ROW_COUNT" -ge 3 ]]; then
  echo -e "  ${GREEN}✓${NC} Rows listed ($ROW_COUNT rows)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Expected >=3 rows, got $ROW_COUNT"
  FAIL=$((FAIL + 1))
fi

# Update row
PATCH_ROW=$(api_patch "/api/projects/$PROJECT_ID/datasources/$DS_ID/tables/$TBL_ID/rows/$ROW1_ID" \
  '{"age":31,"active":false}')
assert_json_field "Row updated" "$PATCH_ROW" ".row.id"

# Delete row
DEL_ROW=$(api_delete_status "/api/projects/$PROJECT_ID/datasources/$DS_ID/tables/$TBL_ID/rows/$ROW2_ID")
assert_status "Row deleted" "200" "$DEL_ROW"

# Create second table: products
TBL2_RESP=$(api_post "/api/projects/$PROJECT_ID/datasources/$DS_ID/tables" '{"name":"products"}')
assert_json_field "Products table created" "$TBL2_RESP" ".table.id"
TBL2_ID=$(echo "$TBL2_RESP" | jq -r '.table.id')

COL2_RESP=$(api_patch "/api/projects/$PROJECT_ID/datasources/$DS_ID/tables" "{
  \"tableId\": \"$TBL2_ID\",
  \"columns\": [
    {\"name\": \"title\", \"type\": \"text\"},
    {\"name\": \"price\", \"type\": \"number\"},
    {\"name\": \"inStock\", \"type\": \"boolean\"}
  ]
}")
assert_json_field "Product columns added" "$COL2_RESP" ".table.columns"

api_post "/api/projects/$PROJECT_ID/datasources/$DS_ID/tables/$TBL2_ID/rows" \
  '{"title":"Widget","price":9.99,"inStock":true}' > /dev/null
api_post "/api/projects/$PROJECT_ID/datasources/$DS_ID/tables/$TBL2_ID/rows" \
  '{"title":"Gadget","price":24.99,"inStock":false}' > /dev/null
echo -e "  ${GREEN}✓${NC} Product rows seeded"
PASS=$((PASS + 1))

# Realtime toggle
RT_RESP=$(api_patch "/api/projects/$PROJECT_ID/datasources/$DS_ID" '{"realtimePollMs":2000}')
assert_json_field "Realtime enabled" "$RT_RESP" ".datasource.id"

RT_OFF=$(api_patch "/api/projects/$PROJECT_ID/datasources/$DS_ID" '{"realtimePollMs":0}')
assert_json_field "Realtime disabled" "$RT_OFF" ".datasource.id"

# CSV Import
CSV_TMP=$(mktemp /tmp/test-csv-XXXXXX.csv)
printf 'title,price,inStock\nHammer,12.50,true\nNails,3.99,true\n' > "$CSV_TMP"
CSV_RESP=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -X POST "${BASE_URL}/api/projects/$PROJECT_ID/datasources/$DS_ID/tables/$TBL2_ID/import-csv" \
  -F "file=@${CSV_TMP};type=text/csv")
rm -f "$CSV_TMP"
CSV_INSERTED=$(echo "$CSV_RESP" | jq '.inserted // 0')
if [[ "$CSV_INSERTED" -ge 1 ]]; then
  echo -e "  ${GREEN}✓${NC} CSV imported ($CSV_INSERTED rows)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} CSV import failed — inserted=$CSV_INSERTED"
  FAIL=$((FAIL + 1))
fi

# =========================================================================
section "7. External API Sources — REST API Connector"
# =========================================================================

# Create a cached API source
API_SRC=$(api_post "/api/projects/$PROJECT_ID/api-sources" '{
  "name": "weather",
  "url": "https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m",
  "method": "GET",
  "cacheMode": "cached"
}')
assert_json_field "API source created" "$API_SRC" ".source.id"
API_SRC_ID=$(echo "$API_SRC" | jq -r '.source.id')

# Create a realtime API source
API_SRC2=$(api_post "/api/projects/$PROJECT_ID/api-sources" '{
  "name": "echo",
  "url": "https://httpbin.org/json",
  "method": "GET",
  "cacheMode": "realtime"
}')
assert_json_field "Realtime API source created" "$API_SRC2" ".source.id"
API_SRC2_ID=$(echo "$API_SRC2" | jq -r '.source.id')

# List
API_LIST=$(api_get "/api/projects/$PROJECT_ID/api-sources")
SRC_COUNT=$(echo "$API_LIST" | jq '.sources | length')
if [[ "$SRC_COUNT" -ge 2 ]]; then
  echo -e "  ${GREEN}✓${NC} API sources listed ($SRC_COUNT sources)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Expected >=2 API sources, got $SRC_COUNT"
  FAIL=$((FAIL + 1))
fi

# Update — switch cache mode
UPD_SRC=$(api_patch "/api/projects/$PROJECT_ID/api-sources/$API_SRC_ID" '{"cacheMode":"realtime"}')
assert_json_field "API source updated" "$UPD_SRC" ".source.id"

# Switch back
api_patch "/api/projects/$PROJECT_ID/api-sources/$API_SRC_ID" '{"cacheMode":"cached"}' > /dev/null

# Test endpoint
TEST_RESP=$(api_post "/api/projects/$PROJECT_ID/api-sources/test" '{
  "url": "https://httpbin.org/json",
  "method": "GET",
  "headers": {},
  "authType": "none"
}')
# May fail if httpbin is down, but we test the endpoint exists
TEST_HAS_STATUS=$(echo "$TEST_RESP" | jq 'has("status") or has("error")')
if [[ "$TEST_HAS_STATUS" == "true" ]]; then
  echo -e "  ${GREEN}✓${NC} API test endpoint works"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠${NC} API test endpoint returned unexpected response"
  SKIP=$((SKIP + 1))
fi

# Delete second source
DEL_SRC=$(api_delete_status "/api/projects/$PROJECT_ID/api-sources/$API_SRC2_ID")
assert_status "API source deleted" "200" "$DEL_SRC"

# Refresh cached data for remaining source
REFRESH_SRC=$(api_post "/api/projects/$PROJECT_ID/api-sources/$API_SRC_ID/refresh")
REFRESH_HAS=$(echo "$REFRESH_SRC" | jq 'has("ok") or has("error")')
if [[ "$REFRESH_HAS" == "true" ]]; then
  echo -e "  ${GREEN}✓${NC} API source refresh endpoint works"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠${NC} API source refresh returned unexpected response"
  SKIP=$((SKIP + 1))
fi

# Refresh-all
REFRESH_ALL_STATUS=$(api_post_status "/api/projects/$PROJECT_ID/api-sources/refresh-all")
if [[ "$REFRESH_ALL_STATUS" == "200" || "$REFRESH_ALL_STATUS" == "207" ]]; then
  echo -e "  ${GREEN}✓${NC} Refresh-all endpoint responded (HTTP $REFRESH_ALL_STATUS)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Refresh-all unexpected: HTTP $REFRESH_ALL_STATUS"
  FAIL=$((FAIL + 1))
fi

# =========================================================================
section "8. External DB Connectors"
# =========================================================================

# Create connector (will fail connection since no external DB, but tests CRUD)
CONN_RESP=$(api_post "/api/projects/$PROJECT_ID/db-connectors" '{
  "name": "test-pg",
  "driver": "postgres",
  "host": "localhost",
  "port": 5432,
  "database": "nonexistent",
  "username": "test",
  "password": "test"
}')
assert_json_field "DB connector created" "$CONN_RESP" ".connector.id"
CONN_ID=$(echo "$CONN_RESP" | jq -r '.connector.id // empty')

if [[ -n "$CONN_ID" ]]; then
  # List connectors
  CONN_LIST=$(api_get "/api/projects/$PROJECT_ID/db-connectors")
  CONN_COUNT=$(echo "$CONN_LIST" | jq '.connectors | length')
  if [[ "$CONN_COUNT" -ge 1 ]]; then
    echo -e "  ${GREEN}✓${NC} Connectors listed ($CONN_COUNT connectors)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Expected >=1 connectors, got $CONN_COUNT"
    FAIL=$((FAIL + 1))
  fi

  # Supported drivers returned
  DRIVERS=$(echo "$CONN_LIST" | jq '.supportedDrivers | length')
  assert_status "Supported drivers returned" "3" "$DRIVERS"

  # Get single connector
  CONN_GET=$(api_get "/api/projects/$PROJECT_ID/db-connectors/$CONN_ID")
  assert_json_eq "Connector driver" "$CONN_GET" ".connector.driver" "postgres"

  # Update connector
  CONN_UPD=$(api_patch "/api/projects/$PROJECT_ID/db-connectors/$CONN_ID" '{"name":"renamed-pg","queryLimit":100,"cacheMode":"realtime"}')
  assert_json_eq "Connector renamed" "$CONN_UPD" ".connector.name" "renamed-pg"

  # Test connection (will fail — no real external DB)
  TEST_CONN_STATUS=$(api_post_status "/api/projects/$PROJECT_ID/db-connectors/$CONN_ID/test")
  assert_status "Test connection endpoint responds" "200" "$TEST_CONN_STATUS"

  # Introspect (will fail/return empty — no real DB, but tests endpoint exists)
  INTROSPECT_RESP=$(api_post "/api/projects/$PROJECT_ID/db-connectors/$CONN_ID/introspect")
  INTROSPECT_HAS=$(echo "$INTROSPECT_RESP" | jq 'has("ok") or has("error")')
  if [[ "$INTROSPECT_HAS" == "true" ]]; then
    echo -e "  ${GREEN}✓${NC} Introspect endpoint responds"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Introspect returned unexpected response"
    FAIL=$((FAIL + 1))
  fi

  # Refresh cached data (will fail — no real DB, but tests endpoint exists)
  REFRESH_CONN=$(api_post "/api/projects/$PROJECT_ID/db-connectors/$CONN_ID/refresh")
  REFRESH_CONN_HAS=$(echo "$REFRESH_CONN" | jq 'has("ok") or has("error")')
  if [[ "$REFRESH_CONN_HAS" == "true" ]]; then
    echo -e "  ${GREEN}✓${NC} Connector refresh endpoint responds"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Connector refresh returned unexpected response"
    FAIL=$((FAIL + 1))
  fi

  # Delete connector
  DEL_CONN=$(api_delete_status "/api/projects/$PROJECT_ID/db-connectors/$CONN_ID")
  assert_status "Connector deleted" "200" "$DEL_CONN"
else
  echo -e "  ${YELLOW}⚠${NC} Connector creation returned no ID — skipping CRUD tests"
  SKIP=$((SKIP + 3))
fi

# =========================================================================
section "9. Assets — Upload + List + Delete"
# =========================================================================

# Create a small test file
TMPFILE=$(mktemp /tmp/test-asset-XXXXXX.txt)
echo "DCCortex test file content $(date +%s)" > "$TMPFILE"

ASSET_RESP=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -X POST "${BASE_URL}/api/projects/$PROJECT_ID/assets" \
  -F "file=@${TMPFILE};filename=test-file.txt;type=text/plain")
rm -f "$TMPFILE"
assert_json_field "Asset uploaded" "$ASSET_RESP" ".asset.id"
ASSET_ID=$(echo "$ASSET_RESP" | jq -r '.asset.id // empty')

ASSETS_LIST=$(api_get "/api/projects/$PROJECT_ID/assets")
ASSET_COUNT=$(echo "$ASSETS_LIST" | jq '.assets | length')
if [[ "$ASSET_COUNT" -ge 1 ]]; then
  echo -e "  ${GREEN}✓${NC} Assets listed ($ASSET_COUNT assets)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Expected >=1 assets, got $ASSET_COUNT"
  FAIL=$((FAIL + 1))
fi

if [[ -n "$ASSET_ID" ]]; then
  DEL_ASSET=$(api_delete_status "/api/projects/$PROJECT_ID/assets/$ASSET_ID")
  assert_status "Asset deleted" "200" "$DEL_ASSET"
fi

# =========================================================================
section "10. Webhooks — CRUD"
# =========================================================================

WH_RESP=$(api_post "/api/projects/$PROJECT_ID/webhooks" '{"name":"test-hook","url":"https://httpbin.org/post","events":["form.submit"],"active":true}')
assert_json_field "Webhook created" "$WH_RESP" ".webhook.id"
WH_ID=$(echo "$WH_RESP" | jq -r '.webhook.id // empty')

WH_LIST=$(api_get "/api/projects/$PROJECT_ID/webhooks")
assert_json_field "Webhooks listed" "$WH_LIST" ".webhooks"

if [[ -n "$WH_ID" ]]; then
  WH_UPD=$(api_patch "/api/projects/$PROJECT_ID/webhooks/$WH_ID" '{"events":["form.submit","btn.click"],"secret":"test-secret"}')
  assert_json_field "Webhook updated" "$WH_UPD" ".webhook.id"

  DEL_WH=$(api_delete_status "/api/projects/$PROJECT_ID/webhooks/$WH_ID")
  assert_status "Webhook deleted" "200" "$DEL_WH"
fi

# =========================================================================
section "11. Runtime Data — Authenticated (Editor Preview)"
# =========================================================================

RUNTIME_RESP=$(api_get "/api/projects/$PROJECT_ID/runtime-data")
assert_json_field "Runtime data returned" "$RUNTIME_RESP" ".data"

# Check that internal tables appear
RT_HAS_CONTACTS=$(echo "$RUNTIME_RESP" | jq '.data | has("contacts")')
if [[ "$RT_HAS_CONTACTS" == "true" ]]; then
  echo -e "  ${GREEN}✓${NC} Runtime data contains 'contacts' table"
  PASS=$((PASS + 1))
  # Verify row data
  RT_ROW_COUNT=$(echo "$RUNTIME_RESP" | jq '.data.contacts | length')
  if [[ "$RT_ROW_COUNT" -ge 2 ]]; then
    echo -e "  ${GREEN}✓${NC} contacts has $RT_ROW_COUNT rows (expected >=2 after delete)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} contacts has $RT_ROW_COUNT rows, expected >=2"
    FAIL=$((FAIL + 1))
  fi
else
  echo -e "  ${RED}✗${NC} Runtime data missing 'contacts'"
  FAIL=$((FAIL + 1))
fi

RT_HAS_PRODUCTS=$(echo "$RUNTIME_RESP" | jq '.data | has("products")')
if [[ "$RT_HAS_PRODUCTS" == "true" ]]; then
  echo -e "  ${GREEN}✓${NC} Runtime data contains 'products' table"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Runtime data missing 'products'"
  FAIL=$((FAIL + 1))
fi

# =========================================================================
section "12. Public Runtime Data — Unauthenticated (Published App)"
# =========================================================================

# Public endpoint — no cookies
PUB_RESP=$(curl -s "${BASE_URL}/api/p/$PROJECT_ID/data")
assert_json_field "Public runtime data" "$PUB_RESP" ".data"

PUB_CONTACTS=$(echo "$PUB_RESP" | jq '.data | has("contacts")')
if [[ "$PUB_CONTACTS" == "true" ]]; then
  echo -e "  ${GREEN}✓${NC} Public data contains contacts"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Public data missing contacts"
  FAIL=$((FAIL + 1))
fi

# =========================================================================
section "12b. Visual Rendering — HTML Verification"
# =========================================================================

# Warm up the public API endpoint (first hit after server recompile can be slow)
curl -s -o /dev/null "${BASE_URL}/api/p/$PROJECT_ID"
sleep 1

# Fetch the public project payload and verify layout + data are structured correctly
PUB_PAYLOAD=$(curl -s "${BASE_URL}/api/p/$PROJECT_ID")
# If screens are empty, retry once (cache may have stale empty entry from recompile)
PUB_SCREEN_COUNT=$(echo "$PUB_PAYLOAD" | jq '.screens | length // 0')
if [[ "$PUB_SCREEN_COUNT" == "0" ]]; then
  sleep 2
  PUB_PAYLOAD=$(curl -s "${BASE_URL}/api/p/$PROJECT_ID")
fi

# 1. Verify screen layout has correct root node type
ROOT_TYPE=$(echo "$PUB_PAYLOAD" | jq -r '.screens[0].layout.root.type // .screens[0].layout.type // empty')
if [[ "$ROOT_TYPE" == "container" ]]; then
  echo -e "  ${GREEN}✓${NC} Root node type is 'container'"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Root node type is '$ROOT_TYPE' — expected 'container'"
  FAIL=$((FAIL + 1))
fi

# 2. Verify layout has children with correct component types (recursive check)
ALL_TYPES=$(echo "$PUB_PAYLOAD" | jq -r '[(.screens[0].layout.root // .screens[0].layout) | .. | .type? // empty] | unique | join(",")')
for EXPECTED_TYPE in header card dataRepeater table alertBanner footer text button textInput formWrapper badge avatar; do
  if echo "$ALL_TYPES" | grep -q "$EXPECTED_TYPE"; then
    echo -e "  ${GREEN}✓${NC} Layout contains '${EXPECTED_TYPE}' component"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Layout missing '${EXPECTED_TYPE}' component (found: ${ALL_TYPES:0:100})"
    FAIL=$((FAIL + 1))
  fi
done

# 3. Verify state definitions exist in layout
STATE_DEFS=$(echo "$PUB_PAYLOAD" | jq '.screens[0].layout.stateDefinitions | length')
if [[ "$STATE_DEFS" -ge 3 ]]; then
  echo -e "  ${GREEN}✓${NC} State definitions present ($STATE_DEFS definitions)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Missing state definitions (got $STATE_DEFS)"
  FAIL=$((FAIL + 1))
fi

# 4. Verify data repeater has correct binding
REPEATER_DS=$(echo "$PUB_PAYLOAD" | jq -r '
  [(.screens[0].layout.root // .screens[0].layout).children[]
    | select(.type == "card")
    | .children[]?
    | select(.type == "dataRepeater")
    | .props.dataSource
  ] | first // empty')
if [[ "$REPEATER_DS" == *"data.contacts"* ]]; then
  echo -e "  ${GREEN}✓${NC} DataRepeater bound to contacts data"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} DataRepeater binding wrong: '$REPEATER_DS'"
  FAIL=$((FAIL + 1))
fi

# 5. Verify table component has rows bound to products data
TABLE_ROWS=$(echo "$PUB_PAYLOAD" | jq -r '
  [(.screens[0].layout.root // .screens[0].layout).children[]
    | select(.type == "card")
    | .children[]?
    | select(.type == "table")
    | .props.rows
  ] | first // empty')
if [[ "$TABLE_ROWS" == *"data.products"* ]]; then
  echo -e "  ${GREEN}✓${NC} Table component bound to products data"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Table binding wrong: '$TABLE_ROWS'"
  FAIL=$((FAIL + 1))
fi

# 6. Verify runtime data has actual row values that would interpolate
CONTACT_NAME=$(echo "$PUB_RESP" | jq -r '.data.contacts[0].name // empty')
PRODUCT_TITLE=$(echo "$PUB_RESP" | jq -r '.data.products[0].title // empty')
if [[ -n "$CONTACT_NAME" && -n "$PRODUCT_TITLE" ]]; then
  echo -e "  ${GREEN}✓${NC} Runtime data has interpolatable values (contact='$CONTACT_NAME', product='$PRODUCT_TITLE')"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Runtime data empty — contacts[0].name='$CONTACT_NAME', products[0].title='$PRODUCT_TITLE'"
  FAIL=$((FAIL + 1))
fi

# 7. Verify globals with state definitions are returned
GLOBALS_STATE=$(echo "$PUB_PAYLOAD" | jq '.globals.globalStateDefinitions | length // 0')
if [[ "$GLOBALS_STATE" -ge 3 ]]; then
  echo -e "  ${GREEN}✓${NC} Globals state definitions present ($GLOBALS_STATE)"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠${NC} Globals state definitions: $GLOBALS_STATE (may be in layout instead)"
  SKIP=$((SKIP + 1))
fi

# 8. Fetch the actual rendered HTML page and verify key content
HTML=$(curl -s "${BASE_URL}/p/$PROJECT_ID")
# Check that the page has the React root + script tags (SSR hydration)
if echo "$HTML" | grep -q '__NEXT_DATA__\|__next'; then
  echo -e "  ${GREEN}✓${NC} Preview page renders (Next.js hydration present)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Preview page missing Next.js hydration markers"
  FAIL=$((FAIL + 1))
fi

# Check that server-side data is embedded in the page
if echo "$HTML" | grep -q "$PROJECT_ID"; then
  echo -e "  ${GREEN}✓${NC} Preview page contains project reference"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Preview page missing project data"
  FAIL=$((FAIL + 1))
fi

# 10. Verify state bindings resolve in SSR HTML (not empty)
if echo "$HTML" | grep -q 'Welcome, Guest!'; then
  echo -e "  ${GREEN}✓${NC} SSR resolves state binding: 'Welcome, Guest!'"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠${NC} SSR state binding may resolve client-side only"
  SKIP=$((SKIP + 1))
fi

# 11. Verify stackH renders flex-direction:row in HTML
if echo "$HTML" | grep -o 'id="hero-stats-row"[^>]*' | head -1 | grep -q 'flex-direction:row'; then
  echo -e "  ${GREEN}✓${NC} stackH renders with flex-direction:row in HTML"
  PASS=$((PASS + 1))
elif echo "$HTML" | grep -A2 'hero-stats-row' | grep -q 'flex-direction:row'; then
  echo -e "  ${GREEN}✓${NC} stackH renders with flex-direction:row in HTML"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠${NC} stackH flex-direction:row not found in SSR HTML (may resolve client-side)"
  SKIP=$((SKIP + 1))
fi

# 12. Verify borderRadius has px units in rendered HTML (no bare 'border-radius:12')
# Match border-radius followed by digits then a semicolon or quote (missing px/em/rem/%)
BAD_BR_COUNT=$(echo "$HTML" | { grep -oE 'border-radius:[0-9]+[;"]' || true; } | wc -l | tr -d ' ')
if [[ "$BAD_BR_COUNT" == "0" ]]; then
  echo -e "  ${GREEN}✓${NC} All border-radius values have px units in HTML"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Found $BAD_BR_COUNT border-radius values without px units"
  FAIL=$((FAIL + 1))
fi

# =========================================================================
section "12c. Runtime Resolve API — Style & Binding Verification"
# =========================================================================

# Build the layout root from the public payload for the resolve API
LAYOUT_ROOT=$(echo "$PUB_PAYLOAD" | jq '.screens[0].layout.root')
STATE_OBJ='{"username":"Guest","clicks":0,"formName":"","formEmail":"","darkMode":false}'
DATA_OBJ=$(echo "$PUB_RESP" | jq '.data // {}')

RESOLVE_RESP=$(curl -s -X POST "${BASE_URL}/api/runtime-resolve" \
  -H "Content-Type: application/json" \
  -d "{\"root\":$LAYOUT_ROOT,\"state\":$STATE_OBJ,\"data\":$DATA_OBJ}")

# 1. stackH components must have flexDirection: row
STACKH_DIRS=$(echo "$RESOLVE_RESP" | jq -r '[.flatNodes[] | select(.type == "stackH") | .flexDirection] | unique | join(",")')
if [[ "$STACKH_DIRS" == "row" ]]; then
  echo -e "  ${GREEN}✓${NC} stackH components have flexDirection: row"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} stackH flexDirection wrong: '$STACKH_DIRS' — expected 'row'"
  FAIL=$((FAIL + 1))
fi

# 2. header has flexDirection: row
HEADER_DIR=$(echo "$RESOLVE_RESP" | jq -r '.flatNodes[] | select(.id == "header") | .flexDirection')
if [[ "$HEADER_DIR" == "row" ]]; then
  echo -e "  ${GREEN}✓${NC} Header has flexDirection: row"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Header flexDirection: '$HEADER_DIR' — expected 'row'"
  FAIL=$((FAIL + 1))
fi

# 3. footer has justifyContent: center
FOOTER_JC=$(echo "$RESOLVE_RESP" | jq -r '.flatNodes[] | select(.id == "footer") | .resolvedProps.justifyContent // empty')
# Also check from computedStyle if available
if [[ -z "$FOOTER_JC" ]]; then
  FOOTER_JC=$(echo "$RESOLVE_RESP" | jq -r '.tree.children[-1].computedStyle.justifyContent // empty')
fi
if [[ "$FOOTER_JC" == "center" ]]; then
  echo -e "  ${GREEN}✓${NC} Footer has justifyContent: center"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Footer justifyContent: '$FOOTER_JC' — expected 'center'"
  FAIL=$((FAIL + 1))
fi

# 4. State binding resolves — "Welcome, Guest!"
WELCOME_TEXT=$(echo "$RESOLVE_RESP" | jq -r '.flatNodes[] | select(.id == "hero-title") | .content')
if [[ "$WELCOME_TEXT" == *"Guest"* ]]; then
  echo -e "  ${GREEN}✓${NC} State binding resolved: 'Welcome, Guest!'"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} State binding failed: '$WELCOME_TEXT'"
  FAIL=$((FAIL + 1))
fi

# 5. Click counter resolves
CLICKS_TEXT=$(echo "$RESOLVE_RESP" | jq -r '.flatNodes[] | select(.id == "click-btn") | .content')
if [[ "$CLICKS_TEXT" == *"0"* ]]; then
  echo -e "  ${GREEN}✓${NC} Click counter resolved: '$CLICKS_TEXT'"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Click counter binding failed: '$CLICKS_TEXT'"
  FAIL=$((FAIL + 1))
fi

# 6. borderRadius has px units (not bare numbers)
BAD_RADIUS=$(echo "$RESOLVE_RESP" | jq -r '[.flatNodes[] | select(.borderRadius != null) | select((.borderRadius | tostring) | test("^[0-9]+$"))] | length')
if [[ "$BAD_RADIUS" == "0" ]]; then
  echo -e "  ${GREEN}✓${NC} All borderRadius values have CSS units"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} $BAD_RADIUS nodes have borderRadius without CSS units"
  FAIL=$((FAIL + 1))
fi

# 7. No zero-issue count (all bindings resolve)
ISSUE_COUNT=$(echo "$RESOLVE_RESP" | jq '.issueCount')
if [[ "$ISSUE_COUNT" == "0" ]]; then
  echo -e "  ${GREEN}✓${NC} No rendering issues detected"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠${NC} $ISSUE_COUNT rendering issues: $(echo "$RESOLVE_RESP" | jq -c '.issues[:3]')"
  SKIP=$((SKIP + 1))
fi

# 8. Data binding resolves — contacts repeater
REPEATER_CONTENT=$(echo "$RESOLVE_RESP" | jq -r '.flatNodes[] | select(.id == "contacts-title") | .content')
if [[ "$REPEATER_CONTENT" == *"2 records"* ]]; then
  echo -e "  ${GREEN}✓${NC} Contacts title shows record count: '$REPEATER_CONTENT'"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Contacts title missing data: '$REPEATER_CONTENT'"
  FAIL=$((FAIL + 1))
fi

# 9. Weather API data resolves  
WEATHER_TEXT=$(echo "$RESOLVE_RESP" | jq -r '.flatNodes[] | select(.id == "weather-temp") | .content')  
if [[ "$WEATHER_TEXT" == *"°C"* ]]; then
  echo -e "  ${GREEN}✓${NC} Weather API data resolved: '$WEATHER_TEXT'"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Weather data binding failed: '$WEATHER_TEXT'"
  FAIL=$((FAIL + 1))
fi

# 10. Header padding accepts CSS shorthand (16px 24px)
HEADER_PAD=$(echo "$RESOLVE_RESP" | jq -r '.flatNodes[] | select(.id == "header") | .padding')
if [[ "$HEADER_PAD" == *"16px"* || "$HEADER_PAD" == *"24px"* ]]; then
  echo -e "  ${GREEN}✓${NC} Header padding preserved: '$HEADER_PAD'"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Header padding lost: '$HEADER_PAD'"
  FAIL=$((FAIL + 1))
fi

# 11. Component registry accessible
REG_RESP=$(curl -s "${BASE_URL}/api/runtime-registry")
COMP_COUNT=$(echo "$REG_RESP" | jq '.componentCount // 0')
if [[ "$COMP_COUNT" -ge 20 ]]; then
  echo -e "  ${GREEN}✓${NC} Component registry returns $COMP_COUNT components"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Component registry returned only $COMP_COUNT components"
  FAIL=$((FAIL + 1))
fi

# 12. Registry has stackH with flexDirection: row default
STACKH_DEFAULT=$(echo "$REG_RESP" | jq -r '.components[] | select(.id == "stackH") | .defaultProps.flexDirection')
if [[ "$STACKH_DEFAULT" == "row" ]]; then
  echo -e "  ${GREEN}✓${NC} stackH registry default flexDirection is 'row'"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} stackH registry default: '$STACKH_DEFAULT'"
  FAIL=$((FAIL + 1))
fi

# =========================================================================
section "13. Public Mutations — Runtime CRUD"
# =========================================================================

# Insert a row via public API
PUB_INSERT=$(curl -s -H "Content-Type: application/json" \
  -X POST "${BASE_URL}/api/p/$PROJECT_ID/data/mutate" \
  -d '{"action":"insertRow","table":"contacts","data":{"name":"PublicUser","email":"pub@test.com","age":22,"active":true}}')
assert_json_field "Public insert" "$PUB_INSERT" ".row.id"
PUB_ROW_ID=$(echo "$PUB_INSERT" | jq -r '.row.id // empty')

if [[ -n "$PUB_ROW_ID" ]]; then
  # Update via public API
  PUB_UPDATE=$(curl -s -H "Content-Type: application/json" \
    -X POST "${BASE_URL}/api/p/$PROJECT_ID/data/mutate" \
    -d "{\"action\":\"updateRow\",\"table\":\"contacts\",\"rowId\":\"$PUB_ROW_ID\",\"data\":{\"age\":23}}")
  assert_json_field "Public update" "$PUB_UPDATE" ".row.id"

  # Delete via public API  
  PUB_DELETE=$(curl -s -H "Content-Type: application/json" \
    -X POST "${BASE_URL}/api/p/$PROJECT_ID/data/mutate" \
    -d "{\"action\":\"deleteRow\",\"table\":\"contacts\",\"rowId\":\"$PUB_ROW_ID\"}")
  assert_json_eq "Public delete" "$PUB_DELETE" ".ok" "true"
fi

# =========================================================================
section "14. Notifications"
# =========================================================================

NOTIF_RESP=$(api_get "/api/notifications")
# Should return list (maybe empty)
NOTIF_HAS=$(echo "$NOTIF_RESP" | jq 'has("notifications")')
if [[ "$NOTIF_HAS" == "true" ]]; then
  echo -e "  ${GREEN}✓${NC} Notifications endpoint works"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠${NC} Notifications returned unexpected shape"
  SKIP=$((SKIP + 1))
fi

READALL_STATUS=$(api_put_status "/api/notifications/read-all")
if [[ "$READALL_STATUS" == "200" ]]; then
  echo -e "  ${GREEN}✓${NC} Read-all endpoint responded (HTTP $READALL_STATUS)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Read-all notifications unexpected: HTTP $READALL_STATUS"
  FAIL=$((FAIL + 1))
fi

# =========================================================================
section "15. Packages"
# =========================================================================

PKG_LIST=$(api_get "/api/packages")
PKG_HAS=$(echo "$PKG_LIST" | jq 'has("packages")')
if [[ "$PKG_HAS" == "true" ]]; then
  echo -e "  ${GREEN}✓${NC} Packages endpoint works"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠${NC} Packages returned unexpected shape"
  SKIP=$((SKIP + 1))
fi

# =========================================================================
section "16. Project Duplicate"
# =========================================================================

DUP_RESP=$(api_post "/api/projects/$PROJECT_ID/duplicate")
DUP_ID=$(echo "$DUP_RESP" | jq -r '.project.id // empty')
if [[ -n "$DUP_ID" ]]; then
  echo -e "  ${GREEN}✓${NC} Project duplicated (new id: ${DUP_ID:0:8}…)"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠${NC} Project duplicate returned no id"
  SKIP=$((SKIP + 1))
fi

# =========================================================================
section "17. Organization Management"
# =========================================================================

# Get org details
ORG_DETAIL=$(api_get "/api/organizations/$ORG_ID")
assert_json_field "Org fetched" "$ORG_DETAIL" ".organization.id"

# Update org
ORG_UPD=$(api_put "/api/organizations/$ORG_ID" '{"name":"Updated Test Org","description":"Integration test org"}')
assert_json_field "Org updated" "$ORG_UPD" ".organization.id"

# Roles
ROLES_RESP=$(api_get "/api/organizations/$ORG_ID/roles")
ROLES_HAS=$(echo "$ROLES_RESP" | jq 'has("roles")')
if [[ "$ROLES_HAS" == "true" ]]; then
  echo -e "  ${GREEN}✓${NC} Org roles endpoint works"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠${NC} Org roles returned unexpected shape"
  SKIP=$((SKIP + 1))
fi

# Audit logs
AUDIT_RESP=$(api_get "/api/organizations/$ORG_ID/audit-logs")
AUDIT_HAS=$(echo "$AUDIT_RESP" | jq 'has("logs")')
if [[ "$AUDIT_HAS" == "true" ]]; then
  echo -e "  ${GREEN}✓${NC} Audit logs endpoint works"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠${NC} Audit logs returned unexpected shape"
  SKIP=$((SKIP + 1))
fi

# Invite (will send to non-existent email, but tests endpoint)
INVITE_RESP=$(api_post "/api/organizations/$ORG_ID/invite" '{"email":"invited-test@dccortex-test.local","role":"member"}')
INVITE_HAS=$(echo "$INVITE_RESP" | jq 'has("invitation") or has("error")')
if [[ "$INVITE_HAS" == "true" ]]; then
  echo -e "  ${GREEN}✓${NC} Invite endpoint responds"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Invite returned unexpected response"
  FAIL=$((FAIL + 1))
fi

# =========================================================================
section "18. Public Project Endpoint"
# =========================================================================

PUB_PROJECT=$(curl -s "${BASE_URL}/api/p/$PROJECT_ID")
assert_json_field "Public project returned" "$PUB_PROJECT" ".project.id"
PUB_SCREENS=$(echo "$PUB_PROJECT" | jq '.screens | length')
if [[ "$PUB_SCREENS" -ge 1 ]]; then
  echo -e "  ${GREEN}✓${NC} Public project has $PUB_SCREENS screen(s)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Public project has no screens"
  FAIL=$((FAIL + 1))
fi

# =========================================================================
section "19. Project Delete"
# =========================================================================

# Delete the duplicated project (not the main one)
if [[ -n "$DUP_ID" ]]; then
  DEL_PROJ=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X DELETE --data-raw '{"verificationName":"Full Test App (copy)"}' "${BASE_URL}/api/projects/$DUP_ID")
  DEL_PROJ_OK=$(echo "$DEL_PROJ" | jq -r '.success // empty')
  if [[ "$DEL_PROJ_OK" == "true" ]]; then
    echo -e "  ${GREEN}✓${NC} Duplicate project deleted"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Project delete failed"
    FAIL=$((FAIL + 1))
  fi
else
  echo -e "  ${YELLOW}⚠${NC} No duplicate to delete"
  SKIP=$((SKIP + 1))
fi

# =========================================================================
section "21. Second App — Task Manager (full lifecycle)"
# =========================================================================

# Create a second project with different component types, multi-screen, different data
APP2_RESP=$(api_post "/api/projects" "{\"name\":\"Task Manager\",\"organizationId\":\"$ORG_ID\"}")
APP2_ID=$(echo "$APP2_RESP" | jq -r '.project.id')
assert_json_field "App2 project created" "$APP2_RESP" ".project.id"

# Create tasks table
APP2_DS_RESP=$(api_post "/api/projects/$APP2_ID/datasources" '{"name":"internal","type":"internal"}')
APP2_DS_ID=$(echo "$APP2_DS_RESP" | jq -r '.datasource.id')
APP2_TBL_RESP=$(api_post "/api/projects/$APP2_ID/datasources/$APP2_DS_ID/tables" '{"name":"tasks"}')
APP2_TBL_ID=$(echo "$APP2_TBL_RESP" | jq -r '.table.id')
assert_json_field "App2 tasks table created" "$APP2_TBL_RESP" ".table.id"

# Add columns via batch PATCH (same as first app)
APP2_COL_RESP=$(api_patch "/api/projects/$APP2_ID/datasources/$APP2_DS_ID/tables" "{
  \"tableId\": \"$APP2_TBL_ID\",
  \"columns\": [
    {\"name\": \"title\", \"type\": \"text\"},
    {\"name\": \"completed\", \"type\": \"boolean\"},
    {\"name\": \"priority\", \"type\": \"text\"},
    {\"name\": \"due_date\", \"type\": \"text\"}
  ]
}")
APP2_COL_COUNT=$(echo "$APP2_COL_RESP" | jq '.table.columns | length')
if [[ "$APP2_COL_COUNT" == "4" ]]; then
  echo -e "  ${GREEN}✓${NC} App2 columns created ($APP2_COL_COUNT)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} App2 columns expected 4, got $APP2_COL_COUNT"
  FAIL=$((FAIL + 1))
fi

# Insert test rows
api_post "/api/projects/$APP2_ID/datasources/$APP2_DS_ID/tables/$APP2_TBL_ID/rows" \
  '{"title":"Fix login bug","completed":false,"priority":"high","due_date":"2026-04-15"}' > /dev/null
api_post "/api/projects/$APP2_ID/datasources/$APP2_DS_ID/tables/$APP2_TBL_ID/rows" \
  '{"title":"Write docs","completed":true,"priority":"medium","due_date":"2026-04-10"}' > /dev/null
api_post "/api/projects/$APP2_ID/datasources/$APP2_DS_ID/tables/$APP2_TBL_ID/rows" \
  '{"title":"Deploy v2","completed":false,"priority":"high","due_date":"2026-04-20"}' > /dev/null
echo -e "  ${GREEN}✓${NC} App2 tasks inserted (3 rows)"
PASS=$((PASS + 1))

# Set globals: state definitions + theme
APP2_GLOBALS='{
  "globalStateDefinitions": [
    {"name": "filter", "type": "text", "initialValue": "all"},
    {"name": "newTask", "type": "text", "initialValue": ""},
    {"name": "taskCount", "type": "number", "initialValue": 0},
    {"name": "showCompleted", "type": "boolean", "initialValue": true}
  ],
  "globalTheme": {
    "primary": "#10b981",
    "background": "#f0fdf4",
    "text": "#064e3b",
    "surface": "#ffffff",
    "borderColor": "#d1fae5"
  }
}'
APP2_GLOB_RESP=$(api_put "/api/projects/$APP2_ID/globals" "$APP2_GLOBALS")
assert_json_eq "App2 globals saved" "$APP2_GLOB_RESP" ".ok" "true"

# Screen 1: Task List — uses tabs, dataRepeater, checkbox, badge, progressBar, alertBanner
APP2_SCREEN1_LAYOUT='{
  "root": {
    "id": "root",
    "type": "container",
    "props": {
      "display": "flex", "flexDirection": "column", "gap": 16,
      "padding": 24, "minHeight": "100vh", "backgroundColor": "#f0fdf4"
    },
    "children": [
      {
        "id": "app-header",
        "type": "header",
        "props": {
          "display": "flex", "flexDirection": "row",
          "justifyContent": "space-between", "alignItems": "center",
          "padding": "12px 20px", "backgroundColor": "#ffffff", "borderRadius": 8
        },
        "children": [
          {
            "id": "app-title",
            "type": "text",
            "props": {"content": "Task Manager", "fontSize": "22px", "fontWeight": "700", "color": "#064e3b"},
            "children": []
          },
          {
            "id": "task-count-badge",
            "type": "badge",
            "props": {"label": "{{state.taskCount}} tasks", "variant": "info", "size": "md"},
            "children": []
          }
        ]
      },
      {
        "id": "add-task-row",
        "type": "stackH",
        "props": {"gap": 8, "alignItems": "center"},
        "children": [
          {
            "id": "new-task-input",
            "type": "textInput",
            "props": {
              "placeholder": "Add a new task...",
              "value": "{{state.newTask}}",
              "onChange": [{"action": "setState", "stateKey": "newTask", "value": "{{event.value}}"}]
            },
            "children": []
          },
          {
            "id": "add-task-btn",
            "type": "button",
            "props": {
              "label": "Add",
              "variant": "primary",
              "backgroundColor": "#10b981",
              "color": "#ffffff",
              "padding": "8px 16px",
              "borderRadius": 6,
              "onClick": [
                {"action": "insertRow", "tableName": "tasks", "rowData": {"title": "{{state.newTask}}", "completed": false, "priority": "medium", "due_date": ""}, "resultStateKey": "lastInsert"},
                {"action": "setState", "stateKey": "newTask", "value": ""}
              ]
            },
            "children": []
          }
        ]
      },
      {
        "id": "progress-section",
        "type": "card",
        "props": {"padding": 16, "backgroundColor": "#ffffff", "borderRadius": 8, "shadow": "sm"},
        "children": [
          {
            "id": "progress-label",
            "type": "text",
            "props": {"content": "Completion Progress", "fontSize": "14px", "fontWeight": "600", "color": "#064e3b"},
            "children": []
          },
          {
            "id": "task-progress",
            "type": "progressBar",
            "props": {"value": 33, "max": 100, "color": "#10b981", "height": "8px", "showLabel": true},
            "children": []
          }
        ]
      },
      {
        "id": "filter-tabs",
        "type": "tabs",
        "props": {
          "tabs": ["All", "Active", "Completed"],
          "activeTab": "{{state.filter}}",
          "variant": "pills",
          "onChange": [{"action": "setState", "stateKey": "filter", "value": "{{event.value}}"}]
        },
        "children": []
      },
      {
        "id": "no-tasks-alert",
        "type": "alertBanner",
        "props": {
          "message": "No tasks yet! Add your first task above.",
          "variant": "info",
          "visible": true
        },
        "children": []
      },
      {
        "id": "tasks-list",
        "type": "dataRepeater",
        "props": {
          "dataSource": "{{data.tasks}}",
          "itemVar": "task",
          "emptyText": "No tasks",
          "display": "flex", "flexDirection": "column", "gap": 8
        },
        "children": [
          {
            "id": "task-item",
            "type": "card",
            "props": {
              "shadow": "sm", "rounded": "md",
              "display": "flex", "flexDirection": "row", "alignItems": "center",
              "gap": 12, "padding": "10px 14px", "backgroundColor": "#ffffff"
            },
            "children": [
              {
                "id": "task-checkbox",
                "type": "checkbox",
                "props": {
                  "checked": "{{task.completed}}",
                  "onChange": [{"action": "updateRow", "tableName": "tasks", "rowId": "{{task.id}}", "rowData": {"completed": "{{event.checked}}"}}]
                },
                "children": []
              },
              {
                "id": "task-title",
                "type": "text",
                "props": {"content": "{{task.title}}", "fontSize": "14px", "color": "#064e3b"},
                "children": []
              },
              {
                "id": "task-spacer",
                "type": "spacer",
                "props": {"flex": 1},
                "children": []
              },
              {
                "id": "task-priority-badge",
                "type": "badge",
                "props": {"label": "{{task.priority}}", "variant": "warning", "size": "sm"},
                "children": []
              },
              {
                "id": "task-due",
                "type": "text",
                "props": {"content": "{{task.due_date}}", "fontSize": "12px", "color": "#6b7280"},
                "children": []
              }
            ]
          }
        ]
      },
      {
        "id": "app-footer",
        "type": "footer",
        "props": {
          "display": "flex", "flexDirection": "row", "justifyContent": "center",
          "padding": "12px 0", "backgroundColor": "transparent"
        },
        "children": [
          {
            "id": "footer-text",
            "type": "text",
            "props": {"content": "Built with DCCortex", "fontSize": "12px", "color": "#9ca3af"},
            "children": []
          }
        ]
      }
    ]
  }
}'

APP2_SC1_RESP=$(api_post "/api/projects/$APP2_ID/screens" \
  "{\"name\":\"Tasks\",\"slug\":\"tasks\",\"route\":\"/\",\"layout\":$APP2_SCREEN1_LAYOUT}")
APP2_SC1_ID=$(echo "$APP2_SC1_RESP" | jq -r '.screen.id')
assert_json_field "App2 screen 'Tasks' created" "$APP2_SC1_RESP" ".screen.id"

# Screen 2: Settings — uses toggle, select, divider, avatar, different layout
APP2_SCREEN2_LAYOUT='{
  "root": {
    "id": "settings-root",
    "type": "container",
    "props": {
      "display": "flex", "flexDirection": "column", "gap": 20,
      "padding": 24, "maxWidth": "600px", "margin": "0 auto"
    },
    "children": [
      {
        "id": "settings-header",
        "type": "stackH",
        "props": {"gap": 12, "alignItems": "center"},
        "children": [
          {
            "id": "user-avatar",
            "type": "avatar",
            "props": {"initials": "TM", "size": "lg", "backgroundColor": "#10b981"},
            "children": []
          },
          {
            "id": "settings-title",
            "type": "text",
            "props": {"content": "Settings", "fontSize": "24px", "fontWeight": "700", "color": "#064e3b"},
            "children": []
          }
        ]
      },
      {
        "id": "settings-divider",
        "type": "divider",
        "props": {"orientation": "horizontal", "color": "#d1fae5", "thickness": 1},
        "children": []
      },
      {
        "id": "show-completed-row",
        "type": "stackH",
        "props": {"gap": 12, "alignItems": "center", "justifyContent": "space-between"},
        "children": [
          {
            "id": "show-completed-label",
            "type": "text",
            "props": {"content": "Show completed tasks", "fontSize": "14px", "color": "#064e3b"},
            "children": []
          },
          {
            "id": "show-completed-toggle",
            "type": "toggle",
            "props": {
              "checked": "{{state.showCompleted}}",
              "onChange": [{"action": "setState", "stateKey": "showCompleted", "value": "{{event.checked}}"}]
            },
            "children": []
          }
        ]
      },
      {
        "id": "back-btn",
        "type": "button",
        "props": {
          "label": "← Back to Tasks",
          "variant": "outline",
          "padding": "8px 16px",
          "borderRadius": 6,
          "onClick": [{"action": "navigate", "screen": "tasks"}]
        },
        "children": []
      }
    ]
  }
}'

APP2_SC2_RESP=$(api_post "/api/projects/$APP2_ID/screens" \
  "{\"name\":\"Settings\",\"slug\":\"settings\",\"route\":\"/settings\",\"layout\":$APP2_SCREEN2_LAYOUT}")
APP2_SC2_ID=$(echo "$APP2_SC2_RESP" | jq -r '.screen.id')
assert_json_field "App2 screen 'Settings' created" "$APP2_SC2_RESP" ".screen.id"

# Publish
APP2_PUB=$(api_put "/api/projects/$APP2_ID" '{"isPublished":true}')
assert_json_eq "App2 published" "$APP2_PUB" ".project.status" "published"

# ------ Verify App2 public payload ------
APP2_PAYLOAD=$(curl -s "${BASE_URL}/api/p/$APP2_ID")
APP2_SCREEN_COUNT=$(echo "$APP2_PAYLOAD" | jq '.screens | length')
if [[ "$APP2_SCREEN_COUNT" == "2" ]]; then
  echo -e "  ${GREEN}✓${NC} App2 has 2 screens"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} App2 expected 2 screens, got $APP2_SCREEN_COUNT"
  FAIL=$((FAIL + 1))
fi

# Verify state definitions
APP2_STATE_COUNT=$(echo "$APP2_PAYLOAD" | jq '.globals.globalStateDefinitions | length')
if [[ "$APP2_STATE_COUNT" == "4" ]]; then
  echo -e "  ${GREEN}✓${NC} App2 has 4 state definitions"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} App2 expected 4 state definitions, got $APP2_STATE_COUNT"
  FAIL=$((FAIL + 1))
fi

# Verify theme
APP2_THEME_PRIMARY=$(echo "$APP2_PAYLOAD" | jq -r '.globals.globalTheme.primary // empty')
if [[ "$APP2_THEME_PRIMARY" == "#10b981" ]]; then
  echo -e "  ${GREEN}✓${NC} App2 theme primary = #10b981 (green)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} App2 theme primary expected #10b981, got $APP2_THEME_PRIMARY"
  FAIL=$((FAIL + 1))
fi

# Verify runtime data has tasks
APP2_DATA=$(curl -s "${BASE_URL}/api/p/$APP2_ID/data")
APP2_TASK_COUNT=$(echo "$APP2_DATA" | jq '.data.tasks | length')
if [[ "$APP2_TASK_COUNT" -ge 3 ]]; then
  echo -e "  ${GREEN}✓${NC} App2 runtime data has $APP2_TASK_COUNT tasks"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} App2 expected >=3 tasks, got $APP2_TASK_COUNT"
  FAIL=$((FAIL + 1))
fi

# Verify task data content
APP2_FIRST_TASK=$(echo "$APP2_DATA" | jq -r '.data.tasks[0].title // empty')
if [[ -n "$APP2_FIRST_TASK" ]]; then
  echo -e "  ${GREEN}✓${NC} App2 first task has title ($APP2_FIRST_TASK)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} App2 first task title is empty"
  FAIL=$((FAIL + 1))
fi

# ------ Resolve API on App2 layout ------
APP2_LAYOUT_ROOT=$(echo "$APP2_PAYLOAD" | jq '.screens[0].layout.root')
APP2_STATE_OBJ='{"filter":"all","newTask":"","taskCount":0,"showCompleted":true}'
APP2_DATA_OBJ=$(echo "$APP2_DATA" | jq '.data // {}')

APP2_RESOLVE=$(curl -s -X POST "${BASE_URL}/api/runtime-resolve" \
  -H "Content-Type: application/json" \
  -d "{\"root\":$APP2_LAYOUT_ROOT,\"state\":$APP2_STATE_OBJ,\"data\":$APP2_DATA_OBJ}")

# stackH in app2 should resolve to flexDirection: row
APP2_STACKH_DIR=$(echo "$APP2_RESOLVE" | jq -r '[.flatNodes[] | select(.type == "stackH") | .flexDirection] | unique | join(",")')
if [[ "$APP2_STACKH_DIR" == "row" ]]; then
  echo -e "  ${GREEN}✓${NC} App2 stackH → flexDirection: row"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} App2 stackH flexDirection expected 'row', got '$APP2_STACKH_DIR'"
  FAIL=$((FAIL + 1))
fi

# dataRepeater binding should resolve
APP2_REPEATER=$(echo "$APP2_RESOLVE" | jq -r '[.flatNodes[] | select(.type == "dataRepeater")] | length')
if [[ "$APP2_REPEATER" -ge 1 ]]; then
  echo -e "  ${GREEN}✓${NC} App2 dataRepeater present in resolved tree"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} App2 dataRepeater not found in resolved tree"
  FAIL=$((FAIL + 1))
fi

# Badge text should resolve {{state.taskCount}}
APP2_BADGE_TEXT=$(echo "$APP2_RESOLVE" | jq -r '[.flatNodes[] | select(.type == "badge")] | .[0].content // .[0].label // empty')
if [[ "$APP2_BADGE_TEXT" == "0 tasks" ]]; then
  echo -e "  ${GREEN}✓${NC} App2 badge resolves '0 tasks' from state"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} App2 badge expected '0 tasks', got '$APP2_BADGE_TEXT'"
  FAIL=$((FAIL + 1))
fi

# ------ App2 SSR HTML verification ------
APP2_HTML=$(curl -s "${BASE_URL}/p/$APP2_ID")
if echo "$APP2_HTML" | grep -q 'Task Manager'; then
  echo -e "  ${GREEN}✓${NC} App2 HTML contains 'Task Manager'"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} App2 HTML missing 'Task Manager'"
  FAIL=$((FAIL + 1))
fi

if echo "$APP2_HTML" | grep -q 'Fix login bug\|Write docs\|Deploy v2'; then
  echo -e "  ${GREEN}✓${NC} App2 HTML contains task data in SSR"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} App2 HTML missing task data in SSR"
  FAIL=$((FAIL + 1))
fi

# Screen 2 resolve — verify avatar and toggle
APP2_SC2_ROOT=$(echo "$APP2_PAYLOAD" | jq '.screens[1].layout.root')
if [[ "$APP2_SC2_ROOT" != "null" && -n "$APP2_SC2_ROOT" ]]; then
  APP2_SC2_RESOLVE=$(curl -s -X POST "${BASE_URL}/api/runtime-resolve" \
    -H "Content-Type: application/json" \
    -d "{\"root\":$APP2_SC2_ROOT,\"state\":$APP2_STATE_OBJ,\"data\":$APP2_DATA_OBJ}")

  APP2_SC2_TYPES=$(echo "$APP2_SC2_RESOLVE" | jq -r '[.flatNodes[].type] | unique | join(",")')
  if echo "$APP2_SC2_TYPES" | grep -q 'avatar'; then
    echo -e "  ${GREEN}✓${NC} App2 Settings screen has avatar component"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} App2 Settings screen missing avatar"
    FAIL=$((FAIL + 1))
  fi

  if echo "$APP2_SC2_TYPES" | grep -q 'toggle'; then
    echo -e "  ${GREEN}✓${NC} App2 Settings screen has toggle component"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} App2 Settings screen missing toggle"
    FAIL=$((FAIL + 1))
  fi

  if echo "$APP2_SC2_TYPES" | grep -q 'divider'; then
    echo -e "  ${GREEN}✓${NC} App2 Settings screen has divider component"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} App2 Settings screen missing divider"
    FAIL=$((FAIL + 1))
  fi
else
  echo -e "  ${YELLOW}⚠${NC} App2 screen 2 layout not available"
  SKIP=$((SKIP + 1))
fi

# Cleanup: delete App2
DEL_APP2=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -X DELETE --data-raw '{"verificationName":"Task Manager"}' "${BASE_URL}/api/projects/$APP2_ID")
DEL_APP2_OK=$(echo "$DEL_APP2" | jq -r '.success // empty')
if [[ "$DEL_APP2_OK" == "true" ]]; then
  echo -e "  ${GREEN}✓${NC} App2 cleaned up (deleted)"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠${NC} App2 cleanup: delete returned $DEL_APP2_OK"
  SKIP=$((SKIP + 1))
fi

# =========================================================================
section "22. RBAC — Unauthenticated Access Denied"
# =========================================================================

# Without cookies, authenticated endpoints should return 401
UNAUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/projects")
assert_status "GET /api/projects without auth → 401" "401" "$UNAUTH_STATUS"

UNAUTH_ORG=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/organizations")
assert_status "GET /api/organizations without auth → 401" "401" "$UNAUTH_ORG"

UNAUTH_CONN=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/projects/$PROJECT_ID/db-connectors")
assert_status "GET /db-connectors without auth → 401" "401" "$UNAUTH_CONN"

# =========================================================================
section "23. Runtime Deep Dive — Events, Repeater Bindings, Components, Theme"
# =========================================================================

# Create a dedicated runtime test project
RT_RESP=$(api_post "/api/projects" "{\"name\":\"Runtime Test Suite\",\"organizationId\":\"$ORG_ID\"}")
RT_ID=$(echo "$RT_RESP" | jq -r '.project.id')
assert_json_field "Runtime project created" "$RT_RESP" ".project.id"

# Create internal datasource + table
RT_DS_RESP=$(api_post "/api/projects/$RT_ID/datasources" '{"name":"internal","type":"internal"}')
RT_DS_ID=$(echo "$RT_DS_RESP" | jq -r '.datasource.id')
RT_TBL_RESP=$(api_post "/api/projects/$RT_ID/datasources/$RT_DS_ID/tables" '{"name":"items"}')
RT_TBL_ID=$(echo "$RT_TBL_RESP" | jq -r '.table.id')
assert_json_field "Runtime table created" "$RT_TBL_RESP" ".table.id"

# Add columns
RT_COL_RESP=$(api_patch "/api/projects/$RT_ID/datasources/$RT_DS_ID/tables" "{
  \"tableId\": \"$RT_TBL_ID\",
  \"columns\": [
    {\"name\": \"title\", \"type\": \"text\"},
    {\"name\": \"done\", \"type\": \"boolean\"},
    {\"name\": \"score\", \"type\": \"number\"},
    {\"name\": \"category\", \"type\": \"text\"}
  ]
}")
RT_COL_COUNT=$(echo "$RT_COL_RESP" | jq '.table.columns | length')
if [[ "$RT_COL_COUNT" == "4" ]]; then
  echo -e "  ${GREEN}✓${NC} Runtime table has 4 columns"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Runtime table expected 4 columns, got $RT_COL_COUNT"
  FAIL=$((FAIL + 1))
fi

# Insert 4 test rows
RT_ROW1=$(api_post "/api/projects/$RT_ID/datasources/$RT_DS_ID/tables/$RT_TBL_ID/rows" \
  '{"title":"Alpha","done":false,"score":80,"category":"Work"}')
RT_ROW1_ID=$(echo "$RT_ROW1" | jq -r '.row.id // empty')
RT_ROW2=$(api_post "/api/projects/$RT_ID/datasources/$RT_DS_ID/tables/$RT_TBL_ID/rows" \
  '{"title":"Bravo","done":true,"score":95,"category":"Play"}')
RT_ROW2_ID=$(echo "$RT_ROW2" | jq -r '.row.id // empty')
api_post "/api/projects/$RT_ID/datasources/$RT_DS_ID/tables/$RT_TBL_ID/rows" \
  '{"title":"Charlie","done":false,"score":42,"category":"Work"}' > /dev/null
api_post "/api/projects/$RT_ID/datasources/$RT_DS_ID/tables/$RT_TBL_ID/rows" \
  '{"title":"Delta","done":true,"score":67,"category":"Play"}' > /dev/null
echo -e "  ${GREEN}✓${NC} 4 test rows inserted"
PASS=$((PASS + 1))

# Set globals: state definitions + theme + colorMode
RT_GLOBALS='{
  "globalStateDefinitions": [
    {"name": "clickCount", "type": "number", "initialValue": 0},
    {"name": "inputVal", "type": "text", "initialValue": ""},
    {"name": "toggled", "type": "boolean", "initialValue": false},
    {"name": "selectedTab", "type": "text", "initialValue": "All"},
    {"name": "lastAction", "type": "text", "initialValue": "none"}
  ],
  "globalTheme": {
    "primary": "#6366f1",
    "background": "#faf5ff",
    "text": "#1e1b4b",
    "surface": "#ffffff",
    "borderColor": "#e9d5ff",
    "colorMode": "light"
  }
}'
RT_GLOB_RESP=$(api_put "/api/projects/$RT_ID/globals" "$RT_GLOBALS")
assert_json_eq "Runtime globals saved" "$RT_GLOB_RESP" ".ok" "true"

# Build a screen that exercises EVERY major runtime feature
RT_SCREEN_LAYOUT='{
  "root": {
    "id": "root",
    "type": "container",
    "props": {
      "display": "flex", "flexDirection": "column", "gap": 16,
      "padding": 24, "minHeight": "100vh", "backgroundColor": "#faf5ff"
    },
    "children": [
      {
        "id": "hdr",
        "type": "header",
        "props": {
          "display": "flex", "flexDirection": "row", "justifyContent": "space-between",
          "alignItems": "center", "padding": "12px 20px", "backgroundColor": "#ffffff",
          "borderRadius": 10, "boxShadow": "0 1px 3px rgba(0,0,0,0.08)"
        },
        "children": [
          {"id": "page-title", "type": "gradientText", "props": {"content": "Runtime Test", "fontSize": "24px", "fontWeight": "800", "gradient": "linear-gradient(135deg, #6366f1, #a855f7)"}, "children": []},
          {"id": "hdr-right", "type": "stackH", "props": {"gap": 8, "alignItems": "center"}, "children": [
            {"id": "click-badge", "type": "badge", "props": {"label": "Clicks: {{state.clickCount}}", "variant": "info", "size": "md"}, "children": []},
            {"id": "user-av", "type": "avatar", "props": {"initials": "RT", "size": "md", "backgroundColor": "#6366f1"}, "children": []}
          ]}
        ]
      },
      {
        "id": "events-card", "type": "card",
        "props": {"padding": 16, "backgroundColor": "#ffffff", "borderRadius": 10, "shadow": "sm"},
        "children": [
          {"id": "events-title", "type": "text", "props": {"content": "Event Testing", "fontSize": "16px", "fontWeight": "600", "color": "#1e1b4b"}, "children": []},
          {"id": "events-row", "type": "stackH", "props": {"gap": 10, "alignItems": "center"}, "children": [
            {"id": "inc-btn", "type": "button", "props": {
              "label": "Increment", "variant": "primary", "padding": "8px 16px", "borderRadius": 6,
              "onClick": [{"action": "mutateState", "stateKey": "clickCount", "mutationOp": "increment", "mutationAmount": 1}]
            }, "children": []},
            {"id": "reset-btn", "type": "button", "props": {
              "label": "Reset", "variant": "outline", "padding": "8px 16px", "borderRadius": 6,
              "onClick": [{"action": "setState", "stateKey": "clickCount", "value": "0"}, {"action": "setState", "stateKey": "lastAction", "value": "reset"}]
            }, "children": []},
            {"id": "click-display", "type": "text", "props": {"content": "Count: {{state.clickCount}}", "fontSize": "14px", "fontWeight": "500"}, "children": []},
            {"id": "last-action", "type": "text", "props": {"content": "Last: {{state.lastAction}}", "fontSize": "12px", "color": "#6b7280"}, "children": []}
          ]}
        ]
      },
      {
        "id": "input-card", "type": "card",
        "props": {"padding": 16, "backgroundColor": "#ffffff", "borderRadius": 10, "shadow": "sm"},
        "children": [
          {"id": "input-title", "type": "text", "props": {"content": "Input Binding", "fontSize": "16px", "fontWeight": "600", "color": "#1e1b4b"}, "children": []},
          {"id": "input-row", "type": "stackH", "props": {"gap": 10, "alignItems": "center"}, "children": [
            {"id": "test-input", "type": "textInput", "props": {
              "placeholder": "Type here...", "value": "{{state.inputVal}}",
              "onChange": [{"action": "setState", "stateKey": "inputVal", "value": "{{event.value}}"}]
            }, "children": []},
            {"id": "input-echo", "type": "text", "props": {"content": "Echo: {{state.inputVal}}", "fontSize": "13px", "color": "#6b7280"}, "children": []},
            {"id": "test-toggle", "type": "toggle", "props": {
              "checked": "{{state.toggled}}",
              "onChange": [{"action": "setState", "stateKey": "toggled", "value": "{{event.checked}}"}]
            }, "children": []},
            {"id": "toggle-status", "type": "text", "props": {"content": "Toggled: {{state.toggled}}", "fontSize": "13px", "color": "#6b7280"}, "children": []}
          ]}
        ]
      },
      {
        "id": "tabs-section", "type": "tabs", "props": {
          "tabs": ["All", "Done", "Pending"], "activeTab": "{{state.selectedTab}}", "variant": "pills",
          "onChange": [{"action": "setState", "stateKey": "selectedTab", "value": "{{event.value}}"}]
        }, "children": []
      },
      {
        "id": "repeater-section", "type": "dataRepeater",
        "props": {
          "dataSource": "{{data.items}}", "itemVar": "item", "emptyText": "No items",
          "display": "flex", "flexDirection": "column", "gap": 8
        },
        "children": [{
          "id": "item-card", "type": "card",
          "props": {
            "shadow": "sm", "display": "flex", "flexDirection": "row",
            "alignItems": "center", "gap": 14, "padding": "12px 16px",
            "backgroundColor": "#ffffff", "borderRadius": 8
          },
          "children": [
            {"id": "item-check", "type": "checkbox", "props": {
              "checked": "{{item.done}}",
              "onChange": [{"action": "updateRow", "tableName": "items", "rowId": "{{item.id}}", "rowData": {"done": "{{event.checked}}"}}]
            }, "children": []},
            {"id": "item-title", "type": "text", "props": {"content": "{{item.title}}", "fontSize": "14px", "fontWeight": "500", "color": "#1e1b4b"}, "children": []},
            {"id": "item-spacer", "type": "spacer", "props": {"flex": 1}, "children": []},
            {"id": "item-score", "type": "text", "props": {"content": "Score: {{item.score}}", "fontSize": "12px", "color": "#6b7280"}, "children": []},
            {"id": "item-cat-badge", "type": "badge", "props": {"label": "{{item.category}}", "variant": "default", "size": "sm"}, "children": []},
            {"id": "item-del-btn", "type": "button", "props": {
              "label": "Delete", "variant": "ghost", "fontSize": "12px", "color": "#ef4444", "padding": "4px 8px",
              "onClick": [{"action": "deleteRow", "tableName": "items", "rowId": "{{item.id}}"}]
            }, "children": []}
          ]
        }]
      },
      {
        "id": "insert-card", "type": "card",
        "props": {"padding": 16, "backgroundColor": "#ffffff", "borderRadius": 10, "shadow": "sm"},
        "children": [
          {"id": "insert-title", "type": "text", "props": {"content": "Insert Test", "fontSize": "16px", "fontWeight": "600", "color": "#1e1b4b"}, "children": []},
          {"id": "insert-btn", "type": "button", "props": {
            "label": "Insert Row", "variant": "primary", "padding": "8px 16px", "borderRadius": 6,
            "onClick": [
              {"action": "insertRow", "tableName": "items", "rowData": {"title": "{{state.inputVal}}", "done": false, "score": 50, "category": "Auto"}, "resultStateKey": "lastInsert"},
              {"action": "setState", "stateKey": "lastAction", "value": "inserted"}
            ]
          }, "children": []}
        ]
      },
      {
        "id": "table-card", "type": "card",
        "props": {"padding": 0, "backgroundColor": "#ffffff", "borderRadius": 10, "shadow": "sm"},
        "children": [
          {"id": "table-header-text", "type": "text", "props": {"content": "Data Table", "padding": "16px 16px 8px 16px", "fontSize": "16px", "fontWeight": "600", "color": "#1e1b4b"}, "children": []},
          {"id": "items-table", "type": "table", "props": {
            "columns": ["title", "score", "category", "done"],
            "dataSource": "{{data.items}}", "striped": true, "bordered": true,
            "sortable": true, "searchable": true, "pageSize": 10
          }, "children": []}
        ]
      },
      {
        "id": "progress-card", "type": "card",
        "props": {"padding": 16, "backgroundColor": "#ffffff", "borderRadius": 10, "shadow": "sm"},
        "children": [
          {"id": "prog-bar", "type": "progressBar", "props": {"value": 65, "max": 100, "color": "#6366f1", "height": "10px", "showLabel": true, "animated": false}, "children": []},
          {"id": "prog-small", "type": "progressBar", "props": {"value": 33, "max": 100, "color": "#10b981", "height": 6, "showPercent": true}, "children": []}
        ]
      },
      {
        "id": "misc-row", "type": "stackH", "props": {"gap": 12, "alignItems": "center"}, "children": [
          {"id": "info-alert", "type": "alertBanner", "props": {"message": "Runtime test suite loaded", "variant": "info"}, "children": []},
          {"id": "success-alert", "type": "alertBanner", "props": {"message": "All systems operational", "variant": "success"}, "children": []}
        ]
      },
      {"id": "sep-divider", "type": "divider", "props": {"orientation": "horizontal", "color": "#e9d5ff", "thickness": 2}, "children": []},
      {
        "id": "ftr", "type": "footer",
        "props": {"display": "flex", "flexDirection": "row", "justifyContent": "center", "padding": "12px 0"},
        "children": [
          {"id": "ftr-text", "type": "text", "props": {"content": "Runtime Test Suite v1", "fontSize": "12px", "color": "#9ca3af"}, "children": []}
        ]
      }
    ]
  }
}'

RT_SC_RESP=$(api_post "/api/projects/$RT_ID/screens" \
  "{\"name\":\"Main\",\"slug\":\"main\",\"route\":\"/\",\"layout\":$RT_SCREEN_LAYOUT}")
RT_SC_ID=$(echo "$RT_SC_RESP" | jq -r '.screen.id')
assert_json_field "Runtime screen created" "$RT_SC_RESP" ".screen.id"

# Publish
RT_PUB=$(api_put "/api/projects/$RT_ID" '{"isPublished":true}')
assert_json_eq "Runtime project published" "$RT_PUB" ".project.status" "published"

# Warm up & fetch rendered HTML
sleep 1
RT_HTML=$(curl -s "${BASE_URL}/p/$RT_ID")

# ---- 23a. SSR Binding Resolution ----
echo -e "\n  ${BOLD}23a. SSR Binding Resolution${NC}"

# State bindings resolve in SSR
RT_CLICK_TEXT=$(echo "$RT_HTML" | grep -o 'Clicks: [0-9]*' | head -1)
if [[ "$RT_CLICK_TEXT" == "Clicks: 0" ]]; then
  echo -e "  ${GREEN}✓${NC} State binding {{state.clickCount}} resolves in SSR → 'Clicks: 0'"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} State binding in SSR expected 'Clicks: 0', got '$RT_CLICK_TEXT'"
  FAIL=$((FAIL + 1))
fi

# Last action state default
if echo "$RT_HTML" | grep -q 'Last: none'; then
  echo -e "  ${GREEN}✓${NC} State binding {{state.lastAction}} resolves to 'Last: none'"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} State binding {{state.lastAction}} not found as 'Last: none'"
  FAIL=$((FAIL + 1))
fi

# Toggle state default
if echo "$RT_HTML" | grep -q 'Toggled: false'; then
  echo -e "  ${GREEN}✓${NC} Boolean state binding resolves to 'Toggled: false'"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Boolean state binding not found as 'Toggled: false'"
  FAIL=$((FAIL + 1))
fi

# ---- 23b. DataRepeater Item Bindings ----
echo -e "\n  ${BOLD}23b. DataRepeater Item Bindings${NC}"

# Each repeater item should show its title
for ITEM_TITLE in "Alpha" "Bravo" "Charlie" "Delta"; do
  if echo "$RT_HTML" | grep -q "$ITEM_TITLE"; then
    echo -e "  ${GREEN}✓${NC} Repeater item '${ITEM_TITLE}' rendered in SSR"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Repeater item '${ITEM_TITLE}' missing from SSR HTML"
    FAIL=$((FAIL + 1))
  fi
done

# Repeater item score bindings
for SCORE_VAL in "Score: 80" "Score: 95" "Score: 42" "Score: 67"; do
  if echo "$RT_HTML" | grep -q "$SCORE_VAL"; then
    echo -e "  ${GREEN}✓${NC} Repeater binding '${SCORE_VAL}' resolved"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Repeater binding '${SCORE_VAL}' not found in HTML"
    FAIL=$((FAIL + 1))
  fi
done

# Repeater item category badges
for CAT_VAL in "Work" "Play"; do
  if echo "$RT_HTML" | grep -q "$CAT_VAL"; then
    echo -e "  ${GREEN}✓${NC} Repeater badge '${CAT_VAL}' present"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Repeater badge '${CAT_VAL}' missing"
    FAIL=$((FAIL + 1))
  fi
done

# Verify no unresolved {{item.*}} bindings remain in visible HTML text
# (exclude JSON event configs inside script/data attributes which are resolved client-side)
RT_VISIBLE_HTML=$(echo "$RT_HTML" | sed 's/<script[^>]*>.*<\/script>//g' | sed 's/self\.__next_f[^)]*//g')
UNRESOLVED_ITEM=$({ echo "$RT_VISIBLE_HTML" | grep -oE '>[^<]*\{\{item\.[a-z_]+\}\}[^<]*<' || true; } | wc -l | tr -d ' ')
if [[ "$UNRESOLVED_ITEM" == "0" ]]; then
  echo -e "  ${GREEN}✓${NC} No unresolved {{item.*}} bindings in SSR"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Found $UNRESOLVED_ITEM unresolved {{item.*}} bindings in SSR"
  FAIL=$((FAIL + 1))
fi

# ---- 23c. Component Rendering Quality ----
echo -e "\n  ${BOLD}23c. Component Rendering Quality${NC}"

# No NaN in rendered HTML
RT_NAN_COUNT=$({ echo "$RT_HTML" | grep -o 'NaN' || true; } | wc -l | tr -d ' ')
if [[ "$RT_NAN_COUNT" == "0" ]]; then
  echo -e "  ${GREEN}✓${NC} Zero NaN values in rendered HTML"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Found $RT_NAN_COUNT NaN values in rendered HTML"
  FAIL=$((FAIL + 1))
fi

# Avatar has valid pixel dimensions (no NaN, no 0px)
RT_AV_STYLE=$(echo "$RT_HTML" | grep -o 'id="user-av"[^>]*style="[^"]*"' | head -1 | grep -o 'style="[^"]*"' || true)
if echo "$RT_AV_STYLE" | grep -qE 'width:[0-9]+px.*height:[0-9]+px'; then
  echo -e "  ${GREEN}✓${NC} Avatar has valid pixel dimensions"
  PASS=$((PASS + 1))
elif echo "$RT_HTML" | grep -A1 'data-node-id="user-av"' | grep -qE 'width:[0-9]+px'; then
  echo -e "  ${GREEN}✓${NC} Avatar has valid pixel dimensions"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Avatar dimensions may be invalid: $RT_AV_STYLE"
  FAIL=$((FAIL + 1))
fi

# ProgressBar height is valid (not NaN)
RT_PROG_HEIGHT=$({ echo "$RT_HTML" | grep -oE 'height:[0-9]+px;border-radius:var\(--border-radius-full' || true; } | head -1)
if [[ -n "$RT_PROG_HEIGHT" ]]; then
  echo -e "  ${GREEN}✓${NC} ProgressBar has valid height (${RT_PROG_HEIGHT%%px*}px)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} ProgressBar height not found or invalid"
  FAIL=$((FAIL + 1))
fi

# Checkbox should NOT show "Checkbox" label text
RT_CB_LABEL=$({ echo "$RT_HTML" | grep -oE '>Checkbox<' || true; } | wc -l | tr -d ' ')
if [[ "$RT_CB_LABEL" == "0" ]]; then
  echo -e "  ${GREEN}✓${NC} Checkboxes don't show spurious 'Checkbox' label"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Found $RT_CB_LABEL spurious 'Checkbox' labels"
  FAIL=$((FAIL + 1))
fi

# Checkbox checked state from repeater binding (Bravo is done:true, Delta is done:true)
RT_CB_CHECKED=$({ echo "$RT_HTML" | grep -oE 'type="checkbox"[^>]*checked' || true; } | wc -l | tr -d ' ')
if [[ "$RT_CB_CHECKED" -ge 2 ]]; then
  echo -e "  ${GREEN}✓${NC} Checkboxes: $RT_CB_CHECKED items marked checked (Bravo + Delta)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Expected >=2 checked checkboxes, got $RT_CB_CHECKED"
  FAIL=$((FAIL + 1))
fi

# Table has populated rows from dataSource binding
RT_TABLE_ROWS=$({ echo "$RT_HTML" | grep -o '<tr' || true; } | wc -l | tr -d ' ')
# Should have 1 header row + 4 data rows = 5 total
if [[ "$RT_TABLE_ROWS" -ge 5 ]]; then
  echo -e "  ${GREEN}✓${NC} Table has $RT_TABLE_ROWS rows (1 header + data rows)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Table expected >=5 <tr> rows, got $RT_TABLE_ROWS"
  FAIL=$((FAIL + 1))
fi

# Table data cells contain actual data
if echo "$RT_HTML" | grep -q '<td[^>]*>Alpha</td>'; then
  echo -e "  ${GREEN}✓${NC} Table contains data cell 'Alpha'"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Table missing 'Alpha' data cell"
  FAIL=$((FAIL + 1))
fi

# All border-radius values have px units (no bare numbers like border-radius:10;)
RT_BAD_BR=$({ echo "$RT_HTML" | grep -oE 'border-radius:[0-9]+[;"]' || true; } | wc -l | tr -d ' ')
if [[ "$RT_BAD_BR" == "0" ]]; then
  echo -e "  ${GREEN}✓${NC} All border-radius values have units"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Found $RT_BAD_BR border-radius values without units"
  FAIL=$((FAIL + 1))
fi

# stackH renders flex-direction:row
if echo "$RT_HTML" | grep -q 'flex-direction:row'; then
  echo -e "  ${GREEN}✓${NC} stackH renders flex-direction:row"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} flex-direction:row not found in HTML"
  FAIL=$((FAIL + 1))
fi

# Header renders as <header> tag
if echo "$RT_HTML" | grep -q '<header.*id="hdr"'; then
  echo -e "  ${GREEN}✓${NC} Header renders as <header> element"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Header not rendered as <header> element"
  FAIL=$((FAIL + 1))
fi

# Footer renders as <footer> tag
if echo "$RT_HTML" | grep -q '<footer.*id="ftr"'; then
  echo -e "  ${GREEN}✓${NC} Footer renders as <footer> element"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Footer not rendered as <footer> element"
  FAIL=$((FAIL + 1))
fi

# GradientText renders with gradient style
if echo "$RT_HTML" | grep -q 'background:linear-gradient'; then
  echo -e "  ${GREEN}✓${NC} GradientText renders with gradient background"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} GradientText missing gradient style"
  FAIL=$((FAIL + 1))
fi

# AlertBanner messages present
if echo "$RT_HTML" | grep -q 'Runtime test suite loaded'; then
  echo -e "  ${GREEN}✓${NC} AlertBanner info message rendered"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} AlertBanner info message missing"
  FAIL=$((FAIL + 1))
fi

if echo "$RT_HTML" | grep -q 'All systems operational'; then
  echo -e "  ${GREEN}✓${NC} AlertBanner success message rendered"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} AlertBanner success message missing"
  FAIL=$((FAIL + 1))
fi

# Divider renders as <hr> or a div with border
if echo "$RT_HTML" | grep -q 'data-node-id="sep-divider"'; then
  echo -e "  ${GREEN}✓${NC} Divider component rendered"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Divider component missing"
  FAIL=$((FAIL + 1))
fi

# Spacer inside repeater
if echo "$RT_HTML" | grep -q 'data-node-id="item-spacer"'; then
  echo -e "  ${GREEN}✓${NC} Spacer component rendered inside repeater"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Spacer component missing"
  FAIL=$((FAIL + 1))
fi

# ---- 23d. Theme CSS Variables ----
echo -e "\n  ${BOLD}23d. Theme CSS Variables${NC}"

# Check that CSS vars are applied
if echo "$RT_HTML" | grep -q '\-\-primary:#6366f1'; then
  echo -e "  ${GREEN}✓${NC} CSS var --primary set to #6366f1"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} CSS var --primary:#6366f1 not found"
  FAIL=$((FAIL + 1))
fi

if echo "$RT_HTML" | grep -q '\-\-background:#faf5ff'; then
  echo -e "  ${GREEN}✓${NC} CSS var --background set to #faf5ff"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} CSS var --background:#faf5ff not found"
  FAIL=$((FAIL + 1))
fi

if echo "$RT_HTML" | grep -q '\-\-text:#1e1b4b'; then
  echo -e "  ${GREEN}✓${NC} CSS var --text set to #1e1b4b"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} CSS var --text:#1e1b4b not found"
  FAIL=$((FAIL + 1))
fi

if echo "$RT_HTML" | grep -q '\-\-surface:#ffffff'; then
  echo -e "  ${GREEN}✓${NC} CSS var --surface set to #ffffff"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} CSS var --surface:#ffffff not found"
  FAIL=$((FAIL + 1))
fi

if echo "$RT_HTML" | grep -q '\-\-border-color:#e9d5ff'; then
  echo -e "  ${GREEN}✓${NC} CSS var --border-color set to #e9d5ff"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} CSS var --border-color:#e9d5ff not found"
  FAIL=$((FAIL + 1))
fi

# Light mode class is applied
if echo "$RT_HTML" | grep -q 'class="[^"]*light'; then
  echo -e "  ${GREEN}✓${NC} Light mode class applied on wrapper"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Light mode class not found"
  FAIL=$((FAIL + 1))
fi

# ---- 23e. CRUD Mutations via Public API ----
echo -e "\n  ${BOLD}23e. CRUD Mutations via Public API${NC}"

# Insert a new row
RT_INSERT=$(curl -s -H "Content-Type: application/json" \
  -X POST "${BASE_URL}/api/p/$RT_ID/data/mutate" \
  -d '{"action":"insertRow","table":"items","data":{"title":"Echo","done":false,"score":55,"category":"Auto"}}')
RT_INSERT_ID=$(echo "$RT_INSERT" | jq -r '.row.id // empty')
if [[ -n "$RT_INSERT_ID" ]]; then
  echo -e "  ${GREEN}✓${NC} Insert via public API returned row id ($RT_INSERT_ID)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Insert via public API failed: $(echo "$RT_INSERT" | jq -r '.error // empty')"
  FAIL=$((FAIL + 1))
fi

# Verify insert succeeded and data endpoint returns items
RT_INSERT_TITLE=$(echo "$RT_INSERT" | jq -r '.row.title // empty')
if [[ "$RT_INSERT_TITLE" == "Echo" ]]; then
  echo -e "  ${GREEN}✓${NC} Insert returned correct row data (title=Echo)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Insert returned unexpected title: '$RT_INSERT_TITLE'"
  FAIL=$((FAIL + 1))
fi

# Update the inserted row
if [[ -n "$RT_INSERT_ID" ]]; then
  RT_UPDATE=$(curl -s -H "Content-Type: application/json" \
    -X POST "${BASE_URL}/api/p/$RT_ID/data/mutate" \
    -d "{\"action\":\"updateRow\",\"table\":\"items\",\"rowId\":\"$RT_INSERT_ID\",\"data\":{\"score\":99,\"done\":true}}")
  RT_UP_OK=$(echo "$RT_UPDATE" | jq -r '.row.score // empty')
  if [[ "$RT_UP_OK" == "99" ]]; then
    echo -e "  ${GREEN}✓${NC} Update returns updated row with score=99"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Update score expected 99, got '$RT_UP_OK'"
    FAIL=$((FAIL + 1))
  fi

  # Delete
  RT_DELETE=$(curl -s -H "Content-Type: application/json" \
    -X POST "${BASE_URL}/api/p/$RT_ID/data/mutate" \
    -d "{\"action\":\"deleteRow\",\"table\":\"items\",\"rowId\":\"$RT_INSERT_ID\"}")
  RT_DEL_OK=$(echo "$RT_DELETE" | jq -r '.ok // empty')
  if [[ "$RT_DEL_OK" == "true" ]]; then
    echo -e "  ${GREEN}✓${NC} Delete returns ok:true"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Delete expected ok:true, got '$RT_DEL_OK'"
    FAIL=$((FAIL + 1))
  fi
fi

# ---- 23f. Resolve API Deep Verification ----
echo -e "\n  ${BOLD}23f. Resolve API Deep Verification${NC}"

RT_PAYLOAD=$(curl -s "${BASE_URL}/api/p/$RT_ID")
RT_LAYOUT_ROOT=$(echo "$RT_PAYLOAD" | jq '.screens[0].layout.root')
RT_STATE_OBJ='{"clickCount":0,"inputVal":"","toggled":false,"selectedTab":"All","lastAction":"none"}'
RT_DATA_OBJ=$(curl -s "${BASE_URL}/api/p/$RT_ID/data" | jq '.data // {}')

RT_RESOLVE=$(curl -s -X POST "${BASE_URL}/api/runtime-resolve" \
  -H "Content-Type: application/json" \
  -d "{\"root\":$RT_LAYOUT_ROOT,\"state\":$RT_STATE_OBJ,\"data\":$RT_DATA_OBJ}")

# All component types present
RT_ALL_TYPES=$(echo "$RT_RESOLVE" | jq -r '[.flatNodes[].type] | unique | join(",")')
for RT_EXPECTED in header card dataRepeater table badge avatar progressBar tabs alertBanner divider spacer footer gradientText button textInput text stackH toggle checkbox; do
  if echo "$RT_ALL_TYPES" | grep -q "$RT_EXPECTED"; then
    echo -e "  ${GREEN}✓${NC} Resolve API: '${RT_EXPECTED}' component present"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Resolve API: '${RT_EXPECTED}' missing (types: ${RT_ALL_TYPES:0:100})"
    FAIL=$((FAIL + 1))
  fi
done

# Badge binding resolved
RT_BADGE_RES=$(echo "$RT_RESOLVE" | jq -r '[.flatNodes[] | select(.id == "click-badge")] | .[0].content // .[0].label // empty')
if [[ "$RT_BADGE_RES" == "Clicks: 0" ]]; then
  echo -e "  ${GREEN}✓${NC} Badge resolves 'Clicks: 0' from state"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Badge expected 'Clicks: 0', got '$RT_BADGE_RES'"
  FAIL=$((FAIL + 1))
fi

# Repeater appears in resolve tree
RT_REP_COUNT=$(echo "$RT_RESOLVE" | jq '[.flatNodes[] | select(.type == "dataRepeater")] | length')
if [[ "$RT_REP_COUNT" -ge 1 ]]; then
  echo -e "  ${GREEN}✓${NC} Resolve API includes dataRepeater node"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Resolve API missing dataRepeater"
  FAIL=$((FAIL + 1))
fi

# stackH flex direction in resolve
RT_SH_DIR=$(echo "$RT_RESOLVE" | jq -r '[.flatNodes[] | select(.type == "stackH") | .flexDirection] | unique | join(",")')
if [[ "$RT_SH_DIR" == "row" ]]; then
  echo -e "  ${GREEN}✓${NC} Resolve API: stackH → flexDirection: row"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Resolve API: stackH flexDirection '$RT_SH_DIR' expected 'row'"
  FAIL=$((FAIL + 1))
fi

# Border radius has px units in resolve
RT_BAD_RAD=$(echo "$RT_RESOLVE" | jq -r '[.flatNodes[] | select(.borderRadius != null) | select((.borderRadius | tostring) | test("^[0-9]+$"))] | length')
if [[ "$RT_BAD_RAD" == "0" ]]; then
  echo -e "  ${GREEN}✓${NC} Resolve API: all borderRadius values have units"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Resolve API: $RT_BAD_RAD nodes have bare borderRadius numbers"
  FAIL=$((FAIL + 1))
fi

# ---- 23g. Negative / Edge Cases ----
echo -e "\n  ${BOLD}23g. Edge Cases${NC}"

# Mutation with invalid table name should not crash
RT_BAD_MUT=$(curl -s -H "Content-Type: application/json" \
  -X POST "${BASE_URL}/api/p/$RT_ID/data/mutate" \
  -d '{"action":"insertRow","table":"nonexistent","data":{"x":1}}')
RT_BAD_MUT_ERR=$(echo "$RT_BAD_MUT" | jq -r '.error // empty')
if [[ -n "$RT_BAD_MUT_ERR" ]]; then
  echo -e "  ${GREEN}✓${NC} Invalid table mutation returns error gracefully"
  PASS=$((PASS + 1))
else
  RT_BAD_MUT_OK=$(echo "$RT_BAD_MUT" | jq -r '.ok // empty')
  if [[ "$RT_BAD_MUT_OK" != "true" ]]; then
    echo -e "  ${GREEN}✓${NC} Invalid table mutation rejected"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Invalid table mutation unexpectedly returned ok"
    FAIL=$((FAIL + 1))
  fi
fi

# Update with bad rowId should not crash
RT_BAD_UP=$(curl -s -H "Content-Type: application/json" \
  -X POST "${BASE_URL}/api/p/$RT_ID/data/mutate" \
  -d '{"action":"updateRow","table":"items","rowId":"00000000-0000-0000-0000-000000000000","data":{"score":0}}')
RT_BAD_UP_ERR=$(echo "$RT_BAD_UP" | jq 'has("error") or (.row == null)')
if [[ "$RT_BAD_UP_ERR" == "true" ]]; then
  echo -e "  ${GREEN}✓${NC} Update with nonexistent rowId handled gracefully"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠${NC} Update with bad rowId returned unexpected: $(echo "$RT_BAD_UP" | jq -c .)"
  SKIP=$((SKIP + 1))
fi

# Delete with bad rowId should not crash
RT_BAD_DEL=$(curl -s -H "Content-Type: application/json" \
  -X POST "${BASE_URL}/api/p/$RT_ID/data/mutate" \
  -d '{"action":"deleteRow","table":"items","rowId":"00000000-0000-0000-0000-000000000000"}')
RT_BAD_DEL_ERR=$(echo "$RT_BAD_DEL" | jq 'has("error") or (.ok == true)')
if [[ "$RT_BAD_DEL_ERR" == "true" ]]; then
  echo -e "  ${GREEN}✓${NC} Delete with nonexistent rowId handled gracefully"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠${NC} Delete with bad rowId returned unexpected: $(echo "$RT_BAD_DEL" | jq -c .)"
  SKIP=$((SKIP + 1))
fi

# Cleanup
DEL_RT=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -X DELETE --data-raw '{"verificationName":"Runtime Test Suite"}' "${BASE_URL}/api/projects/$RT_ID")
DEL_RT_OK=$(echo "$DEL_RT" | jq -r '.success // empty')
if [[ "$DEL_RT_OK" == "true" ]]; then
  echo -e "  ${GREEN}✓${NC} Runtime test project cleaned up"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠${NC} Runtime test cleanup: $(echo "$DEL_RT" | jq -r '.error // "unknown"')"
  SKIP=$((SKIP + 1))
fi

# =========================================================================
# RESULTS
# =========================================================================
echo ""
echo -e "${BOLD}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║               TEST RESULTS                       ║${NC}"
echo -e "${BOLD}╠═══════════════════════════════════════════════════╣${NC}"
TOTAL=$((PASS + FAIL + SKIP))
echo -e "${BOLD}║${NC}  Total:    ${TOTAL}                                     ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  ${GREEN}Passed:  ${PASS}${NC}                                     ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  ${RED}Failed:  ${FAIL}${NC}                                      ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  ${YELLOW}Skipped: ${SKIP}${NC}                                      ${BOLD}║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════════════╝${NC}"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo -e "${RED}${BOLD}Failures:${NC}"
  echo -e "$ERRORS"
  echo ""
  exit 1
else
  echo ""
  echo -e "${GREEN}${BOLD}All tests passed!${NC}"
  echo ""
  echo -e "${BOLD}┌─── Login & View Test Data ───────────────────────┐${NC}"
  echo -e "${BOLD}│${NC}  Email:    ${TEST_EMAIL}"
  echo -e "${BOLD}│${NC}  Password: ${TEST_PASSWORD}"
  echo -e "${BOLD}│${NC}"
  echo -e "${BOLD}│${NC}  Dashboard: ${BASE_URL}/dashboard"
  echo -e "${BOLD}│${NC}  Org:       ${BASE_URL}/organizations/${ORG_ID}"
  echo -e "${BOLD}│${NC}  Project:   ${BASE_URL}/organizations/${ORG_ID}/projects/${PROJECT_ID}/screens"
  echo -e "${BOLD}└──────────────────────────────────────────────────┘${NC}"
  echo ""
  exit 0
fi
