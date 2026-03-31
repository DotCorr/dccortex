/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import type { ProjectTemplate } from './types'

const n = (id: string, type: string, props: Record<string, unknown>, children: unknown[] = []) =>
  ({ id, type, props, children })

// DummyJSON users — rich nested objects demonstrating deep binding paths
const LAYOUT = {
  stateDefinitions: [
    { id: 'sd-selected', name: 'selectedUser', initialValue: '', type: 'string' },
  ],
  dataSources: [],
  namedScripts: {},
  theme: {
    primary: '#7c3aed',
    background: '#faf5ff',
    text: '#1e1b4b',
    surface: '#ffffff',
    borderColor: '#ede9fe',
    borderRadius: '10px',
    borderRadiusSm: '6px',
    borderRadiusLg: '14px',
  },
  root: n('up-root', 'container', { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 0, gap: 0, margin: 0, minHeight: 0, overflow: 'auto', backgroundColor: '#faf5ff' }, [

    // ── Header ──────────────────────────────────────────────────────────────
    n('up-hdr', 'container', { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24, gap: 16, margin: 0, minHeight: 0, backgroundColor: '#7c3aed', color: '#ffffff' }, [
      n('up-hdr-left', 'container', { display: 'flex', flexDirection: 'column', gap: 4, padding: 0, margin: 0, minHeight: 0 }, [
        n('up-title', 'text', { content: '👤 User Profiles', variant: 'h2', color: '#ffffff' }),
        n('up-subtitle', 'text', { content: '8 user records from DummyJSON · Nested object binding · CRUD-capable REST API', variant: 'body', color: '#ddd6fe' }),
      ]),
      n('up-badge', 'badge', { label: 'REST API', variant: 'info', size: 'sm' }),
    ]),

    // ── Info strip: shows deep nested binding ────────────────────────────────
    n('up-strip', 'container', { display: 'flex', flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 4, margin: 0, minHeight: 0, flexWrap: 'wrap', backgroundColor: '#f5f3ff' }, [
      n('up-strip-txt', 'text', { content: '⚡ This template demonstrates nested binding: {{prop.user.company.name}}, {{prop.user.address.city}}, {{prop.user.address.geo.lat}} — any depth works.', variant: 'small', color: '#6d28d9' }),
    ]),

    // ── User list via dataRepeater ───────────────────────────────────────────
    n('up-list', 'dataRepeater', {
      display: 'flex', flexDirection: 'column', gap: 12, padding: 16,
      margin: 0, minHeight: 0,
      dataSource: '{{data.users.users}}', itemVar: 'user', emptyText: 'Loading users…',
    }, [
      // User card
      n('up-card', 'card', { display: 'flex', flexDirection: 'column', gap: 0, padding: 0, shadow: 'md', rounded: 'lg', bordered: true, backgroundColor: '#ffffff', overflow: 'hidden' }, [
        // Top: avatar + name + email
        n('up-top', 'container', { display: 'flex', flexDirection: 'row', gap: 14, alignItems: 'center', padding: 16, margin: 0, minHeight: 0, backgroundColor: '#f5f3ff' }, [
          n('up-av', 'avatar', { src: '', alt: '{{prop.user.name}}', initials: '{{prop.user.name}}', size: 52, shape: 'circle' }),
          n('up-basic', 'container', { display: 'flex', flexDirection: 'column', gap: 2, flex: '1', padding: 0, margin: 0, minHeight: 0 }, [
            n('up-name', 'text', { content: '{{prop.user.name}}', variant: 'body' }),
            n('up-username', 'text', { content: '@{{prop.user.username}}', variant: 'small', color: '#7c3aed' }),
            n('up-email', 'text', { content: '{{prop.user.email}}', variant: 'small', color: '#6b7280' }),
          ]),
          n('up-id-badge', 'badge', { label: 'ID {{prop.user.id}}', variant: 'outline', size: 'sm' }),
        ]),
        // Bottom: company + address (nested binding showcase)
        n('up-bottom', 'container', { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 0, padding: 0, margin: 0, minHeight: 0 }, [
          n('up-company', 'container', { display: 'flex', flexDirection: 'column', gap: 3, padding: 14, flex: '1', margin: 0, minHeight: 0, borderRight: '1px solid #ede9fe' }, [
            n('up-co-lbl', 'text', { content: '🏢 Company', variant: 'caption', color: '#a78bfa' }),
            n('up-co-name', 'text', { content: '{{prop.user.company.name}}', variant: 'body' }),
            n('up-co-phrase', 'text', { content: '"{{prop.user.company.catchPhrase}}"', variant: 'small', color: '#6b7280' }),
          ]),
          n('up-address', 'container', { display: 'flex', flexDirection: 'column', gap: 3, padding: 14, flex: '1', margin: 0, minHeight: 0 }, [
            n('up-addr-lbl', 'text', { content: '📍 Location', variant: 'caption', color: '#a78bfa' }),
            n('up-city', 'text', { content: '{{prop.user.address.city}}, {{prop.user.address.zipcode}}', variant: 'body' }),
            n('up-street', 'text', { content: '{{prop.user.address.street}}, {{prop.user.address.suite}}', variant: 'small', color: '#6b7280' }),
          ]),
        ]),
        // Phone + website row
        n('up-contact', 'container', { display: 'flex', flexDirection: 'row', gap: 8, padding: 12, paddingTop: 8, margin: 0, minHeight: 0, borderTop: '1px solid #ede9fe', flexWrap: 'wrap' }, [
          n('up-phone-badge', 'badge', { label: '📞 {{prop.user.phone}}', variant: 'outline', size: 'sm' }),
          n('up-web-badge', 'badge', { label: '🌐 {{prop.user.website}}', variant: 'info', size: 'sm' }),
        ]),
      ]),
    ]),

    // ── Footer ──────────────────────────────────────────────────────────────
    n('up-footer', 'container', { display: 'flex', flexDirection: 'row', justifyContent: 'center', padding: 16, margin: 0, minHeight: 0, borderTop: '1px solid #ede9fe' }, [
      n('up-footer-txt', 'text', { content: '⚡ Source: dummyjson.com — Free fake REST API · Supports real CRUD (GET/POST/PUT/PATCH/DELETE)', variant: 'small', color: '#a78bfa' }),
    ]),
  ]),
}

export const USER_PROFILES_TEMPLATE: ProjectTemplate = {
  name: 'User Profiles',
  icon: '👤',
  description: 'Browse 8 rich user profiles from DummyJSON. Showcases nested binding paths like {{prop.user.company.name}} and {{prop.user.address.city}}. DummyJSON supports full CRUD operations.',
  tags: ['REST API', 'CRUD API', 'Nested Data', 'Repeater'],
  screens: [{ name: 'Home', slug: 'home', layout: LAYOUT }],
  apiSources: [{
    name: 'users',
    url: 'https://dummyjson.com/users?limit=8',
    method: 'GET',
    authType: 'none',
    schema: [
      { name: 'id', type: 'number' },
      { name: 'name', type: 'string' },
      { name: 'username', type: 'string' },
      { name: 'email', type: 'string' },
      { name: 'phone', type: 'string' },
      { name: 'website', type: 'string' },
      { name: 'company.name', type: 'string' },
      { name: 'address.city', type: 'string' },
    ],
  }],
}
