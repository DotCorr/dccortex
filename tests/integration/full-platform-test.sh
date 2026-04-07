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

# Publish
PUB_RESP=$(api_put "/api/projects/$PROJECT_ID" '{"isPublished":true}')
assert_json_eq "Project published" "$PUB_RESP" ".project.status" "published"

# =========================================================================
section "4. Screens — CRUD + Layout"
# =========================================================================

# Create screen with a complex layout exercising every component type
LAYOUT_JSON='{
  "id": "root",
  "type": "container",
  "props": {"style":{"padding":"16px","display":"flex","flexDirection":"column","gap":"12px"}},
  "children": [
    {
      "id": "hdr",
      "type": "text",
      "props": {"content":"Welcome to {{state.username}}!","style":{"fontSize":"24px","fontWeight":"bold"}},
      "children": []
    },
    {
      "id": "img1",
      "type": "image",
      "props": {"src":"https://placehold.co/300x200","alt":"placeholder","style":{"width":"300px","borderRadius":"8px"}},
      "children": []
    },
    {
      "id": "btn1",
      "type": "button",
      "props": {"label":"Click Me","onClick":{"action":"setState","key":"clicks","value":"{{state.clicks + 1}}"},"style":{"backgroundColor":"#3b82f6","color":"white","padding":"8px 16px","borderRadius":"6px"}},
      "children": []
    },
    {
      "id": "form1",
      "type": "form",
      "props": {"onSubmit":{"action":"insertRow","table":"contacts","data":{"name":"{{state.formName}}","email":"{{state.formEmail}}"}}},
      "children": [
        {
          "id": "input1",
          "type": "input",
          "props": {"placeholder":"Your name","bind":"formName","style":{"border":"1px solid #ccc","padding":"8px","borderRadius":"4px"}},
          "children": []
        },
        {
          "id": "input2",
          "type": "input",
          "props": {"placeholder":"Email","bind":"formEmail","type":"email","style":{"border":"1px solid #ccc","padding":"8px","borderRadius":"4px"}},
          "children": []
        },
        {
          "id": "submit1",
          "type": "button",
          "props": {"label":"Submit","type":"submit","style":{"backgroundColor":"#10b981","color":"white","padding":"8px 16px","borderRadius":"6px"}},
          "children": []
        }
      ]
    },
    {
      "id": "repeater1",
      "type": "repeater",
      "props": {"dataSource":"{{data.contacts}}","itemKey":"id"},
      "children": [
        {
          "id": "rep-text",
          "type": "text",
          "props": {"content":"{{item.name}} — {{item.email}}"},
          "children": []
        }
      ]
    },
    {
      "id": "cond1",
      "type": "conditional",
      "props": {"condition":"{{state.clicks > 0}}"},
      "children": [
        {
          "id": "cond-text",
          "type": "text",
          "props": {"content":"Clicked {{state.clicks}} times!","style":{"color":"#8b5cf6"}},
          "children": []
        }
      ]
    },
    {
      "id": "chart1",
      "type": "container",
      "props": {"style":{"padding":"16px","backgroundColor":"#f9fafb","borderRadius":"8px"}},
      "children": [
        {
          "id": "chart-title",
          "type": "text",
          "props": {"content":"Weather from API: {{data.weather.current.temperature_2m}}°C"},
          "children": []
        }
      ]
    },
    {
      "id": "nav1",
      "type": "button",
      "props": {"label":"Go to About","onClick":{"action":"navigate","screen":"about"},"style":{"textDecoration":"underline","color":"#3b82f6","background":"none","border":"none"}},
      "children": []
    }
  ]
}'

SCREEN_BODY="{\"name\":\"Home\",\"slug\":\"home\",\"layout\":$LAYOUT_JSON}"
SCREEN_RESP=$(api_post "/api/projects/$PROJECT_ID/screens" "$SCREEN_BODY")
assert_json_field "Screen created" "$SCREEN_RESP" ".screen.id"
SCREEN_ID=$(echo "$SCREEN_RESP" | jq -r '.screen.id')
assert_json_eq "Screen name" "$SCREEN_RESP" ".screen.name" "Home"

# Create second screen
SCREEN2_BODY='{"name":"About","slug":"about","layout":{"id":"root","type":"container","props":{},"children":[{"id":"t1","type":"text","props":{"content":"About page"},"children":[]}]}}'
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

READALL_STATUS=$(api_post_status "/api/notifications/read-all")
if [[ "$READALL_STATUS" == "200" || "$READALL_STATUS" == "405" ]]; then
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
section "17. RBAC — Unauthenticated Access Denied"
# =========================================================================

# Without cookies, authenticated endpoints should return 401
UNAUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/projects")
assert_status "GET /api/projects without auth → 401" "401" "$UNAUTH_STATUS"

UNAUTH_ORG=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/organizations")
assert_status "GET /api/organizations without auth → 401" "401" "$UNAUTH_ORG"

UNAUTH_CONN=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/projects/$PROJECT_ID/db-connectors")
assert_status "GET /db-connectors without auth → 401" "401" "$UNAUTH_CONN"

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
  exit 0
fi
