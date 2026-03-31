/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import type { ProjectTemplate } from './types'

const n = (id: string, type: string, props: Record<string, unknown>, children: unknown[] = []) =>
  ({ id, type, props, children })

const LAYOUT = {
  stateDefinitions: [],
  dataSources: [],
  namedScripts: {},
  theme: {
    primary: '#6366f1',
    background: '#fafafa',
    text: '#18181b',
    surface: '#ffffff',
    borderColor: '#e4e4e7',
    borderRadius: '8px',
    borderRadiusSm: '5px',
    borderRadiusLg: '12px',
  },
  root: n('pb-root', 'container', { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 0, gap: 0, margin: 0, minHeight: 0, overflow: 'auto', backgroundColor: '#fafafa' }, [

    // ── Header ──────────────────────────────────────────────────────────────
    n('pb-hdr', 'container', { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24, gap: 16, margin: 0, minHeight: 0, backgroundColor: '#18181b', borderBottom: '1px solid #27272a' }, [
      n('pb-hdr-left', 'container', { display: 'flex', flexDirection: 'column', gap: 4, padding: 0, margin: 0, minHeight: 0 }, [
        n('pb-title', 'text', { content: '📝 Posts Browser', variant: 'h2', color: '#ffffff' }),
        n('pb-subtitle', 'text', { content: '10 posts from JSONPlaceholder · Free public REST API · No auth needed', variant: 'body', color: '#a1a1aa' }),
      ]),
      n('pb-api-badge', 'badge', { label: 'JSON API', variant: 'info', size: 'sm' }),
    ]),

    // ── Post list via dataRepeater ───────────────────────────────────────────
    n('pb-list', 'dataRepeater', {
      display: 'flex', flexDirection: 'column', gap: 12, padding: 20,
      margin: 0, minHeight: 0, backgroundColor: '#fafafa',
      dataSource: '{{data.posts}}', itemVar: 'post', emptyText: 'Loading posts…',
    }, [
      // Card template repeated for each post
      n('pb-card', 'card', { display: 'flex', flexDirection: 'column', gap: 10, padding: 20, shadow: 'sm', rounded: 'md', bordered: true, backgroundColor: '#ffffff' }, [
        // Tags row
        n('pb-tags', 'container', { display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center', padding: 0, margin: 0, minHeight: 0 }, [
          n('pb-id-badge', 'badge', { label: '#{{prop.post.id}}', variant: 'info', size: 'sm' }),
          n('pb-user-badge', 'badge', { label: 'User {{prop.post.userId}}', variant: 'outline', size: 'sm' }),
        ]),
        // Title
        n('pb-card-title', 'text', { content: '{{prop.post.title}}', variant: 'h3' }),
        // Body
        n('pb-card-body', 'text', { content: '{{prop.post.body}}', variant: 'body', color: '#6b7280' }),
      ]),
    ]),

    // ── Footer ──────────────────────────────────────────────────────────────
    n('pb-footer', 'container', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 20, margin: 0, minHeight: 0, borderTop: '1px solid #e4e4e7', backgroundColor: '#ffffff' }, [
      n('pb-footer-info', 'card', { display: 'flex', flexDirection: 'column', gap: 6, padding: 16, shadow: 'none', rounded: 'md', bordered: true, backgroundColor: '#f4f4f5', maxWidth: '600px', width: '100%' }, [
        n('pb-footer-title', 'text', { content: '💡 How the repeater works', variant: 'h3' }),
        n('pb-footer-1', 'text', { content: 'The "posts" data source returns an array. The dataRepeater iterates it and clones its child template once per item.', variant: 'body', color: '#52525b' }),
        n('pb-footer-2', 'text', { content: 'Inside the repeater, use {{prop.post.field}} to access each item\'s fields (where "post" is the itemVar).', variant: 'body', color: '#52525b' }),
        n('pb-footer-3', 'text', { content: '⚡ Source: jsonplaceholder.typicode.com — free fake REST API for testing', variant: 'small', color: '#a1a1aa' }),
      ]),
    ]),
  ]),
}

export const POSTS_BROWSER_TEMPLATE: ProjectTemplate = {
  name: 'Posts Browser',
  icon: '📝',
  description: 'Browse 10 blog posts from the JSONPlaceholder public API. Demonstrates the dataRepeater component with REST API data binding — no auth required.',
  tags: ['Blog', 'REST API', 'dataRepeater', 'No Auth'],
  screens: [{ name: 'Home', slug: 'home', layout: LAYOUT }],
  apiSources: [{
    name: 'posts',
    url: 'https://jsonplaceholder.typicode.com/posts?_limit=10',
    method: 'GET',
    authType: 'none',
    schema: [
      { name: 'userId', type: 'number' },
      { name: 'id', type: 'number' },
      { name: 'title', type: 'string' },
      { name: 'body', type: 'string' },
    ],
  }],
}
