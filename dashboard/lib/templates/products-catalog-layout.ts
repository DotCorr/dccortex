/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import type { ProjectTemplate } from './types'

const n = (id: string, type: string, props: Record<string, unknown>, children: unknown[] = []) =>
  ({ id, type, props, children })

// DummyJSON products — rich data + product thumbnail images
const LAYOUT = {
  stateDefinitions: [
    { id: 'sd-cat', name: 'activeCategory', initialValue: 'all', type: 'string' },
  ],
  dataSources: [],
  namedScripts: {},
  theme: {
    primary: '#f97316',
    background: '#fff7ed',
    text: '#1c1917',
    surface: '#ffffff',
    borderColor: '#fed7aa',
    borderRadius: '10px',
    borderRadiusSm: '6px',
    borderRadiusLg: '16px',
  },
  root: n('pc-root', 'container', { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 0, gap: 0, margin: 0, minHeight: 0, overflow: 'auto', backgroundColor: '#fff7ed' }, [

    // ── Header ────────────────────────────────────────────────────────────────
    n('pc-hdr', 'container', { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24, gap: 16, margin: 0, minHeight: 0, backgroundColor: '#ea580c', color: '#ffffff' }, [
      n('pc-hdr-left', 'container', { display: 'flex', flexDirection: 'column', gap: 4, padding: 0, margin: 0, minHeight: 0 }, [
        n('pc-title', 'text', { content: '🛒 Products Catalog', variant: 'h2', color: '#ffffff' }),
        n('pc-subtitle', 'text', { content: '12 products from DummyJSON · API images + rich data · No auth needed', variant: 'body', color: '#fed7aa' }),
      ]),
      n('pc-badge-row', 'container', { display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', padding: 0, margin: 0, minHeight: 0 }, [
        n('pc-api-badge', 'badge', { label: 'DummyJSON', variant: 'warning', size: 'sm' }),
        n('pc-img-badge', 'badge', { label: 'Images + Data', variant: 'info', size: 'sm' }),
      ]),
    ]),

    // ── Product grid via dataRepeater ────────────────────────────────────────
    n('pc-grid', 'dataRepeater', {
      display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 16, padding: 20,
      margin: 0, minHeight: 0, alignItems: 'flex-start',
      // DummyJSON wraps products in {"products":[...]} — deep path binding
      dataSource: '{{data.catalog.products}}', itemVar: 'product', emptyText: 'Loading products…',
    }, [
      // Product card template
      n('pc-card', 'card', {
        display: 'flex', flexDirection: 'column', gap: 0, padding: 0,
        shadow: 'md', rounded: 'lg', bordered: true,
        backgroundColor: '#ffffff', overflow: 'hidden',
        flex: '1 1 240px', minWidth: '220px', maxWidth: '320px',
      }, [
        // Product thumbnail from API
        n('pc-img', 'image', {
          url: '{{prop.product.thumbnail}}',
          alt: '{{prop.product.title}}',
          width: '100%', height: 180, objectFit: 'cover', objectPosition: 'center',
        }),
        // Content area
        n('pc-content', 'container', { display: 'flex', flexDirection: 'column', gap: 8, padding: 14, margin: 0, minHeight: 0, flex: '1' }, [
          // Category badge
          n('pc-cat-badge', 'badge', { label: '{{prop.product.category}}', variant: 'outline', size: 'sm' }),
          // Title
          n('pc-prod-title', 'text', { content: '{{prop.product.title}}', variant: 'body' }),
          // Description (truncated)
          n('pc-desc', 'text', { content: '{{prop.product.description}}', variant: 'small', color: '#78716c' }),
          // Price + rating row
          n('pc-meta', 'container', { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 0, margin: 0, minHeight: 0, marginTop: 4 }, [
            n('pc-price', 'text', { content: '${{prop.product.price}}', variant: 'body', color: '#ea580c' }),
            n('pc-rating', 'badge', { label: '⭐ {{prop.product.rating}}', variant: 'warning', size: 'sm' }),
          ]),
          // Stock + brand row
          n('pc-stock-row', 'container', { display: 'flex', flexDirection: 'row', gap: 6, flexWrap: 'wrap', padding: 0, margin: 0, minHeight: 0 }, [
            n('pc-brand', 'badge', { label: '{{prop.product.brand}}', variant: 'info', size: 'sm' }),
            n('pc-stock', 'badge', { label: '{{prop.product.stock}} in stock', variant: 'success', size: 'sm' }),
          ]),
        ]),
      ]),
    ]),

    // ── Tips ─────────────────────────────────────────────────────────────────
    n('pc-tips', 'container', { display: 'flex', flexDirection: 'column', padding: 20, paddingTop: 4, gap: 0, margin: 0, minHeight: 0 }, [
      n('pc-tip-card', 'card', { display: 'flex', flexDirection: 'column', gap: 6, padding: 16, shadow: 'none', rounded: 'md', bordered: true, backgroundColor: '#fff7ed' }, [
        n('pc-tip-title', 'text', { content: '💡 Deep path + image binding', variant: 'h3', color: '#c2410c' }),
        n('pc-tip-1', 'text', { content: 'dataSource is {{data.catalog.products}} — this binds to a NESTED property inside the API response object (DummyJSON wraps results in {products:[]}).', variant: 'body', color: '#9a3412' }),
        n('pc-tip-2', 'text', { content: 'The image src is {{prop.product.thumbnail}} — a direct URL from the API. The platform renders it with no extra config needed.', variant: 'body', color: '#9a3412' }),
        n('pc-tip-3', 'text', { content: '⚡ Source: dummyjson.com/products — full CRUD-capable fake REST API, free, no auth needed', variant: 'small', color: '#c2410c' }),
      ]),
    ]),
  ]),
}

export const PRODUCTS_CATALOG_TEMPLATE: ProjectTemplate = {
  name: 'Products Catalog',
  icon: '🛒',
  description: 'E-commerce product grid from DummyJSON. Each card shows a product image (direct from API), title, price, rating and stock — combining API images with rich data in a single dataRepeater.',
  tags: ['E-Commerce', 'Images + Data', 'REST API', 'Deep Binding'],
  screens: [{ name: 'Home', slug: 'home', layout: LAYOUT }],
  apiSources: [{
    name: 'catalog',
    url: 'https://dummyjson.com/products?limit=12',
    method: 'GET',
    authType: 'none',
    schema: [
      { name: 'id', type: 'number' },
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'price', type: 'number' },
      { name: 'rating', type: 'number' },
      { name: 'stock', type: 'number' },
      { name: 'brand', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'thumbnail', type: 'string' },
    ],
  }],
}
