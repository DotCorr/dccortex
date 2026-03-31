# Skill: DCCortex Platform Runtime Knowledge

## Description
Complete runtime behavior reference — every quirk, limitation, workaround, and truth
about how the DCCortex rendering engine, event system, data binding, and published apps
actually work. This is source-level knowledge. Use it to avoid broken layouts, dead events,
and features that only work in editor preview but not in published apps.

---

## 1. Layout Engine — Flex Only

ALL layout containers are forced to `display: flex`. There is NO grid, block, or inline-flex.
Design everything with flexbox in mind.

**Default container props** (applied if not explicitly set):
- `flexDirection: "column"`, `flexWrap: "nowrap"`, `alignItems: "stretch"`
- `justifyContent: "flex-start"`, `gap: 8`, `padding: 12`, `margin: 0`
- `minHeight: 48` ← IMPORTANT: empty containers always take 48px min height.

**To make tight layouts**: always set `minHeight: 0` on containers that should collapse.

**Semantic elements auto-fill width**: `header`, `main`, `footer`, `nav`, `aside`, `article`
get `width: "100%"` automatically if no explicit width is set.

**Pure numeric width/height values get "px"**: `width: "300"` → `"300px"` but `"100%"` stays `"100%"`.

---

## 2. Canvas & Viewport Constraints

**Viewport sizes** (editor wraps canvas in a sized container):
- Desktop: `maxWidth: 1280`, `aspectRatio: 16/9`
- Mobile: `width: 375`, `aspectRatio: 9/19.5`
- Tablet: `width: 768`, `aspectRatio: 4/3`

**Edit mode**: `contain: layout` traps `position: fixed` elements inside the canvas. Fixed elements won't escape to the browser viewport. `z-index` capped at 999.

**Root container**: Always gets `minHeight: "100%"` in both edit and preview.

---

## 3. Border Radius — Theme Variables

ALL components (except divider, spacer, dataRepeater, gestureDetector) get:
`borderRadius: var(--border-radius, 0px)` as a default if not explicitly set.

Cards use CSS variable-based rounded map:
- `none` → `"0"`, `sm` → `var(--border-radius-sm, 4px)`, `md` → `var(--border-radius, 8px)`
- `lg` → `var(--border-radius-lg, 12px)`, `full` → `"24px"`

Modals use `var(--border-radius-lg, 12px)`.

---

## 4. visibleWhen Behavior

**Preview mode**: `visibleWhen` evaluates to false → component is **completely removed** from DOM (returns null).
Exception: modals handle their own visibility (see modal section).

**Edit mode**: hidden components are shown at 40% opacity with orange dashed outline and `pointerEvents: none`. Fixed/absolute elements get collapsed to `position: relative`.

---

## 5. Event System — Critical Rules

### 5a. Actions Run Synchronously
All event steps run in sequence, no `await` between them. Exception: `uploadFile` uses an async IIFE — subsequent steps do NOT wait for the upload to finish.

### 5b. setState Increment Detection
The runtime has special-case detection for `{{state.count}} + 1` patterns. These run as atomic functional updates (safe for rapid fires). Other math like `{{state.count}} + 5` goes through the normal resolution path and may read stale state if actions fire rapidly.

### 5c. State Type Coercion
Values are coerced based on declared type:
- `number`: `Number(resolved)`, NaN → `0`
- `boolean`: only `"true"`, `"1"`, `"yes"` (lowercase) → true; everything else → false
- `string`: no coercion
- `array`/`object`/`date`: stored as-is (string form)

### 5d. Click Events Stop Propagation
`onClick` calls `e.stopPropagation()` **only if** the component has event handlers configured. Clicks do NOT bubble to parent containers when handlers exist. If no onClick is set, click passes through to parent.

`gestureDetector` uses capture phase — fires BEFORE child onClick handlers and prevents children from also firing.

### 5e. Event Payload Shapes (exact)
| Event | Payload |
|-------|---------|
| onChange (text/textarea/number input) | `{ value: string }` |
| onChange (checkbox/toggle) | `{ checked: boolean, value: boolean }` |
| onChange (dropdown) | `{ value: string }` |
| onChange (slider) | `{ value: number }` |
| onChange (datepicker) | `{ value: string }` |
| onChange (fileUpload) | `{ value: FileList }` — NOT a string |
| onChange (tabs) | `{ value: number }` — tab index |
| onChange (accordion) | `{ value: number }` — item index |
| onInput | `{ value: string \| number }` |
| onSubmit (form/search) | `{}` — empty! |
| onClick | `{}` or undefined |
| onClose (modal) | `{}` |

### 5f. custom Script Scope
In scope: `state` (read-only ref), `event` (context object), `data` (runtime data).
Also available via globals: `window`, `document`, `console`, `fetch`.

**CRITICAL**: `state` is a reference. `state.count += 1` mutates the object but React will NOT re-render. To update state from custom scripts, chain a `setState` action after the custom script, or dispatch window events.

**CRITICAL**: Named scripts (`runScript`) receive `state` and `data` but NOT `event`. Scripts are for computing values. Use `return (expression)` format.

---

## 6. fileUpload → Image Display Pipeline (WORKING PATTERN)

### Step 1: State definitions
```json
{ "id": "sd-img", "name": "imageUrl", "type": "string", "defaultValue": "" },
{ "id": "sd-upl", "name": "uploading", "type": "boolean", "defaultValue": "false" }
```

### Step 2: fileUpload component
```json
{
  "id": "upload-zone",
  "type": "fileUpload",
  "props": {
    "accept": "image/*",
    "multiple": false,
    "dragDrop": true,
    "label": "Upload image",
    "onChange": {
      "steps": [{
        "action": "uploadFile",
        "uploadStateKey": "imageUrl",
        "uploadLoadingStateKey": "uploading"
      }]
    }
  },
  "children": []
}
```

### Step 3: Display uploaded image
```json
{
  "id": "uploaded-img",
  "type": "image",
  "props": {
    "url": "{{state.imageUrl}}",
    "alt": "Uploaded photo",
    "width": "100%",
    "height": 300,
    "objectFit": "cover"
  },
  "visibleWhen": "{{state.imageUrl}} != ",
  "children": []
}
```

### How it works internally:
1. User drops/selects file → hidden `<input type="file">` fires onChange
2. `fireConfiguredEvent('onChange', { value: e.target.files })` passes FileList
3. `uploadFile` action creates FormData, POSTs to `/api/projects/{id}/assets`
4. Response: `{ asset: { url: "/api/uploads/..." } }`
5. URL stored in `runtimeState[uploadStateKey]` as a string
6. Single file → string URL; multiple files → array of URLs
7. Image `url` prop bound to `{{state.imageUrl}}` renders the uploaded file

### ⚠️ uploadFile works in both editor preview AND published apps.
Published apps use a public endpoint `/api/p/{projectId}/assets` (10MB limit, safe file types only).

---

## 7. Data Binding — Resolution Rules

### Resolution order for `{{prefix.path}}`:
1. `state.` → from runtime state. Returns `""` if undefined.
2. `data.` → from data sources. Returns `"[data]"` if undefined (NOT empty string!).
3. `event.` → from event context. Returns `""` if undefined.
4. `prop.` → from reusable/repeater context. Returns `""` if undefined.
5. `navProp.` → from screen navigation params. Returns `""` if undefined.
6. `script.` → runs named script. Returns `""` if undefined.
7. `dateNow.`/`dateTime.` → current date/time tokens.
8. Anything else → returns original `{{expr}}` unchanged.

### CRITICAL QUIRK: `{{data.source}}` returns `"[data]"` when undefined
Check data existence with: `{{data.users}} != [data]` or use a named script.
Do NOT use `{{data.users}} == ""` — it will fail because undefined data returns `"[data]"`.

### Arrays get JSON.stringify'd
When a binding resolves to an array/object, it's serialized to JSON string.
`dataRepeater` automatically parses it back with `JSON.parse()`.
Named scripts that return arrays MUST use `JSON.stringify(array)`.

### Bindings are NOT recursive
`{{state.key}}` where key contains `"{{state.other}}"` resolves to the literal string, not the nested value. Only one pass of resolution.

### Expression operators need spaces
`{{state.x}} + 1` works. `{{state.x}}+1` may not (except for the special +1 increment case in setState).

### Auto-sanitization
AI expressions with `.toLowerCase()` get auto-wrapped: `{{state.name}}.toLowerCase()` becomes `String({{state.name}}||'').toLowerCase()`.

---

## 7b. Binding Engine — Hard Limitations

The binding resolver is a **hand-rolled expression parser** — NOT JavaScript `eval()` or `new Function()`.
It supports ONLY: ternary, nullish coalescing, logical AND/OR/NOT, comparisons, arithmetic, and `String(x).includes/startsWith/endsWith()`.

**THESE DO NOT WORK in `{{...}}` bindings:**
- `.find()`, `.filter()`, `.map()`, `.reduce()`, `.sort()`, `.slice()` — NO array methods
- `.length` — NO property access on resolved values
- Arrow functions (`x => x.name`) — NOT parsed
- Bracket indexing (`state.arr[0]`) — NOT supported (use `data.source.0.field` dot-path instead)
- Template literals, destructuring, spread — NOT supported
- Method calls like `JSON.parse()`, `parseInt()`, `Math.round()` — NOT supported
- Any expression more complex than `A op B ? C : D` chains

**Correct pattern**: Put all complex logic in `namedScripts` (which DO run real JS), then reference via `{{script.myFn}}`.

Example — WRONG vs RIGHT:
```
WRONG: "content": "{{ (data.channels.find(c => c.name === state.active) || {}).topic }}"
RIGHT: Define namedScript "activeTopic": "(function(){ var items=data.channels||[]; for(var i=0;i<items.length;i++){ if(items[i].name===state.active) return items[i].topic; } return ''; })()"
       Then: "content": "{{script.activeTopic}}"
```

---

## 8. dataRepeater — Item Context

In preview mode, children get access to:
- `{{prop.item}}` — the full item object
- `{{prop.item.fieldName}}` — a specific field (e.g. `{{prop.item.name}}`)
- `{{prop.itemIndex}}` — 0-based index

In edit mode, a placeholder context is used: `{ item: { id: 1, name: "Sample item", value: "value" } }`.

**CRITICAL**: The item variable name is `itemVar` prop (default `"item"`). If you set `"itemVar": "photo"`, access via `{{prop.photo.url}}`.

---

## 9. Tabs — Children Mapping

Tabs render ONE child per tab. Tab 0 shows `children[0]`, Tab 1 shows `children[1]`, etc.
If you have 3 tabs, you need EXACTLY 3 children (typically containers), one per tab.

```json
{
  "type": "tabs",
  "props": { "tabs": "Photos,Upload,Settings", "activeTab": 0 },
  "children": [
    { "id": "tab-photos", "type": "container", "props": {...}, "children": [...] },
    { "id": "tab-upload", "type": "container", "props": {...}, "children": [...] },
    { "id": "tab-settings", "type": "container", "props": {...}, "children": [...] }
  ]
}
```

---

## 10. Modal Visibility Logic

Modal uses special AND/OR logic:
- If both `open` prop and `visibleWhen` are set → AND'd (both must be true)
- If only `open` prop is set → it controls alone
- If only `visibleWhen` is set → it controls alone

To show a modal: set state variable, bind `open` to `{{state.showModal}}`.
To close: set `showModal` to `"false"` OR use the modal's `onClose` event which fires when close button / overlay is clicked.

---

## 11. Published App Limitations (PreviewApp.tsx)

### Actions that DO work in published apps:
setState, runScript, navigate (screen switch with history), goBack, uploadFile, custom, alert, log, haptic, speak, playAudio

### Actions / features NOT available in published apps:
- ❌ Modal screen navigation — navigate just switches screen, no modal overlay
- ❌ navProps passing — not supported

### custom scripts in published mode now receive runtimeData:
Custom scripts have full `data` access in published apps, same as editor.

### navigate with URL: opens in new tab (`_blank`) in published mode vs same tab in editor.

### State is shared across all screens in published apps:
State definitions from ALL screens AND global state are merged. State from Screen A is available on Screen B.

---

## 12. cortex:refresh — Does NOT Work in Preview

`window.dispatchEvent(new CustomEvent('cortex:refresh'))` is handled on organization/data/screens LIST pages — NOT in the editor preview or published app.

**WORKAROUND for data refresh in preview**: Chain a `setState` action that changes any state variable. State changes trigger the runtime data re-fetch via useEffect. Example: set a dummy `refreshTick` state to `{{state.refreshTick}} + 1` after mutations.

---

## 13. Image Component Defaults

Images with no explicit width/height get: `minWidth: 200`, `minHeight: 150`.
Always set explicit dimensions for images to prevent layout jumps.

---

## 14. Auto-flex for Row Children

When a child is added to a row-flex parent (`header`, `footer`, `nav`, `stackH`, or any container with `flexDirection: "row"`), expandable children get `flex: "1"` automatically if no explicit `flex` or `width` is set. This only applies to container-type children.

---

## 15. Animations — Dedicated Tab

14 keyframe animations are globally available:
`fadeIn`, `fadeOut`, `slideInUp`, `slideInDown`, `slideInLeft`, `slideInRight`,
`zoomIn`, `zoomOut`, `bounceIn`, `pulse`, `shake`, `spin`, `ping`, `float`

Animations are configured in the dedicated **Animate** tab (not the Style tab). Features:
- **Quick presets**: One-click buttons for common animations (fadeIn, slideUp, bounce, pulse, etc.)
- **Custom animation shorthand**: Input like `"myAnim 2s ease infinite"`
- **Fine-tune controls**: duration (0.1s–5s), timing function, delay, iteration count, direction, fill mode
- **Transition & Transform section**: For CSS transitions and transforms
- **Conditional animations**: Can be driven by state bindings (e.g., shake on error)

Usage in JSON: `{ "animation": "fadeIn 0.3s ease" }` or `{ "animation": "pulse 2s infinite" }`

---

## 16. Dropdown and Radio Options Format

Options are ALWAYS comma-separated plain strings: `"Option 1,Option 2,Option 3"`
NOT JSON arrays. NOT pipe-separated.

---

## 17. Error Boundaries

Every component node is wrapped in an error boundary. If a component crashes at render, it shows "Render error" with a Retry button instead of taking down the whole canvas. This means runtime errors in one component won't break the rest of the app.

---

## 18. Working CRUD Pattern (Event Actions — Preferred)

For apps with database tables, use the built-in CRUD event actions instead of custom scripts:

### Insert Row:
```json
{
  "action": "insertRow",
  "tableName": "messages",
  "rowData": "{\"content\": \"{{state.newMessage}}\", \"author\": \"{{state.userName}}\"}",
  "resultStateKey": "lastResult",
  "refreshStateKey": "messages"
}
```

### Update Row:
```json
{
  "action": "updateRow",
  "tableName": "tasks",
  "rowId": "{{state.selectedTaskId}}",
  "rowData": "{\"status\": \"done\"}",
  "refreshStateKey": "tasks"
}
```

### Delete Row:
```json
{
  "action": "deleteRow",
  "tableName": "tasks",
  "rowId": "{{prop.item.id}}",
  "refreshStateKey": "tasks"
}
```

**Key fields:**
- `tableName` — internal table name (not ID)
- `rowData` — JSON string with field→value pairs, supports `{{state.xxx}}` bindings
- `rowId` — row ID string, supports bindings
- `resultStateKey` — optional state var to store API response
- `refreshStateKey` — optional: auto-refreshes this data source/state after mutation

**Published apps**: Runtime uses `POST /api/p/{projectId}/data/mutate` (public endpoint, requires published project status).

**Legacy pattern** (still works): Use `custom` action with manual fetch calls to `/api/projects/{projectId}/datasources/{dsId}/tables/{tableId}/rows`.

---

## 19. Layout Composition Best Practices (from source analysis)

1. **Root must be container**: `{ "id": "root", "type": "container" }` — always. Set `"width": "100%"` and `"minHeight": "100vh"` on root.
2. **Use `minHeight: 0`** on inner containers to prevent unwanted 48px gaps.
3. **Use `width: "100%"`** on content sections; use `"48%"` or `"30%"` with `flexWrap: "wrap"` for grids.
4. **Use `overflow: "auto"` + `minHeight: 0`** for scrollable lists inside flex parents.
5. **Use `flex: "1"`** on containers that should fill remaining space.
6. **Never use `position: fixed`** in editor — it gets trapped by `contain: layout`. Use `position: "sticky"` instead for persistent headers/navs.
7. **Always set `gap`** on containers with children. Default 8 is tight; use 12-16 for breathable layouts.
8. **Set explicit colors on all text** — don't rely on inheritance. Use `var(--text)` or explicit hex.
9. **For grids**: Use a container with `flexDirection: "row"`, `flexWrap: "wrap"`, `gap: 12`, and children with `width: "48%"` (2-col) or `width: "31%"` (3-col).
10. **For full-height layouts**: Root container with `minHeight: "100vh"` (not `100%`), flex column, then content area with `flex: "1"`.
11. **Form fields MUST have width**: All `textInput`, `numberInput`, `textarea`, `dropdown`, `datepicker`, `searchInput` must have `"width": "100%"` when stacked vertically. When side-by-side in a row, use `"flex": "1"` instead.
12. **Headers/navs/footers MUST have width**: Any container acting as a header bar, navigation bar, or footer bar must include `"width": "100%"`.
13. **Cards in data repeaters**: Set `"width": "100%"` on each card/item element inside a `dataRepeater` to ensure they fill the repeater column.
14. **Sidebar + content layouts**: The content area next to a sidebar must have `"flex": "1"` and `"minWidth": 0` to properly fill remaining width.
15. **Buttons in forms**: Primary submit buttons should have `"width": "100%"`. Secondary/inline buttons can omit width.

---

## 20. Table Component — Enhanced Features

The `table` component now supports advanced functionality beyond basic columns/rows:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` | string | `""` | Comma-separated column headers |
| `rows` | string | `""` | CSV rows (one per line) OR JSON array string `[{"col":"val"}]` |
| `showExport` | boolean | `false` | Show CSV/JSON/Copy export buttons |
| `showSearch` | boolean | `false` | Show search input to filter rows |
| `sortable` | boolean | `false` | Click column headers to sort (numeric-aware) |
| `paginate` | boolean | `false` | Enable pagination |
| `pageSize` | number | `10` | Rows per page when paginated |
| `striped` | boolean | `false` | Alternating row background |
| `compact` | boolean | `false` | Reduced cell padding |

**Data format**: Accepts both CSV (rows as line-separated) and JSON array (`[{"name":"Alice"},{"name":"Bob"}]`).
**Bind to data**: Use `{{data.tableName}}` to render internal table data — the renderer auto-extracts column keys from JSON objects.

---

## 21. Realtime Data Polling

Data sources can be configured for automatic polling (useful for chat apps, live dashboards):

In the **Data tab** of the Property Panel, each data source has:
- **Realtime** toggle checkbox — enables/disables polling
- **Interval** input — polling frequency in milliseconds (minimum 1000ms enforced)

When enabled, the runtime (`PreviewApp.tsx`) sets up a `setInterval` that re-fetches data at the configured interval. The minimum interval across all realtime sources is used.

In layout JSON, data sources with realtime look like:
```json
{
  "dataSources": [
    { "id": "ds-1", "type": "table", "tableName": "messages", "stateKey": "messages", "realtime": true, "realtimeInterval": 2000 }
  ]
}
```

---

## 22. AI Protection (Screen Lock)

Screens can be locked from AI modifications via the **Theme/Config** tab toggle: "🔒 Lock screen from AI".

When `aiProtected: true` is set in the layout payload:
- The action executor **rejects** `update_screen` and `delete_screen` actions on this screen
- The system prompt annotates the screen with `🔒 AI-PROTECTED (DO NOT modify or delete)`
- AI is instructed to inform the user to unlock the screen first

This is stored at the layout payload level (`layout.aiProtected`), NOT in the Prisma schema — no migration needed.
