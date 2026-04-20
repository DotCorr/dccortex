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
    primary: '#b91c1c',
    background: '#fff7ed',
    text: '#111827',
    surface: '#ffffff',
    borderColor: '#fed7aa',
    borderRadius: '10px',
    borderRadiusSm: '6px',
    borderRadiusLg: '16px',
  },
  root: n('icc-root', 'container', { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 0, gap: 0, margin: 0, minHeight: 0, overflow: 'auto', backgroundColor: '#fff7ed' }, [

    n('icc-header', 'container', { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 22, gap: 16, margin: 0, minHeight: 0, background: 'linear-gradient(90deg, #7f1d1d 0%, #b91c1c 100%)', color: '#ffffff' }, [
      n('icc-title-wrap', 'container', { display: 'flex', flexDirection: 'column', gap: 4, padding: 0, margin: 0, minHeight: 0 }, [
        n('icc-title', 'text', { content: 'Incident Command Center', variant: 'h2', color: '#ffffff' }),
        n('icc-subtitle', 'text', { content: 'API-only operations board from open weather and disaster feeds', variant: 'body', color: '#fecaca' }),
      ]),
      n('icc-badges', 'container', { display: 'flex', flexDirection: 'row', gap: 8, padding: 0, margin: 0, minHeight: 0 }, [
        n('icc-weather-badge', 'badge', { label: 'Open-Meteo', variant: 'warning', size: 'sm' }),
        n('icc-disaster-badge', 'badge', { label: 'EONET', variant: 'info', size: 'sm' }),
      ]),
    ]),

    n('icc-summary-grid', 'container', { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 14, padding: 18, margin: 0, minHeight: 0 }, [
      n('icc-storm-card', 'card', { display: 'flex', flexDirection: 'column', gap: 6, padding: 14, shadow: 'sm', rounded: 'md', bordered: true, backgroundColor: '#ffffff', flex: '1 1 260px' }, [
        n('icc-storm-label', 'text', { content: 'Current Wind (Tokyo)', variant: 'small', color: '#9a3412' }),
        n('icc-storm-value', 'text', { content: '{{data.weather.current.wind_speed_10m}} km/h', variant: 'h2', color: '#7f1d1d' }),
      ]),
      n('icc-rain-card', 'card', { display: 'flex', flexDirection: 'column', gap: 6, padding: 14, shadow: 'sm', rounded: 'md', bordered: true, backgroundColor: '#ffffff', flex: '1 1 260px' }, [
        n('icc-rain-label', 'text', { content: 'Current Temp (Tokyo)', variant: 'small', color: '#9a3412' }),
        n('icc-rain-value', 'text', { content: '{{data.weather.current.temperature_2m}} C', variant: 'h2', color: '#7f1d1d' }),
      ]),
      n('icc-alert-card', 'card', { display: 'flex', flexDirection: 'column', gap: 6, padding: 14, shadow: 'sm', rounded: 'md', bordered: true, backgroundColor: '#ffffff', flex: '1 1 260px' }, [
        n('icc-alert-label', 'text', { content: 'Open Events (EONET)', variant: 'small', color: '#9a3412' }),
        n('icc-alert-value', 'text', { content: '{{data.events.events.length}} active', variant: 'h2', color: '#7f1d1d' }),
      ]),
    ]),

    n('icc-feed-title-wrap', 'container', { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, paddingTop: 8, paddingBottom: 8, margin: 0, minHeight: 0 }, [
      n('icc-feed-title', 'text', { content: 'Live Event Feed', variant: 'h3', color: '#7f1d1d' }),
      n('icc-feed-note', 'text', { content: 'Rendered with dataRepeater over {{data.events.events}}', variant: 'small', color: '#b45309' }),
    ]),

    n('icc-event-feed', 'dataRepeater', {
      display: 'flex', flexDirection: 'column', gap: 10, padding: 18, paddingTop: 6,
      margin: 0, minHeight: 0,
      dataSource: '{{data.events.events}}', itemVar: 'event', emptyText: 'No active events found right now.',
    }, [
      n('icc-event-card', 'card', { display: 'flex', flexDirection: 'column', gap: 8, padding: 14, shadow: 'sm', rounded: 'md', bordered: true, backgroundColor: '#ffffff' }, [
        n('icc-event-top', 'container', { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 0, margin: 0, minHeight: 0 }, [
          n('icc-event-name', 'text', { content: '{{prop.event.title}}', variant: 'body' }),
          n('icc-event-severity', 'badge', { label: '{{prop.event.categories[0].title}}', variant: 'danger', size: 'sm' }),
        ]),
        n('icc-event-date', 'text', { content: 'Started: {{prop.event.geometry[0].date}}', variant: 'small', color: '#6b7280' }),
        n('icc-event-source', 'text', { content: 'Source: {{prop.event.sources[0].id}}', variant: 'small', color: '#b45309' }),
      ]),
    ]),

    n('icc-tips-wrap', 'container', { display: 'flex', flexDirection: 'column', padding: 18, paddingTop: 4, gap: 0, margin: 0, minHeight: 0 }, [
      n('icc-tip-card', 'card', { display: 'flex', flexDirection: 'column', gap: 6, padding: 14, shadow: 'none', rounded: 'md', bordered: true, backgroundColor: '#ffedd5' }, [
        n('icc-tip-title', 'text', { content: 'How this proves API-only runtime', variant: 'h3', color: '#9a3412' }),
        n('icc-tip-1', 'text', { content: 'Every panel is bound directly to external API payloads. There are no internal DB tables and no custom code.', variant: 'body', color: '#7c2d12' }),
        n('icc-tip-2', 'text', { content: 'The metrics cards use deep bindings like {{data.weather.current.temperature_2m}} and {{data.events.events.length}}.', variant: 'body', color: '#7c2d12' }),
        n('icc-tip-3', 'text', { content: 'The feed cards come from a dataRepeater over {{data.events.events}} so runtime interpolation and SSR both exercise nested arrays.', variant: 'small', color: '#9a3412' }),
      ]),
    ]),
  ]),
}

export const INCIDENT_COMMAND_CENTER_TEMPLATE: ProjectTemplate = {
  name: 'Incident Command Center',
  icon: '🚨',
  description: 'Polished API-only operations dashboard. Combines weather telemetry with NASA EONET disaster events to validate deep binding, repeaters, and SSR runtime output without internal DB setup.',
  tags: ['API-Only', 'Operations', 'SSR Ready', 'Deep Binding'],
  screens: [{ name: 'Home', slug: 'home', layout: LAYOUT }],
  apiSources: [
    {
      name: 'weather',
      url: 'https://api.open-meteo.com/v1/forecast?latitude=35.6762&longitude=139.6503&current=temperature_2m,wind_speed_10m&timezone=auto',
      method: 'GET',
      authType: 'none',
      schema: [
        { name: 'current.temperature_2m', type: 'number' },
        { name: 'current.wind_speed_10m', type: 'number' },
      ],
    },
    {
      name: 'events',
      url: 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=8',
      method: 'GET',
      authType: 'none',
      schema: [
        { name: 'events[].title', type: 'string' },
        { name: 'events[].categories[0].title', type: 'string' },
        { name: 'events[].geometry[0].date', type: 'string' },
      ],
    },
  ],
}
