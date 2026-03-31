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
    primary: '#a78bfa',
    background: '#111827',
    text: '#f9fafb',
    surface: '#1f2937',
    borderColor: '#374151',
    borderRadius: '10px',
    borderRadiusSm: '6px',
    borderRadiusLg: '14px',
  },
  root: n('pg-root', 'container', { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 0, gap: 0, margin: 0, minHeight: 0, overflow: 'auto', backgroundColor: '#111827' }, [

    // ── Header ──────────────────────────────────────────────────────────────
    n('pg-hdr', 'container', { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 32, paddingBottom: 16, gap: 16, margin: 0, minHeight: 0 }, [
      n('pg-hdr-left', 'container', { display: 'flex', flexDirection: 'column', gap: 6, padding: 0, margin: 0, minHeight: 0 }, [
        n('pg-title', 'text', { content: '🖼 Photo Gallery', variant: 'h1', color: '#f9fafb' }),
        n('pg-subtitle', 'text', { content: '12 stunning random photos from Picsum Photos · Free image API · No auth needed', variant: 'body', color: '#9ca3af' }),
      ]),
      n('pg-badge', 'badge', { label: 'Image API', variant: 'info', size: 'sm' }),
    ]),

    // ── Photo grid via dataRepeater ──────────────────────────────────────────
    n('pg-grid', 'dataRepeater', {
      display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 16, padding: 24, paddingTop: 8,
      margin: 0, minHeight: 0, alignItems: 'flex-start',
      dataSource: '{{data.photos}}', itemVar: 'photo', emptyText: 'Loading photos…',
    }, [
      // Photo card template
      n('pg-photo-card', 'card', {
        display: 'flex', flexDirection: 'column', gap: 0, padding: 0,
        shadow: 'lg', rounded: 'lg', bordered: false,
        backgroundColor: '#1f2937', overflow: 'hidden',
        flex: '1 1 280px', minWidth: '220px', maxWidth: '380px',
      }, [
        // Photo image
        n('pg-img', 'image', {
          url: 'https://picsum.photos/id/{{prop.photo.id}}/800/600',
          alt: 'Photo by {{prop.photo.author}}',
          width: '100%', height: 220, objectFit: 'cover', objectPosition: 'center',
        }),
        // Info section
        n('pg-info', 'container', { display: 'flex', flexDirection: 'column', gap: 4, padding: 14, margin: 0, minHeight: 0 }, [
          n('pg-author', 'text', { content: '{{prop.photo.author}}', variant: 'body', color: '#f9fafb' }),
          n('pg-dims', 'container', { display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center', padding: 0, margin: 0, minHeight: 0 }, [
            n('pg-dims-txt', 'text', { content: '{{prop.photo.width}} × {{prop.photo.height}} px', variant: 'small', color: '#9ca3af' }),
            n('pg-id-badge', 'badge', { label: '#{{prop.photo.id}}', variant: 'outline', size: 'sm' }),
          ]),
        ]),
      ]),
    ]),

    // ── Footer ──────────────────────────────────────────────────────────────
    n('pg-footer', 'container', { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24, gap: 10, margin: 0, minHeight: 0, borderTop: '1px solid #374151' }, [
      n('pg-tip', 'card', { display: 'flex', flexDirection: 'column', gap: 6, padding: 16, shadow: 'none', rounded: 'md', bordered: true, backgroundColor: '#1f2937', borderColor: '#374151', maxWidth: '640px', width: '100%' }, [
        n('pg-tip-title', 'text', { content: '💡 How image binding works', variant: 'h3', color: '#f9fafb' }),
        n('pg-tip-1', 'text', { content: 'The image URL uses {{prop.photo.id}} — a prop binding that the dataRepeater injects for each item. The Picsum API builds the image from that ID.', variant: 'body', color: '#d1d5db' }),
        n('pg-tip-2', 'text', { content: '⚡ Source: picsum.photos — free placeholder image API', variant: 'small', color: '#6b7280' }),
      ]),
    ]),
  ]),
}

export const PHOTO_GALLERY_TEMPLATE: ProjectTemplate = {
  name: 'Photo Gallery',
  icon: '🖼',
  description: 'Dark-mode photo grid using the Picsum Photos API. Shows image binding inside a dataRepeater — each card\'s src is built from {{prop.photo.id}}. No auth required.',
  tags: ['Gallery', 'Images', 'REST API', 'Dark Mode'],
  screens: [{ name: 'Home', slug: 'home', layout: LAYOUT }],
  apiSources: [{
    name: 'photos',
    url: 'https://picsum.photos/v2/list?limit=12&page=1',
    method: 'GET',
    authType: 'none',
    schema: [
      { name: 'id', type: 'string' },
      { name: 'author', type: 'string' },
      { name: 'width', type: 'number' },
      { name: 'height', type: 'number' },
      { name: 'url', type: 'string' },
      { name: 'download_url', type: 'string' },
    ],
  }],
}
