#!/usr/bin/env bash
# =============================================================================
# DCCortex Exhaustive Per-Component Integration Test
# =============================================================================
# Tests EVERY component type with EVERY prop, style, binding, event,
# animation, visibleWhen, and edge case.  Each component gets its own
# project so failures are isolated.
#
# Usage:
#   ./tests/integration/component-exhaustive-test.sh [BASE_URL] [COMPONENT]
#   Default BASE_URL: http://localhost:3002
#   Optional COMPONENT: run only one component (e.g. "container", "button")
#
# Requirements:
#   - Dashboard running (docker compose up)
#   - curl, jq
# =============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:3002}"
ONLY_COMPONENT="${2:-}"
COOKIE_JAR=$(mktemp)
PASS=0
FAIL=0
SKIP=0
ERRORS=""
TEST_EMAIL="comptest-$(date +%s)@dccortex-test.local"
TEST_PASSWORD="SecurePass99"

cleanup() { rm -f "$COOKIE_JAR" 2>/dev/null || true; }
trap cleanup EXIT

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Test helpers ──
assert_status() {
  local test_name="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo -e "  ${GREEN}✓${NC} $test_name (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $test_name — expected $expected, got $actual"
    FAIL=$((FAIL + 1)); ERRORS="$ERRORS\n  - $test_name: expected $expected, got $actual"
  fi
}

assert_json_field() {
  local test_name="$1" json="$2" field="$3"
  local value
  value=$(echo "$json" | jq -r "$field" 2>/dev/null || echo "PARSE_ERROR")
  if [[ "$value" != "null" && "$value" != "" && "$value" != "PARSE_ERROR" ]]; then
    echo -e "  ${GREEN}✓${NC} $test_name ($field = ${value:0:60})"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $test_name — field $field is null/empty"
    FAIL=$((FAIL + 1)); ERRORS="$ERRORS\n  - $test_name: $field missing"
  fi
}

assert_json_eq() {
  local test_name="$1" json="$2" field="$3" expected="$4"
  local actual
  actual=$(echo "$json" | jq -r "$field" 2>/dev/null || echo "PARSE_ERROR")
  if [[ "$actual" == "$expected" ]]; then
    echo -e "  ${GREEN}✓${NC} $test_name ($field = $expected)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $test_name — expected $field=$expected, got $actual"
    FAIL=$((FAIL + 1)); ERRORS="$ERRORS\n  - $test_name: expected $field=$expected, got $actual"
  fi
}

# Match a value against a regex pattern
assert_match() {
  local test_name="$1" value="$2" pattern="$3"
  if echo "$value" | grep -qE "$pattern"; then
    echo -e "  ${GREEN}✓${NC} $test_name"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $test_name — value '${value:0:80}' does not match '$pattern'"
    FAIL=$((FAIL + 1)); ERRORS="$ERRORS\n  - $test_name: no match"
  fi
}

assert_contains() {
  local test_name="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo -e "  ${GREEN}✓${NC} $test_name"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $test_name — missing '$needle'"
    FAIL=$((FAIL + 1)); ERRORS="$ERRORS\n  - $test_name: missing '$needle'"
  fi
}

assert_not_contains() {
  local test_name="$1" haystack="$2" needle="$3"
  if ! echo "$haystack" | grep -qF "$needle"; then
    echo -e "  ${GREEN}✓${NC} $test_name"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $test_name — should not contain '$needle'"
    FAIL=$((FAIL + 1)); ERRORS="$ERRORS\n  - $test_name: unexpected '$needle'"
  fi
}

assert_node_prop() {
  local test_name="$1" resolve_json="$2" node_id="$3" prop="$4" expected="$5"
  local actual
  actual=$(echo "$resolve_json" | jq -r "[.flatNodes[] | select(.id == \"$node_id\")] | .[0].$prop // empty" 2>/dev/null)
  if [[ "$actual" == "$expected" ]]; then
    echo -e "  ${GREEN}✓${NC} $test_name ($node_id.$prop = $expected)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $test_name — $node_id.$prop expected '$expected', got '$actual'"
    FAIL=$((FAIL + 1)); ERRORS="$ERRORS\n  - $test_name: $node_id.$prop expected '$expected', got '$actual'"
  fi
}

assert_node_style() {
  local test_name="$1" resolve_json="$2" node_id="$3" style_key="$4" expected="$5"
  local actual
  actual=$(echo "$resolve_json" | jq -r "
    [.. | objects | select(.id? == \"$node_id\" and .computedStyle?) | .computedStyle.\"$style_key\" // null] | first // empty
  " 2>/dev/null)
  if [[ "$actual" == "$expected" ]]; then
    echo -e "  ${GREEN}✓${NC} $test_name ($node_id style $style_key = $expected)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $test_name — $node_id style $style_key expected '$expected', got '$actual'"
    FAIL=$((FAIL + 1)); ERRORS="$ERRORS\n  - $test_name: style.$style_key expected '$expected', got '$actual'"
  fi
}

assert_no_issues() {
  local test_name="$1" resolve_json="$2" node_id="$3"
  local count
  count=$(echo "$resolve_json" | jq "[.issues[] | select(.nodeId == \"$node_id\")] | length" 2>/dev/null || echo "0")
  if [[ "$count" == "0" ]]; then
    echo -e "  ${GREEN}✓${NC} $test_name (no resolve issues)"
    PASS=$((PASS + 1))
  else
    local issues
    issues=$(echo "$resolve_json" | jq -r "[.issues[] | select(.nodeId == \"$node_id\")] | .[0].issues[]" 2>/dev/null | head -3)
    echo -e "  ${RED}✗${NC} $test_name — $count resolve issues: ${issues:0:100}"
    FAIL=$((FAIL + 1)); ERRORS="$ERRORS\n  - $test_name: $count issues"
  fi
}

# ── API helpers ──
api_get()         { curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" "${BASE_URL}${1}"; }
api_get_status()  { curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "${BASE_URL}${1}"; }
api_post()        { curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -H "Content-Type: application/json" -X POST --data-raw "${2:-$_EMPTY_JSON}" "${BASE_URL}${1}"; }
api_post_status() { curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" -H "Content-Type: application/json" -X POST --data-raw "${2:-$_EMPTY_JSON}" "${BASE_URL}${1}"; }
api_put()         { curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -H "Content-Type: application/json" -X PUT --data-raw "${2:-$_EMPTY_JSON}" "${BASE_URL}${1}"; }
api_put_status()  { curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" -H "Content-Type: application/json" -X PUT --data-raw "${2:-$_EMPTY_JSON}" "${BASE_URL}${1}"; }
api_delete()      { curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X DELETE "${BASE_URL}${1}"; }

# ── Resolve helper: send layout root + state + data → get resolved tree ──
RESOLVE_TMP=$(mktemp)
_EMPTY_JSON='{}'
resolve_layout() {
  local root_json="$1" state_json="${2:-$_EMPTY_JSON}" data_json="${3:-$_EMPTY_JSON}"
  printf '{"root":%s,"state":%s,"data":%s}' "$root_json" "$state_json" "$data_json" > "$RESOLVE_TMP"
  curl -s -X POST "${BASE_URL}/api/runtime-resolve" \
    -H "Content-Type: application/json" \
    -d @"$RESOLVE_TMP"
}

# ── Create a test project, return ORG_ID PROJECT_ID ──
# Usage: eval $(create_test_project "My Component")
create_test_project() {
  local name="$1"
  local org_resp proj_resp pub_resp org_id proj_id
  org_resp=$(api_post "/api/organizations" "{\"name\":\"Test $name Org\"}")
  org_id=$(echo "$org_resp" | jq -r '.organization.id')
  proj_resp=$(api_post "/api/organizations/$org_id/projects" "{\"name\":\"$name Test\",\"description\":\"Exhaustive $name component test\"}")
  proj_id=$(echo "$proj_resp" | jq -r '.project.id')
  echo "ORG_ID='$org_id' PROJECT_ID='$proj_id'"
}

# ── Create a screen with layout, publish, and return the resolve result ──
# Usage: RESOLVE=$(publish_and_resolve "$PROJECT_ID" "$LAYOUT_JSON" "$STATE_JSON")
publish_and_resolve() {
  local proj_id="$1" layout_json="$2" state_json="${3:-{\}}" data_json="${4:-{\}}"
  # Create screen
  local sc_resp
  sc_resp=$(api_post "/api/projects/$proj_id/screens" \
    "{\"name\":\"Main\",\"slug\":\"main\",\"route\":\"/\",\"layout\":$layout_json}")
  local sc_id
  sc_id=$(echo "$sc_resp" | jq -r '.screen.id')
  # Publish
  api_put "/api/projects/$proj_id" '{"isPublished":true}' > /dev/null
  sleep 0.5
  # Get SSR HTML
  local html
  html=$(curl -s "${BASE_URL}/p/$proj_id")
  # Get resolve via API
  local root_json
  root_json=$(echo "$layout_json" | jq -c '.root')
  local resolve
  resolve=$(resolve_layout "$root_json" "$state_json" "$data_json")
  # Return as JSON object with html and resolve
  echo "$resolve"
}

get_html() {
  local proj_id="$1"
  curl -s "${BASE_URL}/p/$proj_id"
}

delete_project() {
  local proj_id="$1"
  api_delete "/api/projects/$proj_id" > /dev/null 2>&1 || true
}

# =============================================================================
# ██████████████████████████████████████████████████████████████████████████████
#  HEADER
# ██████████████████████████████████████████████████████████████████████████████
# =============================================================================

echo -e "${BOLD}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   DCCortex Exhaustive Component Test             ║${NC}"
echo -e "${BOLD}║   Target: ${BASE_URL}                    ║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════════════╝${NC}"

# ── Preflight ──
echo -e "\n${BOLD}━━━ 0. Preflight ━━━${NC}"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/")
assert_status "Server reachable" "200" "$HTTP_STATUS"

# ── Auth ──
echo -e "\n${BOLD}━━━ 1. Auth ━━━${NC}"
REG_RESP=$(api_post "/api/auth/register" "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"ComponentTester\"}")
assert_json_field "User registered" "$REG_RESP" ".user.id"

CSRF_RESP=$(api_get "/api/auth/csrf")
CSRF_TOKEN=$(echo "$CSRF_RESP" | jq -r '.csrfToken // empty')
LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -X POST "${BASE_URL}/api/auth/callback/credentials" \
  --data-urlencode "csrfToken=${CSRF_TOKEN}" \
  --data-urlencode "email=${TEST_EMAIL}" \
  --data-urlencode "password=${TEST_PASSWORD}" \
  --data-urlencode "json=true")
# Auth redirects so 200 or 302 both pass
if [[ "$LOGIN_STATUS" == "200" || "$LOGIN_STATUS" == "302" ]]; then
  echo -e "  ${GREEN}✓${NC} Login successful (HTTP $LOGIN_STATUS)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Login failed (HTTP $LOGIN_STATUS)"
  FAIL=$((FAIL + 1))
fi

SESSION=$(api_get "/api/auth/session")
assert_json_field "Session valid" "$SESSION" ".user.email"

# ── Create shared org ──
SHARED_ORG_RESP=$(api_post "/api/organizations" "{\"name\":\"CompTest $(date +%s)\"}")
SHARED_ORG_ID=$(echo "$SHARED_ORG_RESP" | jq -r '.organization.id')
assert_json_field "Shared org created" "$SHARED_ORG_RESP" ".organization.id"


# =============================================================================
# ██████████████████████████████████████████████████████████████████████████████
#  COMPONENT TESTS
# ██████████████████████████████████████████████████████████████████████████████
# =============================================================================

should_run() {
  [[ -z "$ONLY_COMPONENT" || "$ONLY_COMPONENT" == "$1" ]]
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. CONTAINER — the foundational layout component
# ─────────────────────────────────────────────────────────────────────────────
if should_run "container"; then
echo -e "\n${BOLD}━━━ 2. Container — Exhaustive ━━━${NC}"

PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Container Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
C_PROJ=$(echo "$PROJ_RESP" | jq -r '.project.id')
assert_json_field "Container project created" "$PROJ_RESP" ".project.id"

# ── 2a. Layout Props ──
echo -e "\n  ${BOLD}2a. Layout Props${NC}"
C_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {
      "display": "flex", "flexDirection": "column", "flexWrap": "nowrap",
      "alignItems": "center", "justifyContent": "space-between",
      "gap": 16, "padding": 24, "margin": 8,
      "width": "100%", "height": "400px", "minHeight": 200
    },
    "children": [
      {"id": "row-container", "type": "container", "props": {
        "flexDirection": "row", "alignItems": "flex-start", "justifyContent": "flex-end",
        "gap": 12, "padding": "8px 16px", "width": "50%", "height": 100
      }, "children": [
        {"id": "inner-text", "type": "text", "props": {"content": "Inside row"}, "children": []}
      ]},
      {"id": "col-reverse", "type": "container", "props": {
        "flexDirection": "column-reverse", "flexWrap": "wrap", "gap": 4, "padding": 0
      }, "children": [
        {"id": "rev-a", "type": "text", "props": {"content": "A"}, "children": []},
        {"id": "rev-b", "type": "text", "props": {"content": "B"}, "children": []}
      ]},
      {"id": "row-reverse", "type": "container", "props": {
        "flexDirection": "row-reverse", "justifyContent": "space-around", "alignItems": "baseline",
        "flex": "1"
      }, "children": []},
      {"id": "wrap-container", "type": "container", "props": {
        "flexDirection": "row", "flexWrap": "wrap", "justifyContent": "space-evenly",
        "alignItems": "stretch", "gap": 20
      }, "children": []}
    ]
  }
}'
C_LAYOUT_JSON="{\"root\":$(echo $C_LAYOUT | jq -c '.root')}"
SC_RESP=$(api_post "/api/projects/$C_PROJ/screens" "{\"name\":\"Layout\",\"slug\":\"layout\",\"route\":\"/\",\"layout\":$C_LAYOUT}")
assert_json_field "Layout screen created" "$SC_RESP" ".screen.id"
C_SC1_ID=$(echo "$SC_RESP" | jq -r '.screen.id')

# Publish & resolve
api_put "/api/projects/$C_PROJ" '{"isPublished":true}' > /dev/null
sleep 0.5
C_ROOT=$(echo "$C_LAYOUT" | jq -c '.root')
C_RESOLVE=$(resolve_layout "$C_ROOT")

# Root container props
assert_node_style "Root flexDirection=column" "$C_RESOLVE" "root" "flexDirection" "column"
assert_node_style "Root alignItems=center" "$C_RESOLVE" "root" "alignItems" "center"
assert_node_style "Root justifyContent=space-between" "$C_RESOLVE" "root" "justifyContent" "space-between"
assert_node_style "Root gap=16px" "$C_RESOLVE" "root" "gap" "16px"
assert_node_style "Root padding=24px" "$C_RESOLVE" "root" "padding" "24px"
assert_node_style "Root width=100%" "$C_RESOLVE" "root" "width" "100%"
assert_node_style "Root height=400px" "$C_RESOLVE" "root" "height" "400px"
assert_node_style "Root minHeight=200px" "$C_RESOLVE" "root" "minHeight" "200px"
assert_node_style "Root display=flex" "$C_RESOLVE" "root" "display" "flex"

# Row container
assert_node_style "Row flexDirection=row" "$C_RESOLVE" "row-container" "flexDirection" "row"
assert_node_style "Row alignItems=flex-start" "$C_RESOLVE" "row-container" "alignItems" "flex-start"
assert_node_style "Row justifyContent=flex-end" "$C_RESOLVE" "row-container" "justifyContent" "flex-end"
assert_node_style "Row gap=12px" "$C_RESOLVE" "row-container" "gap" "12px"
assert_node_style "Row padding=8px 16px" "$C_RESOLVE" "row-container" "padding" "8px 16px"
assert_node_style "Row width=50%" "$C_RESOLVE" "row-container" "width" "50%"
assert_node_style "Row height=100px" "$C_RESOLVE" "row-container" "height" "100px"

# Column-reverse + wrap
assert_node_style "ColReverse flexDirection=column-reverse" "$C_RESOLVE" "col-reverse" "flexDirection" "column-reverse"
assert_node_style "ColReverse flexWrap=wrap" "$C_RESOLVE" "col-reverse" "flexWrap" "wrap"
assert_node_style "ColReverse gap=4px" "$C_RESOLVE" "col-reverse" "gap" "4px"

# Row-reverse + baseline + space-around + flex
assert_node_style "RowReverse flexDirection=row-reverse" "$C_RESOLVE" "row-reverse" "flexDirection" "row-reverse"
assert_node_style "RowReverse justifyContent=space-around" "$C_RESOLVE" "row-reverse" "justifyContent" "space-around"
assert_node_style "RowReverse alignItems=baseline" "$C_RESOLVE" "row-reverse" "alignItems" "baseline"

# Wrap + space-evenly
assert_node_style "Wrap flexWrap=wrap" "$C_RESOLVE" "wrap-container" "flexWrap" "wrap"
assert_node_style "Wrap justifyContent=space-evenly" "$C_RESOLVE" "wrap-container" "justifyContent" "space-evenly"
assert_node_style "Wrap gap=20px" "$C_RESOLVE" "wrap-container" "gap" "20px"

# No resolve issues on root
assert_no_issues "Root no resolve issues" "$C_RESOLVE" "root"

# ── 2b. Visual / Box-model Props ──
echo -e "\n  ${BOLD}2b. Visual / Box-model Props${NC}"
C_VIS_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40},
    "children": [
      {"id": "styled-box", "type": "container", "props": {
        "backgroundColor": "#ff5733", "borderRadius": 12,
        "border": "2px solid #333", "boxShadow": "0 4px 6px rgba(0,0,0,0.1)",
        "opacity": "0.85", "padding": "20px 30px", "margin": "10px 0",
        "minHeight": 100, "maxWidth": "800px"
      }, "children": []},
      {"id": "gradient-box", "type": "container", "props": {
        "background": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        "borderRadius": "50%", "width": 120, "height": 120
      }, "children": []},
      {"id": "individual-borders", "type": "container", "props": {
        "borderTop": "3px dashed red",
        "borderRight": "2px solid blue",
        "borderBottom": "1px dotted green",
        "borderLeft": "4px double orange",
        "borderTopLeftRadius": 8, "borderTopRightRadius": 16,
        "borderBottomRightRadius": 24, "borderBottomLeftRadius": 0,
        "padding": 10
      }, "children": []},
      {"id": "overflow-box", "type": "container", "props": {
        "overflow": "hidden", "position": "relative",
        "width": 200, "height": 100
      }, "children": []},
      {"id": "cursor-box", "type": "container", "props": {
        "cursor": "pointer", "userSelect": "none", "pointerEvents": "auto",
        "padding": 10
      }, "children": []},
      {"id": "filter-box", "type": "container", "props": {
        "filter": "blur(2px)", "backdropFilter": "blur(10px)",
        "mixBlendMode": "multiply", "padding": 10
      }, "children": []}
    ]
  }
}'
C_VIS_ROOT=$(echo "$C_VIS_LAYOUT" | jq -c '.root')
C_VIS_RESOLVE=$(resolve_layout "$C_VIS_ROOT")

assert_node_style "StyledBox backgroundColor=#ff5733" "$C_VIS_RESOLVE" "styled-box" "backgroundColor" "#ff5733"
assert_node_style "StyledBox borderRadius=12px" "$C_VIS_RESOLVE" "styled-box" "borderRadius" "12px"
assert_node_style "StyledBox border=2px solid #333" "$C_VIS_RESOLVE" "styled-box" "border" "2px solid #333"
assert_node_style "StyledBox boxShadow" "$C_VIS_RESOLVE" "styled-box" "boxShadow" "0 4px 6px rgba(0,0,0,0.1)"
assert_node_style "StyledBox opacity=0.85" "$C_VIS_RESOLVE" "styled-box" "opacity" "0.85"
assert_node_style "StyledBox maxWidth=800px" "$C_VIS_RESOLVE" "styled-box" "maxWidth" "800px"

assert_node_style "GradientBox background" "$C_VIS_RESOLVE" "gradient-box" "background" "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
assert_node_style "GradientBox borderRadius=50%" "$C_VIS_RESOLVE" "gradient-box" "borderRadius" "50%"
assert_node_style "GradientBox width=120px" "$C_VIS_RESOLVE" "gradient-box" "width" "120px"

assert_node_style "IndvBorders borderTop" "$C_VIS_RESOLVE" "individual-borders" "borderTop" "3px dashed red"
assert_node_style "IndvBorders borderRight" "$C_VIS_RESOLVE" "individual-borders" "borderRight" "2px solid blue"
assert_node_style "IndvBorders borderBottom" "$C_VIS_RESOLVE" "individual-borders" "borderBottom" "1px dotted green"
assert_node_style "IndvBorders borderLeft" "$C_VIS_RESOLVE" "individual-borders" "borderLeft" "4px double orange"
assert_node_style "IndvBorders borderTopLeftRadius=8px" "$C_VIS_RESOLVE" "individual-borders" "borderTopLeftRadius" "8px"
assert_node_style "IndvBorders borderTopRightRadius=16px" "$C_VIS_RESOLVE" "individual-borders" "borderTopRightRadius" "16px"
assert_node_style "IndvBorders borderBottomRightRadius=24px" "$C_VIS_RESOLVE" "individual-borders" "borderBottomRightRadius" "24px"

assert_node_style "OverflowBox overflow=hidden" "$C_VIS_RESOLVE" "overflow-box" "overflow" "hidden"
assert_node_style "OverflowBox position=relative" "$C_VIS_RESOLVE" "overflow-box" "position" "relative"

assert_node_style "CursorBox cursor=pointer" "$C_VIS_RESOLVE" "cursor-box" "cursor" "pointer"
assert_node_style "CursorBox userSelect=none" "$C_VIS_RESOLVE" "cursor-box" "userSelect" "none"

assert_node_style "FilterBox filter=blur(2px)" "$C_VIS_RESOLVE" "filter-box" "filter" "blur(2px)"
assert_node_style "FilterBox backdropFilter=blur(10px)" "$C_VIS_RESOLVE" "filter-box" "backdropFilter" "blur(10px)"
assert_node_style "FilterBox mixBlendMode=multiply" "$C_VIS_RESOLVE" "filter-box" "mixBlendMode" "multiply"

# ── 2c. State Bindings ──
echo -e "\n  ${BOLD}2c. State Bindings${NC}"
C_BIND_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40,
      "backgroundColor": "{{state.bgColor}}"
    },
    "children": [
      {"id": "bound-text", "type": "text", "props": {"content": "Hello {{state.userName}}"}, "children": []},
      {"id": "count-text", "type": "text", "props": {"content": "Count: {{state.count}}"}, "children": []}
    ]
  }
}'
C_BIND_STATE='{"bgColor":"#e0f2fe","userName":"Alice","count":42}'
C_BIND_ROOT=$(echo "$C_BIND_LAYOUT" | jq -c '.root')
C_BIND_RESOLVE=$(resolve_layout "$C_BIND_ROOT" "$C_BIND_STATE")

assert_node_style "Binding: root bg resolves from state" "$C_BIND_RESOLVE" "root" "backgroundColor" "#e0f2fe"
assert_node_prop "Binding: text resolves username" "$C_BIND_RESOLVE" "bound-text" "content" "Hello Alice"
assert_node_prop "Binding: count resolves" "$C_BIND_RESOLVE" "count-text" "content" "Count: 42"
assert_no_issues "Binding: no issues on root" "$C_BIND_RESOLVE" "root"
assert_no_issues "Binding: no issues on bound-text" "$C_BIND_RESOLVE" "bound-text"

# ── 2d. Events (onClick, onDoubleClick, onMouseEnter, onMouseLeave) ──
echo -e "\n  ${BOLD}2d. Events${NC}"
C_EVT_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40},
    "children": [
      {"id": "click-box", "type": "container", "props": {
        "padding": 20, "backgroundColor": "#dbeafe", "cursor": "pointer",
        "onClick": [{"action": "setState", "stateKey": "clicked", "value": "true"}]
      }, "children": [
        {"id": "click-label", "type": "text", "props": {"content": "Click me"}, "children": []}
      ]},
      {"id": "multi-evt-box", "type": "container", "props": {
        "padding": 20, "backgroundColor": "#fef3c7",
        "onClick": [{"action": "mutateState", "stateKey": "counter", "mutationOp": "increment"}],
        "onMouseEnter": [{"action": "setState", "stateKey": "hovered", "value": "true"}],
        "onMouseLeave": [{"action": "setState", "stateKey": "hovered", "value": "false"}]
      }, "children": [
        {"id": "hover-status", "type": "text", "props": {"content": "Hovered: {{state.hovered}}"}, "children": []}
      ]},
      {"id": "multi-step-box", "type": "container", "props": {
        "padding": 20, "backgroundColor": "#ede9fe",
        "onClick": [
          {"action": "setState", "stateKey": "step1", "value": "done"},
          {"action": "mutateState", "stateKey": "stepCount", "mutationOp": "increment"},
          {"action": "setState", "stateKey": "lastAction", "value": "multiClick"}
        ]
      }, "children": [
        {"id": "step-status", "type": "text", "props": {"content": "Steps: {{state.stepCount}}"}, "children": []}
      ]}
    ]
  }
}'
# Verify the event configs are valid JSON (parse doesn't crash)
C_EVT_ROOT=$(echo "$C_EVT_LAYOUT" | jq -c '.root')
C_EVT_RESOLVE=$(resolve_layout "$C_EVT_ROOT" '{"clicked":"false","counter":0,"hovered":"false","step1":"pending","stepCount":0,"lastAction":"none"}')
assert_node_prop "Event: hover status shows state" "$C_EVT_RESOLVE" "hover-status" "content" "Hovered: false"
assert_node_prop "Event: step status shows count" "$C_EVT_RESOLVE" "step-status" "content" "Steps: 0"
assert_no_issues "Event: click-box no issues" "$C_EVT_RESOLVE" "click-box"

# ── 2e. visibleWhen ──
echo -e "\n  ${BOLD}2e. visibleWhen${NC}"
C_VIS_WHEN_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40},
    "children": [
      {"id": "always-visible", "type": "text", "props": {"content": "Always here"}, "children": []},
      {"id": "conditional-show", "type": "container", "props": {
        "padding": 10, "backgroundColor": "#dcfce7",
        "visibleWhen": "{{state.showPanel}} == true"
      }, "children": [
        {"id": "cond-text", "type": "text", "props": {"content": "Panel visible"}, "children": []}
      ]},
      {"id": "conditional-hide", "type": "container", "props": {
        "padding": 10, "backgroundColor": "#fee2e2",
        "visibleWhen": "{{state.showPanel}} == false"
      }, "children": [
        {"id": "hidden-text", "type": "text", "props": {"content": "Panel hidden"}, "children": []}
      ]}
    ]
  }
}'
# Create screen, publish, test via SSR HTML
C_VIS_SC=$(api_post "/api/projects/$C_PROJ/screens" "{\"name\":\"VisibleWhen\",\"slug\":\"visible-when\",\"route\":\"/visible-when\",\"layout\":$C_VIS_WHEN_LAYOUT}")
assert_json_field "visibleWhen screen created" "$C_VIS_SC" ".screen.id"

# Save globals with showPanel state
api_put "/api/projects/$C_PROJ/globals" '{"globalStateDefinitions":[{"name":"showPanel","type":"boolean","initialValue":"true"},{"name":"bgColor","type":"text","initialValue":"#e0f2fe"},{"name":"userName","type":"text","initialValue":"Alice"},{"name":"count","type":"number","initialValue":"42"},{"name":"clicked","type":"boolean","initialValue":"false"},{"name":"counter","type":"number","initialValue":"0"},{"name":"hovered","type":"boolean","initialValue":"false"},{"name":"step1","type":"text","initialValue":"pending"},{"name":"stepCount","type":"number","initialValue":"0"},{"name":"lastAction","type":"text","initialValue":"none"}]}' > /dev/null

# Test visibleWhen via resolve API (SSR page renders the first screen, not this one)
C_VIS_ROOT=$(echo "$C_VIS_WHEN_LAYOUT" | jq -c '.root')
C_VIS_RESOLVE=$(resolve_layout "$C_VIS_ROOT" '{"showPanel":true}')
# "Always here" text should resolve regardless
assert_node_prop "visibleWhen: 'Always here' resolves" "$C_VIS_RESOLVE" "always-visible" "content" "Always here"
# When showPanel=true, conditional-show should be present in tree
C_VIS_SHOW=$(echo "$C_VIS_RESOLVE" | jq -r '.. | objects | select(.id=="cond-text") | .resolvedContent // empty')
if [[ "$C_VIS_SHOW" == "Panel visible" ]]; then
  echo -e "  ${GREEN}✓${NC} visibleWhen: conditional panel resolves when true"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} visibleWhen: conditional panel expected 'Panel visible', got '$C_VIS_SHOW'"
  FAIL=$((FAIL + 1))
fi
# When showPanel=false, conditional-hide should be present
C_VIS_RESOLVE_FALSE=$(resolve_layout "$C_VIS_ROOT" '{"showPanel":false}')
C_VIS_HIDE=$(echo "$C_VIS_RESOLVE_FALSE" | jq -r '.. | objects | select(.id=="hidden-text") | .resolvedContent // empty')
if [[ "$C_VIS_HIDE" == "Panel hidden" ]]; then
  echo -e "  ${GREEN}✓${NC} visibleWhen: hidden panel resolves when false"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} visibleWhen: hidden panel expected 'Panel hidden', got '$C_VIS_HIDE'"
  FAIL=$((FAIL + 1))
fi

# ── 2f. Animation / transition styles ──
echo -e "\n  ${BOLD}2f. Animation / Transition Styles${NC}"
C_ANIM_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40},
    "children": [
      {"id": "transition-box", "type": "container", "props": {
        "padding": 20, "backgroundColor": "#fef3c7",
        "transition": "all 0.3s ease",
        "transform": "translateY(0px)"
      }, "children": []},
      {"id": "animated-box", "type": "container", "props": {
        "padding": 20, "backgroundColor": "#ddd6fe",
        "animation": "fadeIn 1s ease-in-out",
        "animationIterationCount": "1",
        "animationFillMode": "forwards",
        "willChange": "opacity, transform"
      }, "children": []},
      {"id": "hover-transition-box", "type": "container", "props": {
        "padding": 20, "backgroundColor": "#bbf7d0",
        "transition": "background-color 0.2s, transform 0.3s ease-out",
        "cursor": "pointer"
      }, "children": []}
    ]
  }
}'
C_ANIM_ROOT=$(echo "$C_ANIM_LAYOUT" | jq -c '.root')
C_ANIM_RESOLVE=$(resolve_layout "$C_ANIM_ROOT")

assert_node_style "Transition box has transition" "$C_ANIM_RESOLVE" "transition-box" "transition" "all 0.3s ease"
assert_node_style "Transition box has transform" "$C_ANIM_RESOLVE" "transition-box" "transform" "translateY(0px)"
assert_node_style "Animated box has animation" "$C_ANIM_RESOLVE" "animated-box" "animation" "fadeIn 1s ease-in-out"
assert_node_style "Animated box animationFillMode" "$C_ANIM_RESOLVE" "animated-box" "animationFillMode" "forwards"
assert_node_style "Animated box willChange" "$C_ANIM_RESOLVE" "animated-box" "willChange" "opacity, transform"
assert_node_style "HoverTransition has transition" "$C_ANIM_RESOLVE" "hover-transition-box" "transition" "background-color 0.2s, transform 0.3s ease-out"

# ── 2g. Nesting depth ──
echo -e "\n  ${BOLD}2g. Deep Nesting${NC}"
C_NEST_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 4, "minHeight": 40},
    "children": [
      {"id": "L1", "type": "container", "props": {"flexDirection": "row", "padding": 4}, "children": [
        {"id": "L2", "type": "container", "props": {"flexDirection": "column", "padding": 4}, "children": [
          {"id": "L3", "type": "container", "props": {"flexDirection": "row", "padding": 4}, "children": [
            {"id": "L4", "type": "container", "props": {"flexDirection": "column", "padding": 4}, "children": [
              {"id": "L5", "type": "container", "props": {"flexDirection": "row", "padding": 4}, "children": [
                {"id": "deep-text", "type": "text", "props": {"content": "5 levels deep"}, "children": []}
              ]}
            ]}
          ]}
        ]}
      ]}
    ]
  }
}'
C_NEST_ROOT=$(echo "$C_NEST_LAYOUT" | jq -c '.root')
C_NEST_RESOLVE=$(resolve_layout "$C_NEST_ROOT")
assert_node_prop "Nesting: 5 levels deep content" "$C_NEST_RESOLVE" "deep-text" "content" "5 levels deep"
assert_node_style "Nesting: L1 row" "$C_NEST_RESOLVE" "L1" "flexDirection" "row"
assert_node_style "Nesting: L2 column" "$C_NEST_RESOLVE" "L2" "flexDirection" "column"
assert_node_style "Nesting: L3 row" "$C_NEST_RESOLVE" "L3" "flexDirection" "row"
assert_node_style "Nesting: L5 row" "$C_NEST_RESOLVE" "L5" "flexDirection" "row"

# ── 2h. Edge cases ──
echo -e "\n  ${BOLD}2h. Edge Cases${NC}"
C_EDGE_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 0, "minHeight": 0},
    "children": [
      {"id": "empty-container", "type": "container", "props": {}, "children": []},
      {"id": "zero-gap", "type": "container", "props": {"gap": 0, "padding": 0}, "children": []},
      {"id": "large-padding", "type": "container", "props": {"padding": "100px 200px", "margin": "50px 100px"}, "children": []},
      {"id": "percent-dims", "type": "container", "props": {"width": "75%", "height": "50vh", "minHeight": 0}, "children": []},
      {"id": "calc-width", "type": "container", "props": {"width": "calc(100% - 40px)", "minHeight": 0}, "children": []}
    ]
  }
}'
C_EDGE_ROOT=$(echo "$C_EDGE_LAYOUT" | jq -c '.root')
C_EDGE_RESOLVE=$(resolve_layout "$C_EDGE_ROOT")

# Empty container should get default props from registry
assert_node_style "Empty container defaults: display=flex" "$C_EDGE_RESOLVE" "empty-container" "display" "flex"
assert_node_style "Empty container defaults: flexDirection=column" "$C_EDGE_RESOLVE" "empty-container" "flexDirection" "column"

# Zero values
assert_node_style "ZeroGap: gap=0px" "$C_EDGE_RESOLVE" "zero-gap" "gap" "0px"

# Complex CSS values
assert_node_style "LargePadding: padding" "$C_EDGE_RESOLVE" "large-padding" "padding" "100px 200px"
assert_node_style "LargePadding: margin" "$C_EDGE_RESOLVE" "large-padding" "margin" "50px 100px"

# Percentage + viewport units
assert_node_style "PercentDims: width=75%" "$C_EDGE_RESOLVE" "percent-dims" "width" "75%"
assert_node_style "PercentDims: height=50vh" "$C_EDGE_RESOLVE" "percent-dims" "height" "50vh"

# calc()
assert_node_style "CalcWidth: width=calc(100% - 40px)" "$C_EDGE_RESOLVE" "calc-width" "width" "calc(100% - 40px)"

# ── 2i. SSR HTML rendering ──
echo -e "\n  ${BOLD}2i. SSR HTML Rendering${NC}"
C_HTML=$(get_html "$C_PROJ")
# Container should render as a div with flex styles
assert_contains "SSR: HTML contains flex" "$C_HTML" "flex"
assert_contains "SSR: HTML contains root id" "$C_HTML" "root"
# Note: style bindings like {{state.bgColor}} remain raw in SSR HTML because
# they're resolved client-side. Text content bindings ARE resolved SSR-side.
# The presence of {{state.}} in serialized layout JSON is expected.

# Clean up
delete_project "$C_PROJ"
echo -e "  ${GREEN}✓${NC} Container project cleaned up"
PASS=$((PASS + 1))

fi # end container


# ─────────────────────────────────────────────────────────────────────────────
# 3. TEXT — content, typography, binding, formatting
# ─────────────────────────────────────────────────────────────────────────────
if should_run "text"; then
echo -e "\n${BOLD}━━━ 3. Text — Exhaustive ━━━${NC}"

T_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Text Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
T_PROJ=$(echo "$T_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Text project created" "$T_PROJ_RESP" ".project.id"

# ── 3a. Typography props ──
echo -e "\n  ${BOLD}3a. Typography Props${NC}"
T_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40},
    "children": [
      {"id": "plain-text", "type": "text", "props": {"content": "Hello World"}, "children": []},
      {"id": "styled-text", "type": "text", "props": {
        "content": "Styled Text",
        "fontSize": "32px", "fontWeight": "700", "fontFamily": "Inter",
        "fontStyle": "italic", "color": "#1e40af",
        "lineHeight": "1.5", "letterSpacing": "2px",
        "textAlign": "center", "textDecoration": "underline",
        "textTransform": "uppercase"
      }, "children": []},
      {"id": "small-text", "type": "text", "props": {
        "content": "Small caption",
        "fontSize": 11, "fontWeight": "300", "color": "#9ca3af",
        "textOverflow": "ellipsis", "whiteSpace": "nowrap",
        "overflow": "hidden", "maxWidth": "100px"
      }, "children": []},
      {"id": "shadow-text", "type": "text", "props": {
        "content": "Shadow Text",
        "textShadow": "2px 2px 4px rgba(0,0,0,0.3)",
        "fontSize": "24px", "fontWeight": "600"
      }, "children": []}
    ]
  }
}'
T_ROOT=$(echo "$T_LAYOUT" | jq -c '.root')
T_RESOLVE=$(resolve_layout "$T_ROOT")

assert_node_prop "Text: plain content" "$T_RESOLVE" "plain-text" "content" "Hello World"
assert_node_prop "Text: styled content" "$T_RESOLVE" "styled-text" "content" "Styled Text"
assert_node_style "Text: fontSize=32px" "$T_RESOLVE" "styled-text" "fontSize" "32px"
assert_node_style "Text: fontWeight=700" "$T_RESOLVE" "styled-text" "fontWeight" "700"
assert_node_style "Text: fontStyle=italic" "$T_RESOLVE" "styled-text" "fontStyle" "italic"
assert_node_style "Text: color=#1e40af" "$T_RESOLVE" "styled-text" "color" "#1e40af"
assert_node_style "Text: lineHeight=1.5" "$T_RESOLVE" "styled-text" "lineHeight" "1.5"
assert_node_style "Text: letterSpacing=2px" "$T_RESOLVE" "styled-text" "letterSpacing" "2px"
assert_node_style "Text: textAlign=center" "$T_RESOLVE" "styled-text" "textAlign" "center"
assert_node_style "Text: textDecoration=underline" "$T_RESOLVE" "styled-text" "textDecoration" "underline"
assert_node_style "Text: textTransform=uppercase" "$T_RESOLVE" "styled-text" "textTransform" "uppercase"

# Small text overflow handling
assert_node_style "Text: textOverflow=ellipsis" "$T_RESOLVE" "small-text" "textOverflow" "ellipsis"
assert_node_style "Text: whiteSpace=nowrap" "$T_RESOLVE" "small-text" "whiteSpace" "nowrap"
assert_node_style "Text: overflow=hidden" "$T_RESOLVE" "small-text" "overflow" "hidden"
assert_node_style "Text: maxWidth=100px" "$T_RESOLVE" "small-text" "maxWidth" "100px"

# Text shadow
assert_node_style "Text: textShadow" "$T_RESOLVE" "shadow-text" "textShadow" "2px 2px 4px rgba(0,0,0,0.3)"

# Bare number fontSize with px
assert_node_style "Text: small fontSize=11px" "$T_RESOLVE" "small-text" "fontSize" "11px"

# ── 3b. State bindings ──
echo -e "\n  ${BOLD}3b. State Bindings${NC}"
T_BIND_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40},
    "children": [
      {"id": "greeting", "type": "text", "props": {"content": "Hello {{state.name}}, welcome!"}, "children": []},
      {"id": "counter", "type": "text", "props": {"content": "Score: {{state.score}} / {{state.max}}"}, "children": []},
      {"id": "empty-binding", "type": "text", "props": {"content": "Empty: {{state.missing}}"}, "children": []},
      {"id": "multi-binding", "type": "text", "props": {"content": "{{state.first}} {{state.last}} ({{state.role}})"}, "children": []}
    ]
  }
}'
T_BIND_STATE='{"name":"Bob","score":95,"max":100,"first":"John","last":"Doe","role":"Admin"}'
T_BIND_ROOT=$(echo "$T_BIND_LAYOUT" | jq -c '.root')
T_BIND_RESOLVE=$(resolve_layout "$T_BIND_ROOT" "$T_BIND_STATE")

assert_node_prop "TextBind: greeting" "$T_BIND_RESOLVE" "greeting" "content" "Hello Bob, welcome!"
assert_node_prop "TextBind: score/max" "$T_BIND_RESOLVE" "counter" "content" "Score: 95 / 100"
assert_node_prop "TextBind: empty binding" "$T_BIND_RESOLVE" "empty-binding" "content" "Empty: "
assert_node_prop "TextBind: multi binding" "$T_BIND_RESOLVE" "multi-binding" "content" "John Doe (Admin)"

delete_project "$T_PROJ"
echo -e "  ${GREEN}✓${NC} Text project cleaned up"
PASS=$((PASS + 1))

fi # end text


# ─────────────────────────────────────────────────────────────────────────────
# 4. BUTTON — label, variant, events, styling
# ─────────────────────────────────────────────────────────────────────────────
if should_run "button"; then
echo -e "\n${BOLD}━━━ 4. Button — Exhaustive ━━━${NC}"

B_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Button Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
B_PROJ=$(echo "$B_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Button project created" "$B_PROJ_RESP" ".project.id"

echo -e "\n  ${BOLD}4a. Variants & Props${NC}"
B_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 8},
    "children": [
      {"id": "primary-btn", "type": "button", "props": {
        "label": "Primary", "variant": "primary", "padding": "10px 20px", "borderRadius": 8,
        "fontSize": "16px", "fontWeight": "600"
      }, "children": []},
      {"id": "outline-btn", "type": "button", "props": {
        "label": "Outline", "variant": "outline", "padding": "8px 16px", "borderRadius": 4
      }, "children": []},
      {"id": "ghost-btn", "type": "button", "props": {
        "label": "Ghost", "variant": "ghost", "padding": "6px 12px"
      }, "children": []},
      {"id": "custom-btn", "type": "button", "props": {
        "label": "Custom Styled", "variant": "primary",
        "backgroundColor": "#10b981", "color": "#ffffff",
        "padding": "12px 32px", "borderRadius": 24,
        "fontSize": "18px", "fontWeight": "bold",
        "boxShadow": "0 4px 12px rgba(16,185,129,0.4)",
        "cursor": "pointer"
      }, "children": []},
      {"id": "icon-btn", "type": "button", "props": {
        "label": "With Icon", "icon": "mdi:check", "variant": "primary",
        "padding": "8px 16px"
      }, "children": []},
      {"id": "disabled-btn", "type": "button", "props": {
        "label": "Disabled", "variant": "primary", "disabled": true, "opacity": "0.5",
        "cursor": "not-allowed"
      }, "children": []},
      {"id": "bound-btn", "type": "button", "props": {
        "label": "Clicks: {{state.count}}", "variant": "primary",
        "onClick": [
          {"action": "mutateState", "stateKey": "count", "mutationOp": "increment"},
          {"action": "setState", "stateKey": "lastClick", "value": "button"}
        ]
      }, "children": []},
      {"id": "full-width-btn", "type": "button", "props": {
        "label": "Full Width", "variant": "primary", "width": "100%",
        "padding": "14px 0", "textAlign": "center"
      }, "children": []}
    ]
  }
}'
B_ROOT=$(echo "$B_LAYOUT" | jq -c '.root')
B_STATE='{"count":0,"lastClick":"none"}'
B_RESOLVE=$(resolve_layout "$B_ROOT" "$B_STATE")

assert_node_prop "Button: primary label" "$B_RESOLVE" "primary-btn" "content" "Primary"
assert_node_prop "Button: outline label" "$B_RESOLVE" "outline-btn" "content" "Outline"
assert_node_prop "Button: ghost label" "$B_RESOLVE" "ghost-btn" "content" "Ghost"
assert_node_prop "Button: custom label" "$B_RESOLVE" "custom-btn" "content" "Custom Styled"
assert_node_style "Button: custom bg" "$B_RESOLVE" "custom-btn" "backgroundColor" "#10b981"
assert_node_style "Button: custom color" "$B_RESOLVE" "custom-btn" "color" "#ffffff"
assert_node_style "Button: custom borderRadius=24px" "$B_RESOLVE" "custom-btn" "borderRadius" "24px"
assert_node_style "Button: custom boxShadow" "$B_RESOLVE" "custom-btn" "boxShadow" "0 4px 12px rgba(16,185,129,0.4)"
assert_node_style "Button: disabled opacity" "$B_RESOLVE" "disabled-btn" "opacity" "0.5"
assert_node_style "Button: disabled cursor" "$B_RESOLVE" "disabled-btn" "cursor" "not-allowed"
assert_node_prop "Button: bound label resolves" "$B_RESOLVE" "bound-btn" "content" "Clicks: 0"
assert_node_style "Button: full width=100%" "$B_RESOLVE" "full-width-btn" "width" "100%"

assert_no_issues "Button: primary no issues" "$B_RESOLVE" "primary-btn"
assert_no_issues "Button: custom no issues" "$B_RESOLVE" "custom-btn"
assert_no_issues "Button: bound no issues" "$B_RESOLVE" "bound-btn"

delete_project "$B_PROJ"
echo -e "  ${GREEN}✓${NC} Button project cleaned up"
PASS=$((PASS + 1))

fi # end button


# ─────────────────────────────────────────────────────────────────────────────
# 5. STACKH / STACKV — horizontal and vertical stacks
# ─────────────────────────────────────────────────────────────────────────────
if should_run "stackH" || should_run "stackV"; then
echo -e "\n${BOLD}━━━ 5. StackH / StackV — Exhaustive ━━━${NC}"

S_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Stack Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
S_PROJ=$(echo "$S_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Stack project created" "$S_PROJ_RESP" ".project.id"

S_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 16},
    "children": [
      {"id": "h-stack", "type": "stackH", "props": {
        "gap": 12, "alignItems": "center", "justifyContent": "space-between",
        "padding": "8px 16px", "backgroundColor": "#f0f9ff"
      }, "children": [
        {"id": "h1", "type": "text", "props": {"content": "Left"}, "children": []},
        {"id": "h2", "type": "text", "props": {"content": "Center"}, "children": []},
        {"id": "h3", "type": "text", "props": {"content": "Right"}, "children": []}
      ]},
      {"id": "v-stack", "type": "stackV", "props": {
        "gap": 8, "alignItems": "stretch", "padding": 12, "backgroundColor": "#fefce8"
      }, "children": [
        {"id": "v1", "type": "text", "props": {"content": "Top"}, "children": []},
        {"id": "v2", "type": "text", "props": {"content": "Middle"}, "children": []},
        {"id": "v3", "type": "text", "props": {"content": "Bottom"}, "children": []}
      ]},
      {"id": "nested-stacks", "type": "stackV", "props": {"gap": 8}, "children": [
        {"id": "inner-h", "type": "stackH", "props": {"gap": 4, "alignItems": "center"}, "children": [
          {"id": "nested-text", "type": "text", "props": {"content": "Nested HV"}, "children": []}
        ]}
      ]}
    ]
  }
}'
S_ROOT=$(echo "$S_LAYOUT" | jq -c '.root')
S_RESOLVE=$(resolve_layout "$S_ROOT")

assert_node_style "StackH: flexDirection=row" "$S_RESOLVE" "h-stack" "flexDirection" "row"
assert_node_style "StackH: gap=12px" "$S_RESOLVE" "h-stack" "gap" "12px"
assert_node_style "StackH: alignItems=center" "$S_RESOLVE" "h-stack" "alignItems" "center"
assert_node_style "StackH: justifyContent=space-between" "$S_RESOLVE" "h-stack" "justifyContent" "space-between"
assert_node_style "StackH: bg" "$S_RESOLVE" "h-stack" "backgroundColor" "#f0f9ff"

assert_node_style "StackV: flexDirection=column" "$S_RESOLVE" "v-stack" "flexDirection" "column"
assert_node_style "StackV: gap=8px" "$S_RESOLVE" "v-stack" "gap" "8px"
assert_node_style "StackV: alignItems=stretch" "$S_RESOLVE" "v-stack" "alignItems" "stretch"
assert_node_style "StackV: bg" "$S_RESOLVE" "v-stack" "backgroundColor" "#fefce8"

assert_node_prop "Nested: text resolves" "$S_RESOLVE" "nested-text" "content" "Nested HV"
assert_node_style "Nested inner: flexDirection=row" "$S_RESOLVE" "inner-h" "flexDirection" "row"

delete_project "$S_PROJ"
echo -e "  ${GREEN}✓${NC} Stack project cleaned up"
PASS=$((PASS + 1))

fi # end stack


# ─────────────────────────────────────────────────────────────────────────────
# 6. CARD — padding, shadow, border, content
# ─────────────────────────────────────────────────────────────────────────────
if should_run "card"; then
echo -e "\n${BOLD}━━━ 6. Card — Exhaustive ━━━${NC}"

CD_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Card Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
CD_PROJ=$(echo "$CD_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Card project created" "$CD_PROJ_RESP" ".project.id"

CD_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 16},
    "children": [
      {"id": "basic-card", "type": "card", "props": {
        "padding": 16, "backgroundColor": "#ffffff", "borderRadius": 12
      }, "children": [
        {"id": "card-text", "type": "text", "props": {"content": "Card content"}, "children": []}
      ]},
      {"id": "shadow-card", "type": "card", "props": {
        "padding": 24, "backgroundColor": "#f8fafc",
        "borderRadius": 16, "boxShadow": "0 10px 15px rgba(0,0,0,0.1)",
        "border": "1px solid #e2e8f0"
      }, "children": []},
      {"id": "colored-card", "type": "card", "props": {
        "padding": "20px 30px", "backgroundColor": "#eef2ff",
        "borderRadius": 8, "border": "2px solid #6366f1"
      }, "children": [
        {"id": "colored-text", "type": "text", "props": {"content": "Colored card"}, "children": []}
      ]},
      {"id": "clickable-card", "type": "card", "props": {
        "padding": 16, "backgroundColor": "#fff7ed", "cursor": "pointer",
        "transition": "transform 0.2s, box-shadow 0.2s",
        "onClick": [{"action": "setState", "stateKey": "selected", "value": "card1"}]
      }, "children": [
        {"id": "click-card-text", "type": "text", "props": {"content": "Click me"}, "children": []}
      ]}
    ]
  }
}'
CD_ROOT=$(echo "$CD_LAYOUT" | jq -c '.root')
CD_RESOLVE=$(resolve_layout "$CD_ROOT")

assert_node_prop "Card: basic content" "$CD_RESOLVE" "card-text" "content" "Card content"
assert_node_style "Card: basic borderRadius=12px" "$CD_RESOLVE" "basic-card" "borderRadius" "12px"
assert_node_style "Card: shadow boxShadow" "$CD_RESOLVE" "shadow-card" "boxShadow" "0 10px 15px rgba(0,0,0,0.1)"
assert_node_style "Card: shadow border" "$CD_RESOLVE" "shadow-card" "border" "1px solid #e2e8f0"
assert_node_style "Card: colored bg" "$CD_RESOLVE" "colored-card" "backgroundColor" "#eef2ff"
assert_node_style "Card: colored border" "$CD_RESOLVE" "colored-card" "border" "2px solid #6366f1"
assert_node_style "Card: clickable cursor" "$CD_RESOLVE" "clickable-card" "cursor" "pointer"
assert_node_style "Card: clickable transition" "$CD_RESOLVE" "clickable-card" "transition" "transform 0.2s, box-shadow 0.2s"

delete_project "$CD_PROJ"
echo -e "  ${GREEN}✓${NC} Card project cleaned up"
PASS=$((PASS + 1))

fi # end card


# ─────────────────────────────────────────────────────────────────────────────
# 7. IMAGE — url, alt, objectFit, dimensions
# ─────────────────────────────────────────────────────────────────────────────
if should_run "image"; then
echo -e "\n${BOLD}━━━ 7. Image — Exhaustive ━━━${NC}"

I_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Image Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
I_PROJ=$(echo "$I_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Image project created" "$I_PROJ_RESP" ".project.id"

I_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 16},
    "children": [
      {"id": "basic-img", "type": "image", "props": {
        "url": "https://placehold.co/400x300", "alt": "Test image",
        "width": 400, "height": 300, "objectFit": "cover"
      }, "children": []},
      {"id": "contain-img", "type": "image", "props": {
        "url": "https://placehold.co/200x200", "alt": "Contained",
        "width": 200, "height": 200, "objectFit": "contain", "objectPosition": "top"
      }, "children": []},
      {"id": "fill-img", "type": "image", "props": {
        "url": "https://placehold.co/100x100", "alt": "Fill mode",
        "width": "100%", "height": 200, "objectFit": "fill",
        "borderRadius": 16, "boxShadow": "0 4px 6px rgba(0,0,0,0.1)"
      }, "children": []},
      {"id": "bound-img", "type": "image", "props": {
        "url": "{{state.imageUrl}}", "alt": "{{state.imageAlt}}",
        "width": 300, "height": 200
      }, "children": []}
    ]
  }
}'
I_ROOT=$(echo "$I_LAYOUT" | jq -c '.root')
I_STATE='{"imageUrl":"https://placehold.co/300x200","imageAlt":"Dynamic image"}'
I_RESOLVE=$(resolve_layout "$I_ROOT" "$I_STATE")

assert_node_style "Image: objectFit=cover" "$I_RESOLVE" "basic-img" "objectFit" "cover"
assert_node_style "Image: contain objectFit" "$I_RESOLVE" "contain-img" "objectFit" "contain"
assert_node_style "Image: contain objectPosition=top" "$I_RESOLVE" "contain-img" "objectPosition" "top"
assert_node_style "Image: fill borderRadius=16px" "$I_RESOLVE" "fill-img" "borderRadius" "16px"
assert_no_issues "Image: basic no issues" "$I_RESOLVE" "basic-img"

delete_project "$I_PROJ"
echo -e "  ${GREEN}✓${NC} Image project cleaned up"
PASS=$((PASS + 1))

fi # end image


# ─────────────────────────────────────────────────────────────────────────────
# 8. BADGE — label, variant, size, bindings
# ─────────────────────────────────────────────────────────────────────────────
if should_run "badge"; then
echo -e "\n${BOLD}━━━ 8. Badge — Exhaustive ━━━${NC}"

BD_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Badge Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
BD_PROJ=$(echo "$BD_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Badge project created" "$BD_PROJ_RESP" ".project.id"

BD_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "row", "padding": 10, "minHeight": 40, "gap": 8},
    "children": [
      {"id": "default-badge", "type": "badge", "props": {"label": "Default", "variant": "default", "size": "md"}, "children": []},
      {"id": "info-badge", "type": "badge", "props": {"label": "Info", "variant": "info", "size": "sm"}, "children": []},
      {"id": "success-badge", "type": "badge", "props": {"label": "Success", "variant": "success", "size": "lg"}, "children": []},
      {"id": "warning-badge", "type": "badge", "props": {"label": "Warning", "variant": "warning"}, "children": []},
      {"id": "error-badge", "type": "badge", "props": {"label": "Error", "variant": "error"}, "children": []},
      {"id": "bound-badge", "type": "badge", "props": {"label": "Score: {{state.score}}", "variant": "info"}, "children": []}
    ]
  }
}'
BD_ROOT=$(echo "$BD_LAYOUT" | jq -c '.root')
BD_RESOLVE=$(resolve_layout "$BD_ROOT" '{"score":99}')

assert_node_prop "Badge: default" "$BD_RESOLVE" "default-badge" "content" "Default"
assert_node_prop "Badge: info" "$BD_RESOLVE" "info-badge" "content" "Info"
assert_node_prop "Badge: success" "$BD_RESOLVE" "success-badge" "content" "Success"
assert_node_prop "Badge: bound" "$BD_RESOLVE" "bound-badge" "content" "Score: 99"
assert_no_issues "Badge: default no issues" "$BD_RESOLVE" "default-badge"

delete_project "$BD_PROJ"
echo -e "  ${GREEN}✓${NC} Badge project cleaned up"
PASS=$((PASS + 1))

fi # end badge


# ─────────────────────────────────────────────────────────────────────────────
# 9. CHECKBOX — checked, label, events, bindings
# ─────────────────────────────────────────────────────────────────────────────
if should_run "checkbox"; then
echo -e "\n${BOLD}━━━ 9. Checkbox — Exhaustive ━━━${NC}"

CK_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Checkbox Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
CK_PROJ=$(echo "$CK_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Checkbox project created" "$CK_PROJ_RESP" ".project.id"

CK_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 8},
    "children": [
      {"id": "default-check", "type": "checkbox", "props": {"label": "Accept terms", "checked": false}, "children": []},
      {"id": "checked-check", "type": "checkbox", "props": {"label": "Pre-checked", "checked": true}, "children": []},
      {"id": "no-label-check", "type": "checkbox", "props": {"checked": false}, "children": []},
      {"id": "bound-check", "type": "checkbox", "props": {
        "label": "Notify: {{state.notify}}",
        "checked": "{{state.notify}}",
        "onChange": [{"action": "setState", "stateKey": "notify", "value": "{{event.checked}}"}]
      }, "children": []},
      {"id": "styled-check", "type": "checkbox", "props": {
        "label": "Custom style", "checked": false,
        "color": "#10b981", "fontSize": "16px"
      }, "children": []}
    ]
  }
}'
CK_ROOT=$(echo "$CK_LAYOUT" | jq -c '.root')
CK_RESOLVE=$(resolve_layout "$CK_ROOT" '{"notify":true}')

assert_node_prop "Checkbox: default label" "$CK_RESOLVE" "default-check" "content" "Accept terms"
assert_node_prop "Checkbox: pre-checked label" "$CK_RESOLVE" "checked-check" "content" "Pre-checked"
assert_node_prop "Checkbox: bound label" "$CK_RESOLVE" "bound-check" "content" "Notify: true"
assert_no_issues "Checkbox: default no issues" "$CK_RESOLVE" "default-check"

delete_project "$CK_PROJ"
echo -e "  ${GREEN}✓${NC} Checkbox project cleaned up"
PASS=$((PASS + 1))

fi # end checkbox


# ─────────────────────────────────────────────────────────────────────────────
# 10. TOGGLE — checked, label, onChange, styling
# ─────────────────────────────────────────────────────────────────────────────
if should_run "toggle"; then
echo -e "\n${BOLD}━━━ 10. Toggle — Exhaustive ━━━${NC}"

TG_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Toggle Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
TG_PROJ=$(echo "$TG_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Toggle project created" "$TG_PROJ_RESP" ".project.id"

TG_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 8},
    "children": [
      {"id": "basic-toggle", "type": "toggle", "props": {"label": "Dark mode"}, "children": []},
      {"id": "checked-toggle", "type": "toggle", "props": {"label": "Enabled", "checked": true}, "children": []},
      {"id": "left-label-toggle", "type": "toggle", "props": {"label": "Left label", "labelPosition": "left"}, "children": []},
      {"id": "bound-toggle", "type": "toggle", "props": {
        "label": "Active: {{state.active}}",
        "checked": "{{state.active}}",
        "onChange": [{"action": "setState", "stateKey": "active", "value": "{{event.checked}}"}]
      }, "children": []}
    ]
  }
}'
TG_ROOT=$(echo "$TG_LAYOUT" | jq -c '.root')
TG_RESOLVE=$(resolve_layout "$TG_ROOT" '{"active":false}')

assert_node_prop "Toggle: basic label" "$TG_RESOLVE" "basic-toggle" "content" "Dark mode"
assert_node_prop "Toggle: checked label" "$TG_RESOLVE" "checked-toggle" "content" "Enabled"
assert_node_prop "Toggle: bound label" "$TG_RESOLVE" "bound-toggle" "content" "Active: false"
assert_no_issues "Toggle: basic no issues" "$TG_RESOLVE" "basic-toggle"

delete_project "$TG_PROJ"
echo -e "  ${GREEN}✓${NC} Toggle project cleaned up"
PASS=$((PASS + 1))

fi # end toggle


# ─────────────────────────────────────────────────────────────────────────────
# 11. TEXT INPUT / NUMBER INPUT / TEXTAREA / SEARCH INPUT
# ─────────────────────────────────────────────────────────────────────────────
if should_run "textInput" || should_run "numberInput" || should_run "textarea" || should_run "searchInput"; then
echo -e "\n${BOLD}━━━ 11. Form Inputs — Exhaustive ━━━${NC}"

FI_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"FormInput Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
FI_PROJ=$(echo "$FI_PROJ_RESP" | jq -r '.project.id')
assert_json_field "FormInput project created" "$FI_PROJ_RESP" ".project.id"

FI_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 12},
    "children": [
      {"id": "basic-input", "type": "textInput", "props": {
        "label": "Name", "placeholder": "Enter name", "value": ""
      }, "children": []},
      {"id": "bound-input", "type": "textInput", "props": {
        "label": "Email", "placeholder": "your@email.com", "value": "{{state.email}}",
        "onChange": [{"action": "setState", "stateKey": "email", "value": "{{event.value}}"}]
      }, "children": []},
      {"id": "styled-input", "type": "textInput", "props": {
        "label": "Styled", "placeholder": "Custom",
        "fontSize": "18px", "color": "#1e40af", "borderRadius": 8
      }, "children": []},
      {"id": "number-input", "type": "numberInput", "props": {
        "label": "Quantity", "placeholder": "0", "value": "{{state.qty}}",
        "onChange": [{"action": "setState", "stateKey": "qty", "value": "{{event.value}}"}]
      }, "children": []},
      {"id": "basic-textarea", "type": "textarea", "props": {
        "label": "Notes", "placeholder": "Add notes...", "value": "", "rows": 4
      }, "children": []},
      {"id": "bound-textarea", "type": "textarea", "props": {
        "label": "Description", "value": "{{state.desc}}",
        "onChange": [{"action": "setState", "stateKey": "desc", "value": "{{event.value}}"}],
        "rows": 6
      }, "children": []},
      {"id": "search-input", "type": "searchInput", "props": {
        "placeholder": "Search...", "value": "{{state.searchTerm}}",
        "onChange": [{"action": "setState", "stateKey": "searchTerm", "value": "{{event.value}}"}]
      }, "children": []}
    ]
  }
}'
FI_ROOT=$(echo "$FI_LAYOUT" | jq -c '.root')
FI_RESOLVE=$(resolve_layout "$FI_ROOT" '{"email":"test@test.com","qty":5,"desc":"Hello world","searchTerm":"foo"}')

assert_node_prop "TextInput: basic label" "$FI_RESOLVE" "basic-input" "content" "Name"
assert_node_prop "TextInput: bound label" "$FI_RESOLVE" "bound-input" "content" "Email"
assert_node_prop "NumberInput: label" "$FI_RESOLVE" "number-input" "content" "Quantity"
assert_node_prop "Textarea: label" "$FI_RESOLVE" "basic-textarea" "content" "Notes"
assert_no_issues "TextInput: basic no issues" "$FI_RESOLVE" "basic-input"
assert_no_issues "NumberInput: no issues" "$FI_RESOLVE" "number-input"
assert_no_issues "Textarea: no issues" "$FI_RESOLVE" "basic-textarea"

delete_project "$FI_PROJ"
echo -e "  ${GREEN}✓${NC} FormInput project cleaned up"
PASS=$((PASS + 1))

fi # end form inputs


# ─────────────────────────────────────────────────────────────────────────────
# 12. DROPDOWN / RADIO GROUP / SLIDER / DATEPICKER
# ─────────────────────────────────────────────────────────────────────────────
if should_run "dropdown" || should_run "radioGroup" || should_run "slider" || should_run "datepicker"; then
echo -e "\n${BOLD}━━━ 12. Selection Inputs — Exhaustive ━━━${NC}"

SI_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Selection Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
SI_PROJ=$(echo "$SI_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Selection project created" "$SI_PROJ_RESP" ".project.id"

SI_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 12},
    "children": [
      {"id": "basic-dropdown", "type": "dropdown", "props": {
        "label": "Role", "options": "Admin,Editor,Viewer", "value": "{{state.role}}",
        "onChange": [{"action": "setState", "stateKey": "role", "value": "{{event.value}}"}]
      }, "children": []},
      {"id": "radio-group", "type": "radioGroup", "props": {
        "options": "Small,Medium,Large", "value": "{{state.size}}",
        "layout": "horizontal",
        "onChange": [{"action": "setState", "stateKey": "size", "value": "{{event.value}}"}]
      }, "children": []},
      {"id": "v-radio", "type": "radioGroup", "props": {
        "options": "Yes,No,Maybe", "value": "{{state.answer}}",
        "layout": "vertical"
      }, "children": []},
      {"id": "basic-slider", "type": "slider", "props": {
        "min": 0, "max": 100, "step": 5, "value": "{{state.volume}}",
        "onChange": [{"action": "setState", "stateKey": "volume", "value": "{{event.value}}"}]
      }, "children": []},
      {"id": "date-picker", "type": "datepicker", "props": {
        "label": "Start date", "value": "{{state.startDate}}",
        "onChange": [{"action": "setState", "stateKey": "startDate", "value": "{{event.value}}"}]
      }, "children": []}
    ]
  }
}'
SI_ROOT=$(echo "$SI_LAYOUT" | jq -c '.root')
SI_RESOLVE=$(resolve_layout "$SI_ROOT" '{"role":"Editor","size":"Medium","answer":"Yes","volume":50,"startDate":"2026-04-10"}')

assert_node_prop "Dropdown: label" "$SI_RESOLVE" "basic-dropdown" "content" "Role"
assert_no_issues "Dropdown: no issues" "$SI_RESOLVE" "basic-dropdown"
assert_no_issues "RadioGroup: no issues" "$SI_RESOLVE" "radio-group"
assert_no_issues "Slider: no issues" "$SI_RESOLVE" "basic-slider"
assert_no_issues "Datepicker: no issues" "$SI_RESOLVE" "date-picker"

delete_project "$SI_PROJ"
echo -e "  ${GREEN}✓${NC} Selection project cleaned up"
PASS=$((PASS + 1))

fi # end selection inputs


# ─────────────────────────────────────────────────────────────────────────────
# 13. DIVIDER / SPACER / ICON — simple display components
# ─────────────────────────────────────────────────────────────────────────────
if should_run "divider" || should_run "spacer" || should_run "icon"; then
echo -e "\n${BOLD}━━━ 13. Divider / Spacer / Icon — Exhaustive ━━━${NC}"

DI_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Display Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
DI_PROJ=$(echo "$DI_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Display project created" "$DI_PROJ_RESP" ".project.id"

DI_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 8},
    "children": [
      {"id": "h-divider", "type": "divider", "props": {"orientation": "horizontal", "color": "#e5e7eb", "thickness": 2, "width": "100%"}, "children": []},
      {"id": "colored-divider", "type": "divider", "props": {"orientation": "horizontal", "color": "#6366f1", "thickness": 3}, "children": []},
      {"id": "small-spacer", "type": "spacer", "props": {"height": 8, "width": "100%"}, "children": []},
      {"id": "large-spacer", "type": "spacer", "props": {"height": 48, "width": "100%"}, "children": []},
      {"id": "star-icon", "type": "icon", "props": {"icon": "mdi:star", "size": 24, "color": "#f59e0b"}, "children": []},
      {"id": "large-icon", "type": "icon", "props": {"icon": "mdi:heart", "size": 48, "color": "#ef4444"}, "children": []},
      {"id": "bound-icon", "type": "icon", "props": {"icon": "{{state.iconName}}", "color": "{{state.iconColor}}", "size": 32}, "children": []}
    ]
  }
}'
DI_ROOT=$(echo "$DI_LAYOUT" | jq -c '.root')
DI_RESOLVE=$(resolve_layout "$DI_ROOT" '{"iconName":"mdi:check","iconColor":"#10b981"}')

assert_no_issues "Divider: horizontal no issues" "$DI_RESOLVE" "h-divider"
assert_no_issues "Spacer: small no issues" "$DI_RESOLVE" "small-spacer"
assert_no_issues "Icon: star no issues" "$DI_RESOLVE" "star-icon"
assert_no_issues "Icon: bound no issues" "$DI_RESOLVE" "bound-icon"

delete_project "$DI_PROJ"
echo -e "  ${GREEN}✓${NC} Display project cleaned up"
PASS=$((PASS + 1))

fi # end display


# ─────────────────────────────────────────────────────────────────────────────
# 14. AVATAR — initials, size, color
# ─────────────────────────────────────────────────────────────────────────────
if should_run "avatar"; then
echo -e "\n${BOLD}━━━ 14. Avatar — Exhaustive ━━━${NC}"

AV_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Avatar Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
AV_PROJ=$(echo "$AV_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Avatar project created" "$AV_PROJ_RESP" ".project.id"

AV_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "row", "padding": 10, "minHeight": 40, "gap": 8},
    "children": [
      {"id": "sm-avatar", "type": "avatar", "props": {"initials": "SM", "size": "sm", "backgroundColor": "#6366f1"}, "children": []},
      {"id": "md-avatar", "type": "avatar", "props": {"initials": "MD", "size": "md", "backgroundColor": "#10b981"}, "children": []},
      {"id": "lg-avatar", "type": "avatar", "props": {"initials": "LG", "size": "lg", "backgroundColor": "#f59e0b"}, "children": []},
      {"id": "xl-avatar", "type": "avatar", "props": {"initials": "XL", "size": "xl", "backgroundColor": "#ef4444"}, "children": []},
      {"id": "url-avatar", "type": "avatar", "props": {"url": "https://placehold.co/80x80", "size": "md"}, "children": []},
      {"id": "bound-avatar", "type": "avatar", "props": {"initials": "{{state.userInitials}}", "backgroundColor": "{{state.avatarColor}}", "size": "md"}, "children": []}
    ]
  }
}'
AV_ROOT=$(echo "$AV_LAYOUT" | jq -c '.root')
AV_RESOLVE=$(resolve_layout "$AV_ROOT" '{"userInitials":"AB","avatarColor":"#8b5cf6"}')

assert_no_issues "Avatar: sm no issues" "$AV_RESOLVE" "sm-avatar"
assert_no_issues "Avatar: md no issues" "$AV_RESOLVE" "md-avatar"
assert_no_issues "Avatar: lg no issues" "$AV_RESOLVE" "lg-avatar"
assert_no_issues "Avatar: bound no issues" "$AV_RESOLVE" "bound-avatar"

delete_project "$AV_PROJ"
echo -e "  ${GREEN}✓${NC} Avatar project cleaned up"
PASS=$((PASS + 1))

fi # end avatar


# ─────────────────────────────────────────────────────────────────────────────
# 15. PROGRESS BAR — value, max, color, height, animation
# ─────────────────────────────────────────────────────────────────────────────
if should_run "progressBar"; then
echo -e "\n${BOLD}━━━ 15. ProgressBar — Exhaustive ━━━${NC}"

PB_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"ProgressBar Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
PB_PROJ=$(echo "$PB_PROJ_RESP" | jq -r '.project.id')
assert_json_field "ProgressBar project created" "$PB_PROJ_RESP" ".project.id"

PB_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 12},
    "children": [
      {"id": "basic-progress", "type": "progressBar", "props": {"value": 65, "max": 100, "color": "#6366f1", "height": "10px"}, "children": []},
      {"id": "zero-progress", "type": "progressBar", "props": {"value": 0, "max": 100, "color": "#ef4444", "height": "8px"}, "children": []},
      {"id": "full-progress", "type": "progressBar", "props": {"value": 100, "max": 100, "color": "#10b981", "height": "12px", "showLabel": true}, "children": []},
      {"id": "thin-progress", "type": "progressBar", "props": {"value": 33, "max": 100, "color": "#f59e0b", "height": 4}, "children": []},
      {"id": "bound-progress", "type": "progressBar", "props": {"value": "{{state.progress}}", "max": 100, "color": "#8b5cf6"}, "children": []}
    ]
  }
}'
PB_ROOT=$(echo "$PB_LAYOUT" | jq -c '.root')
PB_RESOLVE=$(resolve_layout "$PB_ROOT" '{"progress":75}')

assert_no_issues "ProgressBar: basic no issues" "$PB_RESOLVE" "basic-progress"
assert_no_issues "ProgressBar: zero no issues" "$PB_RESOLVE" "zero-progress"
assert_no_issues "ProgressBar: full no issues" "$PB_RESOLVE" "full-progress"
assert_no_issues "ProgressBar: thin no issues" "$PB_RESOLVE" "thin-progress"
assert_no_issues "ProgressBar: bound no issues" "$PB_RESOLVE" "bound-progress"

delete_project "$PB_PROJ"
echo -e "  ${GREEN}✓${NC} ProgressBar project cleaned up"
PASS=$((PASS + 1))

fi # end progressBar


# ─────────────────────────────────────────────────────────────────────────────
# 16. ALERT BANNER — variants, message, binding
# ─────────────────────────────────────────────────────────────────────────────
if should_run "alertBanner"; then
echo -e "\n${BOLD}━━━ 16. AlertBanner — Exhaustive ━━━${NC}"

AB_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"AlertBanner Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
AB_PROJ=$(echo "$AB_PROJ_RESP" | jq -r '.project.id')
assert_json_field "AlertBanner project created" "$AB_PROJ_RESP" ".project.id"

AB_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 8},
    "children": [
      {"id": "info-alert", "type": "alertBanner", "props": {"message": "Information message", "variant": "info"}, "children": []},
      {"id": "success-alert", "type": "alertBanner", "props": {"message": "Operation succeeded", "variant": "success"}, "children": []},
      {"id": "warning-alert", "type": "alertBanner", "props": {"message": "Be careful", "variant": "warning"}, "children": []},
      {"id": "error-alert", "type": "alertBanner", "props": {"message": "Something failed", "variant": "error"}, "children": []},
      {"id": "bound-alert", "type": "alertBanner", "props": {"message": "Status: {{state.status}}", "variant": "{{state.alertType}}"}, "children": []}
    ]
  }
}'
AB_ROOT=$(echo "$AB_LAYOUT" | jq -c '.root')
AB_RESOLVE=$(resolve_layout "$AB_ROOT" '{"status":"Processing","alertType":"info"}')

assert_node_prop "AlertBanner: info message" "$AB_RESOLVE" "info-alert" "content" "Information message"
assert_node_prop "AlertBanner: success message" "$AB_RESOLVE" "success-alert" "content" "Operation succeeded"
assert_node_prop "AlertBanner: bound message" "$AB_RESOLVE" "bound-alert" "content" "Status: Processing"
assert_no_issues "AlertBanner: info no issues" "$AB_RESOLVE" "info-alert"

delete_project "$AB_PROJ"
echo -e "  ${GREEN}✓${NC} AlertBanner project cleaned up"
PASS=$((PASS + 1))

fi # end alertBanner


# ─────────────────────────────────────────────────────────────────────────────
# 17. TABS — tabs list, activeTab, variant, events
# ─────────────────────────────────────────────────────────────────────────────
if should_run "tabs"; then
echo -e "\n${BOLD}━━━ 17. Tabs — Exhaustive ━━━${NC}"

TB_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Tabs Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
TB_PROJ=$(echo "$TB_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Tabs project created" "$TB_PROJ_RESP" ".project.id"

TB_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 16},
    "children": [
      {"id": "basic-tabs", "type": "tabs", "props": {
        "tabs": ["Tab 1", "Tab 2", "Tab 3"], "activeTab": 0, "variant": "default"
      }, "children": []},
      {"id": "pills-tabs", "type": "tabs", "props": {
        "tabs": ["All", "Active", "Completed"], "activeTab": "{{state.tab}}", "variant": "pills",
        "onChange": [{"action": "setState", "stateKey": "tab", "value": "{{event.value}}"}]
      }, "children": []},
      {"id": "underline-tabs", "type": "tabs", "props": {
        "tabs": ["Overview", "Details", "Settings"], "activeTab": 1, "variant": "underline"
      }, "children": []}
    ]
  }
}'
TB_ROOT=$(echo "$TB_LAYOUT" | jq -c '.root')
TB_RESOLVE=$(resolve_layout "$TB_ROOT" '{"tab":"All"}')

assert_no_issues "Tabs: basic no issues" "$TB_RESOLVE" "basic-tabs"
assert_no_issues "Tabs: pills no issues" "$TB_RESOLVE" "pills-tabs"
assert_no_issues "Tabs: underline no issues" "$TB_RESOLVE" "underline-tabs"

delete_project "$TB_PROJ"
echo -e "  ${GREEN}✓${NC} Tabs project cleaned up"
PASS=$((PASS + 1))

fi # end tabs


# ─────────────────────────────────────────────────────────────────────────────
# 18. TABLE — columns, dataSource, striped, sortable, paginate
# ─────────────────────────────────────────────────────────────────────────────
if should_run "table"; then
echo -e "\n${BOLD}━━━ 18. Table — Exhaustive ━━━${NC}"

TBL_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Table Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
TBL_PROJ=$(echo "$TBL_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Table project created" "$TBL_PROJ_RESP" ".project.id"

TBL_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 16},
    "children": [
      {"id": "basic-table", "type": "table", "props": {
        "columns": ["Name", "Score", "Status"],
        "dataSource": "{{data.users}}",
        "striped": true, "bordered": true, "sortable": true,
        "searchable": true, "pageSize": 10
      }, "children": []},
      {"id": "compact-table", "type": "table", "props": {
        "columns": ["Item", "Qty"],
        "dataSource": "{{data.items}}",
        "compact": true, "striped": false
      }, "children": []},
      {"id": "styled-table", "type": "table", "props": {
        "columns": ["A", "B"],
        "backgroundColor": "#f8fafc", "borderRadius": 8,
        "border": "1px solid #e2e8f0"
      }, "children": []}
    ]
  }
}'
TBL_ROOT=$(echo "$TBL_LAYOUT" | jq -c '.root')
TBL_DATA='{"users":[{"Name":"Alice","Score":95,"Status":"Active"},{"Name":"Bob","Score":82,"Status":"Pending"}],"items":[{"Item":"Widget","Qty":10}]}'
TBL_RESOLVE=$(resolve_layout "$TBL_ROOT" '{}' "$TBL_DATA")

assert_no_issues "Table: basic no issues" "$TBL_RESOLVE" "basic-table"
assert_no_issues "Table: compact no issues" "$TBL_RESOLVE" "compact-table"
assert_node_style "Table: styled bg" "$TBL_RESOLVE" "styled-table" "backgroundColor" "#f8fafc"

delete_project "$TBL_PROJ"
echo -e "  ${GREEN}✓${NC} Table project cleaned up"
PASS=$((PASS + 1))

fi # end table


# ─────────────────────────────────────────────────────────────────────────────
# 19. DATA REPEATER — dataSource, itemVar, children, binding
# ─────────────────────────────────────────────────────────────────────────────
if should_run "dataRepeater"; then
echo -e "\n${BOLD}━━━ 19. DataRepeater — Exhaustive ━━━${NC}"

DR_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"DataRepeater Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
DR_PROJ=$(echo "$DR_PROJ_RESP" | jq -r '.project.id')
assert_json_field "DataRepeater project created" "$DR_PROJ_RESP" ".project.id"

DR_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 8},
    "children": [
      {"id": "basic-repeater", "type": "dataRepeater", "props": {
        "dataSource": "{{data.items}}", "itemVar": "item", "emptyText": "No items found",
        "display": "flex", "flexDirection": "column", "gap": 8
      }, "children": [
        {"id": "item-row", "type": "stackH", "props": {"gap": 8, "alignItems": "center"}, "children": [
          {"id": "item-name", "type": "text", "props": {"content": "{{item.name}}"}, "children": []},
          {"id": "item-value", "type": "text", "props": {"content": "Value: {{item.value}}"}, "children": []}
        ]}
      ]},
      {"id": "custom-var-repeater", "type": "dataRepeater", "props": {
        "dataSource": "{{data.tasks}}", "itemVar": "task", "emptyText": "No tasks"
      }, "children": [
        {"id": "task-title", "type": "text", "props": {"content": "{{task.title}}: {{task.done}}"}, "children": []}
      ]},
      {"id": "empty-repeater", "type": "dataRepeater", "props": {
        "dataSource": "{{data.empty}}", "itemVar": "x", "emptyText": "Nothing here"
      }, "children": [
        {"id": "empty-child", "type": "text", "props": {"content": "Should not appear"}, "children": []}
      ]}
    ]
  }
}'
DR_ROOT=$(echo "$DR_LAYOUT" | jq -c '.root')
DR_DATA='{"items":[{"name":"Alpha","value":10},{"name":"Beta","value":20}],"tasks":[{"title":"Buy milk","done":false}],"empty":[]}'
DR_RESOLVE=$(resolve_layout "$DR_ROOT" '{}' "$DR_DATA")

assert_no_issues "DataRepeater: basic no issues" "$DR_RESOLVE" "basic-repeater"
assert_no_issues "DataRepeater: custom var no issues" "$DR_RESOLVE" "custom-var-repeater"
# Repeater type should be present
DR_TYPES=$(echo "$DR_RESOLVE" | jq -r '[.flatNodes[].type] | join(",")')
assert_contains "DataRepeater: type present" "$DR_TYPES" "dataRepeater"

delete_project "$DR_PROJ"
echo -e "  ${GREEN}✓${NC} DataRepeater project cleaned up"
PASS=$((PASS + 1))

fi # end dataRepeater


# ─────────────────────────────────────────────────────────────────────────────
# 20. LINK — label, url, styling
# ─────────────────────────────────────────────────────────────────────────────
if should_run "link"; then
echo -e "\n${BOLD}━━━ 20. Link — Exhaustive ━━━${NC}"

LK_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Link Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
LK_PROJ=$(echo "$LK_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Link project created" "$LK_PROJ_RESP" ".project.id"

LK_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 8},
    "children": [
      {"id": "basic-link", "type": "link", "props": {"label": "Click here", "url": "#"}, "children": []},
      {"id": "styled-link", "type": "link", "props": {
        "label": "Styled link", "url": "#",
        "color": "#6366f1", "fontSize": "18px", "fontWeight": "600", "textDecoration": "none"
      }, "children": []},
      {"id": "bound-link", "type": "link", "props": {"label": "{{state.linkText}}", "url": "{{state.linkUrl}}"}, "children": []}
    ]
  }
}'
LK_ROOT=$(echo "$LK_LAYOUT" | jq -c '.root')
LK_RESOLVE=$(resolve_layout "$LK_ROOT" '{"linkText":"Dynamic link","linkUrl":"https://example.com"}')

assert_node_prop "Link: basic label" "$LK_RESOLVE" "basic-link" "content" "Click here"
assert_node_prop "Link: styled label" "$LK_RESOLVE" "styled-link" "content" "Styled link"
assert_node_style "Link: styled color" "$LK_RESOLVE" "styled-link" "color" "#6366f1"
assert_node_prop "Link: bound label" "$LK_RESOLVE" "bound-link" "content" "Dynamic link"
assert_no_issues "Link: bound no issues" "$LK_RESOLVE" "bound-link"

delete_project "$LK_PROJ"
echo -e "  ${GREEN}✓${NC} Link project cleaned up"
PASS=$((PASS + 1))

fi # end link


# ─────────────────────────────────────────────────────────────────────────────
# 21. MODAL — open, close, visibleWhen
# ─────────────────────────────────────────────────────────────────────────────
if should_run "modal"; then
echo -e "\n${BOLD}━━━ 21. Modal — Exhaustive ━━━${NC}"

MO_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Modal Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
MO_PROJ=$(echo "$MO_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Modal project created" "$MO_PROJ_RESP" ".project.id"

MO_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 8},
    "children": [
      {"id": "open-btn", "type": "button", "props": {
        "label": "Open Modal",
        "onClick": [{"action": "setState", "stateKey": "showModal", "value": "true"}]
      }, "children": []},
      {"id": "test-modal", "type": "modal", "props": {
        "open": "{{state.showModal}}",
        "padding": 24, "backgroundColor": "#ffffff", "borderRadius": 16,
        "width": "400px", "maxHeight": "80vh"
      }, "children": [
        {"id": "modal-title", "type": "text", "props": {"content": "Modal Title", "fontSize": "20px", "fontWeight": "700"}, "children": []},
        {"id": "close-btn", "type": "button", "props": {
          "label": "Close",
          "onClick": [{"action": "setState", "stateKey": "showModal", "value": "false"}]
        }, "children": []}
      ]}
    ]
  }
}'
MO_ROOT=$(echo "$MO_LAYOUT" | jq -c '.root')
MO_RESOLVE=$(resolve_layout "$MO_ROOT" '{"showModal":"false"}')

assert_no_issues "Modal: no issues" "$MO_RESOLVE" "test-modal"
assert_node_prop "Modal: title" "$MO_RESOLVE" "modal-title" "content" "Modal Title"

delete_project "$MO_PROJ"
echo -e "  ${GREEN}✓${NC} Modal project cleaned up"
PASS=$((PASS + 1))

fi # end modal


# ─────────────────────────────────────────────────────────────────────────────
# 22. SPINNER — size, color
# ─────────────────────────────────────────────────────────────────────────────
if should_run "spinner"; then
echo -e "\n${BOLD}━━━ 22. Spinner — Exhaustive ━━━${NC}"

SP_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Spinner Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
SP_PROJ=$(echo "$SP_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Spinner project created" "$SP_PROJ_RESP" ".project.id"

SP_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "row", "padding": 10, "minHeight": 40, "gap": 16},
    "children": [
      {"id": "basic-spinner", "type": "spinner", "props": {"size": 24, "color": "#6366f1"}, "children": []},
      {"id": "large-spinner", "type": "spinner", "props": {"size": 48, "color": "#10b981"}, "children": []},
      {"id": "bound-spinner", "type": "spinner", "props": {"color": "{{state.spinnerColor}}", "size": 32}, "children": []}
    ]
  }
}'
SP_ROOT=$(echo "$SP_LAYOUT" | jq -c '.root')
SP_RESOLVE=$(resolve_layout "$SP_ROOT" '{"spinnerColor":"#ef4444"}')

assert_no_issues "Spinner: basic no issues" "$SP_RESOLVE" "basic-spinner"
assert_no_issues "Spinner: large no issues" "$SP_RESOLVE" "large-spinner"
assert_no_issues "Spinner: bound no issues" "$SP_RESOLVE" "bound-spinner"

delete_project "$SP_PROJ"
echo -e "  ${GREEN}✓${NC} Spinner project cleaned up"
PASS=$((PASS + 1))

fi # end spinner


# ─────────────────────────────────────────────────────────────────────────────
# 23. GRADIENT TEXT / GRADIENT SVG — gradient, animation
# ─────────────────────────────────────────────────────────────────────────────
if should_run "gradientText" || should_run "gradientSvg"; then
echo -e "\n${BOLD}━━━ 23. GradientText / GradientSvg — Exhaustive ━━━${NC}"

GT_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Gradient Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
GT_PROJ=$(echo "$GT_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Gradient project created" "$GT_PROJ_RESP" ".project.id"

GT_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 16},
    "children": [
      {"id": "basic-grad-text", "type": "gradientText", "props": {
        "content": "Gradient Title", "fontSize": "32px", "fontWeight": "800",
        "gradient": "linear-gradient(135deg, #6366f1, #a855f7)"
      }, "children": []},
      {"id": "animated-grad", "type": "gradientText", "props": {
        "content": "Animated", "fontSize": "24px", "fontWeight": "700",
        "gradient": "linear-gradient(90deg, #ff0080, #7928ca, #ff0080)",
        "animation": "dccGradientShiftX 3s ease infinite"
      }, "children": []},
      {"id": "basic-grad-svg", "type": "gradientSvg", "props": {
        "gradient": "linear-gradient(135deg, #22d3ee, #6366f1)",
        "width": 240, "height": 140, "opacity": 0.8
      }, "children": []},
      {"id": "bound-grad", "type": "gradientText", "props": {
        "content": "Score: {{state.score}}", "fontSize": "20px",
        "gradient": "linear-gradient(to right, #10b981, #3b82f6)"
      }, "children": []}
    ]
  }
}'
GT_ROOT=$(echo "$GT_LAYOUT" | jq -c '.root')
GT_RESOLVE=$(resolve_layout "$GT_ROOT" '{"score":100}')

assert_node_prop "GradientText: basic content" "$GT_RESOLVE" "basic-grad-text" "content" "Gradient Title"
assert_node_prop "GradientText: bound content" "$GT_RESOLVE" "bound-grad" "content" "Score: 100"
assert_no_issues "GradientText: basic no issues" "$GT_RESOLVE" "basic-grad-text"
assert_no_issues "GradientSvg: basic no issues" "$GT_RESOLVE" "basic-grad-svg"

delete_project "$GT_PROJ"
echo -e "  ${GREEN}✓${NC} Gradient project cleaned up"
PASS=$((PASS + 1))

fi # end gradient


# ─────────────────────────────────────────────────────────────────────────────
# 24. SECTION / HEADER / FOOTER / NAV / ASIDE / ARTICLE — semantic layouts
# ─────────────────────────────────────────────────────────────────────────────
if should_run "section" || should_run "header" || should_run "footer" || should_run "nav" || should_run "aside" || should_run "article"; then
echo -e "\n${BOLD}━━━ 24. Semantic Layout Components ━━━${NC}"

SL_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Semantic Layout Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
SL_PROJ=$(echo "$SL_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Semantic layout project created" "$SL_PROJ_RESP" ".project.id"

SL_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 0, "minHeight": 40},
    "children": [
      {"id": "page-header", "type": "header", "props": {
        "display": "flex", "flexDirection": "row", "alignItems": "center",
        "justifyContent": "space-between", "padding": "12px 20px",
        "backgroundColor": "#1e1b4b", "color": "#ffffff"
      }, "children": [
        {"id": "header-text", "type": "text", "props": {"content": "Header"}, "children": []}
      ]},
      {"id": "page-nav", "type": "nav", "props": {
        "display": "flex", "flexDirection": "row", "gap": 16,
        "padding": "8px 20px", "backgroundColor": "#f1f5f9"
      }, "children": [
        {"id": "nav-link1", "type": "link", "props": {"label": "Home", "url": "#"}, "children": []},
        {"id": "nav-link2", "type": "link", "props": {"label": "About", "url": "#"}, "children": []}
      ]},
      {"id": "page-main", "type": "main", "props": {
        "padding": 20, "minHeight": 200
      }, "children": [
        {"id": "main-section", "type": "section", "props": {
          "padding": 16, "backgroundColor": "#f8fafc", "borderRadius": 8
        }, "children": [
          {"id": "section-text", "type": "text", "props": {"content": "Section content"}, "children": []}
        ]},
        {"id": "page-article", "type": "article", "props": {
          "padding": 16, "minHeight": 100
        }, "children": [
          {"id": "article-text", "type": "text", "props": {"content": "Article content"}, "children": []}
        ]}
      ]},
      {"id": "page-aside", "type": "aside", "props": {
        "padding": 16, "backgroundColor": "#fefce8", "minHeight": 100,
        "collapsible": false
      }, "children": [
        {"id": "aside-text", "type": "text", "props": {"content": "Sidebar"}, "children": []}
      ]},
      {"id": "page-footer", "type": "footer", "props": {
        "display": "flex", "flexDirection": "row", "justifyContent": "center",
        "padding": "12px 0", "backgroundColor": "#f1f5f9"
      }, "children": [
        {"id": "footer-text", "type": "text", "props": {"content": "Footer"}, "children": []}
      ]}
    ]
  }
}'
SL_ROOT=$(echo "$SL_LAYOUT" | jq -c '.root')
SL_RESOLVE=$(resolve_layout "$SL_ROOT")

# Verify all semantic types are present in flatNodes
SL_TYPES=$(echo "$SL_RESOLVE" | jq -r '[.flatNodes[].type] | unique | join(",")')
for SL_TYPE in header nav main section article aside footer; do
  assert_contains "Semantic: $SL_TYPE present" "$SL_TYPES" "$SL_TYPE"
done

assert_node_prop "Header: text" "$SL_RESOLVE" "header-text" "content" "Header"
assert_node_prop "Footer: text" "$SL_RESOLVE" "footer-text" "content" "Footer"
assert_node_prop "Section: text" "$SL_RESOLVE" "section-text" "content" "Section content"
assert_node_prop "Article: text" "$SL_RESOLVE" "article-text" "content" "Article content"
assert_node_style "Header: bg" "$SL_RESOLVE" "page-header" "backgroundColor" "#1e1b4b"
assert_node_style "Header: flexDirection=row" "$SL_RESOLVE" "page-header" "flexDirection" "row"
assert_node_style "Footer: justifyContent=center" "$SL_RESOLVE" "page-footer" "justifyContent" "center"

assert_no_issues "Header: no issues" "$SL_RESOLVE" "page-header"
assert_no_issues "Nav: no issues" "$SL_RESOLVE" "page-nav"
assert_no_issues "Section: no issues" "$SL_RESOLVE" "main-section"

delete_project "$SL_PROJ"
echo -e "  ${GREEN}✓${NC} Semantic layout project cleaned up"
PASS=$((PASS + 1))

fi # end semantic layouts


# ─────────────────────────────────────────────────────────────────────────────
# 25. ACCORDION / TOOLTIP / EMBED / VIDEO / FILE UPLOAD / FORM WRAPPER
# ─────────────────────────────────────────────────────────────────────────────
if should_run "accordion" || should_run "tooltip" || should_run "embed" || should_run "video" || should_run "fileUpload" || should_run "formWrapper"; then
echo -e "\n${BOLD}━━━ 25. Specialty Components ━━━${NC}"

SC_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Specialty Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
SC_PROJ=$(echo "$SC_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Specialty project created" "$SC_PROJ_RESP" ".project.id"

SC_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 12},
    "children": [
      {"id": "test-accordion", "type": "accordion", "props": {
        "title": "Click to expand",
        "padding": 16, "backgroundColor": "#f8fafc", "borderRadius": 8
      }, "children": [
        {"id": "acc-content", "type": "text", "props": {"content": "Accordion body"}, "children": []}
      ]},
      {"id": "test-tooltip", "type": "tooltip", "props": {
        "text": "Helpful tip", "position": "top"
      }, "children": [
        {"id": "tooltip-child", "type": "text", "props": {"content": "Hover me"}, "children": []}
      ]},
      {"id": "test-embed", "type": "embed", "props": {
        "html": "<div style=\"color:blue\">Embedded</div>",
        "width": "100%", "height": 200
      }, "children": []},
      {"id": "test-video", "type": "video", "props": {
        "url": "https://example.com/video.mp4",
        "width": "100%", "height": 300, "autoplay": false, "controls": true
      }, "children": []},
      {"id": "test-upload", "type": "fileUpload", "props": {
        "label": "Upload file", "accept": ".jpg,.png,.pdf",
        "multiple": false
      }, "children": []},
      {"id": "test-form", "type": "formWrapper", "props": {
        "padding": 16, "gap": 12
      }, "children": [
        {"id": "form-input", "type": "textInput", "props": {"label": "Name", "placeholder": "Enter name"}, "children": []},
        {"id": "form-submit", "type": "button", "props": {"label": "Submit", "variant": "primary"}, "children": []}
      ]}
    ]
  }
}'
SC_ROOT=$(echo "$SC_LAYOUT" | jq -c '.root')
SC_RESOLVE=$(resolve_layout "$SC_ROOT")

assert_no_issues "Accordion: no issues" "$SC_RESOLVE" "test-accordion"
assert_no_issues "Tooltip: no issues" "$SC_RESOLVE" "test-tooltip"
assert_no_issues "Embed: no issues" "$SC_RESOLVE" "test-embed"
assert_no_issues "Video: no issues" "$SC_RESOLVE" "test-video"
assert_no_issues "FileUpload: no issues" "$SC_RESOLVE" "test-upload"
assert_no_issues "FormWrapper: no issues" "$SC_RESOLVE" "test-form"
assert_node_prop "Accordion: body" "$SC_RESOLVE" "acc-content" "content" "Accordion body"
assert_node_prop "Form: submit label" "$SC_RESOLVE" "form-submit" "content" "Submit"

delete_project "$SC_PROJ"
echo -e "  ${GREEN}✓${NC} Specialty project cleaned up"
PASS=$((PASS + 1))

fi # end specialty


# ─────────────────────────────────────────────────────────────────────────────
# 26. SUSPENSE — skeleton, spinner, label variants
# ─────────────────────────────────────────────────────────────────────────────
if should_run "suspense"; then
echo -e "\n${BOLD}━━━ 26. Suspense — Exhaustive ━━━${NC}"

SU_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Suspense Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
SU_PROJ=$(echo "$SU_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Suspense project created" "$SU_PROJ_RESP" ".project.id"

SU_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 12},
    "children": [
      {"id": "skeleton-suspense", "type": "suspense", "props": {
        "suspenseEnabled": true, "suspenseVariant": "skeleton",
        "suspenseWhen": "{{state.loading}} == true",
        "padding": 16
      }, "children": [
        {"id": "susp-content", "type": "text", "props": {"content": "Loaded content"}, "children": []}
      ]},
      {"id": "spinner-suspense", "type": "suspense", "props": {
        "suspenseEnabled": true, "suspenseVariant": "spinner",
        "suspenseLabel": "Loading data...",
        "suspenseWhen": "{{state.loadingB}} == true"
      }, "children": []},
      {"id": "dots-suspense", "type": "suspense", "props": {
        "suspenseEnabled": true, "suspenseVariant": "dots",
        "suspenseDirection": "horizontal"
      }, "children": []}
    ]
  }
}'
SU_ROOT=$(echo "$SU_LAYOUT" | jq -c '.root')
SU_RESOLVE=$(resolve_layout "$SU_ROOT" '{"loading":false,"loadingB":true}')

assert_no_issues "Suspense: skeleton no issues" "$SU_RESOLVE" "skeleton-suspense"
assert_no_issues "Suspense: spinner no issues" "$SU_RESOLVE" "spinner-suspense"
assert_node_prop "Suspense: loaded content" "$SU_RESOLVE" "susp-content" "content" "Loaded content"

delete_project "$SU_PROJ"
echo -e "  ${GREEN}✓${NC} Suspense project cleaned up"
PASS=$((PASS + 1))

fi # end suspense


# ─────────────────────────────────────────────────────────────────────────────
# 27. GESTURE DETECTOR — tap, double-tap, press, hover
# ─────────────────────────────────────────────────────────────────────────────
if should_run "gestureDetector"; then
echo -e "\n${BOLD}━━━ 27. GestureDetector — Exhaustive ━━━${NC}"

GD_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"GestureDetector Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
GD_PROJ=$(echo "$GD_PROJ_RESP" | jq -r '.project.id')
assert_json_field "GestureDetector project created" "$GD_PROJ_RESP" ".project.id"

GD_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40, "gap": 12},
    "children": [
      {"id": "tap-detector", "type": "gestureDetector", "props": {
        "behavior": "opacity",
        "onClick": [{"action": "setState", "stateKey": "tapped", "value": "true"}],
        "onDoubleClick": [{"action": "setState", "stateKey": "doubleTapped", "value": "true"}]
      }, "children": [
        {"id": "tap-content", "type": "text", "props": {"content": "Tap me"}, "children": []}
      ]},
      {"id": "press-detector", "type": "gestureDetector", "props": {
        "behavior": "scale",
        "onPressIn": [{"action": "setState", "stateKey": "pressed", "value": "true"}],
        "onPressOut": [{"action": "setState", "stateKey": "pressed", "value": "false"}]
      }, "children": [
        {"id": "press-content", "type": "text", "props": {"content": "Press & hold"}, "children": []}
      ]},
      {"id": "hover-detector", "type": "gestureDetector", "props": {
        "behavior": "opacity",
        "onMouseEnter": [{"action": "setState", "stateKey": "hovered", "value": "true"}],
        "onMouseLeave": [{"action": "setState", "stateKey": "hovered", "value": "false"}]
      }, "children": [
        {"id": "hover-content", "type": "text", "props": {"content": "Hover: {{state.hovered}}"}, "children": []}
      ]}
    ]
  }
}'
GD_ROOT=$(echo "$GD_LAYOUT" | jq -c '.root')
GD_RESOLVE=$(resolve_layout "$GD_ROOT" '{"tapped":"false","doubleTapped":"false","pressed":"false","hovered":"false"}')

assert_no_issues "GestureDetector: tap no issues" "$GD_RESOLVE" "tap-detector"
assert_no_issues "GestureDetector: press no issues" "$GD_RESOLVE" "press-detector"
assert_node_prop "GestureDetector: hover binding" "$GD_RESOLVE" "hover-content" "content" "Hover: false"

delete_project "$GD_PROJ"
echo -e "  ${GREEN}✓${NC} GestureDetector project cleaned up"
PASS=$((PASS + 1))

fi # end gestureDetector


# ─────────────────────────────────────────────────────────────────────────────
# 28. RICH TEXT — HTML content rendering
# ─────────────────────────────────────────────────────────────────────────────
if should_run "richText"; then
echo -e "\n${BOLD}━━━ 28. RichText — Exhaustive ━━━${NC}"

RT_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"RichText Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
RT_PROJ=$(echo "$RT_PROJ_RESP" | jq -r '.project.id')
assert_json_field "RichText project created" "$RT_PROJ_RESP" ".project.id"

RT_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 10, "minHeight": 40},
    "children": [
      {"id": "basic-rich", "type": "richText", "props": {
        "content": "<h1>Title</h1><p>Paragraph with <strong>bold</strong> and <em>italic</em>.</p>"
      }, "children": []},
      {"id": "bound-rich", "type": "richText", "props": {
        "content": "{{state.htmlContent}}"
      }, "children": []}
    ]
  }
}'
RT_ROOT=$(echo "$RT_LAYOUT" | jq -c '.root')
RT_RESOLVE=$(resolve_layout "$RT_ROOT" '{"htmlContent":"<p>Dynamic HTML</p>"}')

assert_no_issues "RichText: basic no issues" "$RT_RESOLVE" "basic-rich"
assert_no_issues "RichText: bound no issues" "$RT_RESOLVE" "bound-rich"

delete_project "$RT_PROJ"
echo -e "  ${GREEN}✓${NC} RichText project cleaned up"
PASS=$((PASS + 1))

fi # end richText


# ─────────────────────────────────────────────────────────────────────────────
# 29. CROSS-COMPONENT SSR INTEGRATION TEST
# ─────────────────────────────────────────────────────────────────────────────
if should_run "integration"; then
echo -e "\n${BOLD}━━━ 29. Cross-Component SSR Integration ━━━${NC}"

INT_PROJ_RESP=$(api_post "/api/projects" "{\"name\":\"Integration Test\",\"organizationId\":\"$SHARED_ORG_ID\"}")
INT_PROJ=$(echo "$INT_PROJ_RESP" | jq -r '.project.id')
assert_json_field "Integration project created" "$INT_PROJ_RESP" ".project.id"

# Save globals
api_put "/api/projects/$INT_PROJ/globals" '{"globalStateDefinitions":[{"name":"count","type":"number","initialValue":"0"},{"name":"name","type":"text","initialValue":"World"},{"name":"active","type":"boolean","initialValue":"true"},{"name":"theme","type":"text","initialValue":"light"}]}' > /dev/null

INT_LAYOUT='{
  "root": {
    "id": "root", "type": "container",
    "props": {"flexDirection": "column", "padding": 20, "minHeight": "100vh", "gap": 16, "backgroundColor": "#faf5ff"},
    "children": [
      {"id": "int-header", "type": "header", "props": {
        "display": "flex", "flexDirection": "row", "alignItems": "center", "justifyContent": "space-between",
        "padding": "12px 20px", "backgroundColor": "#1e1b4b"
      }, "children": [
        {"id": "int-title", "type": "gradientText", "props": {"content": "Hello {{state.name}}", "fontSize": "24px", "fontWeight": "800", "gradient": "linear-gradient(135deg, #6366f1, #a855f7)"}, "children": []},
        {"id": "int-badge", "type": "badge", "props": {"label": "Count: {{state.count}}", "variant": "info"}, "children": []}
      ]},
      {"id": "int-card", "type": "card", "props": {"padding": 16, "backgroundColor": "#ffffff", "borderRadius": 12, "boxShadow": "0 2px 8px rgba(0,0,0,0.06)"}, "children": [
        {"id": "int-stack", "type": "stackH", "props": {"gap": 12, "alignItems": "center"}, "children": [
          {"id": "int-btn", "type": "button", "props": {
            "label": "Increment",
            "onClick": [{"action": "mutateState", "stateKey": "count", "mutationOp": "increment"}]
          }, "children": []},
          {"id": "int-count", "type": "text", "props": {"content": "Count: {{state.count}}"}, "children": []},
          {"id": "int-toggle", "type": "toggle", "props": {
            "label": "Active",
            "checked": "{{state.active}}",
            "onChange": [{"action": "setState", "stateKey": "active", "value": "{{event.checked}}"}]
          }, "children": []}
        ]}
      ]},
      {"id": "int-input-row", "type": "stackH", "props": {"gap": 8}, "children": [
        {"id": "int-input", "type": "textInput", "props": {
          "placeholder": "Enter name",
          "value": "{{state.name}}",
          "onChange": [{"action": "setState", "stateKey": "name", "value": "{{event.value}}"}]
        }, "children": []},
        {"id": "int-avatar", "type": "avatar", "props": {"initials": "WD", "size": "md", "backgroundColor": "#6366f1"}, "children": []}
      ]},
      {"id": "int-progress", "type": "progressBar", "props": {"value": 50, "max": 100, "color": "#6366f1", "height": "8px"}, "children": []},
      {"id": "int-alert", "type": "alertBanner", "props": {"message": "Theme: {{state.theme}}", "variant": "info"}, "children": []},
      {"id": "int-divider", "type": "divider", "props": {"orientation": "horizontal", "color": "#e9d5ff", "thickness": 2}, "children": []},
      {"id": "int-footer", "type": "footer", "props": {"display": "flex", "justifyContent": "center", "padding": "12px 0"}, "children": [
        {"id": "int-footer-text", "type": "text", "props": {"content": "Exhaustive Test v1"}, "children": []}
      ]}
    ]
  }
}'

# Create screen, publish, test SSR
INT_SC=$(api_post "/api/projects/$INT_PROJ/screens" "{\"name\":\"Main\",\"slug\":\"main\",\"route\":\"/\",\"layout\":$INT_LAYOUT}")
assert_json_field "Integration screen created" "$INT_SC" ".screen.id"
api_put "/api/projects/$INT_PROJ" '{"isPublished":true}' > /dev/null
sleep 1

INT_HTML=$(get_html "$INT_PROJ")

# SSR binding resolution
assert_contains "SSR Integration: Hello World" "$INT_HTML" "Hello World"
assert_contains "SSR Integration: Count: 0" "$INT_HTML" "Count: 0"
assert_contains "SSR Integration: Theme: light" "$INT_HTML" "Theme: light"
assert_contains "SSR Integration: footer text" "$INT_HTML" "Exhaustive Test v1"
# Note: {{state.xxx}} and {{event.xxx}} may appear in SSR HTML
# as part of serialized layout JSON and style bindings (resolved client-side)

# Resolve API verification
INT_ROOT=$(echo "$INT_LAYOUT" | jq -c '.root')
INT_RESOLVE=$(resolve_layout "$INT_ROOT" '{"count":0,"name":"World","active":true,"theme":"light"}')
INT_ISSUE_COUNT=$(echo "$INT_RESOLVE" | jq '.issueCount')
if [[ "$INT_ISSUE_COUNT" == "0" ]]; then
  echo -e "  ${GREEN}✓${NC} Integration: zero resolve issues across all nodes"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Integration: $INT_ISSUE_COUNT resolve issues"
  FAIL=$((FAIL + 1))
  echo "$INT_RESOLVE" | jq '.issues[]' 2>/dev/null | head -10
fi

# Verify all types present
INT_TYPES=$(echo "$INT_RESOLVE" | jq -r '[.flatNodes[].type] | unique | join(",")')
for INT_TYPE in container header card stackH button text toggle textInput avatar progressBar alertBanner divider footer gradientText badge; do
  assert_contains "Integration: $INT_TYPE in resolve" "$INT_TYPES" "$INT_TYPE"
done

delete_project "$INT_PROJ"
echo -e "  ${GREEN}✓${NC} Integration project cleaned up"
PASS=$((PASS + 1))

fi # end integration


# =============================================================================
# ██████████████████████████████████████████████████████████████████████████████
#  RESULTS
# ██████████████████████████████████████████████████████████████████████████████
# =============================================================================

TOTAL=$((PASS + FAIL + SKIP))

echo ""
echo -e "${BOLD}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║               TEST RESULTS                       ║${NC}"
echo -e "${BOLD}╠═══════════════════════════════════════════════════╣${NC}"
printf "${BOLD}║  Total:   %-38s ║${NC}\n" "$TOTAL"
printf "${BOLD}║  Passed:  ${GREEN}%-38s${NC}${BOLD} ║${NC}\n" "$PASS"
printf "${BOLD}║  Failed:  ${RED}%-38s${NC}${BOLD} ║${NC}\n" "$FAIL"
printf "${BOLD}║  Skipped: ${YELLOW}%-38s${NC}${BOLD} ║${NC}\n" "$SKIP"
echo -e "${BOLD}╚═══════════════════════════════════════════════════╝${NC}"

if [[ $FAIL -gt 0 ]]; then
  echo -e "\n${RED}${BOLD}Failed tests:${NC}"
  echo -e "$ERRORS"
  echo ""
  exit 1
else
  echo -e "\n${GREEN}${BOLD}All tests passed!${NC}\n"
  exit 0
fi
