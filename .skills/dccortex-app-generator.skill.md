# Skill: Generate DCCortex App from Description

## Description
Given a natural language app description, generate a complete, valid DCCortex screen JSON that can be imported directly. This skill combines the schema knowledge from `dccortex-screen-json.skill.md` with the patterns from `dccortex-component-patterns.skill.md` to produce production-quality apps.

## When to Use
- User says "build me a [type] app"
- User describes an app concept and wants working DCCortex JSON output
- User wants to quickly prototype an idea

---

## Process

### Step 1: Identify App Requirements
From the user's description, extract:
- **App name and purpose**
- **Data model**: What entities/tables are needed? (column names and types)
- **Screens/pages**: What views does the app need?
- **Interactions**: CRUD operations, filtering, sorting, navigation
- **Visual style**: Dark/light, color scheme, mobile-first or desktop

### Step 2: Design State Variables
Map requirements to `stateDefinitions`:
- Form inputs → state variables (e.g., `newItemName`, `newItemPrice`)
- Navigation → `activePage` or `activeTab`
- Modals → `showAddModal`, `showEditModal`, `selectedItemId`
- Filters → `searchQuery`, `filterCategory`, `sortBy`
- Settings → any user prefs with `cacheValue: true`
- API config → `apiBase`, `apiBaseSet` (with `cacheValue: true`)

### Step 3: Design Named Scripts
Create computed values:
- **Counts**: `(data.tableName||[]).length`
- **Filtered lists**: Return `JSON.stringify(filtered)` for `dataRepeater`
- **Derived values**: Sums, averages, percentages
- Always use ES5 syntax (`function(){}`, `var`, no arrow functions)

### Step 4: Build Component Tree
Assemble the screen using these structural patterns:

**MANDATORY WIDTH RULES:**
- Root container: `"width": "100%"`, `"minHeight": "100vh"`
- All form fields (textInput, dropdown, textarea, etc.): `"width": "100%"` (or `"flex": "1"` if side-by-side)
- Header/nav/footer bars: `"width": "100%"`
- Cards inside dataRepeater: `"width": "100%"`
- Submit/primary buttons in forms: `"width": "100%"`
- Content area next to sidebar: `"flex": "1"`, `"minWidth": 0`

```
root (container, column, width="100%", minHeight="100vh")
├── Setup banner (visibleWhen apiBaseSet != true) — if app needs API
├── Main content (visibleWhen activePage == list)
│   ├── Hero header (gradient background)
│   │   ├── Icon + Title + Subtitle
│   │   ├── Stat cards row
│   │   └── Progress bar
│   ├── Filter pills row
│   ├── List heading + badge
│   ├── dataRepeater (filteredItems)
│   │   └── Item card (row layout with checkbox/actions)
│   └── Add button (opens modal)
├── Settings page (visibleWhen activePage == settings)
│   ├── Header with back button
│   ├── Stats summary
│   └── Actions (clear, reconfigure, etc.)
└── Add modal (visibleWhen showAddModal == true)
    ├── Overlay dismiss area
    └── Sheet with form fields + submit button
```

### Step 5: Wire Up Events
- **Button clicks**: `setState` to change pages, open modals
- **Form inputs**: `onChange` → `setState` with `{{event.value}}`
- **Counters**: `setState` with `{{state.count}} + 1` (auto-increment shortcut)
- **CRUD**: `custom` scripts with `fetch()` + `cortex:refresh`
- **Custom scripts**: receive `state`, `event`, `data` as function params (state is read-only)
- **Haptic feedback**: Add `haptic` actions before state changes
- **Checkboxes in repeaters**: PATCH to toggle, use `{{prop.item.id}}`

### Step 6: Output Valid JSON
Wrap everything in the export envelope with proper globals and theme.

⚠️ This export envelope is for FILE IMPORT only. In Cortex chat responses, use the action format:
`{ "message": "...", "actions": [{ "type": "create_screen", "params": { ... } }] }`

---

## Output Format

For file imports, output the complete JSON wrapped in a code block:

````json
{
  "exportVersion": 1,
  "_note": "Description of what this app does and what tables it needs.",
  "screens": [...],
  "globals": { "colorMode": "adaptive", "theme": {...} }
}
````

For **Cortex chat responses**, use action format instead (see system prompt).

---

## Critical Rules

1. **State defaultValues are always strings** — `"0"` not `0`, `"false"` not `false`, `"[]"` not `[]`
2. **State type can be `"string"`, `"number"`, or `"boolean"`** — the runtime coerces values accordingly
2. **ALL children arrays must exist** — even empty: `"children": []`
3. **Navigation must be connected** — in multi-screen apps, every screen must be reachable from the entry screen.
4. **No dead-end details pages** — detail/settings screens must include a clear back/home navigation action.
5. **Entry screen first** — create landing/discover/home first and keep sort order aligned with user flow.
6. **Container defaults should stay minimal** — avoid unnecessary `borderRadius`, oversized `padding`, and arbitrary `minHeight`.
6.1. **No decorative styling by default** — do not use gradients, heavy shadows, or glassmorphism unless explicitly requested.
6.2. **Radius discipline** — keep radius subtle (0-8px) for default mobile UI; avoid large rounded cards/buttons everywhere.
7. **Alignment sanity** — icon + text rows must use `flexDirection: "row"`, `alignItems: "center"`, and explicit `justifyContent`.
7.1. **Button alignment** — icon + label buttons must explicitly center content so icons never float to the top.
8. **Data binding integrity** — every `{{script.x}}` and `{{data.x}}` reference must have a real script/dataSource.
9. **Targeted updates** — for change requests, update only affected screens/components and preserve existing working structure.
10. **Transparent execution summary** — always state what changed, what dependencies were updated, and what could not be verified at runtime.
11. **Navigation IDs in multi-screen create flows** — use `$screenNId` placeholders for `targetScreenId`, never slugs/names.
3. **ALL node IDs must be unique** within the screen
4. **ALL containers need baseline props**: `flexDirection`, `gap`, `padding`, `minHeight`
5. **ES5 only in scripts** — `var`, `function(){}`, no `const`/`let`/`=>`/template literals
6. **Scripts returning arrays MUST `JSON.stringify()`** the result
7. **After fetch mutations, ALWAYS dispatch `cortex:refresh`**
8. **Use `var(--background)`, `var(--surface)`, `var(--text)`, `var(--border-color)`** for theme colors
9. **visibleWhen comparisons** use `==` and `!=` (not `===`)
10. **dataRepeater items** are accessed via `{{prop.ITEMVAR.field}}` matching the `itemVar` prop

---

## App Type Templates

### CRUD List App (Todo, Contacts, Inventory)
- Table: name + fields
- Pages: list, settings
- Features: add modal, inline toggle/delete, filter pills, stats

### Dashboard App (Analytics, Finance, Metrics)
- Layout: sidebar (aside) + main content area
- Features: tabs for sections, chart components, stat cards, data tables
- Navigation: sidebar links toggle `{{state.tab}}`

### Form App (Survey, Registration, Settings)
- Layout: single column, card-based sections
- Features: multi-step with `activePage`, validation in custom scripts, submit via fetch

### Content App (Blog, Portfolio, Documentation)
- Layout: header + main + optional sidebar
- Features: richText for content, image components, accordions

### E-Commerce (Products, Orders)
- Tables: products, orders, cart
- Pages: catalog (grid), detail, cart, checkout
- Features: add-to-cart custom script, quantity state, total computation

---

## Example Prompt & Response

**User**: "Build me a habit tracker app. I want to track daily habits with a streak counter."

**Response Plan**:
- Table: `habits` (name: text, streak: text, lastChecked: text, category: text)
- State: `showAddModal`, `newHabitName`, `newCategory`, `filter`, `activePage`, `apiBase`, `apiBaseSet`
- Scripts: `totalHabits`, `checkedToday`, `longestStreak`, `filteredHabits`
- Pages: main list, settings
- Features: check-in button per habit, streak display, category filter, add modal

Then generate the full JSON following all rules above.
