# Skill: Full-Screen Production Examples

## Description
Battle-tested, production-ready full-screen examples that demonstrate the CORRECT way to build DCCortex screens. These are verified working layouts with proper prop names, data bindings, namedScripts, and multi-screen navigation. Study and internalise these patterns — they are the gold standard.

## When to Use
- Generating ANY new screen from scratch
- Building data-driven screens with API or DB data
- Building multi-screen apps with navigation
- Creating dashboards, lists, forms, detail views, e-commerce, or analytics screens

---

## CRITICAL RULES (learned from real failures)

1. **Padding and gap are NUMBERS, not strings** — `"padding": 16` ✅ NOT `"padding": "16px"` ❌
2. **Layout direction** — `"flexDirection": "row"` ✅ NOT `"direction": "horizontal"` ❌
3. **Chart data** — comma-separated numbers: `"data": "10,20,30"` ✅ NOT `"dataScript": "..."` ❌
4. **Gauge chart** — `"value": 72, "min": 0, "max": 100` ✅
5. **Labels** — Charts use `"labels": "A,B,C"` (comma-separated string) ✅
6. **dataSources in layout** — Always `[]` (empty array) ✅ NOT `{ "key": {...} }` ❌
7. **namedScripts** — Object map: `{ "name": "body" }`. Body has access to `state` and `data`. MUST use ES5 (`var`, `function(){}`, no arrow functions).
8. **Scripts returning arrays** — MUST `JSON.stringify()` the result for dataRepeater to consume
9. **children** — ALWAYS include `"children": []` even on leaf nodes
10. **Events as strings** — When events are in props like onClick, they must be JSON-stringified: `"onClick": "{\"steps\":[...]}"` ✅

---

## Example 1: Dashboard Home — Multi-Source Stats + Data Lists

Shows: API data stats, DB data stats, live crypto prices, user list from API, contacts from PostgreSQL, multi-screen navigation.

```json
{
  "root": {
    "id": "root",
    "type": "container",
    "props": { "flexDirection": "column", "padding": 16, "gap": 16, "maxWidth": "1000px", "margin": "0 auto" },
    "children": [
      {
        "id": "header",
        "type": "container",
        "props": { "flexDirection": "row", "justifyContent": "space-between", "alignItems": "center", "padding": 0 },
        "children": [
          { "id": "title", "type": "text", "props": { "content": "📊 API Dashboard", "variant": "h4", "fontWeight": "bold" }, "children": [] },
          { "id": "date", "type": "text", "props": { "content": "{{dateNow.fullDate}}", "variant": "body2", "color": "#888" }, "children": [] }
        ]
      },
      {
        "id": "stats-row",
        "type": "container",
        "props": { "flexDirection": "row", "gap": 12, "padding": 0, "flexWrap": "wrap" },
        "children": [
          {
            "id": "s-users",
            "type": "card",
            "props": { "flexDirection": "column", "gap": 4, "flex": "1 1 180px", "padding": 16, "alignItems": "center" },
            "children": [
              { "id": "su-val", "type": "text", "props": { "content": "{{script.userCount}}", "variant": "h3", "fontWeight": "bold", "color": "#2563eb" }, "children": [] },
              { "id": "su-lbl", "type": "text", "props": { "content": "👤 Users (API)", "variant": "body2", "color": "#888" }, "children": [] }
            ]
          },
          {
            "id": "s-posts",
            "type": "card",
            "props": { "flexDirection": "column", "gap": 4, "flex": "1 1 180px", "padding": 16, "alignItems": "center" },
            "children": [
              { "id": "sp-val", "type": "text", "props": { "content": "{{script.postCount}}", "variant": "h3", "fontWeight": "bold", "color": "#16a34a" }, "children": [] },
              { "id": "sp-lbl", "type": "text", "props": { "content": "📝 Posts (API)", "variant": "body2", "color": "#888" }, "children": [] }
            ]
          },
          {
            "id": "s-contacts",
            "type": "card",
            "props": { "flexDirection": "column", "gap": 4, "flex": "1 1 180px", "padding": 16, "alignItems": "center" },
            "children": [
              { "id": "sc-val", "type": "text", "props": { "content": "{{script.contactCount}}", "variant": "h3", "fontWeight": "bold", "color": "#9333ea" }, "children": [] },
              { "id": "sc-lbl", "type": "text", "props": { "content": "📇 Contacts (DB)", "variant": "body2", "color": "#888" }, "children": [] }
            ]
          }
        ]
      },
      {
        "id": "crypto-card",
        "type": "card",
        "props": { "flexDirection": "column", "gap": 8, "padding": 16 },
        "children": [
          { "id": "crypto-title", "type": "text", "props": { "content": "💰 Live Crypto Prices", "fontWeight": "600" }, "children": [] },
          {
            "id": "crypto-row",
            "type": "container",
            "props": { "flexDirection": "row", "gap": 12, "padding": 0, "flexWrap": "wrap" },
            "children": [
              { "id": "btc", "type": "badge", "props": { "label": "BTC: ${{script.btcPrice}}" }, "children": [] },
              { "id": "eth", "type": "badge", "props": { "label": "ETH: ${{script.ethPrice}}" }, "children": [] }
            ]
          }
        ]
      },
      {
        "id": "users-section",
        "type": "card",
        "props": { "flexDirection": "column", "gap": 8, "padding": 16 },
        "children": [
          {
            "id": "users-header",
            "type": "container",
            "props": { "flexDirection": "row", "justifyContent": "space-between", "alignItems": "center", "padding": 0 },
            "children": [
              { "id": "usr-title", "type": "text", "props": { "content": "Recent Users", "fontWeight": "600" }, "children": [] },
              { "id": "btn-all-users", "type": "button", "props": { "label": "View All →", "variant": "outline", "size": "sm", "onClick": "{\"steps\":[{\"action\":\"navigate\",\"targetScreenId\":\"<userListScreenId>\"}]}" }, "children": [] }
            ]
          },
          {
            "id": "users-list",
            "type": "dataRepeater",
            "props": { "dataSource": "{{script.usersFirst5}}", "itemVar": "u", "flexDirection": "column", "gap": 6, "emptyText": "Loading users..." },
            "children": [
              {
                "id": "user-row",
                "type": "container",
                "props": {
                  "flexDirection": "row", "justifyContent": "space-between", "alignItems": "center", "padding": 8, "gap": 8,
                  "backgroundColor": "#f8fafc", "borderRadius": 8,
                  "onClick": "{\"steps\":[{\"action\":\"navigate\",\"targetScreenId\":\"<userDetailScreenId>\",\"navProps\":{\"userId\":\"{{prop.u.id}}\"}}]}"
                },
                "children": [
                  {
                    "id": "ur-left",
                    "type": "container",
                    "props": { "flexDirection": "row", "gap": 8, "padding": 0, "alignItems": "center" },
                    "children": [
                      { "id": "ur-avatar", "type": "avatar", "props": { "name": "{{prop.u.name}}", "size": "sm" }, "children": [] },
                      {
                        "id": "ur-info",
                        "type": "container",
                        "props": { "flexDirection": "column", "gap": 0, "padding": 0 },
                        "children": [
                          { "id": "ur-name", "type": "text", "props": { "content": "{{prop.u.name}}", "fontWeight": "600", "variant": "body2" }, "children": [] },
                          { "id": "ur-email", "type": "text", "props": { "content": "{{prop.u.email}}", "variant": "caption", "color": "#888" }, "children": [] }
                        ]
                      }
                    ]
                  },
                  { "id": "ur-company", "type": "badge", "props": { "label": "{{prop.u.company.name}}" }, "children": [] }
                ]
              }
            ]
          }
        ]
      },
      {
        "id": "nav-row",
        "type": "container",
        "props": { "flexDirection": "row", "gap": 8, "padding": 0, "justifyContent": "center", "flexWrap": "wrap" },
        "children": [
          { "id": "btn-users", "type": "button", "props": { "label": "👤 All Users", "variant": "outline", "onClick": "{\"steps\":[{\"action\":\"navigate\",\"targetScreenId\":\"<userListScreenId>\"}]}" }, "children": [] },
          { "id": "btn-posts", "type": "button", "props": { "label": "📝 All Posts", "variant": "outline", "onClick": "{\"steps\":[{\"action\":\"navigate\",\"targetScreenId\":\"<postListScreenId>\"}]}" }, "children": [] },
          { "id": "btn-orders", "type": "button", "props": { "label": "📦 Orders", "variant": "outline", "onClick": "{\"steps\":[{\"action\":\"navigate\",\"targetScreenId\":\"<ordersScreenId>\"}]}" }, "children": [] }
        ]
      }
    ]
  },
  "stateDefinitions": [],
  "dataSources": [],
  "namedScripts": {
    "userCount": "var u = data.users; return Array.isArray(u) ? String(u.length) : '…'",
    "postCount": "var p = data.posts; return Array.isArray(p) ? String(p.length) : '…'",
    "contactCount": "var c = data.contacts; return Array.isArray(c) ? String(c.length) : '…'",
    "btcPrice": "var c = data.crypto; return (c && c.bitcoin) ? String(c.bitcoin.usd) : '…'",
    "ethPrice": "var c = data.crypto; return (c && c.ethereum) ? String(c.ethereum.usd) : '…'",
    "usersFirst5": "var u = data.users; if (!Array.isArray(u)) return '[]'; return JSON.stringify(u.slice(0,5))"
  }
}
```

**KEY PATTERNS TO COPY:**
- Stats cards: `flex: "1 1 180px"` + `flexWrap: "wrap"` = responsive grid
- Card with centered text: `alignItems: "center"` on card props
- DataRepeater: `dataSource` points to a namedScript that returns `JSON.stringify(array)`
- Row items: `justifyContent: "space-between"` + `alignItems: "center"` = left-right layout
- Navigation: `onClick` with `navProps` passes data to target screen
- avatar + text column = contact/user row pattern

---

## Example 2: E-Commerce Product Grid with Search, Filter & Mixed Data

Shows: Product grid from external API, stats from PostgreSQL, search + category filter, cart integration, responsive wrap layout.

```json
{
  "root": {
    "id": "root",
    "type": "container",
    "props": { "flexDirection": "column", "padding": 16, "gap": 16, "width": "100%", "minHeight": "100vh", "maxWidth": "1000px", "margin": "0 auto" },
    "children": [
      {
        "id": "header",
        "type": "container",
        "props": { "flexDirection": "row", "justifyContent": "space-between", "alignItems": "center", "padding": 0, "width": "100%" },
        "children": [
          { "id": "title", "type": "text", "props": { "content": "🛒 Shop", "variant": "h4", "fontWeight": "bold" }, "children": [] },
          {
            "id": "header-btns",
            "type": "container",
            "props": { "flexDirection": "row", "gap": 8, "padding": 0 },
            "children": [
              { "id": "btn-cart", "type": "button", "props": { "label": "🛒 Cart ({{script.cartCount}})", "variant": "outline", "onClick": "{\"steps\":[{\"action\":\"navigate\",\"targetScreenId\":\"<cartScreenId>\"}]}" }, "children": [] },
              { "id": "btn-orders", "type": "button", "props": { "label": "📦 Orders", "variant": "ghost", "onClick": "{\"steps\":[{\"action\":\"navigate\",\"targetScreenId\":\"<ordersScreenId>\"}]}" }, "children": [] }
            ]
          }
        ]
      },
      {
        "id": "search-row",
        "type": "container",
        "props": { "flexDirection": "row", "gap": 8, "padding": 0 },
        "children": [
          { "id": "search", "type": "textInput", "props": { "placeholder": "🔍 Search products…", "stateKey": "search", "flex": "1" }, "children": [] },
          { "id": "cat-filter", "type": "dropdown", "props": { "stateKey": "category", "options": "All,electronics,jewelery,men's clothing,women's clothing" }, "children": [] }
        ]
      },
      {
        "id": "stats-row",
        "type": "container",
        "props": { "flexDirection": "row", "gap": 12, "padding": 0, "flexWrap": "wrap" },
        "children": [
          {
            "id": "s-prods",
            "type": "card",
            "props": { "flexDirection": "column", "gap": 4, "flex": "1 1 140px", "padding": 12, "alignItems": "center" },
            "children": [
              { "id": "sp-val", "type": "text", "props": { "content": "{{script.productCount}}", "variant": "h4", "fontWeight": "bold", "color": "#2563eb" }, "children": [] },
              { "id": "sp-lbl", "type": "text", "props": { "content": "Products (API)", "variant": "caption", "color": "#888" }, "children": [] }
            ]
          },
          {
            "id": "s-rev",
            "type": "card",
            "props": { "flexDirection": "column", "gap": 4, "flex": "1 1 140px", "padding": 12, "alignItems": "center" },
            "children": [
              { "id": "sr-val", "type": "text", "props": { "content": "${{script.totalRevenue}}", "variant": "h4", "fontWeight": "bold", "color": "#ea580c" }, "children": [] },
              { "id": "sr-lbl", "type": "text", "props": { "content": "Revenue (DB)", "variant": "caption", "color": "#888" }, "children": [] }
            ]
          }
        ]
      },
      {
        "id": "product-grid",
        "type": "dataRepeater",
        "props": { "dataSource": "{{script.filteredProducts}}", "itemVar": "p", "flexDirection": "row", "gap": 12, "flexWrap": "wrap", "emptyText": "No products match filter" },
        "children": [
          {
            "id": "prod-card",
            "type": "card",
            "props": {
              "flexDirection": "column", "gap": 8, "padding": 14, "flex": "1 1 220px", "maxWidth": "300px",
              "onClick": "{\"steps\":[{\"action\":\"navigate\",\"targetScreenId\":\"<productDetailScreenId>\",\"navProps\":{\"productId\":\"{{prop.p.id}}\"}}]}"
            },
            "children": [
              { "id": "pc-img", "type": "image", "props": { "src": "{{prop.p.image}}", "height": 140, "objectFit": "contain", "backgroundColor": "#fff" }, "children": [] },
              { "id": "pc-title", "type": "text", "props": { "content": "{{prop.p.title}}", "fontWeight": "600", "variant": "body2" }, "children": [] },
              {
                "id": "pc-foot",
                "type": "container",
                "props": { "flexDirection": "row", "justifyContent": "space-between", "alignItems": "center", "padding": 0 },
                "children": [
                  { "id": "pc-price", "type": "text", "props": { "content": "${{prop.p.price}}", "fontWeight": "bold", "color": "#16a34a" }, "children": [] },
                  { "id": "pc-rating", "type": "text", "props": { "content": "⭐ {{prop.p.rating.rate}}", "variant": "caption", "color": "#f59e0b" }, "children": [] }
                ]
              },
              { "id": "pc-cat", "type": "badge", "props": { "label": "{{prop.p.category}}" }, "children": [] }
            ]
          }
        ]
      }
    ]
  },
  "stateDefinitions": [
    { "id": "s-search", "name": "search", "type": "string", "initialValue": "" },
    { "id": "s-cat", "name": "category", "type": "string", "initialValue": "All" },
    { "id": "s-cart", "name": "cart", "type": "string", "initialValue": "[]" }
  ],
  "dataSources": [],
  "namedScripts": {
    "productCount": "var p = data.products; return Array.isArray(p) ? String(p.length) : '…'",
    "totalRevenue": "var o = data.orders; if (!Array.isArray(o)) return '0'; return o.reduce(function(s,x){return s+(x.total||0)},0).toFixed(2)",
    "cartCount": "try { var c = JSON.parse(state.cart || '[]'); return String(c.length) } catch(e) { return '0' }",
    "filteredProducts": "var p = data.products; if (!Array.isArray(p)) return '[]'; var q = (state.search || '').toLowerCase(); var cat = state.category || 'All'; var filtered = p.filter(function(x){ var matchSearch = !q || x.title.toLowerCase().indexOf(q) >= 0; var matchCat = cat === 'All' || x.category === cat; return matchSearch && matchCat }); return JSON.stringify(filtered)"
  }
}
```

**KEY PATTERNS TO COPY:**
- Product grid: dataRepeater with `flexDirection: "row"` + `flexWrap: "wrap"` + `flex: "1 1 220px"` per card
- Image cards: `objectFit: "contain"` + fixed height + `backgroundColor: "#fff"` for product images
- Search + dropdown filter: side-by-side row, both bound to state, namedScript does the filtering
- Mixed data sources: API data (`data.products`) + DB data (`data.orders`) combined on one screen
- Cart as JSON string in state: `JSON.parse(state.cart || '[]')` pattern

---

## Example 3: Data List with Charts, Search, Filter & Status Badges (PostgreSQL)

Shows: Database-driven list, stat cards, pie chart + bar chart, search + status dropdown, badge per row.

```json
{
  "root": {
    "id": "root",
    "type": "container",
    "props": { "flexDirection": "column", "padding": 16, "gap": 16, "width": "100%", "minHeight": "100vh", "maxWidth": "900px", "margin": "0 auto" },
    "children": [
      {
        "id": "header",
        "type": "container",
        "props": { "flexDirection": "row", "justifyContent": "space-between", "alignItems": "center", "padding": 0, "width": "100%" },
        "children": [
          { "id": "title", "type": "text", "props": { "content": "📦 Orders", "variant": "h5", "fontWeight": "bold" }, "children": [] },
          { "id": "btn-back", "type": "button", "props": { "label": "← Dashboard", "variant": "ghost", "onClick": "{\"steps\":[{\"action\":\"goBack\"}]}" }, "children": [] }
        ]
      },
      {
        "id": "summary-row",
        "type": "container",
        "props": { "flexDirection": "row", "gap": 12, "padding": 0, "flexWrap": "wrap" },
        "children": [
          {
            "id": "sm-total",
            "type": "card",
            "props": { "flexDirection": "column", "gap": 4, "flex": "1 1 140px", "padding": 12, "alignItems": "center" },
            "children": [
              { "id": "smt-val", "type": "text", "props": { "content": "{{script.orderCount}}", "variant": "h4", "fontWeight": "bold", "color": "#2563eb" }, "children": [] },
              { "id": "smt-lbl", "type": "text", "props": { "content": "Total Orders", "variant": "caption", "color": "#888" }, "children": [] }
            ]
          },
          {
            "id": "sm-rev",
            "type": "card",
            "props": { "flexDirection": "column", "gap": 4, "flex": "1 1 140px", "padding": 12, "alignItems": "center" },
            "children": [
              { "id": "smr-val", "type": "text", "props": { "content": "${{script.totalRevenue}}", "variant": "h4", "fontWeight": "bold", "color": "#16a34a" }, "children": [] },
              { "id": "smr-lbl", "type": "text", "props": { "content": "Total Revenue", "variant": "caption", "color": "#888" }, "children": [] }
            ]
          }
        ]
      },
      {
        "id": "chart-row",
        "type": "container",
        "props": { "flexDirection": "row", "gap": 12, "padding": 0, "flexWrap": "wrap" },
        "children": [
          {
            "id": "status-chart",
            "type": "card",
            "props": { "flexDirection": "column", "gap": 8, "padding": 16, "flex": "1 1 300px" },
            "children": [
              { "id": "sc-title", "type": "text", "props": { "content": "Status Breakdown", "fontWeight": "600" }, "children": [] },
              { "id": "sc-pie", "type": "pieChart", "props": { "data": "{{script.statusChartData}}", "height": 180 }, "children": [] }
            ]
          },
          {
            "id": "revenue-chart",
            "type": "card",
            "props": { "flexDirection": "column", "gap": 8, "padding": 16, "flex": "1 1 300px" },
            "children": [
              { "id": "rc-title", "type": "text", "props": { "content": "Revenue by Order", "fontWeight": "600" }, "children": [] },
              { "id": "rc-bar", "type": "barChart", "props": { "data": "{{script.revenueChartData}}", "color": "#16a34a", "height": 180 }, "children": [] }
            ]
          }
        ]
      },
      {
        "id": "filter-row",
        "type": "container",
        "props": { "flexDirection": "row", "gap": 8, "padding": 0 },
        "children": [
          { "id": "filter-search", "type": "textInput", "props": { "placeholder": "🔍 Search orders…", "stateKey": "search", "flex": "1" }, "children": [] },
          { "id": "filter-status", "type": "dropdown", "props": { "stateKey": "statusFilter", "options": "All,Delivered,Shipped,Processing,Cancelled" }, "children": [] }
        ]
      },
      {
        "id": "order-list",
        "type": "dataRepeater",
        "props": { "dataSource": "{{script.filteredOrders}}", "itemVar": "o", "flexDirection": "column", "gap": 8, "emptyText": "No orders match filter" },
        "children": [
          {
            "id": "order-card",
            "type": "card",
            "props": { "flexDirection": "row", "justifyContent": "space-between", "alignItems": "center", "padding": 14 },
            "children": [
              {
                "id": "oc-left",
                "type": "container",
                "props": { "flexDirection": "column", "gap": 2, "padding": 0 },
                "children": [
                  {
                    "id": "oc-num-row",
                    "type": "container",
                    "props": { "flexDirection": "row", "gap": 8, "padding": 0, "alignItems": "center" },
                    "children": [
                      { "id": "oc-num", "type": "text", "props": { "content": "{{prop.o.orderNumber}}", "fontWeight": "bold" }, "children": [] },
                      { "id": "oc-status", "type": "badge", "props": { "label": "{{prop.o.status}}" }, "children": [] }
                    ]
                  },
                  { "id": "oc-cust", "type": "text", "props": { "content": "{{prop.o.customer}} · {{prop.o.email}}", "variant": "body2", "color": "#555" }, "children": [] }
                ]
              },
              { "id": "oc-total", "type": "text", "props": { "content": "${{prop.o.total}}", "variant": "h6", "fontWeight": "bold", "color": "#16a34a" }, "children": [] }
            ]
          }
        ]
      }
    ]
  },
  "stateDefinitions": [
    { "id": "s-search", "name": "search", "type": "string", "initialValue": "" },
    { "id": "s-filter", "name": "statusFilter", "type": "string", "initialValue": "All" }
  ],
  "dataSources": [],
  "namedScripts": {
    "orderCount": "var o = data.orders; return Array.isArray(o) ? String(o.length) : '0'",
    "totalRevenue": "var o = data.orders; if (!Array.isArray(o)) return '0'; return String(o.reduce(function(s,x){return s+(x.total||0)},0).toFixed(2))",
    "statusChartData": "var o = data.orders; if (!Array.isArray(o)) return '0,0,0,0'; var d=0,s=0,p=0,c=0; o.forEach(function(x){if(x.status==='Delivered')d++;else if(x.status==='Shipped')s++;else if(x.status==='Processing')p++;else c++}); return d+','+s+','+p+','+c",
    "revenueChartData": "var o = data.orders; if (!Array.isArray(o)) return '0'; return o.map(function(x){return Math.round(x.total||0)}).join(',')",
    "filteredOrders": "var o = data.orders; if (!Array.isArray(o)) return '[]'; var q = (state.search || '').toLowerCase(); var sf = state.statusFilter || 'All'; var filtered = o.filter(function(x){ var matchSearch = !q || (x.customer||'').toLowerCase().indexOf(q)>=0 || (x.orderNumber||'').toLowerCase().indexOf(q)>=0; var matchStatus = sf === 'All' || x.status === sf; return matchSearch && matchStatus }); return JSON.stringify(filtered)"
  }
}
```

**KEY PATTERNS TO COPY:**
- Dynamic chart data from DB: namedScript counts statuses → `"3,2,1,2"` for pieChart
- Revenue bar chart: `o.map(function(x){return Math.round(x.total||0)}).join(',')` → comma-separated
- Search + status dropdown filter: both drive one `filteredOrders` namedScript
- Order card row: left column (number + badge + subtitle) vs right value (price)
- `goBack` action for back buttons — simpler than hardcoded screen IDs

---

## Example 4: Weather Dashboard — Nested API Data, Gauge & Line Chart

Shows: Deeply nested API response (`data.weather.current_weather.temperature`), weather code mapping, gauge chart with normalized value, line chart from array data.

```json
{
  "root": {
    "id": "root",
    "type": "container",
    "props": { "flexDirection": "column", "padding": 16, "gap": 16, "width": "100%", "minHeight": "100vh", "maxWidth": "800px", "margin": "0 auto" },
    "children": [
      {
        "id": "header",
        "type": "container",
        "props": { "flexDirection": "row", "justifyContent": "space-between", "alignItems": "center", "padding": 0 },
        "children": [
          { "id": "title", "type": "text", "props": { "content": "🌤 Weather", "variant": "h5", "fontWeight": "bold" }, "children": [] },
          { "id": "btn-back", "type": "button", "props": { "label": "← Back", "variant": "ghost", "onClick": "{\"steps\":[{\"action\":\"goBack\"}]}" }, "children": [] }
        ]
      },
      {
        "id": "current-card",
        "type": "card",
        "props": { "flexDirection": "column", "gap": 12, "padding": 20, "alignItems": "center" },
        "children": [
          { "id": "temp", "type": "text", "props": { "content": "{{script.currentTemp}}°C", "variant": "h2", "fontWeight": "bold", "color": "#ea580c" }, "children": [] },
          { "id": "desc", "type": "text", "props": { "content": "{{script.weatherDesc}}", "variant": "h6", "color": "#555" }, "children": [] },
          {
            "id": "details-row",
            "type": "container",
            "props": { "flexDirection": "row", "gap": 20, "padding": 0, "justifyContent": "center" },
            "children": [
              {
                "id": "d-wind",
                "type": "container",
                "props": { "flexDirection": "column", "gap": 2, "padding": 0, "alignItems": "center" },
                "children": [
                  { "id": "dw-val", "type": "text", "props": { "content": "{{script.windSpeed}} km/h", "fontWeight": "bold", "color": "#2563eb" }, "children": [] },
                  { "id": "dw-lbl", "type": "text", "props": { "content": "💨 Wind", "variant": "caption", "color": "#888" }, "children": [] }
                ]
              }
            ]
          }
        ]
      },
      {
        "id": "temp-gauge",
        "type": "card",
        "props": { "flexDirection": "column", "gap": 8, "padding": 16 },
        "children": [
          { "id": "tg-title", "type": "text", "props": { "content": "Temperature Gauge", "fontWeight": "600" }, "children": [] },
          { "id": "tg-gauge", "type": "gaugeChart", "props": { "value": "{{script.tempGaugeVal}}", "min": 0, "max": 100, "height": 140 }, "children": [] },
          { "id": "tg-label", "type": "text", "props": { "content": "{{script.currentTemp}}°C", "textAlign": "center", "variant": "caption", "color": "#888" }, "children": [] }
        ]
      },
      {
        "id": "hourly-card",
        "type": "card",
        "props": { "flexDirection": "column", "gap": 8, "padding": 16 },
        "children": [
          { "id": "hc-title", "type": "text", "props": { "content": "24h Temperature Forecast", "fontWeight": "600" }, "children": [] },
          { "id": "hc-chart", "type": "lineChart", "props": { "data": "{{script.hourlyTemps}}", "color": "#ea580c", "height": 220 }, "children": [] }
        ]
      }
    ]
  },
  "stateDefinitions": [],
  "dataSources": [],
  "namedScripts": {
    "currentTemp": "var w = data.weather; return (w && w.current_weather) ? String(w.current_weather.temperature) : '…'",
    "windSpeed": "var w = data.weather; return (w && w.current_weather) ? String(w.current_weather.windspeed) : '…'",
    "weatherDesc": "var w = data.weather; if (!w || !w.current_weather) return '…'; var code = w.current_weather.weathercode; var map = {0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',61:'Slight rain',63:'Moderate rain',65:'Heavy rain',71:'Slight snow',95:'Thunderstorm'}; return map[code] || 'Code ' + code",
    "tempGaugeVal": "var w = data.weather; if (!w || !w.current_weather) return 50; var t = w.current_weather.temperature; return Math.max(0, Math.min(100, Math.round((t + 20) / 65 * 100)))",
    "hourlyTemps": "var w = data.weather; if (!w || !w.hourly || !w.hourly.temperature_2m) return '10,12,14,16,18,20,19,17'; var temps = w.hourly.temperature_2m.slice(0,24); return temps.join(',')"
  }
}
```

**KEY PATTERNS TO COPY:**
- Nested API data: `data.weather.current_weather.temperature` accessed via namedScript (NOT direct binding, which can't handle deep paths reliably)
- Weather code enum mapping: Object literal lookups in namedScripts
- Gauge chart normalization: Map real range (-20°C to 45°C) → 0-100 gauge range with `Math.max(0, Math.min(100, ...))`
- Line chart from array: `temps.join(',')` converts API array → comma-separated for lineChart
- Fallback values: `return '…'` when data hasn't loaded yet

---

## Example 5: Task Manager — State-Driven CRUD with Filter + Progress

Shows: Seed data in state (no DB), multi-field filtering, progress bar, filtered data repeater, navigation with navProps, analytics link.

```json
{
  "root": {
    "id": "root",
    "type": "container",
    "props": { "flexDirection": "column", "padding": 16, "gap": 16, "width": "100%", "minHeight": "100vh", "maxWidth": "900px", "margin": "0 auto" },
    "children": [
      {
        "id": "header",
        "type": "container",
        "props": { "flexDirection": "row", "justifyContent": "space-between", "alignItems": "center", "gap": 8, "padding": 0, "width": "100%" },
        "children": [
          { "id": "title", "type": "text", "props": { "content": "Task Manager", "variant": "h4", "fontWeight": "bold" }, "children": [] },
          { "id": "btn-add", "type": "button", "props": { "label": "+ New Task", "variant": "primary", "onClick": "{\"steps\":[{\"action\":\"navigate\",\"targetScreenId\":\"<addTaskScreenId>\"}]}" }, "children": [] }
        ]
      },
      {
        "id": "filter-row",
        "type": "container",
        "props": { "flexDirection": "row", "gap": 8, "padding": 0, "flexWrap": "wrap" },
        "children": [
          { "id": "search", "type": "textInput", "props": { "placeholder": "Search tasks...", "stateKey": "search", "flex": "1 1 200px" }, "children": [] },
          { "id": "filter-status", "type": "dropdown", "props": { "stateKey": "filterStatus", "options": "all,todo,in-progress,done" }, "children": [] },
          { "id": "filter-priority", "type": "dropdown", "props": { "stateKey": "filterPriority", "options": "all,high,medium,low" }, "children": [] }
        ]
      },
      {
        "id": "stats-row",
        "type": "container",
        "props": { "flexDirection": "row", "gap": 12, "padding": 0, "flexWrap": "wrap" },
        "children": [
          {
            "id": "stat-total",
            "type": "card",
            "props": { "flexDirection": "column", "gap": 4, "flex": "1 1 120px", "padding": 12 },
            "children": [
              { "id": "st-label", "type": "text", "props": { "content": "Total", "variant": "caption", "color": "#888" }, "children": [] },
              { "id": "st-val", "type": "text", "props": { "content": "{{script.totalCount}}", "variant": "h5", "fontWeight": "bold" }, "children": [] }
            ]
          },
          {
            "id": "stat-done",
            "type": "card",
            "props": { "flexDirection": "column", "gap": 4, "flex": "1 1 120px", "padding": 12 },
            "children": [
              { "id": "sd-label", "type": "text", "props": { "content": "Done", "variant": "caption", "color": "#888" }, "children": [] },
              { "id": "sd-val", "type": "text", "props": { "content": "{{script.doneCount}}", "variant": "h5", "fontWeight": "bold", "color": "#16a34a" }, "children": [] }
            ]
          }
        ]
      },
      { "id": "progress", "type": "progressBar", "props": { "value": "{{script.completionPct}}", "max": 100, "label": "{{script.completionPct}}% Complete" }, "children": [] },
      {
        "id": "task-list",
        "type": "dataRepeater",
        "props": { "dataSource": "{{script.filteredTasks}}", "itemVar": "task", "flexDirection": "column", "gap": 8, "emptyText": "No tasks match your filters" },
        "children": [
          {
            "id": "task-card",
            "type": "card",
            "props": {
              "flexDirection": "row", "justifyContent": "space-between", "alignItems": "center", "gap": 12, "padding": 12,
              "onClick": "{\"steps\":[{\"action\":\"navigate\",\"targetScreenId\":\"<taskDetailScreenId>\",\"navProps\":{\"taskId\":\"{{prop.task.id}}\"}}]}"
            },
            "children": [
              {
                "id": "tc-left",
                "type": "container",
                "props": { "flexDirection": "column", "gap": 4, "flex": "1", "padding": 0 },
                "children": [
                  { "id": "tc-name", "type": "text", "props": { "content": "{{prop.task.title}}", "fontWeight": "600" }, "children": [] },
                  {
                    "id": "tc-meta",
                    "type": "container",
                    "props": { "flexDirection": "row", "gap": 8, "padding": 0 },
                    "children": [
                      { "id": "tc-pri", "type": "badge", "props": { "label": "{{prop.task.priority}}" }, "children": [] },
                      { "id": "tc-cat", "type": "text", "props": { "content": "{{prop.task.category}}", "variant": "caption", "color": "#888" }, "children": [] }
                    ]
                  }
                ]
              },
              { "id": "tc-status", "type": "badge", "props": { "label": "{{prop.task.status}}" }, "children": [] }
            ]
          }
        ]
      }
    ]
  },
  "stateDefinitions": [
    { "id": "s-search", "name": "search", "initialValue": "", "type": "string" },
    { "id": "s-fs", "name": "filterStatus", "initialValue": "all", "type": "string" },
    { "id": "s-fp", "name": "filterPriority", "initialValue": "all", "type": "string" },
    { "id": "s-tasks", "name": "tasks", "type": "array", "initialValue": "[{\"id\":\"1\",\"title\":\"Design landing page\",\"status\":\"done\",\"priority\":\"high\",\"category\":\"Design\"},{\"id\":\"2\",\"title\":\"Build auth API\",\"status\":\"in-progress\",\"priority\":\"high\",\"category\":\"Backend\"},{\"id\":\"3\",\"title\":\"Write unit tests\",\"status\":\"todo\",\"priority\":\"medium\",\"category\":\"QA\"}]" }
  ],
  "dataSources": [],
  "namedScripts": {
    "filteredTasks": "var raw = state.tasks; var tasks = typeof raw === 'string' ? JSON.parse(raw || '[]') : (Array.isArray(raw) ? raw : []); var s = (state.search || '').toLowerCase(); var fs = state.filterStatus || 'all'; var fp = state.filterPriority || 'all'; return JSON.stringify(tasks.filter(function(t){ if (s && t.title.toLowerCase().indexOf(s) === -1) return false; if (fs !== 'all' && t.status !== fs) return false; if (fp !== 'all' && t.priority !== fp) return false; return true }))",
    "totalCount": "var raw = state.tasks; var tasks = typeof raw === 'string' ? JSON.parse(raw || '[]') : (Array.isArray(raw) ? raw : []); return String(tasks.length)",
    "doneCount": "var raw = state.tasks; var tasks = typeof raw === 'string' ? JSON.parse(raw || '[]') : (Array.isArray(raw) ? raw : []); return String(tasks.filter(function(t){ return t.status === 'done' }).length)",
    "completionPct": "var raw = state.tasks; var tasks = typeof raw === 'string' ? JSON.parse(raw || '[]') : (Array.isArray(raw) ? raw : []); if (tasks.length === 0) return '0'; return String(Math.round(tasks.filter(function(t){ return t.status === 'done' }).length / tasks.length * 100))"
  }
}
```

**KEY PATTERNS TO COPY:**
- State-driven data: Seed array in `initialValue` as JSON string, parse in namedScripts
- Robust parsing: `typeof raw === 'string' ? JSON.parse(raw || '[]') : (Array.isArray(raw) ? raw : [])` handles both string and array state
- Multi-field filter: search + status dropdown + priority dropdown → single `filteredTasks` script
- Progress bar: `value` from namedScript, `max: 100`, `label` with dynamic percentage
- Task row: left column (title + badges) + right status badge

---

## Example 6: Checkout Form — Multi-Section Form with Order Summary

Shows: formWrapper, shipping/payment sections, cart summary computed from state, success overlay with visibleWhen.

```json
{
  "root": {
    "id": "root",
    "type": "container",
    "props": { "flexDirection": "column", "padding": 16, "gap": 16, "width": "100%", "minHeight": "100vh", "maxWidth": "600px", "margin": "0 auto" },
    "children": [
      {
        "id": "header",
        "type": "container",
        "props": { "flexDirection": "row", "justifyContent": "space-between", "alignItems": "center", "padding": 0 },
        "children": [
          { "id": "title", "type": "text", "props": { "content": "Checkout", "variant": "h5", "fontWeight": "bold" }, "children": [] },
          { "id": "btn-back", "type": "button", "props": { "label": "← Back", "variant": "ghost", "onClick": "{\"steps\":[{\"action\":\"goBack\"}]}" }, "children": [] }
        ]
      },
      {
        "id": "success-card",
        "type": "card",
        "props": { "flexDirection": "column", "gap": 16, "padding": 32, "alignItems": "center", "backgroundColor": "#f0fdf4", "visibleWhen": "{{state.orderPlaced}}" },
        "children": [
          { "id": "s-icon", "type": "text", "props": { "content": "🎉", "variant": "h1", "textAlign": "center" }, "children": [] },
          { "id": "s-title", "type": "text", "props": { "content": "Order Placed!", "variant": "h5", "fontWeight": "bold", "color": "#16a34a", "textAlign": "center" }, "children": [] },
          { "id": "s-msg", "type": "text", "props": { "content": "Thank you for your purchase.", "textAlign": "center", "color": "#666" }, "children": [] },
          { "id": "s-btn", "type": "button", "props": { "label": "Continue Shopping", "variant": "primary", "onClick": "{\"steps\":[{\"action\":\"navigate\",\"targetScreenId\":\"<homeScreenId>\"}]}" }, "children": [] }
        ]
      },
      {
        "id": "form-wrapper",
        "type": "formWrapper",
        "props": { "flexDirection": "column", "gap": 16 },
        "children": [
          {
            "id": "shipping-section",
            "type": "card",
            "props": { "flexDirection": "column", "gap": 12, "padding": 16 },
            "children": [
              { "id": "sh-title", "type": "text", "props": { "content": "📦 Shipping", "variant": "h6", "fontWeight": "bold" }, "children": [] },
              { "id": "sh-name", "type": "textInput", "props": { "label": "Full Name", "stateKey": "name", "placeholder": "John Doe", "required": true, "width": "100%" }, "children": [] },
              { "id": "sh-email", "type": "textInput", "props": { "label": "Email", "stateKey": "email", "placeholder": "john@example.com", "required": true, "width": "100%" }, "children": [] },
              { "id": "sh-addr", "type": "textInput", "props": { "label": "Address", "stateKey": "address", "placeholder": "123 Main St", "required": true, "width": "100%" }, "children": [] },
              {
                "id": "sh-row",
                "type": "container",
                "props": { "flexDirection": "row", "gap": 12, "padding": 0 },
                "children": [
                  { "id": "sh-city", "type": "textInput", "props": { "label": "City", "stateKey": "city", "placeholder": "New York", "flex": "1" }, "children": [] },
                  { "id": "sh-zip", "type": "textInput", "props": { "label": "ZIP", "stateKey": "zip", "placeholder": "10001", "flex": "1" }, "children": [] }
                ]
              },
              { "id": "sh-country", "type": "dropdown", "props": { "label": "Country", "stateKey": "country", "options": "United States,Canada,United Kingdom,Australia", "width": "100%" }, "children": [] }
            ]
          },
          {
            "id": "payment-section",
            "type": "card",
            "props": { "flexDirection": "column", "gap": 12, "padding": 16 },
            "children": [
              { "id": "pay-title", "type": "text", "props": { "content": "💳 Payment", "variant": "h6", "fontWeight": "bold" }, "children": [] },
              { "id": "pay-card", "type": "textInput", "props": { "label": "Card Number", "stateKey": "cardNumber", "placeholder": "4242 4242 4242 4242", "width": "100%" }, "children": [] },
              {
                "id": "pay-row",
                "type": "container",
                "props": { "flexDirection": "row", "gap": 12, "padding": 0 },
                "children": [
                  { "id": "pay-exp", "type": "textInput", "props": { "label": "Expiry", "stateKey": "cardExpiry", "placeholder": "12/25", "flex": "1" }, "children": [] },
                  { "id": "pay-cvv", "type": "textInput", "props": { "label": "CVV", "stateKey": "cardCvv", "placeholder": "123", "flex": "1" }, "children": [] }
                ]
              }
            ]
          },
          {
            "id": "order-summary",
            "type": "card",
            "props": { "flexDirection": "column", "gap": 8, "padding": 16, "backgroundColor": "#f8fafc" },
            "children": [
              { "id": "os-title", "type": "text", "props": { "content": "Order Summary", "variant": "h6", "fontWeight": "bold" }, "children": [] },
              { "id": "sep1", "type": "divider", "props": {}, "children": [] },
              {
                "id": "os-total",
                "type": "container",
                "props": { "flexDirection": "row", "justifyContent": "space-between", "padding": 0 },
                "children": [
                  { "id": "os-total-l", "type": "text", "props": { "content": "Total", "variant": "h6", "fontWeight": "bold" }, "children": [] },
                  { "id": "os-total-v", "type": "text", "props": { "content": "${{script.total}}", "variant": "h6", "fontWeight": "bold", "color": "#16a34a" }, "children": [] }
                ]
              }
            ]
          },
          { "id": "btn-place", "type": "button", "props": { "label": "🔒 Place Order", "variant": "primary", "fullWidth": true, "onClick": "{\"steps\":[{\"action\":\"setState\",\"stateKey\":\"orderPlaced\",\"value\":\"true\"}]}" }, "children": [] }
        ]
      }
    ]
  },
  "stateDefinitions": [
    { "id": "s-cart", "name": "cart", "type": "string", "initialValue": "[]" },
    { "id": "s-name", "name": "name", "type": "string", "initialValue": "" },
    { "id": "s-email", "name": "email", "type": "string", "initialValue": "" },
    { "id": "s-addr", "name": "address", "type": "string", "initialValue": "" },
    { "id": "s-city", "name": "city", "type": "string", "initialValue": "" },
    { "id": "s-zip", "name": "zip", "type": "string", "initialValue": "" },
    { "id": "s-country", "name": "country", "type": "string", "initialValue": "United States" },
    { "id": "s-card", "name": "cardNumber", "type": "string", "initialValue": "" },
    { "id": "s-exp", "name": "cardExpiry", "type": "string", "initialValue": "" },
    { "id": "s-cvv", "name": "cardCvv", "type": "string", "initialValue": "" },
    { "id": "s-placed", "name": "orderPlaced", "type": "string", "initialValue": "" }
  ],
  "dataSources": [],
  "namedScripts": {
    "cartCount": "try { var c = JSON.parse(state.cart || '[]'); return Array.isArray(c) ? String(c.length) : '0' } catch(e) { return '0' }",
    "subtotal": "try { var c = JSON.parse(state.cart || '[]'); if (!Array.isArray(c)) return '0.00'; return c.reduce(function(s,i){ return s + (Number(i.price)||0) }, 0).toFixed(2) } catch(e) { return '0.00' }",
    "total": "try { var c = JSON.parse(state.cart || '[]'); if (!Array.isArray(c)) return '0.00'; var sub = c.reduce(function(s,i){ return s + (Number(i.price)||0) }, 0); return (sub * 1.08).toFixed(2) } catch(e) { return '0.00' }"
  }
}
```

**KEY PATTERNS TO COPY:**
- Success overlay: `visibleWhen: "{{state.orderPlaced}}"` on a card at the top, with redirect buttons
- Form sections in cards: Each card = one form group (shipping, payment) with title + fields
- Side-by-side fields: `flexDirection: "row"` container with two text inputs (city/zip, expiry/cvv)
- Dropdown for country: `options` is a simple comma-separated string
- Order summary row: `justifyContent: "space-between"` for label vs value alignment
- Tax calculation in namedScript: `(sub * 1.08).toFixed(2)` — keep math in scripts, not bindings

---

## namedScript Patterns Cheatsheet

### Safe array access (works for both API and state data)
```
"var arr = data.mySource; if (!Array.isArray(arr)) return '[]'; return JSON.stringify(arr)"
```

### Safe state array parse (state stores arrays as strings)
```
"var raw = state.items; var arr = typeof raw === 'string' ? JSON.parse(raw || '[]') : (Array.isArray(raw) ? raw : []); return String(arr.length)"
```

### Search + multi-filter
```
"var items = data.myData; if (!Array.isArray(items)) return '[]'; var q = (state.search || '').toLowerCase(); var cat = state.categoryFilter || 'All'; return JSON.stringify(items.filter(function(x){ var matchQ = !q || (x.name||'').toLowerCase().indexOf(q)>=0; var matchCat = cat === 'All' || x.category === cat; return matchQ && matchCat }))"
```

### Nested object access (e.g. weather API)
```
"var w = data.weather; return (w && w.current_weather) ? String(w.current_weather.temperature) : '…'"
```

### Chart data from array field
```
"var w = data.weather; if (!w || !w.hourly) return '10,12,14'; return w.hourly.temperature_2m.slice(0,24).join(',')"
```

### Aggregate stats (count by field value)
```
"var o = data.orders; if (!Array.isArray(o)) return '0,0,0'; var a=0,b=0,c=0; o.forEach(function(x){if(x.status==='active')a++;else if(x.status==='pending')b++;else c++}); return a+','+b+','+c"
```

### Cart total from JSON string state
```
"try { var c = JSON.parse(state.cart || '[]'); if (!Array.isArray(c)) return '0.00'; return c.reduce(function(s,i){ return s + (Number(i.price)||0) }, 0).toFixed(2) } catch(e) { return '0.00' }"
```

### Find item by navProp ID
```
"var p = data.products; if (!Array.isArray(p)) return '…'; var id = Number(state._navProp_productId) || 1; var found = p.find(function(x){ return x.id === id }) || p[0] || {}; return found.title || '…'"
```

Note: `navProp.productId` is stored in state as `state._navProp_productId` at runtime.
