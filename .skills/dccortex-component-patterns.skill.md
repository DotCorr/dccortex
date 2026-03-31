# Skill: DCCortex Component Patterns & Recipes

## Description
Ready-to-use UI patterns and component recipes for building DCCortex apps. Each pattern is a complete, copy-pasteable JSON snippet that can be dropped into a screen's component tree.

## When to Use
- User asks for a specific UI pattern (sidebar, form, card list, stats dashboard, etc.)
- Building a new screen and need reusable building blocks
- Assembling complex layouts from proven patterns

---

## Pattern: Stat Cards Row

Three KPI stat cards in a horizontal row with glassmorphism styling.

```json
{
  "id": "stats-row",
  "type": "container",
  "props": { "flexDirection": "row", "alignItems": "center", "gap": 10, "padding": 0, "minHeight": 0 },
  "children": [
    {
      "id": "stat-1",
      "type": "container",
      "props": { "flexDirection": "column", "gap": 3, "padding": 14, "minHeight": 0, "flex": "1", "background": "rgba(255,255,255,0.13)", "borderRadius": "14px", "boxShadow": "0 0 0 1px rgba(255,255,255,0.2)", "backdropFilter": "blur(8px)" },
      "children": [
        { "id": "stat-1-val", "type": "text", "props": { "content": "{{script.totalCount}}", "fontSize": "30px", "color": "#fff", "fontWeight": "800" }, "children": [] },
        { "id": "stat-1-lbl", "type": "text", "props": { "content": "Total", "fontSize": "11px", "color": "rgba(255,255,255,0.6)", "fontWeight": "500" }, "children": [] }
      ]
    },
    {
      "id": "stat-2",
      "type": "container",
      "props": { "flexDirection": "column", "gap": 3, "padding": 14, "minHeight": 0, "flex": "1", "background": "rgba(255,255,255,0.13)", "borderRadius": "14px", "boxShadow": "0 0 0 1px rgba(255,255,255,0.2)", "backdropFilter": "blur(8px)" },
      "children": [
        { "id": "stat-2-val", "type": "text", "props": { "content": "{{script.activeCount}}", "fontSize": "30px", "color": "#fff", "fontWeight": "800" }, "children": [] },
        { "id": "stat-2-lbl", "type": "text", "props": { "content": "Active", "fontSize": "11px", "color": "rgba(255,255,255,0.6)", "fontWeight": "500" }, "children": [] }
      ]
    },
    {
      "id": "stat-3",
      "type": "container",
      "props": { "flexDirection": "column", "gap": 3, "padding": 14, "minHeight": 0, "flex": "1", "background": "rgba(255,255,255,0.13)", "borderRadius": "14px", "boxShadow": "0 0 0 1px rgba(255,255,255,0.2)", "backdropFilter": "blur(8px)" },
      "children": [
        { "id": "stat-3-val", "type": "text", "props": { "content": "{{script.doneCount}}", "fontSize": "30px", "color": "#fff", "fontWeight": "800" }, "children": [] },
        { "id": "stat-3-lbl", "type": "text", "props": { "content": "Done", "fontSize": "11px", "color": "rgba(255,255,255,0.6)", "fontWeight": "500" }, "children": [] }
      ]
    }
  ]
}
```

---

## Pattern: Hero Header with Gradient

```json
{
  "id": "hero",
  "type": "container",
  "props": {
    "flexDirection": "column", "gap": 20, "padding": 24, "minHeight": 0,
    "background": "linear-gradient(140deg,#312e81 0%,#4f46e5 40%,#7c3aed 70%,#a855f7 100%)"
  },
  "children": [
    {
      "id": "hero-row",
      "type": "container",
      "props": { "flexDirection": "row", "alignItems": "center", "gap": 12, "padding": 0, "minHeight": 0 },
      "children": [
        {
          "id": "hero-icon-wrap",
          "type": "container",
          "props": { "flexDirection": "row", "alignItems": "center", "justifyContent": "center", "gap": 0, "padding": 0, "minHeight": 0, "width": "42px", "height": "42px", "background": "rgba(255,255,255,0.18)", "borderRadius": "12px" },
          "children": [
            { "id": "hero-icon", "type": "icon", "props": { "icon": "mdi:rocket-launch", "size": 22, "color": "#ffffff" }, "children": [] }
          ]
        },
        {
          "id": "hero-text-col",
          "type": "container",
          "props": { "flexDirection": "column", "gap": 2, "padding": 0, "minHeight": 0, "flex": "1" },
          "children": [
            { "id": "hero-title", "type": "text", "props": { "content": "App Title", "fontSize": "22px", "color": "#ffffff", "fontWeight": "800", "letterSpacing": "-0.5px" }, "children": [] },
            { "id": "hero-sub", "type": "text", "props": { "content": "Subtitle text", "fontSize": "11px", "color": "rgba(255,255,255,0.55)" }, "children": [] }
          ]
        },
        { "id": "hero-badge", "type": "badge", "props": { "label": "● Live", "variant": "success", "size": "sm" }, "children": [] }
      ]
    }
  ]
}
```

---

## Pattern: Sidebar Navigation (Desktop Layout)

```json
{
  "id": "sidebar",
  "type": "aside",
  "props": {
    "width": "240px", "height": "100%", "flexDirection": "column",
    "padding": 0, "gap": 0, "margin": 0, "minHeight": 0,
    "backgroundColor": "#0f172a", "overflow": "hidden", "collapsible": true
  },
  "children": [
    {
      "id": "sb-logo",
      "type": "container",
      "props": { "flexDirection": "row", "alignItems": "center", "gap": 12, "padding": 20, "margin": 0, "minHeight": 0, "borderBottom": "1px solid #1e293b" },
      "children": [
        { "id": "sb-logo-icon", "type": "icon", "props": { "icon": "mdi:chart-arc-outline", "size": 28, "color": "#6366f1" }, "children": [] },
        { "id": "sb-logo-text", "type": "text", "props": { "content": "AppName", "color": "#f1f5f9", "fontWeight": "700", "fontSize": "18px" }, "children": [] }
      ]
    },
    {
      "id": "sb-nav",
      "type": "container",
      "props": { "flexDirection": "column", "gap": 4, "padding": "16px 12px", "minHeight": 0 },
      "children": [
        {
          "id": "sb-nav-1-active",
          "type": "container",
          "props": {
            "flexDirection": "row", "alignItems": "center", "gap": 10, "padding": "10px 12px", "minHeight": 0,
            "background": "rgba(99,102,241,0.15)", "borderRadius": "8px", "cursor": "pointer",
            "visibleWhen": "{{state.tab}} == overview",
            "onClick": { "steps": [{ "action": "setState", "stateKey": "tab", "value": "overview" }] }
          },
          "children": [
            { "id": "sb-n1a-icon", "type": "icon", "props": { "icon": "mdi:view-dashboard", "size": 18, "color": "#818cf8" }, "children": [] },
            { "id": "sb-n1a-text", "type": "text", "props": { "content": "Overview", "color": "#c7d2fe", "fontSize": "14px", "fontWeight": "600" }, "children": [] }
          ]
        },
        {
          "id": "sb-nav-1-inactive",
          "type": "container",
          "props": {
            "flexDirection": "row", "alignItems": "center", "gap": 10, "padding": "10px 12px", "minHeight": 0,
            "borderRadius": "8px", "cursor": "pointer", "opacity": "0.6",
            "visibleWhen": "{{state.tab}} != overview",
            "onClick": { "steps": [{ "action": "setState", "stateKey": "tab", "value": "overview" }] }
          },
          "children": [
            { "id": "sb-n1i-icon", "type": "icon", "props": { "icon": "mdi:view-dashboard", "size": 18, "color": "#94a3b8" }, "children": [] },
            { "id": "sb-n1i-text", "type": "text", "props": { "content": "Overview", "color": "#94a3b8", "fontSize": "14px" }, "children": [] }
          ]
        }
      ]
    }
  ]
}
```

---

## Pattern: Form with Input Fields

```json
{
  "id": "form-section",
  "type": "container",
  "props": { "flexDirection": "column", "gap": 14, "padding": "16px 20px", "minHeight": 0, "width": "100%" },
  "children": [
    {
      "id": "field-name",
      "type": "container",
      "props": { "flexDirection": "column", "gap": 6, "padding": 0, "minHeight": 0, "width": "100%" },
      "children": [
        { "id": "field-name-label", "type": "text", "props": { "content": "NAME", "fontSize": "12px", "fontWeight": "700", "color": "var(--text)", "opacity": "0.6", "textTransform": "uppercase", "letterSpacing": "0.05em" }, "children": [] },
        { "id": "field-name-input", "type": "textInput", "props": { "value": "{{state.name}}", "placeholder": "Enter your name", "width": "100%", "onChange": { "steps": [{ "action": "setState", "stateKey": "name", "value": "{{event.value}}" }] } }, "children": [] }
      ]
    },
    {
      "id": "field-email",
      "type": "container",
      "props": { "flexDirection": "column", "gap": 6, "padding": 0, "minHeight": 0, "width": "100%" },
      "children": [
        { "id": "field-email-label", "type": "text", "props": { "content": "EMAIL", "fontSize": "12px", "fontWeight": "700", "color": "var(--text)", "opacity": "0.6", "textTransform": "uppercase", "letterSpacing": "0.05em" }, "children": [] },
        { "id": "field-email-input", "type": "textInput", "props": { "value": "{{state.email}}", "placeholder": "you@example.com", "width": "100%", "onChange": { "steps": [{ "action": "setState", "stateKey": "email", "value": "{{event.value}}" }] } }, "children": [] }
      ]
    },
    {
      "id": "form-submit",
      "type": "button",
      "props": {
        "label": "Submit",
        "variant": "primary",
        "borderRadius": "12px", "fontSize": "16px", "fontWeight": "700", "padding": "14px 20px",
        "boxShadow": "0 4px 16px rgba(99,102,241,0.4)", "width": "100%",
        "onClick": {
          "steps": [
            { "action": "haptic", "hapticPreset": "medium" },
            { "action": "custom", "customScript": "var base=state.apiBase;\nfetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:state.name,email:state.email})}).then(function(){window.dispatchEvent(new CustomEvent('cortex:refresh'))})" },
            { "action": "setState", "stateKey": "name", "value": "" },
            { "action": "setState", "stateKey": "email", "value": "" }
          ]
        }
      },
      "children": []
    }
  ]
}
```

---

## Pattern: Filter Pills Row

```json
{
  "id": "filter-row",
  "type": "container",
  "props": { "flexDirection": "row", "alignItems": "center", "gap": 8, "padding": 12, "minHeight": 0, "background": "var(--surface)", "borderBottom": "1px solid var(--border-color)", "flexWrap": "wrap" },
  "children": [
    { "id": "filter-label", "type": "text", "props": { "content": "Filter:", "fontSize": "11px", "fontWeight": "700", "color": "var(--text)", "opacity": "0.45" }, "children": [] },
    {
      "id": "f-all-on",
      "type": "container",
      "props": { "padding": 9, "background": "#6366f1", "borderRadius": "20px", "cursor": "pointer", "boxShadow": "0 2px 8px rgba(99,102,241,0.4)", "visibleWhen": "{{state.filter}} == all", "onClick": { "steps": [{ "action": "setState", "stateKey": "filter", "value": "all" }] }, "flexDirection": "row", "gap": 0, "minHeight": 0 },
      "children": [{ "id": "f-all-on-t", "type": "text", "props": { "content": "All", "fontSize": "12px", "color": "#fff", "fontWeight": "700" }, "children": [] }]
    },
    {
      "id": "f-all-off",
      "type": "container",
      "props": { "padding": 9, "background": "var(--surface)", "borderRadius": "20px", "cursor": "pointer", "border": "1px solid var(--border-color)", "opacity": "0.65", "visibleWhen": "{{state.filter}} != all", "onClick": { "steps": [{ "action": "setState", "stateKey": "filter", "value": "all" }] }, "flexDirection": "row", "gap": 0, "minHeight": 0 },
      "children": [{ "id": "f-all-off-t", "type": "text", "props": { "content": "All", "fontSize": "12px", "color": "var(--text)" }, "children": [] }]
    }
  ]
}
```

---

## Pattern: Empty State

```json
{
  "id": "empty-state",
  "type": "container",
  "props": { "flexDirection": "column", "alignItems": "center", "justifyContent": "center", "gap": 16, "padding": 40, "minHeight": 200, "opacity": "0.6" },
  "children": [
    { "id": "empty-icon", "type": "icon", "props": { "icon": "mdi:inbox-outline", "size": 48, "color": "var(--text)" }, "children": [] },
    { "id": "empty-title", "type": "text", "props": { "content": "No items yet", "fontSize": "18px", "fontWeight": "600", "color": "var(--text)" }, "children": [] },
    { "id": "empty-desc", "type": "text", "props": { "content": "Create your first item to get started", "fontSize": "14px", "color": "var(--text)", "opacity": "0.6" }, "children": [] }
  ]
}
```

---

## Pattern: List Item Row (for dataRepeater)

```json
{
  "id": "list-item",
  "type": "container",
  "props": {
    "flexDirection": "row", "alignItems": "center", "gap": 12, "padding": 14, "minHeight": 0,
    "background": "var(--surface)", "borderRadius": "12px", "marginBottom": "8px",
    "borderLeft": "4px solid #6366f1", "boxShadow": "0 1px 6px rgba(0,0,0,0.07)"
  },
  "children": [
    { "id": "li-avatar", "type": "avatar", "props": { "initials": "{{prop.item.initials}}", "size": 36, "shape": "circle" }, "children": [] },
    {
      "id": "li-content",
      "type": "container",
      "props": { "flexDirection": "column", "gap": 2, "padding": 0, "minHeight": 0, "flex": "1" },
      "children": [
        { "id": "li-title", "type": "text", "props": { "content": "{{prop.item.name}}", "fontSize": "15px", "fontWeight": "500", "color": "var(--text)" }, "children": [] },
        { "id": "li-subtitle", "type": "text", "props": { "content": "{{prop.item.description}}", "fontSize": "12px", "color": "var(--text)", "opacity": "0.5" }, "children": [] }
      ]
    },
    { "id": "li-badge", "type": "badge", "props": { "label": "{{prop.item.status}}", "variant": "info", "size": "xs" }, "children": [] },
    { "id": "li-delete", "type": "button", "props": { "label": "✕", "variant": "ghost", "opacity": "0.4", "fontSize": "13px", "onClick": { "steps": [{ "action": "haptic", "hapticPreset": "heavy" }, { "action": "custom", "customScript": "fetch(state.apiBase+'/'+('{{prop.item.id}}'),{method:'DELETE'}).then(function(){window.dispatchEvent(new CustomEvent('cortex:refresh'))})" }] } }, "children": [] }
  ]
}
```

---

## Pattern: Progress Section

```json
{
  "id": "progress-section",
  "type": "container",
  "props": { "flexDirection": "column", "gap": 6, "padding": 0, "minHeight": 0 },
  "children": [
    {
      "id": "progress-labels",
      "type": "container",
      "props": { "flexDirection": "row", "justifyContent": "space-between", "padding": 0, "minHeight": 0, "gap": 0 },
      "children": [
        { "id": "progress-lbl", "type": "text", "props": { "content": "Progress", "fontSize": "12px", "color": "rgba(255,255,255,0.7)" }, "children": [] },
        { "id": "progress-pct", "type": "text", "props": { "content": "{{script.progressPct}}%", "fontSize": "12px", "color": "#fff", "fontWeight": "700" }, "children": [] }
      ]
    },
    {
      "id": "progress-track",
      "type": "container",
      "props": { "flexDirection": "row", "gap": 0, "padding": 0, "minHeight": 0, "width": "100%", "height": "8px", "background": "rgba(255,255,255,0.2)", "borderRadius": "4px", "overflow": "hidden" },
      "children": [
        { "id": "progress-fill", "type": "container", "props": { "flexDirection": "column", "gap": 0, "padding": 0, "minHeight": 0, "width": "{{script.progressPct}}%", "height": "8px", "background": "rgba(255,255,255,0.88)", "borderRadius": "4px", "transition": "width 0.5s ease" }, "children": [] }
      ]
    }
  ]
}
```

---

## Pattern: Settings / About Page

```json
{
  "id": "settings-info",
  "type": "container",
  "props": { "flexDirection": "column", "gap": 8, "padding": 16, "minHeight": 0 },
  "children": [
    { "id": "info-title", "type": "text", "props": { "content": "About", "fontSize": "14px", "fontWeight": "700", "color": "var(--text)" }, "children": [] },
    { "id": "info-divider", "type": "divider", "props": { "orientation": "horizontal", "thickness": 1, "color": "var(--border-color)" }, "children": [] },
    {
      "id": "info-row-1",
      "type": "container",
      "props": { "flexDirection": "row", "justifyContent": "space-between", "padding": "8px 0", "minHeight": 0, "gap": 0 },
      "children": [
        { "id": "info-r1-lbl", "type": "text", "props": { "content": "Platform", "fontSize": "13px", "color": "var(--text)", "opacity": "0.6" }, "children": [] },
        { "id": "info-r1-val", "type": "text", "props": { "content": "DCCortex", "fontSize": "13px", "fontWeight": "600", "color": "var(--text)" }, "children": [] }
      ]
    },
    {
      "id": "info-row-2",
      "type": "container",
      "props": { "flexDirection": "row", "justifyContent": "space-between", "padding": "8px 0", "minHeight": 0, "gap": 0 },
      "children": [
        { "id": "info-r2-lbl", "type": "text", "props": { "content": "Version", "fontSize": "13px", "color": "var(--text)", "opacity": "0.6" }, "children": [] },
        { "id": "info-r2-val", "type": "badge", "props": { "label": "v1.0", "variant": "info", "size": "xs" }, "children": [] }
      ]
    }
  ]
}
```

---

## Theme Presets

### Dark (Default)
```json
{ "primary": "#6366f1", "background": "#0f0f13", "surface": "#1a1a24", "text": "#e2e8f0", "borderColor": "#2d2d3f" }
```

### Light
```json
{ "primary": "#6366f1", "background": "#f8fafc", "surface": "#ffffff", "text": "#0f172a", "borderColor": "#e2e8f0" }
```

### Warm Dark
```json
{ "primary": "#f59e0b", "background": "#1c1917", "surface": "#292524", "text": "#fef3c7", "borderColor": "#44403c" }
```

### Ocean
```json
{ "primary": "#06b6d4", "background": "#0c1222", "surface": "#1a2332", "text": "#e0f2fe", "borderColor": "#1e3a5f" }
```

### Rose
```json
{ "primary": "#f43f5e", "background": "#1a0a10", "surface": "#2a1520", "text": "#fce7f3", "borderColor": "#4a1d2f" }
```
