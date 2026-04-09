#!/bin/bash
set -euo pipefail
BASE=http://localhost:3002
CJ=$(mktemp)
trap "rm -f $CJ" EXIT

EMAIL="test-1775720385@dccortex-test.local"
PASS="SecurePass99"
ORG_ID="298f07b3-c75c-499a-a271-1c5a90896f39"

# Login
CSRF=$(curl -s -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | jq -r '.csrfToken')
curl -s -o /dev/null -b "$CJ" -c "$CJ" -X POST "$BASE/api/auth/callback/credentials" \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode "email=$EMAIL" \
  --data-urlencode "password=$PASS" --data-urlencode "json=true"
echo "Logged in"

api_post() { curl -s -b "$CJ" -c "$CJ" -H "Content-Type: application/json" -X POST "${BASE}${1}" --data-raw "$2"; }
api_put()  { curl -s -b "$CJ" -c "$CJ" -H "Content-Type: application/json" -X PUT  "${BASE}${1}" --data-raw "$2"; }
api_patch(){ curl -s -b "$CJ" -c "$CJ" -H "Content-Type: application/json" -X PATCH "${BASE}${1}" --data-raw "$2"; }

# Create project
PROJ=$(api_post "/api/projects" "{\"name\":\"Task Manager\",\"organizationId\":\"$ORG_ID\"}")
PID=$(echo "$PROJ" | jq -r '.project.id')
echo "Project: $PID"

# Create datasource + table
DS=$(api_post "/api/projects/$PID/datasources" '{"name":"internal","type":"internal"}')
DSID=$(echo "$DS" | jq -r '.datasource.id')
TBL=$(api_post "/api/projects/$PID/datasources/$DSID/tables" '{"name":"tasks"}')
TID=$(echo "$TBL" | jq -r '.table.id')

# Add columns
api_patch "/api/projects/$PID/datasources/$DSID/tables" "{
  \"tableId\": \"$TID\",
  \"columns\": [
    {\"name\": \"title\", \"type\": \"text\"},
    {\"name\": \"completed\", \"type\": \"boolean\"},
    {\"name\": \"priority\", \"type\": \"text\"},
    {\"name\": \"due_date\", \"type\": \"text\"},
    {\"name\": \"category\", \"type\": \"text\"}
  ]
}" > /dev/null
echo "Table + columns created"

# Insert sample tasks
api_post "/api/projects/$PID/datasources/$DSID/tables/$TID/rows" \
  '{"title":"Fix login bug","completed":false,"priority":"high","due_date":"2026-04-15","category":"Engineering"}' > /dev/null
api_post "/api/projects/$PID/datasources/$DSID/tables/$TID/rows" \
  '{"title":"Write API docs","completed":true,"priority":"medium","due_date":"2026-04-10","category":"Documentation"}' > /dev/null
api_post "/api/projects/$PID/datasources/$DSID/tables/$TID/rows" \
  '{"title":"Deploy v2 to production","completed":false,"priority":"high","due_date":"2026-04-20","category":"DevOps"}' > /dev/null
api_post "/api/projects/$PID/datasources/$DSID/tables/$TID/rows" \
  '{"title":"Design onboarding flow","completed":false,"priority":"medium","due_date":"2026-04-18","category":"Design"}' > /dev/null
api_post "/api/projects/$PID/datasources/$DSID/tables/$TID/rows" \
  '{"title":"Set up CI pipeline","completed":true,"priority":"low","due_date":"2026-04-08","category":"DevOps"}' > /dev/null
api_post "/api/projects/$PID/datasources/$DSID/tables/$TID/rows" \
  '{"title":"User interview #3","completed":false,"priority":"medium","due_date":"2026-04-12","category":"Research"}' > /dev/null
echo "6 tasks inserted"

# Set globals
api_put "/api/projects/$PID/globals" '{
  "globalStateDefinitions": [
    {"name": "filter", "type": "text", "initialValue": "all"},
    {"name": "newTask", "type": "text", "initialValue": ""},
    {"name": "taskCount", "type": "number", "initialValue": 6},
    {"name": "showCompleted", "type": "boolean", "initialValue": true},
    {"name": "searchQuery", "type": "text", "initialValue": ""}
  ],
  "globalTheme": {
    "primary": "#10b981",
    "background": "#f0fdf4",
    "text": "#064e3b",
    "surface": "#ffffff",
    "borderColor": "#d1fae5"
  }
}' > /dev/null
echo "Globals set"

# Screen 1: Task Dashboard
SCREEN1='{
  "root": {
    "id": "root",
    "type": "container",
    "props": {
      "display": "flex", "flexDirection": "column", "gap": 20,
      "padding": 24, "minHeight": "100vh", "backgroundColor": "#f0fdf4",
      "fontFamily": "Inter, system-ui, sans-serif"
    },
    "children": [
      {
        "id": "app-header",
        "type": "header",
        "props": {
          "display": "flex", "flexDirection": "row",
          "justifyContent": "space-between", "alignItems": "center",
          "padding": "16px 24px", "backgroundColor": "#ffffff",
          "borderRadius": 12, "boxShadow": "0 1px 3px rgba(0,0,0,0.08)"
        },
        "children": [
          {
            "id": "app-title",
            "type": "gradientText",
            "props": {
              "content": "Task Manager",
              "gradient": "linear-gradient(135deg, #10b981, #059669)",
              "fontSize": "26px", "fontWeight": "800"
            },
            "children": []
          },
          {
            "id": "header-right",
            "type": "stackH",
            "props": {"gap": 10, "alignItems": "center"},
            "children": [
              {
                "id": "task-count-badge",
                "type": "badge",
                "props": {"label": "{{state.taskCount}} tasks", "variant": "success", "size": "md"},
                "children": []
              },
              {
                "id": "user-avatar",
                "type": "avatar",
                "props": {"initials": "TM", "size": "md", "backgroundColor": "#10b981"},
                "children": []
              }
            ]
          }
        ]
      },
      {
        "id": "stats-row",
        "type": "stackH",
        "props": {"gap": 12},
        "children": [
          {
            "id": "stat-total",
            "type": "card",
            "props": {
              "padding": 16, "backgroundColor": "#ffffff", "borderRadius": 10,
              "shadow": "sm", "display": "flex", "flexDirection": "column", "gap": 4,
              "flex": 1
            },
            "children": [
              {"id": "stat-total-label", "type": "text", "props": {"content": "Total Tasks", "fontSize": "12px", "color": "#6b7280", "fontWeight": "500"}, "children": []},
              {"id": "stat-total-val", "type": "text", "props": {"content": "{{state.taskCount}}", "fontSize": "28px", "color": "#064e3b", "fontWeight": "700"}, "children": []}
            ]
          },
          {
            "id": "stat-progress",
            "type": "card",
            "props": {
              "padding": 16, "backgroundColor": "#ffffff", "borderRadius": 10,
              "shadow": "sm", "display": "flex", "flexDirection": "column", "gap": 8,
              "flex": 1
            },
            "children": [
              {"id": "progress-label", "type": "text", "props": {"content": "Completion", "fontSize": "12px", "color": "#6b7280", "fontWeight": "500"}, "children": []},
              {"id": "progress-bar", "type": "progressBar", "props": {"value": 33, "max": 100, "color": "#10b981", "height": "8px", "showLabel": true}, "children": []}
            ]
          },
          {
            "id": "stat-high",
            "type": "card",
            "props": {
              "padding": 16, "backgroundColor": "#ffffff", "borderRadius": 10,
              "shadow": "sm", "display": "flex", "flexDirection": "column", "gap": 4,
              "flex": 1
            },
            "children": [
              {"id": "stat-high-label", "type": "text", "props": {"content": "High Priority", "fontSize": "12px", "color": "#6b7280", "fontWeight": "500"}, "children": []},
              {"id": "stat-high-val", "type": "text", "props": {"content": "2", "fontSize": "28px", "color": "#ef4444", "fontWeight": "700"}, "children": []}
            ]
          }
        ]
      },
      {
        "id": "add-task-card",
        "type": "card",
        "props": {
          "padding": 16, "backgroundColor": "#ffffff", "borderRadius": 10, "shadow": "sm"
        },
        "children": [
          {
            "id": "add-task-row",
            "type": "stackH",
            "props": {"gap": 10, "alignItems": "center"},
            "children": [
              {
                "id": "new-task-input",
                "type": "textInput",
                "props": {
                  "placeholder": "What needs to be done?",
                  "value": "{{state.newTask}}",
                  "onChange": [{"action": "setState", "stateKey": "newTask", "value": "{{event.value}}"}]
                },
                "children": []
              },
              {
                "id": "add-task-btn",
                "type": "button",
                "props": {
                  "label": "+ Add Task",
                  "variant": "primary",
                  "backgroundColor": "#10b981",
                  "color": "#ffffff",
                  "padding": "10px 20px",
                  "borderRadius": 8,
                  "fontWeight": "600",
                  "onClick": [
                    {"action": "insertRow", "tableName": "tasks", "rowData": {"title": "{{state.newTask}}", "completed": false, "priority": "medium", "due_date": "", "category": "General"}, "resultStateKey": "lastInsert"},
                    {"action": "setState", "stateKey": "newTask", "value": ""},
                    {"action": "mutateState", "stateKey": "taskCount", "mutationOp": "increment", "mutationAmount": 1}
                  ]
                },
                "children": []
              }
            ]
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
        "id": "tasks-list",
        "type": "dataRepeater",
        "props": {
          "dataSource": "{{data.tasks}}",
          "itemVar": "task",
          "emptyText": "No tasks yet — add one above!",
          "display": "flex", "flexDirection": "column", "gap": 8
        },
        "children": [
          {
            "id": "task-item",
            "type": "card",
            "props": {
              "shadow": "sm", "rounded": "md",
              "display": "flex", "flexDirection": "row", "alignItems": "center",
              "gap": 14, "padding": "14px 18px", "backgroundColor": "#ffffff"
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
                "id": "task-info",
                "type": "stackV",
                "props": {"gap": 2, "flex": 1},
                "children": [
                  {"id": "task-title", "type": "text", "props": {"content": "{{task.title}}", "fontSize": "15px", "fontWeight": "500", "color": "#064e3b"}, "children": []},
                  {
                    "id": "task-meta",
                    "type": "stackH",
                    "props": {"gap": 8, "alignItems": "center"},
                    "children": [
                      {"id": "task-category", "type": "badge", "props": {"label": "{{task.category}}", "variant": "default", "size": "sm"}, "children": []},
                      {"id": "task-due", "type": "text", "props": {"content": "Due: {{task.due_date}}", "fontSize": "12px", "color": "#9ca3af"}, "children": []}
                    ]
                  }
                ]
              },
              {
                "id": "task-priority-badge",
                "type": "badge",
                "props": {"label": "{{task.priority}}", "variant": "warning", "size": "sm"},
                "children": []
              },
              {
                "id": "task-delete-btn",
                "type": "button",
                "props": {
                  "label": "×",
                  "variant": "ghost",
                  "color": "#ef4444",
                  "fontSize": "18px",
                  "padding": "4px 8px",
                  "onClick": [{"action": "deleteRow", "tableName": "tasks", "rowId": "{{task.id}}"}]
                },
                "children": []
              }
            ]
          }
        ]
      },
      {
        "id": "tasks-table-card",
        "type": "card",
        "props": {
          "padding": 0, "backgroundColor": "#ffffff", "borderRadius": 10, "shadow": "sm"
        },
        "children": [
          {
            "id": "table-header",
            "type": "text",
            "props": {"content": "Tasks Overview", "fontSize": "16px", "fontWeight": "600", "color": "#064e3b", "padding": "16px 18px 8px 18px"},
            "children": []
          },
          {
            "id": "tasks-table",
            "type": "table",
            "props": {
              "dataSource": "{{data.tasks}}",
              "columns": ["title", "priority", "category", "due_date", "completed"],
              "striped": true,
              "bordered": true,
              "searchable": true,
              "pageSize": 10,
              "sortable": true
            },
            "children": []
          }
        ]
      },
      {
        "id": "app-footer",
        "type": "footer",
        "props": {
          "display": "flex", "flexDirection": "row",
          "justifyContent": "space-between", "alignItems": "center",
          "padding": "16px 24px", "backgroundColor": "transparent"
        },
        "children": [
          {"id": "footer-text", "type": "text", "props": {"content": "Built with DCCortex", "fontSize": "12px", "color": "#9ca3af"}, "children": []},
          {
            "id": "settings-btn",
            "type": "button",
            "props": {
              "label": "⚙ Settings",
              "variant": "outline",
              "padding": "6px 14px",
              "borderRadius": 6,
              "fontSize": "13px",
              "onClick": [{"action": "navigate", "screen": "settings"}]
            },
            "children": []
          }
        ]
      }
    ]
  }
}'

api_post "/api/projects/$PID/screens" \
  "{\"name\":\"Dashboard\",\"slug\":\"dashboard\",\"route\":\"/\",\"layout\":$SCREEN1}" > /dev/null
echo "Screen 1: Dashboard created"

# Screen 2: Settings
SCREEN2='{
  "root": {
    "id": "settings-root",
    "type": "container",
    "props": {
      "display": "flex", "flexDirection": "column", "gap": 24,
      "padding": 32, "maxWidth": "640px", "margin": "0 auto",
      "minHeight": "100vh", "backgroundColor": "#f0fdf4"
    },
    "children": [
      {
        "id": "settings-top",
        "type": "stackH",
        "props": {"gap": 16, "alignItems": "center"},
        "children": [
          {"id": "settings-avatar", "type": "avatar", "props": {"initials": "TM", "size": "xl", "backgroundColor": "#10b981"}, "children": []},
          {
            "id": "settings-info",
            "type": "stackV",
            "props": {"gap": 2},
            "children": [
              {"id": "settings-title", "type": "text", "props": {"content": "Settings", "fontSize": "28px", "fontWeight": "800", "color": "#064e3b"}, "children": []},
              {"id": "settings-sub", "type": "text", "props": {"content": "Configure your task manager", "fontSize": "14px", "color": "#6b7280"}, "children": []}
            ]
          }
        ]
      },
      {"id": "s-divider", "type": "divider", "props": {"orientation": "horizontal", "color": "#d1fae5", "thickness": 1}, "children": []},
      {
        "id": "settings-card",
        "type": "card",
        "props": {"padding": 20, "backgroundColor": "#ffffff", "borderRadius": 10, "shadow": "sm"},
        "children": [
          {
            "id": "show-completed-row",
            "type": "stackH",
            "props": {"gap": 12, "alignItems": "center", "justifyContent": "space-between"},
            "children": [
              {
                "id": "show-completed-info",
                "type": "stackV",
                "props": {"gap": 2},
                "children": [
                  {"id": "sc-label", "type": "text", "props": {"content": "Show completed tasks", "fontSize": "15px", "fontWeight": "500", "color": "#064e3b"}, "children": []},
                  {"id": "sc-desc", "type": "text", "props": {"content": "Display tasks that have been marked as done", "fontSize": "12px", "color": "#9ca3af"}, "children": []}
                ]
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
          {"id": "setting-div-1", "type": "divider", "props": {"orientation": "horizontal", "color": "#f3f4f6", "thickness": 1, "margin": "16px 0"}, "children": []},
          {
            "id": "about-section",
            "type": "stackV",
            "props": {"gap": 8},
            "children": [
              {"id": "about-label", "type": "text", "props": {"content": "About", "fontSize": "15px", "fontWeight": "500", "color": "#064e3b"}, "children": []},
              {
                "id": "about-alert",
                "type": "alertBanner",
                "props": {"message": "Task Manager v1.0 — Built with DCCortex visual app builder. This is a fully functional app with real data persistence, state management, and interactive components.", "variant": "info"},
                "children": []
              }
            ]
          }
        ]
      },
      {
        "id": "back-btn",
        "type": "button",
        "props": {
          "label": "← Back to Dashboard",
          "variant": "outline",
          "padding": "10px 20px",
          "borderRadius": 8,
          "fontWeight": "500",
          "onClick": [{"action": "navigate", "screen": "dashboard"}]
        },
        "children": []
      }
    ]
  }
}'

api_post "/api/projects/$PID/screens" \
  "{\"name\":\"Settings\",\"slug\":\"settings\",\"route\":\"/settings\",\"layout\":$SCREEN2}" > /dev/null
echo "Screen 2: Settings created"

# Publish
api_put "/api/projects/$PID" '{"isPublished":true}' > /dev/null
echo ""
echo "============================================"
echo "  Task Manager app created and published!"
echo "============================================"
echo ""
echo "  View app:  $BASE/p/$PID"
echo ""
echo "  Features:"
echo "    - 6 sample tasks with priorities & categories"
echo "    - Click checkbox to mark complete"
echo "    - Click × to delete a task"
echo "    - Add new tasks via input + button"
echo "    - Sortable/searchable table view"
echo "    - Settings screen with toggle"
echo "    - Navigation between screens"
echo ""
