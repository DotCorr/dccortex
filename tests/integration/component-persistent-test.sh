#!/usr/bin/env bash
# =============================================================================
# DCCortex Persistent Component Integration Test
# =============================================================================
# - Uses one fixed account and one fixed organization
# - Creates one persistent project per component (never deletes)
# - Upserts screens so script is re-runnable
# - Starts with deep checks for container/text/button
#
# Usage:
#   ./tests/integration/component-persistent-test.sh [BASE_URL] [COMPONENT]
#
# Examples:
#   ./tests/integration/component-persistent-test.sh
#   ./tests/integration/component-persistent-test.sh http://localhost:3002 container
# =============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:3002}"
ONLY_COMPONENT="${2:-}"
ORG_ID="2a21fcb6-2649-449b-ada3-c0f5b25c778f"
TEST_EMAIL="demo@dccortex.local"
TEST_PASSWORD="DemoPass99"
COOKIE_JAR=$(mktemp)
RESOLVE_TMP=$(mktemp)
_EMPTY_JSON='{}'
PASS=0
FAIL=0
ERRORS=""

cleanup() {
  rm -f "$COOKIE_JAR" "$RESOLVE_TMP" 2>/dev/null || true
}
trap cleanup EXIT

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

assert_status() {
  local test_name="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo -e "  ${GREEN}OK${NC} $test_name (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} $test_name - expected $expected, got $actual"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  - $test_name: expected $expected, got $actual"
  fi
}

assert_json_field() {
  local test_name="$1" json="$2" field="$3"
  local value
  value=$(echo "$json" | jq -r "$field" 2>/dev/null || echo "PARSE_ERROR")
  if [[ "$value" != "null" && "$value" != "" && "$value" != "PARSE_ERROR" ]]; then
    echo -e "  ${GREEN}OK${NC} $test_name"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} $test_name - field $field missing"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  - $test_name: missing $field"
  fi
}

assert_node_style() {
  local test_name="$1" resolve_json="$2" node_id="$3" style_key="$4" expected="$5"
  local actual
  actual=$(echo "$resolve_json" | jq -r "[.. | objects | select(.id? == \"$node_id\" and .computedStyle?) | .computedStyle.\"$style_key\" // null] | first // empty" 2>/dev/null)
  if [[ "$actual" == "$expected" ]]; then
    echo -e "  ${GREEN}OK${NC} $test_name"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} $test_name - expected '$expected', got '$actual'"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  - $test_name: expected $expected, got $actual"
  fi
}

assert_node_content() {
  local test_name="$1" resolve_json="$2" node_id="$3" expected="$4"
  local actual
  actual=$(echo "$resolve_json" | jq -r "[.flatNodes[] | select(.id == \"$node_id\")] | .[0].content // empty" 2>/dev/null)
  if [[ "$actual" == "$expected" ]]; then
    echo -e "  ${GREEN}OK${NC} $test_name"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} $test_name - expected '$expected', got '$actual'"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  - $test_name: expected $expected, got $actual"
  fi
}

api_get()   { curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" "${BASE_URL}${1}"; }
api_post()  { curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -H "Content-Type: application/json" -X POST --data-raw "${2:-$_EMPTY_JSON}" "${BASE_URL}${1}"; }
api_put()   { curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -H "Content-Type: application/json" -X PUT --data-raw "${2:-$_EMPTY_JSON}" "${BASE_URL}${1}"; }
api_patch() { curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -H "Content-Type: application/json" -X PATCH --data-raw "${2:-$_EMPTY_JSON}" "${BASE_URL}${1}"; }

resolve_layout() {
  local root_json="$1" state_json="${2:-$_EMPTY_JSON}" data_json="${3:-$_EMPTY_JSON}"
  printf '{"root":%s,"state":%s,"data":%s}' "$root_json" "$state_json" "$data_json" > "$RESOLVE_TMP"
  curl -s -X POST "${BASE_URL}/api/runtime-resolve" -H "Content-Type: application/json" -d @"$RESOLVE_TMP"
}

slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'
}

login_demo_user() {
  local csrf_resp csrf_token login_status
  csrf_resp=$(api_get "/api/auth/csrf")
  csrf_token=$(echo "$csrf_resp" | jq -r '.csrfToken // empty')
  if [[ -z "$csrf_token" ]]; then
    echo -e "${RED}Could not fetch CSRF token. Is dashboard running at ${BASE_URL}?${NC}"
    exit 1
  fi

  login_status=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -X POST "${BASE_URL}/api/auth/callback/credentials" \
    --data-urlencode "csrfToken=${csrf_token}" \
    --data-urlencode "email=${TEST_EMAIL}" \
    --data-urlencode "password=${TEST_PASSWORD}" \
    --data-urlencode "json=true")

  if [[ "$login_status" != "200" && "$login_status" != "302" ]]; then
    echo -e "${RED}Login failed with HTTP ${login_status}${NC}"
    exit 1
  fi

  local session
  session=$(api_get "/api/auth/session")
  assert_json_field "Session is valid" "$session" ".user.email"
}

get_or_create_project() {
  local project_name="$1"
  local project_desc="$2"
  local projects_resp existing_id create_resp new_id

  projects_resp=$(api_get "/api/projects?organizationId=${ORG_ID}")
  existing_id=$(echo "$projects_resp" | jq -r --arg name "$project_name" '.projects[]? | select(.name == $name) | .id' | head -n1)

  if [[ -n "$existing_id" ]]; then
    echo "$existing_id"
    return 0
  fi

  create_resp=$(api_post "/api/projects" "{\"name\":\"${project_name}\",\"description\":\"${project_desc}\",\"organizationId\":\"${ORG_ID}\"}")
  new_id=$(echo "$create_resp" | jq -r '.project.id // empty')
  if [[ -z "$new_id" ]]; then
    echo -e "${RED}Failed to create project: ${project_name}${NC}"
    echo "$create_resp" | head -c 500
    exit 1
  fi

  echo "$new_id"
}

get_or_upsert_screen() {
  local project_id="$1"
  local screen_name="$2"
  local screen_slug="$3"
  local layout_json="$4"
  local screens_resp screen_id create_resp

  screens_resp=$(api_get "/api/projects/${project_id}/screens")
  screen_id=$(echo "$screens_resp" | jq -r --arg slug "$screen_slug" '.screens[]? | select(.slug == $slug) | .id' | head -n1)

  if [[ -n "$screen_id" ]]; then
    api_patch "/api/projects/${project_id}/screens/${screen_id}" "{\"name\":\"${screen_name}\",\"slug\":\"${screen_slug}\",\"layout\":${layout_json}}" >/dev/null
    echo "$screen_id"
    return 0
  fi

  create_resp=$(api_post "/api/projects/${project_id}/screens" "{\"name\":\"${screen_name}\",\"slug\":\"${screen_slug}\",\"route\":\"/${screen_slug}\",\"layout\":${layout_json}}")
  screen_id=$(echo "$create_resp" | jq -r '.screen.id // empty')
  if [[ -z "$screen_id" ]]; then
    echo -e "${RED}Failed to create screen ${screen_slug} for project ${project_id}${NC}"
    echo "$create_resp" | head -c 500
    exit 1
  fi
  echo "$screen_id"
}

publish_project() {
  local project_id="$1"
  api_put "/api/projects/${project_id}" '{"isPublished":true}' >/dev/null
}

set_project_globals() {
  local project_id="$1"
  local globals_json="$2"
  api_put "/api/projects/${project_id}/globals" "{\"globalStateDefinitions\":${globals_json}}" >/dev/null
}

ensure_component_project() {
  local component_id="$1"
  local component_title="$2"
  local project_name="Component: ${component_title}"
  local screen_slug="$(slugify "$component_title")-spec"

  local layout_json
  layout_json=$(jq -cn --arg cid "$component_id" '{root:{id:"root",type:"container",props:{padding:16,gap:12},children:[{id:("node-"+$cid),type:$cid,props:{},children:[]}]}}')

  local project_id
  project_id=$(get_or_create_project "$project_name" "Persistent component validation project for ${component_title}")
  get_or_upsert_screen "$project_id" "${component_title} Spec" "$screen_slug" "$layout_json" >/dev/null
  publish_project "$project_id"

  echo -e "  ${CYAN}${component_title}${NC}: ${BASE_URL}/organizations/${ORG_ID}/projects/${project_id}"
  echo -e "  ${CYAN}${component_title} public${NC}: ${BASE_URL}/p/${project_id}"
}

test_container_component() {
  echo -e "\n${BOLD}== Container (deep test) ==${NC}"
  local project_id layout_json root_json screen_id resolve_json

  project_id=$(get_or_create_project "Component: Container" "Persistent component validation project for Container")
  set_project_globals "$project_id" '[{"key":"themeColor","type":"string","defaultValue":"#0ea5e9"}]'

  layout_json='{
    "root": {
      "id": "root",
      "type": "container",
      "props": {
        "flexDirection": "row",
        "alignItems": "center",
        "justifyContent": "space-between",
        "gap": 20,
        "padding": 18,
        "margin": 6,
        "width": "100%",
        "height": "320px",
        "minHeight": 240,
        "backgroundColor": "{{state.themeColor}}",
        "borderRadius": 14,
        "animation": "fadeIn 0.4s ease"
      },
      "children": [
        {
          "id": "left-stack",
          "type": "stackV",
          "props": {
            "gap": 8,
            "padding": 8,
            "visibleWhen": "{{state.showLeft}} == true"
          },
          "children": [
            { "id": "left-title", "type": "text", "props": { "content": "Left panel" }, "children": [] }
          ]
        },
        {
          "id": "right-stack",
          "type": "stackV",
          "props": {
            "gap": 6,
            "padding": 10,
            "visibleWhen": "{{state.showLeft}} == false"
          },
          "children": [
            { "id": "right-title", "type": "text", "props": { "content": "Right panel" }, "children": [] }
          ]
        }
      ]
    }
  }'

  screen_id=$(get_or_upsert_screen "$project_id" "Container Spec" "container-spec" "$layout_json")
  publish_project "$project_id"

  root_json=$(echo "$layout_json" | jq -c '.root')
  resolve_json=$(resolve_layout "$root_json" '{"showLeft":true,"themeColor":"#0ea5e9"}' '{}')

  assert_node_style "Container flexDirection" "$resolve_json" "root" "flexDirection" "row"
  assert_node_style "Container alignItems" "$resolve_json" "root" "alignItems" "center"
  assert_node_style "Container justifyContent" "$resolve_json" "root" "justifyContent" "space-between"
  assert_node_style "Container gap" "$resolve_json" "root" "gap" "20px"
  assert_node_style "Container padding" "$resolve_json" "root" "padding" "18px"
  assert_node_style "Container margin" "$resolve_json" "root" "margin" "6px"
  assert_node_style "Container minHeight" "$resolve_json" "root" "minHeight" "240px"
  assert_node_style "Container borderRadius" "$resolve_json" "root" "borderRadius" "14px"
  assert_node_style "Container background global binding" "$resolve_json" "root" "backgroundColor" "#0ea5e9"
  assert_node_content "VisibleWhen true branch" "$resolve_json" "left-title" "Left panel"

  resolve_json=$(resolve_layout "$root_json" '{"showLeft":false,"themeColor":"#0ea5e9"}' '{}')
  assert_node_content "VisibleWhen false branch" "$resolve_json" "right-title" "Right panel"

  echo -e "  ${CYAN}Editor${NC}: ${BASE_URL}/organizations/${ORG_ID}/projects/${project_id}/screens/${screen_id}/edit"
  echo -e "  ${CYAN}Public${NC}: ${BASE_URL}/p/${project_id}"
}

test_text_component() {
  echo -e "\n${BOLD}== Text (deep test) ==${NC}"
  local project_id layout_json root_json screen_id resolve_json

  project_id=$(get_or_create_project "Component: Text" "Persistent component validation project for Text")
  layout_json='{
    "root": {
      "id": "root",
      "type": "container",
      "props": {"padding": 24, "gap": 12},
      "children": [
        {
          "id": "text-node",
          "type": "text",
          "props": {
            "content": "{{state.title}}",
            "variant": "h2",
            "fontSize": 34,
            "fontWeight": 700,
            "letterSpacing": 1.2,
            "lineHeight": 1.4,
            "color": "#0f172a",
            "textAlign": "center",
            "animation": "fadeIn 0.6s ease"
          },
          "children": []
        }
      ]
    }
  }'

  screen_id=$(get_or_upsert_screen "$project_id" "Text Spec" "text-spec" "$layout_json")
  publish_project "$project_id"

  root_json=$(echo "$layout_json" | jq -c '.root')
  resolve_json=$(resolve_layout "$root_json" '{"title":"Persistent Text Works"}' '{}')

  assert_node_content "Text content binding" "$resolve_json" "text-node" "Persistent Text Works"
  assert_node_style "Text font size" "$resolve_json" "text-node" "fontSize" "34px"
  assert_node_style "Text font weight" "$resolve_json" "text-node" "fontWeight" "700"
  assert_node_style "Text letter spacing" "$resolve_json" "text-node" "letterSpacing" "1.2px"
  assert_node_style "Text alignment" "$resolve_json" "text-node" "textAlign" "center"

  echo -e "  ${CYAN}Editor${NC}: ${BASE_URL}/organizations/${ORG_ID}/projects/${project_id}/screens/${screen_id}/edit"
  echo -e "  ${CYAN}Public${NC}: ${BASE_URL}/p/${project_id}"
}

test_button_component() {
  echo -e "\n${BOLD}== Button (deep test) ==${NC}"
  local project_id layout_json root_json screen_id resolve_json

  project_id=$(get_or_create_project "Component: Button" "Persistent component validation project for Button")
  layout_json='{
    "root": {
      "id": "root",
      "type": "container",
      "props": {"padding": 24, "gap": 12},
      "children": [
        {
          "id": "btn-node",
          "type": "button",
          "props": {
            "label": "{{state.label}}",
            "variant": "outline",
            "width": "220px",
            "height": "48px",
            "borderRadius": 12,
            "fontSize": 16,
            "fontWeight": 600,
            "animation": "fadeIn 0.25s ease"
          },
          "children": []
        }
      ]
    }
  }'

  screen_id=$(get_or_upsert_screen "$project_id" "Button Spec" "button-spec" "$layout_json")
  publish_project "$project_id"

  root_json=$(echo "$layout_json" | jq -c '.root')
  resolve_json=$(resolve_layout "$root_json" '{"label":"Save Changes"}' '{}')

  assert_node_content "Button label binding" "$resolve_json" "btn-node" "Save Changes"
  assert_node_style "Button width" "$resolve_json" "btn-node" "width" "220px"
  assert_node_style "Button height" "$resolve_json" "btn-node" "height" "48px"
  assert_node_style "Button border radius" "$resolve_json" "btn-node" "borderRadius" "12px"
  assert_node_style "Button font size" "$resolve_json" "btn-node" "fontSize" "16px"

  echo -e "  ${CYAN}Editor${NC}: ${BASE_URL}/organizations/${ORG_ID}/projects/${project_id}/screens/${screen_id}/edit"
  echo -e "  ${CYAN}Public${NC}: ${BASE_URL}/p/${project_id}"
}

seed_all_component_projects() {
  echo -e "\n${BOLD}== Seeding persistent project per component ==${NC}"

  local components=(
    "container:Container" "text:Text" "button:Button" "stackH:Stack H" "stackV:Stack V"
    "image:Image" "card:Card" "badge:Badge" "checkbox:Checkbox" "toggle:Toggle"
    "textInput:Text Input" "numberInput:Number Input" "textarea:Textarea" "dropdown:Dropdown"
    "radioGroup:Radio Group" "slider:Slider" "datepicker:Date Picker" "divider:Divider"
    "spacer:Spacer" "icon:Icon" "avatar:Avatar" "progressBar:Progress Bar"
    "alertBanner:Alert Banner" "tabs:Tabs" "table:Table" "dataRepeater:Data Repeater"
    "link:Link" "modal:Modal" "spinner:Spinner" "gradientText:Gradient Text"
    "gradientSvg:Gradient SVG" "section:Section" "header:Header" "main:Main"
    "footer:Footer" "nav:Nav" "aside:Aside" "article:Article" "accordion:Accordion"
    "formWrapper:Form" "gestureDetector:Gesture Detector" "suspense:Suspense"
    "richText:Rich Text" "tooltip:Tooltip" "embed:Embed" "video:Video" "fileUpload:File Upload"
  )

  local item cid title
  for item in "${components[@]}"; do
    cid="${item%%:*}"
    title="${item#*:}"
    if [[ -n "$ONLY_COMPONENT" && "$ONLY_COMPONENT" != "$cid" ]]; then
      continue
    fi
    ensure_component_project "$cid" "$title"
  done
}

should_run() {
  [[ -z "$ONLY_COMPONENT" || "$ONLY_COMPONENT" == "$1" ]]
}

echo -e "${BOLD}===============================================${NC}"
echo -e "${BOLD}DCCortex Persistent Component Test${NC}"
echo -e "${BOLD}Target: ${BASE_URL}${NC}"
echo -e "${BOLD}Org: ${ORG_ID}${NC}"
echo -e "${BOLD}===============================================${NC}"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/")
assert_status "Server reachable" "200" "$HTTP_STATUS"

login_demo_user
seed_all_component_projects

if should_run "container"; then
  test_container_component
fi
if should_run "text"; then
  test_text_component
fi
if should_run "button"; then
  test_button_component
fi

echo -e "\n${BOLD}Summary${NC}"
echo -e "  Passed: ${GREEN}${PASS}${NC}"
echo -e "  Failed: ${RED}${FAIL}${NC}"

if [[ "$FAIL" -gt 0 ]]; then
  echo -e "\n${RED}Failures:${NC}${ERRORS}"
  exit 1
fi

echo -e "\n${GREEN}Persistent component project setup complete.${NC}"
