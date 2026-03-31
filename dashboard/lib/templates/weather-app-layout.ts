/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import type { ProjectTemplate } from './types'

const n = (id: string, type: string, props: Record<string, unknown>, children: unknown[] = []) =>
  ({ id, type, props, children })

const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35' +
  '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code' +
  '&hourly=temperature_2m,precipitation_probability' +
  '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum' +
  '&timezone=auto&forecast_days=7'

const LAYOUT = {
  stateDefinitions: [],
  dataSources: [],
  namedScripts: {},
  theme: {
    primary: '#0ea5e9',
    background: '#f0f9ff',
    text: '#0f172a',
    surface: '#ffffff',
    borderColor: '#e0f2fe',
    borderRadius: '10px',
    borderRadiusSm: '6px',
    borderRadiusLg: '14px',
  },
  root: n('w-root', 'container', { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 0, gap: 0, margin: 0, minHeight: 0, overflow: 'auto', backgroundColor: '#f0f9ff' }, [
    // ── Header ──────────────────────────────────────────────────────────────
    n('w-hdr', 'container', { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24, gap: 16, margin: 0, minHeight: 0, backgroundColor: '#0284c7', color: '#ffffff' }, [
      n('w-hdr-txt', 'container', { display: 'flex', flexDirection: 'column', gap: 4, padding: 0, margin: 0, minHeight: 0 }, [
        n('w-title', 'text', { content: '🌤 Weather Dashboard', variant: 'h2', color: '#ffffff' }),
        n('w-subtitle', 'text', { content: 'Paris, France · Live forecast from Open-Meteo API (free, no key)', variant: 'body', color: '#bae6fd' }),
      ]),
      n('w-live-badge', 'badge', { label: 'Live', variant: 'success', size: 'sm' }),
    ]),

    // ── Metric cards ────────────────────────────────────────────────────────
    n('w-cards', 'container', { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 20, padding: 24, margin: 0, minHeight: 0, backgroundColor: '#f0f9ff' }, [
      // Temperature
      n('w-temp-card', 'card', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 24, shadow: 'md', rounded: 'lg', bordered: true, flex: '1', minWidth: '180px', backgroundColor: '#ffffff' }, [
        n('w-temp-lbl', 'text', { content: '🌡 Temperature', variant: 'h3', color: '#0ea5e9' }),
        n('w-temp-val', 'text', { content: '{{data.weather.current.temperature_2m}}°C', variant: 'h1' }),
        n('w-temp-sub', 'text', { content: 'Current outdoor temp', variant: 'small', color: '#64748b' }),
      ]),
      // Humidity
      n('w-hum-card', 'card', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 24, shadow: 'md', rounded: 'lg', bordered: true, flex: '1', minWidth: '180px', backgroundColor: '#ffffff' }, [
        n('w-hum-lbl', 'text', { content: '💧 Humidity', variant: 'h3', color: '#0284c7' }),
        n('w-hum-val', 'text', { content: '{{data.weather.current.relative_humidity_2m}}%', variant: 'h1' }),
        n('w-hum-sub', 'text', { content: 'Relative humidity', variant: 'small', color: '#64748b' }),
      ]),
      // Wind
      n('w-wind-card', 'card', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 24, shadow: 'md', rounded: 'lg', bordered: true, flex: '1', minWidth: '180px', backgroundColor: '#ffffff' }, [
        n('w-wind-lbl', 'text', { content: '💨 Wind Speed', variant: 'h3', color: '#075985' }),
        n('w-wind-val', 'text', { content: '{{data.weather.current.wind_speed_10m}} km/h', variant: 'h1' }),
        n('w-wind-sub', 'text', { content: 'Surface level', variant: 'small', color: '#64748b' }),
      ]),
      // Weather code
      n('w-code-card', 'card', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 24, shadow: 'md', rounded: 'lg', bordered: true, flex: '1', minWidth: '180px', backgroundColor: '#ffffff' }, [
        n('w-code-lbl', 'text', { content: '☁ Weather Code', variant: 'h3', color: '#0369a1' }),
        n('w-code-val', 'text', { content: '{{data.weather.current.weather_code}}', variant: 'h1' }),
        n('w-code-sub', 'text', { content: 'WMO weather code', variant: 'small', color: '#64748b' }),
      ]),
    ]),

    // ── Additional info ─────────────────────────────────────────────────────
    n('w-info', 'container', { display: 'flex', flexDirection: 'column', gap: 12, padding: 24, paddingTop: 0, margin: 0, minHeight: 0 }, [
      n('w-info-card', 'card', { display: 'flex', flexDirection: 'column', gap: 8, padding: 20, shadow: 'sm', rounded: 'md', bordered: true, backgroundColor: '#ffffff' }, [
        n('w-info-title', 'text', { content: 'ℹ How data binding works', variant: 'h3' }),
        n('w-info-1', 'text', { content: 'This app uses {{data.weather.*}} bindings. The "weather" source is fetched server-side at preview/publish time and injected into every binding in this screen.', variant: 'body', color: '#475569' }),
        n('w-info-2', 'text', { content: 'Try editing this screen → enter Preview mode → see live data fill in automatically.', variant: 'body', color: '#475569' }),
        n('w-info-3', 'text', { content: '⚡ Source: open-meteo.com — free, no API key needed, no sign-up required.', variant: 'small', color: '#94a3b8' }),
      ]),
    ]),

    // ── Footer ──────────────────────────────────────────────────────────────
    n('w-footer', 'container', { display: 'flex', flexDirection: 'row', justifyContent: 'center', padding: 16, margin: 0, minHeight: 0, borderTop: '1px solid #e0f2fe' }, [
      n('w-footer-txt', 'text', { content: 'Powered by open-meteo.com — Free & Open Source Weather API · No registration · No key', variant: 'small', color: '#94a3b8' }),
    ]),
  ]),
}

export const WEATHER_APP_TEMPLATE: ProjectTemplate = {
  name: 'Weather Dashboard',
  icon: '🌤',
  description: 'Live weather metrics for Paris using the free Open-Meteo API. Shows current temperature, humidity, wind speed and weather code. No API key required.',
  tags: ['Weather', 'Open API', 'No Auth', 'Live Data'],
  screens: [{ name: 'Home', slug: 'home', layout: LAYOUT }],
  apiSources: [{
    name: 'weather',
    url: WEATHER_URL,
    method: 'GET',
    authType: 'none',
    schema: [
      { name: 'temperature_2m', type: 'number' },
      { name: 'relative_humidity_2m', type: 'number' },
      { name: 'wind_speed_10m', type: 'number' },
      { name: 'weather_code', type: 'number' },
    ],
  }],
}
