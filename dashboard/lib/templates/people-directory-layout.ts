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
  stateDefinitions: [
    { id: 'sd-search', name: 'search', initialValue: '', type: 'string' },
  ],
  dataSources: [],
  namedScripts: {},
  theme: {
    primary: '#0f766e',
    background: '#ffffff',
    text: '#0f172a',
    surface: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: '8px',
    borderRadiusSm: '5px',
    borderRadiusLg: '12px',
  },
  root: n('pd-root', 'container', { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 0, gap: 0, margin: 0, minHeight: 0, overflow: 'auto', backgroundColor: '#ffffff' }, [

    // ── Header ──────────────────────────────────────────────────────────────
    n('pd-hdr', 'container', { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24, gap: 16, margin: 0, minHeight: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }, [
      n('pd-hdr-left', 'container', { display: 'flex', flexDirection: 'column', gap: 4, padding: 0, margin: 0, minHeight: 0 }, [
        n('pd-title', 'text', { content: '👥 People Directory', variant: 'h2' }),
        n('pd-subtitle', 'text', { content: 'Your team at a glance — backed by internal PostgreSQL database', variant: 'body', color: '#64748b' }),
      ]),
      n('pd-db-badge', 'badge', { label: 'PostgreSQL', variant: 'success', size: 'sm' }),
    ]),

    // ── Search bar ──────────────────────────────────────────────────────────
    n('pd-search-wrap', 'container', { display: 'flex', flexDirection: 'row', padding: 16, paddingBottom: 8, gap: 0, margin: 0, minHeight: 0 }, [
      n('pd-search', 'searchInput', { label: '', placeholder: 'Search people by name, role or department…', value: '{{state.search}}', suggestions: '' }),
    ]),

    // ── Person list via dataRepeater ────────────────────────────────────────
    n('pd-list', 'dataRepeater', {
      display: 'flex', flexDirection: 'column', gap: 10, padding: 16, paddingTop: 8,
      margin: 0, minHeight: 0,
      dataSource: '{{data.people}}', itemVar: 'person', emptyText: 'No people in database yet. Add rows via the Data tab.',
    }, [
      // Person card template
      n('pd-card', 'card', { display: 'flex', flexDirection: 'row', gap: 16, alignItems: 'center', padding: 16, shadow: 'sm', rounded: 'md', bordered: true, backgroundColor: '#ffffff' }, [
        // Avatar
        n('pd-avatar', 'avatar', { src: '', alt: '{{prop.person.name}}', initials: '{{prop.person.name}}', size: 48, shape: 'circle', showStatus: false }),
        // Info columns
        n('pd-info', 'container', { display: 'flex', flexDirection: 'column', gap: 2, flex: '1', padding: 0, margin: 0, minHeight: 0 }, [
          n('pd-name', 'text', { content: '{{prop.person.name}}', variant: 'body' }),
          n('pd-role', 'text', { content: '{{prop.person.role}}', variant: 'body', color: '#475569' }),
          n('pd-email', 'text', { content: '{{prop.person.email}}', variant: 'small', color: '#94a3b8' }),
        ]),
        // Department badge
        n('pd-dept', 'badge', { label: '{{prop.person.department}}', variant: 'info', size: 'sm' }),
        // Joined date
        n('pd-joined', 'text', { content: '{{prop.person.joined}}', variant: 'small', color: '#cbd5e1' }),
      ]),
    ]),

    // ── Tips card ─────────────────────────────────────────────────────────────
    n('pd-tips', 'container', { display: 'flex', flexDirection: 'column', padding: 16, paddingTop: 4, gap: 0, margin: 0, minHeight: 0 }, [
      n('pd-tip-card', 'card', { display: 'flex', flexDirection: 'column', gap: 6, padding: 16, shadow: 'none', rounded: 'md', bordered: true, backgroundColor: '#f0fdf4' }, [
        n('pd-tip-title', 'text', { content: '💡 How internal DB binding works', variant: 'h3', color: '#15803d' }),
        n('pd-tip-1', 'text', { content: 'The "people" data comes straight from your internal PostgreSQL table of the same name.  Go to "Data" tab → add or edit rows there — this screen updates automatically.', variant: 'body', color: '#166534' }),
        n('pd-tip-2', 'text', { content: 'The dataRepeater\'s dataSource is set to {{data.people}}. The runtime fetches all rows and makes them available as an array for the repeater.', variant: 'body', color: '#166534' }),
        n('pd-tip-3', 'text', { content: 'The search input is wired to {{state.search}} — add a visibleWhen condition on each card to filter client-side, or use a namedScript to pre-filter the array.', variant: 'small', color: '#16a34a' }),
      ]),
    ]),
  ]),
}

const SEED_ROWS = [
  { name: 'Alice Johnson', role: 'Product Manager', department: 'Product', email: 'alice@example.com', joined: '2021-03-15' },
  { name: 'Ben Carter', role: 'Senior Engineer', department: 'Engineering', email: 'ben@example.com', joined: '2020-07-01' },
  { name: 'Carmen López', role: 'UX Designer', department: 'Design', email: 'carmen@example.com', joined: '2022-01-20' },
  { name: 'David Kim', role: 'Data Analyst', department: 'Analytics', email: 'david@example.com', joined: '2021-11-08' },
  { name: 'Emma Wilson', role: 'Engineering Manager', department: 'Engineering', email: 'emma@example.com', joined: '2019-05-12' },
  { name: 'Felix Müller', role: 'Backend Engineer', department: 'Engineering', email: 'felix@example.com', joined: '2023-02-27' },
  { name: 'Grace Chen', role: 'Marketing Lead', department: 'Marketing', email: 'grace@example.com', joined: '2022-09-05' },
  { name: 'Hassan Ali', role: 'DevOps Engineer', department: 'Infrastructure', email: 'hassan@example.com', joined: '2020-12-14' },
]

export const PEOPLE_DIRECTORY_TEMPLATE: ProjectTemplate = {
  name: 'People Directory',
  icon: '👥',
  description: 'Team roster powered by an internal PostgreSQL table. Demonstrates DB data binding — rows added in the Data tab appear here automatically. Includes 8 seeded contacts.',
  tags: ['PostgreSQL', 'Internal DB', 'dataRepeater', 'HR / Directory'],
  screens: [{ name: 'Home', slug: 'home', layout: LAYOUT }],
  dbSetup: {
    tables: [{
      name: 'people',
      columns: [
        { name: 'name', type: 'text', sortOrder: 0 },
        { name: 'role', type: 'text', sortOrder: 1 },
        { name: 'department', type: 'text', sortOrder: 2 },
        { name: 'email', type: 'text', sortOrder: 3 },
        { name: 'joined', type: 'text', sortOrder: 4 },
      ],
      rows: SEED_ROWS,
    }],
  },
}
