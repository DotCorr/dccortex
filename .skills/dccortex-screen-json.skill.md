# Skill: Generate DCCortex Screen JSON

## Description
Generate valid DCCortex screen JSON files that can be imported via **Projects → Screens → Import JSON**. DCCortex is a no-code app builder with a rich component system, state management, data binding, named scripts, event actions, and theming.

## ⚠️ IMPORTANT: This format is for FILE IMPORT only
The `exportVersion` / `screens` envelope below is ONLY for generating importable JSON files.
When responding in the **Cortex chat**, you MUST use the action format instead:
```json
{ "message": "...", "actions": [{ "type": "create_screen", "params": { "projectId": "...", "name": "...", "slug": "...", "layout": { ... } } }] }
```
NEVER output `{ "exportVersion": 1, "screens": [...] }` in a chat response.

## When to Use
- User asks to build an app, screen, page, or UI using DCCortex
- User wants a ready-to-import JSON for their DCCortex project
- User describes an app idea and wants it generated as DCCortex JSON

---

## JSON Envelope

Every DCCortex export uses this top-level structure:

```json
{
  "exportVersion": 1,
  "_note": "Optional human-readable note about what this screen does or requires.",
  "screens": [
    {
      "name": "Screen Title",
      "slug": "screen-slug",
      "layout": {
        "stateDefinitions": [],
        "dataSources": [],
        "namedScripts": {},
        "root": { /* component tree */ }
      },
      "script": ""
    }
  ],
  "globals": {
    "colorMode": "adaptive",
    "theme": {
      "primary": "#6366f1",
      "background": "#0f0f13",
      "surface": "#1a1a24",
      "text": "#e2e8f0",
      "borderColor": "#2d2d3f"
    }
  }
}
```

### Rules:
- `exportVersion` is always `1`
- `screens` is an array (can contain multiple screens)
- Each screen has `name`, `slug`, `layout`, and optional `script`
- `globals.colorMode` can be `"adaptive"`, `"light"`, or `"dark"`
- `globals.theme` defines CSS variable colors used via `var(--background)`, `var(--surface)`, `var(--text)`, `var(--border-color)`, `var(--primary)`

---

## Component Node Structure

Every node in the tree follows this shape:

```json
{
  "id": "unique-id",
  "type": "componentType",
  "props": { /* component-specific props + style props */ },
  "children": [ /* child nodes (if component allows children) */ ]
}
```

### ID Rules:
- `id` must be unique within the screen
- Use short prefixes like `"n-1"`, `"n-2a"`, `"sb-logo"`, `"hdr-title"`, etc.
- The root node's id must be `"root"` and type must be `"container"`

---

## Complete Component Reference

### Layout Components (allow children)

| Type | Description | Key Props |
|------|-------------|-----------|
| `container` | Flex container (most common) | `flexDirection`, `gap`, `padding`, `minHeight`, `alignItems`, `justifyContent`, `flexWrap` |
| `section` | Semantic section with optional title | `title` + all container props |
| `stackV` | Vertical stack (shortcut for column container) | Same as container, defaults `flexDirection: "column"` |
| `stackH` | Horizontal stack (shortcut for row container) | Same as container, defaults `flexDirection: "row"` |
| `header` | Semantic header | Defaults: `flexDirection: "row"`, `alignItems: "center"`, `justifyContent: "space-between"` |
| `main` | Semantic main content area | Container props, `minHeight: 120` |
| `footer` | Semantic footer | Like header |
| `nav` | Semantic nav | Row layout by default |
| `aside` | Sidebar (supports hamburger collapse) | `collapsible`, `hamburgerBreakpoint` ("always"\|"sm"\|"md"\|"lg"\|"xl"\|"never"), `hamburgerTop`, `hamburgerLeft`, `hamburgerBg`, `hamburgerColor`, `hamburgerBorder`, `hamburgerRadius`, `hamburgerIcon`, `hamburgerIconSize` |
| `article` | Semantic article | `minHeight: 120` |
| `card` | Styled card wrapper | `shadow` ("none"\|"sm"\|"md"\|"lg"\|"xl"), `rounded` ("none"\|"sm"\|"md"\|"lg"\|"full"), `bordered` |
| `formWrapper` | Form with submit | `submitLabel`, `method` ("none"\|"post"\|"api") |
| `gestureDetector` | Touch/click feedback wrapper | `behavior` ("opacity"\|"scale"\|"none"), `activeOpacity`, `activeScale` |
| `tooltip` | Tooltip wrapper | `content`, `position` ("top"\|"bottom"\|"left"\|"right"), `delay` |
| `modal` | Dialog/modal | `title`, `open`, `size` ("sm"\|"md"\|"lg"\|"xl"\|"full"), `showOverlay`, `showCloseButton` |
| `tabs` | Tabbed container | `tabs` (comma-separated labels), `activeTab`, `variant` ("line"\|"pills"\|"boxed") |

### Display Components (no children)

| Type | Description | Key Props |
|------|-------------|-----------|
| `text` | Text/heading/paragraph | `content`, `variant` ("body"\|"h1"\|"h2"\|"h3"\|"caption"\|"small") |
| `image` | Image | `url`, `alt`, `width`, `height`, `objectFit` ("fill"\|"contain"\|"cover"\|"none"\|"scale-down"), `objectPosition` (default: `"center"`) |
| `icon` | Iconify icon | `icon` (e.g. `"mdi:home"`, `"lucide:star"`), `size`, `color` |
| `badge` | Badge/tag | `label`, `variant` ("default"\|"success"\|"warning"\|"error"\|"info"\|"outline"), `size` ("xs"\|"sm"\|"md") |
| `avatar` | Avatar circle/square | `src`, `alt`, `initials`, `size`, `shape` ("circle"\|"square"), `showStatus`, `status` ("online"\|"offline"\|"away"\|"busy") |
| `progressBar` | Progress bar | `value`, `max`, `label`, `showPercent`, `color`, `height`, `animated` |
| `spinner` | Loading spinner | `size`, `color`, `label` |
| `divider` | Horizontal/vertical line | `orientation` ("horizontal"\|"vertical"), `thickness`, `color`, `width`, `margin` |
| `spacer` | Empty space | `width`, `height` |
| `table` | Data table | `columns` (comma-separated), `rows` (bindable JSON or CSV), `showExport`, `showSearch`, `sortable`, `paginate`, `pageSize`, `striped`, `compact` |
| `richText` | Markdown renderer | `content` (markdown string) |
| `video` | Video player | `src`, `poster`, `controls`, `autoplay`, `loop`, `muted`, `width`, `height` |
| `embed` | iFrame embed | `src`, `title`, `width`, `height`, `allow` |
| `accordion` | Collapsible sections | `items` ("Title1\|Content1,Title2\|Content2"), `multiple`, `defaultOpen` |
| `dataRepeater` | Loops over data array | `dataSource` (bindable JSON array), `itemVar` (default `"item"`), `emptyText`, `gap`, `padding` — **allows children** |

### Form Components

| Type | Description | Key Props |
|------|-------------|-----------|
| `textInput` | Text input | `label`, `placeholder`, `value` |
| `numberInput` | Number input | `label`, `placeholder`, `value` |
| `textarea` | Multi-line text | `label`, `placeholder`, `value`, `rows` |
| `dropdown` | Select/dropdown | `label`, `options` (comma-separated), `value` |
| `checkbox` | Checkbox | `label`, `checked` |
| `toggle` | Toggle/switch | `label`, `checked`, `labelPosition` ("left"\|"right") |
| `radioGroup` | Radio buttons | `label`, `options` (comma-separated), `value`, `layout` ("vertical"\|"horizontal") |
| `slider` | Range slider | `label`, `min`, `max`, `step`, `value`, `showValue` |
| `datepicker` | Date/time picker | `label`, `value`, `type` ("date"\|"datetime-local"\|"time"\|"month") |
| `fileUpload` | File upload | `label`, `accept`, `multiple`, `dragDrop` |
| `searchInput` | Search with suggestions | `label`, `placeholder`, `value`, `suggestions` — **events**: `onChange`, `onFocus`, `onBlur`, `onInput`, `onSubmit` |

### Action Components

| Type | Description | Key Props |
|------|-------------|-----------|
| `button` | Button | `label`, `variant` ("primary"\|"secondary"\|"outline"\|"ghost") |
| `link` | Hyperlink | `label`, `url` |

### Chart Components

| Type | Description | Key Props |
|------|-------------|-----------|
| `lineChart` | Line chart | `data` (comma-separated values), `width`, `height`, `color`, `showDots` |
| `barChart` | Vertical bar chart | `data`, `width`, `height`, `color` |
| `pieChart` | Pie chart | `data`, `width`, `height` |
| `areaChart` | Area chart | `data`, `width`, `height`, `color` |
| `doughnutChart` | Doughnut chart | `data`, `width`, `height`, `innerRadiusPercent` |
| `horizontalBarChart` | Horizontal bars | `data`, `width`, `height`, `color` |
| `stackedBarChart` | Stacked bars | `dataA`, `dataB`, `dataC`, `width`, `height` |
| `scatterChart` | Scatter plot | `data` ("x,y\|x,y\|..."), `width`, `height`, `color` |
| `radarChart` | Radar/spider chart | `data`, `width`, `height` |
| `gaugeChart` | Gauge/KPI | `value`, `min`, `max`, `width`, `height`, `color` |
| `funnelChart` | Funnel | `data`, `width`, `height` |
| `stepLineChart` | Step line | `data`, `width`, `height`, `color` |
| `heatmapChart` | Heatmap | `data` ("row1\|row2\|..."), `width`, `height` |
| `bubbleChart` | Bubble chart | `data` ("x,y,size\|..."), `width`, `height` |

### Special Components

| Type | Description | Key Props |
|------|-------------|-----------|
| `reusableInstance` | Instance of a reusable component | `reusableId`, `reusableProps` |

---

## Style Props (Available on ALL Components)

Every component can accept these CSS-style props directly in `props`:

### Typography
`color`, `fontSize`, `fontWeight`, `fontFamily`, `fontStyle`, `lineHeight`, `letterSpacing`, `textAlign`, `textDecoration`, `textTransform`, `textOverflow`, `textShadow`, `textIndent`, `whiteSpace`, `wordBreak`, `verticalAlign`, `lineClamp`

### Background
`backgroundColor`, `background`, `backgroundImage`, `backgroundSize`, `backgroundPosition`, `backgroundRepeat`, `backgroundBlendMode`, `opacity`

### Border
`border`, `borderTop`, `borderRight`, `borderBottom`, `borderLeft`, `borderWidth`, `borderStyle`, `borderColor`, `borderRadius`, `borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomRightRadius`, `borderBottomLeftRadius`

### Shadow & Outline
`boxShadow`, `outline`, `outlineOffset`

### Animation & FX
`animation`, `animationDuration`, `animationTimingFunction`, `animationDelay`, `animationIterationCount`, `animationDirection`, `animationFillMode`, `transition`, `transform`, `willChange`

### Filters & Blend
`filter`, `backdropFilter`, `mixBlendMode`

### Position
`position`, `top`, `right`, `bottom`, `left`, `zIndex`

### Layout (on containers)
`display`, `flexDirection`, `flexWrap`, `alignItems`, `justifyContent`, `gap`, `padding`, `margin`, `width`, `height`, `minHeight`, `minWidth`, `maxWidth`, `maxHeight`, `flex`, `alignSelf`

### Other
`cursor`, `pointerEvents`, `userSelect`, `aspectRatio`, `overflow`, `overflowX`, `overflowY`, `objectFit`, `objectPosition`

---

## State Management

Define screen-local state variables in `stateDefinitions`:

```json
{
  "stateDefinitions": [
    {
      "id": "sd1",
      "name": "searchQuery",
      "type": "string",
      "defaultValue": ""
    },
    {
      "id": "sd2",
      "name": "activeTab",
      "type": "string",
      "defaultValue": "home"
    },
    {
      "id": "sd3",
      "name": "count",
      "type": "number",
      "defaultValue": "0"
    },
    {
      "id": "sd4",
      "name": "savedToken",
      "type": "string",
      "defaultValue": "",
      "cacheValue": true
    },
    {
      "id": "sd5",
      "name": "darkMode",
      "type": "boolean",
      "defaultValue": "false"
    }
  ]
}
```

### Rules:
- `type` can be `"string"`, `"number"`, or `"boolean"` — the runtime coerces values accordingly
- `defaultValue` should always be a string (use `"0"`, `"false"`, `"[]"`, not numbers/booleans)
- When `type` is `"number"`, setState values are coerced to a number (NaN → 0)
- When `type` is `"boolean"`, values `"true"`, `"1"`, `"yes"` → true, everything else → false
- `cacheValue: true` persists to localStorage across page reloads
- Access via `{{state.variableName}}` in any prop value

---

## Data Binding & Template Expressions

Use `{{...}}` syntax in any string prop value:

| Pattern | Description |
|---------|-------------|
| `{{state.variableName}}` | Read a state variable |
| `{{data.tableName}}` | Read all rows from a data table (array) |
| `{{data.tableName.0.fieldName}}` | Read specific field from first row |
| `{{script.scriptName}}` | Read computed value from a named script |
| `{{prop.item.fieldName}}` | Inside a dataRepeater, read the current item's field |
| `{{prop.item.id}}` | The row ID in a repeater |
| `{{event.value}}` | The value from an onChange event (inputs) |
| `{{event.checked}}` | The checked state from a checkbox/toggle |

### Examples:
```json
{ "content": "Hello, {{state.userName}}!" }
{ "content": "{{script.totalCount}} items" }
{ "visibleWhen": "{{state.isLoggedIn}} == true" }
{ "value": "{{state.searchQuery}}" }
{ "dataSource": "{{script.filteredItems}}" }
{ "background": "{{state.isDark}} == true ? '#000' : '#fff'" }
```

---

## Named Scripts

Computed expressions evaluated at render time. They can access `state`, `data`, and other scripts:

```json
{
  "namedScripts": {
    "totalItems": "(data.todos||[]).length",
    "completedCount": "(data.todos||[]).filter(function(t){return t.done===true||t.done==='true'}).length",
    "progressPct": "(data.todos||[]).length>0?Math.round((data.todos||[]).filter(function(t){return t.done===true}).length/(data.todos||[]).length*100):0",
    "filteredList": "(function(){ var items=data.products||[]; var q=state.search||''; if(!q) return JSON.stringify(items); return JSON.stringify(items.filter(function(i){return i.name.toLowerCase().indexOf(q.toLowerCase())>=0})) })()",
    "greeting": "state.name ? 'Hello, '+state.name+'!' : 'Welcome!'"
  }
}
```

### Rules:
- Use ES5 syntax (no arrow functions, no `let`/`const`, no template literals)
- Scripts that return arrays MUST return `JSON.stringify(array)` (the renderer parses it back)
- Access via `{{script.scriptName}}`
- Can reference `state.varName`, `data.tableName`, and other scripts

---

## Conditional Visibility

Any component can have `visibleWhen` in its props:

```json
{ "visibleWhen": "{{state.isLoggedIn}} == true" }
{ "visibleWhen": "{{state.tab}} == settings" }
{ "visibleWhen": "{{state.count}} > 0" }
{ "visibleWhen": "{{state.role}} != admin" }
```

Supported operators: `==`, `!=`, `>`, `<`, `>=`, `<=`, `contains`, `is empty`

---

## Event Actions

Events are defined as `onClick`, `onChange`, `onSubmit`, etc. on component props. They use a `steps` array:

```json
{
  "onClick": {
    "steps": [
      {
        "action": "setState",
        "stateKey": "activeTab",
        "value": "settings"
      }
    ]
  }
}
```

### Available Actions:

| Action | Description | Required Props |
|--------|-------------|---------------|
| `setState` | Set a state variable | `stateKey`, `value`, optional `cacheValue: true` |
| `navigate` | Navigate to another screen | `targetScreenId` and/or `url`, optional `targetScreenType` ("page"\|"modal"\|"sidebar") |
| `runScript` | Execute a named script | `scriptName` |
| `alert` | Show an alert dialog | `message` |
| `log` | Console log | `message` |
| `haptic` | Trigger haptic feedback (mobile/Tauri) | `hapticPreset` ("success"\|"error"\|"warning"\|"light"\|"medium"\|"heavy"\|"selection") |
| `speak` | Text-to-speech | `speakText`, optional `speakRate`, `speakPitch` |
| `playAudio` | Play audio file | `audioUrl` or `audioAssetId` |
| `custom` | Run arbitrary JavaScript | `customScript` |
| `insertRow` | Insert a row into an internal DB table | `tableName`, `rowData` (JSON string or binding), optional `resultStateKey`, `refreshStateKey` |
| `updateRow` | Update an existing row | `tableName`, `rowId` (binding), `rowData` (JSON string), optional `resultStateKey`, `refreshStateKey` |
| `deleteRow` | Delete a row by ID | `tableName`, `rowId` (binding), optional `resultStateKey`, `refreshStateKey` |

### Conditional Actions:
```json
{
  "action": "setState",
  "stateKey": "count",
  "value": "1",
  "condition": { "left": "{{state.isReady}}", "op": "==", "right": "true" }
}
```

### Multi-Step Events:
```json
{
  "onClick": {
    "steps": [
      { "action": "haptic", "hapticPreset": "medium" },
      { "action": "setState", "stateKey": "showModal", "value": "true" },
      { "action": "setState", "stateKey": "selectedItem", "value": "{{prop.item.id}}" }
    ]
  }
}
```

### Custom Scripts (for API calls):
```json
{
  "action": "custom",
  "customScript": "var base=state.apiBase;\nvar id='{{prop.item.id}}';\nfetch(base+'/'+id,{method:'DELETE'}).then(function(){window.dispatchEvent(new CustomEvent('cortex:refresh'))})"
}
```

**Custom script execution context:** Custom scripts are called as `new Function('state', 'event', 'data', customScript)` — the three arguments are:
- `state` — read-only snapshot of current state values (object)
- `event` — the event context (e.g. `{value: "...", type: "onClick"}`)
- `data` — current runtime data (from data sources/tables)

**Important:** `state` in custom scripts is **read-only**. To change state, use the `setState` action (not a custom script). Custom scripts are for side-effects like fetch calls, `window.dispatchEvent`, DOM manipulation, etc.

**Important:** After any data mutation (POST/PATCH/DELETE), dispatch `cortex:refresh` to reload data:
```js
window.dispatchEvent(new CustomEvent('cortex:refresh'))
```

### setState Value Resolution:
setState `value` is passed through `resolveExpression()`, meaning you can use bindings and simple expressions directly:
```json
{ "action": "setState", "stateKey": "name", "value": "{{event.value}}" }
{ "action": "setState", "stateKey": "price", "value": "{{state.price}} + 10" }
{ "action": "setState", "stateKey": "label", "value": "{{state.count}} > 0 ? 'Has items' : 'Empty'" }
```

**Auto-increment shortcut:** If the value is `{{state.KEY}}` or `{{state.KEY}} + 1`, the runtime detects this and performs an atomic numeric increment (no expression parsing needed). This is the idiomatic way to increment counters.

### Navigate to Modal:
Navigate can open another screen as a modal overlay:
```json
{ "action": "navigate", "targetScreenId": "screen-abc", "targetScreenType": "modal" }
```
`targetScreenType` options: `"page"` (default), `"modal"`, `"sidebar"`

### Available Events by Component:

| Component | Events |
|-----------|--------|
| Layout containers | `onClick`, `onDoubleClick`, `onMouseEnter`, `onMouseLeave` |
| `button`, `link` | `onClick`, `onDoubleClick`, `onMouseEnter`, `onMouseLeave` |
| `textInput`, `numberInput`, `textarea` | `onChange`, `onFocus`, `onBlur`, `onInput`, `onKeyDown`, `onKeyUp` |
| `searchInput` | `onChange`, `onFocus`, `onBlur`, `onInput`, `onSubmit`, `onKeyDown`, `onKeyUp` |
| `dropdown` | `onChange`, `onFocus`, `onBlur` |
| `checkbox`, `toggle` | `onChange`, `onClick` |
| `radioGroup`, `tabs`, `accordion` | `onChange` |
| `slider` | `onChange`, `onInput` |
| `datepicker` | `onChange`, `onFocus`, `onBlur` |
| `fileUpload` | `onChange`, `onClick` |
| `formWrapper` | `onSubmit` |
| `modal` | `onClose` |
| `gestureDetector` | `onClick`, `onDoubleClick`, `onMouseEnter`, `onMouseLeave`, `onPressIn`, `onPressOut` |

### Global Event Keys (available on all components if not overridden):
`onLoad`, `onClick`, `onDoubleClick`, `onChange`, `onSubmit`, `onFocus`, `onBlur`, `onInput`, `onMouseEnter`, `onMouseLeave`, `onPressIn`, `onPressOut`, `onKeyDown`, `onKeyUp`

### Event Payload (`{{event.x}}` bindings):
| Binding | Description |
|---------|-------------|
| `{{event.value}}` | Input value (from onChange on text inputs, dropdowns, sliders, etc.) |
| `{{event.checked}}` | Boolean checked state (from onChange on checkbox/toggle) |
| `{{event.type}}` | Event name string (e.g. `"onClick"`, `"onChange"`) |
| `{{event.pressed}}` | Gesture press state (for `onPressIn`/`onPressOut`) |

---

## Data Repeater Pattern

The `dataRepeater` component loops over an array and renders its children for each item:

```json
{
  "id": "repeater-1",
  "type": "dataRepeater",
  "props": {
    "dataSource": "{{script.filteredItems}}",
    "itemVar": "item",
    "emptyText": "No items found",
    "gap": 8,
    "padding": "10px 16px"
  },
  "children": [
    {
      "id": "item-card",
      "type": "container",
      "props": {
        "flexDirection": "row",
        "alignItems": "center",
        "gap": 12,
        "padding": 14,
        "background": "var(--surface)",
        "borderRadius": "12px",
        "marginBottom": "8px"
      },
      "children": [
        {
          "id": "item-name",
          "type": "text",
          "props": { "content": "{{prop.item.name}}" }
        },
        {
          "id": "item-delete",
          "type": "button",
          "props": {
            "label": "Delete",
            "variant": "ghost",
            "onClick": {
              "steps": [
                {
                  "action": "custom",
                  "customScript": "fetch(state.apiBase+'/'+('{{prop.item.id}}'),{method:'DELETE'}).then(function(){window.dispatchEvent(new CustomEvent('cortex:refresh'))})"
                }
              ]
            }
          }
        }
      ]
    }
  ]
}
```

### Rules:
- `dataSource` should resolve to a JSON string of an array (use `JSON.stringify()` in named scripts)
- Access item fields with `{{prop.item.fieldName}}` (where `item` matches `itemVar`)
- `emptyText` shows when the array is empty

---

## Toggle Pattern (Active/Inactive States)

To create toggle buttons (like tabs, filters), use two copies of the element with opposite `visibleWhen`:

```json
[
  {
    "id": "tab-active",
    "type": "container",
    "props": {
      "background": "#6366f1",
      "borderRadius": "20px",
      "padding": 9,
      "visibleWhen": "{{state.tab}} == home",
      "onClick": { "steps": [{ "action": "setState", "stateKey": "tab", "value": "home" }] }
    },
    "children": [{ "id": "tab-active-text", "type": "text", "props": { "content": "Home", "color": "#fff", "fontWeight": "700" }, "children": [] }]
  },
  {
    "id": "tab-inactive",
    "type": "container",
    "props": {
      "background": "var(--surface)",
      "borderRadius": "20px",
      "padding": 9,
      "border": "1px solid var(--border-color)",
      "opacity": "0.65",
      "visibleWhen": "{{state.tab}} != home",
      "onClick": { "steps": [{ "action": "setState", "stateKey": "tab", "value": "home" }] }
    },
    "children": [{ "id": "tab-inactive-text", "type": "text", "props": { "content": "Home", "color": "var(--text)" }, "children": [] }]
  }
]
```

---

## Modal Pattern (Bottom Sheet)

Use a fixed-position container with backdrop for modals:

```json
{
  "id": "modal-overlay",
  "type": "container",
  "props": {
    "visibleWhen": "{{state.showModal}} == true",
    "position": "fixed",
    "top": "0", "left": "0", "right": "0", "bottom": "0",
    "zIndex": "100",
    "justifyContent": "flex-end",
    "background": "rgba(0,0,0,0.55)",
    "backdropFilter": "blur(4px)"
  },
  "children": [
    {
      "id": "modal-dismiss",
      "type": "container",
      "props": {
        "flex": "1",
        "cursor": "pointer",
        "onClick": { "steps": [{ "action": "setState", "stateKey": "showModal", "value": "false" }] }
      },
      "children": []
    },
    {
      "id": "modal-sheet",
      "type": "container",
      "props": {
        "flexDirection": "column",
        "background": "var(--background)",
        "borderRadius": "20px 20px 0 0",
        "boxShadow": "0 -8px 32px rgba(0,0,0,0.2)"
      },
      "children": [ /* modal content */ ]
    }
  ]
}
```

---

## Page Navigation Pattern (Single-Screen Multi-Page)

Use state to switch between "pages" within one screen:

```json
{
  "stateDefinitions": [
    { "id": "sd1", "name": "activePage", "type": "string", "defaultValue": "list" }
  ]
}
```

Then wrap each "page" in a container with `visibleWhen`:
```json
{ "visibleWhen": "{{state.activePage}} == list" }
{ "visibleWhen": "{{state.activePage}} == settings" }
{ "visibleWhen": "{{state.activePage}} == detail" }
```

---

## Data Table Integration

When the DCCortex project has internal database tables, data is available as `data.tableName` (array of row objects). Each row has:
- `id` — unique row identifier
- Custom columns defined on the table (e.g., `content`, `completed`, `priority`)
- `created_at` — timestamp

### CRUD via Event Actions (preferred):
Use the built-in `insertRow`, `updateRow`, and `deleteRow` actions instead of custom fetch scripts:

```json
{
  "onClick": {
    "steps": [
      {
        "action": "insertRow",
        "tableName": "messages",
        "rowData": "{\"content\": \"{{state.newMessage}}\", \"author\": \"{{state.userName}}\"}",
        "resultStateKey": "lastInsertResult",
        "refreshStateKey": "messages"
      },
      { "action": "setState", "stateKey": "newMessage", "value": "" }
    ]
  }
}
```

- `tableName`: The internal table name (not ID)
- `rowData`: JSON string with column→value pairs. Supports `{{state.xxx}}` and `{{event.xxx}}` bindings.
- `rowId`: For update/delete — the ID of the row (use `{{state.selectedRowId}}` or `{{prop.item.id}}`)
- `resultStateKey`: State variable to store the API response (optional)
- `refreshStateKey`: State key or data source name to auto-refresh after mutation (optional)

### CRUD via API (legacy fallback):
```js
// CREATE
fetch(apiBase, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({field: value}) })

// UPDATE
fetch(apiBase + '/' + rowId, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({field: newValue}) })

// DELETE
fetch(apiBase + '/' + rowId, { method: 'DELETE' })

// After any mutation:
window.dispatchEvent(new CustomEvent('cortex:refresh'))
```

The API base URL format: `/api/projects/{projectId}/datasources/{dsId}/tables/{tableId}/rows`

### Runtime CRUD Endpoint (for published apps):
Published apps use `POST /api/p/{projectId}/data/mutate` with body:
```json
{ "action": "insertRow", "table": "tableName", "data": { "field": "value" } }
{ "action": "updateRow", "table": "tableName", "rowId": "row-id", "data": { "field": "newValue" } }
{ "action": "deleteRow", "table": "tableName", "rowId": "row-id" }
```

---

## Best Practices

1. **Always use strings for state values** — even for booleans (`"true"`/`"false"`) and numbers (`"0"`, `"42"`)
2. **Use ES5 syntax in scripts** — `function(){}` not `() =>`, `var` not `let`/`const`
3. **Return `JSON.stringify(array)`** from scripts that produce arrays for `dataRepeater`
4. **Use `var(--background)`, `var(--surface)`, `var(--text)`, `var(--border-color)`, `var(--primary)`** for theme-aware colors
5. **Always include `children: []`** even for leaf components
6. **Use unique IDs** — short, descriptive like `"hdr-title"`, `"n-1"`, `"btn-save"`
7. **Include `gap`, `padding`, `minHeight`** on all containers (even if `0`)
8. **Haptic actions** enhance mobile/Tauri feel — use `"light"` for taps, `"medium"` for actions, `"heavy"` for destructive
9. **Use gradients** for hero sections: `"background": "linear-gradient(140deg, #312e81 0%, #4f46e5 40%, #7c3aed 70%, #a855f7 100%)"`
10. **Use `boxShadow`** for elevation: `"boxShadow": "0 1px 6px rgba(0,0,0,0.07)"`
11. **Root container MUST have `"width": "100%"` and `"minHeight": "100vh"`** — never leave the root without explicit dimensions.
12. **Form fields MUST have `"width": "100%"`** — textInput, numberInput, textarea, dropdown, datepicker, searchInput. In side-by-side rows, use `"flex": "1"` instead.
13. **Header/nav/footer bars MUST have `"width": "100%"`** — any container used as a top bar, navigation, or footer.
14. **Cards in dataRepeaters MUST have `"width": "100%"`** — each repeated item fills the repeater.

---

## Additional Features

### `customId` Prop
Any component can have a `customId` prop to override its DOM `id` attribute (useful for anchoring, linking, or DOM queries):
```json
{ "customId": "my-hero-section" }
```

### Real-Time Data Streaming (SSE)
If a data source has `realtimePollMs` set (e.g. `1000`), the runtime subscribes to an SSE stream at `/api/projects/{projectId}/runtime-data/stream?pollMs={ms}`. The server pushes DB snapshots over a persistent connection — no polling required from the client.

### Named Scripts Execution Context
Named scripts are evaluated as `new Function('state', 'data', 'return (' + body + ')')` — they receive:
- `state` — current state values (read-only snapshot)
- `data` — current runtime data from all data sources

Return value is available via `{{script.scriptName}}`.

---

## Example: Minimal Counter App

```json
{
  "exportVersion": 1,
  "screens": [{
    "name": "Counter",
    "slug": "counter",
    "layout": {
      "stateDefinitions": [
        { "id": "sd1", "name": "count", "type": "number", "defaultValue": "0" }
      ],
      "dataSources": [],
      "namedScripts": {},
      "root": {
        "id": "root",
        "type": "container",
        "props": { "flexDirection": "column", "alignItems": "center", "justifyContent": "center", "gap": 20, "padding": 40, "width": "100%", "minHeight": "100vh", "background": "var(--background)" },
        "children": [
          { "id": "n-1", "type": "text", "props": { "content": "Count: {{state.count}}", "fontSize": "32px", "fontWeight": "800", "color": "var(--text)" }, "children": [] },
          { "id": "n-2", "type": "container", "props": { "flexDirection": "row", "gap": 12, "padding": 0, "minHeight": 0 }, "children": [
            { "id": "n-3", "type": "button", "props": { "label": "- 1", "variant": "outline", "onClick": { "steps": [{ "action": "setState", "stateKey": "count", "value": "{{state.count}} - 1" }] } }, "children": [] },
            { "id": "n-4", "type": "button", "props": { "label": "+ 1", "variant": "primary", "onClick": { "steps": [{ "action": "setState", "stateKey": "count", "value": "{{state.count}} + 1" }] } }, "children": [] }
          ]}
        ]
      }
    },
    "script": ""
  }],
  "globals": { "colorMode": "adaptive", "theme": { "primary": "#6366f1", "background": "#0f0f13", "surface": "#1a1a24", "text": "#e2e8f0", "borderColor": "#2d2d3f" } }
}
```
