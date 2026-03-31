/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Layout format migration utility.
 *
 * Accepts a screen layout JSON (any historical format) and returns the
 * current ScreenLayoutPayload shape.  Migrations are applied sequentially
 * so older layouts are progressively upgraded.
 *
 * Format history:
 *   v0 — bare Node tree (no wrapper, just { id, type, props, children })
 *   v1 — wrapped: { root, stateDefinitions?, dataSources?, namedScripts? }
 *   v2 — adds: theme, presentation, seoSettings, screenPropDefs, customTypes
 */

type MigratedLayout = {
  root: { id: string; type: string; props: Record<string, unknown>; children?: unknown[] }
  stateDefinitions: unknown[]
  dataSources: unknown[]
  namedScripts: Record<string, string>
  theme?: Record<string, unknown>
  presentation?: 'page' | 'modal'
  seoSettings?: Record<string, unknown>
  screenPropDefs?: unknown[]
  customTypes?: unknown[]
  _version: number
}

const CURRENT_VERSION = 2

export function migrateLayout(raw: unknown): MigratedLayout {
  if (!raw || typeof raw !== 'object') {
    // Empty / null layout — create a fresh root container
    return {
      root: { id: 'root', type: 'container', props: {}, children: [] },
      stateDefinitions: [],
      dataSources: [],
      namedScripts: {},
      _version: CURRENT_VERSION,
    }
  }

  const obj = raw as Record<string, unknown>
  let layout: MigratedLayout

  // v0 detection: raw object has `id` and `type` at top level (bare Node tree)
  if ('id' in obj && 'type' in obj && !('root' in obj)) {
    layout = {
      root: obj as MigratedLayout['root'],
      stateDefinitions: [],
      dataSources: [],
      namedScripts: {},
      _version: 0,
    }
  }
  // v1+ detection: has a `root` key
  else if ('root' in obj && obj.root && typeof obj.root === 'object') {
    layout = {
      root: obj.root as MigratedLayout['root'],
      stateDefinitions: Array.isArray(obj.stateDefinitions) ? obj.stateDefinitions : [],
      dataSources: Array.isArray(obj.dataSources) ? obj.dataSources : [],
      namedScripts: (obj.namedScripts && typeof obj.namedScripts === 'object') ? obj.namedScripts as Record<string, string> : {},
      theme: (obj.theme && typeof obj.theme === 'object') ? obj.theme as Record<string, unknown> : undefined,
      presentation: obj.presentation === 'modal' ? 'modal' : 'page',
      seoSettings: (obj.seoSettings && typeof obj.seoSettings === 'object') ? obj.seoSettings as Record<string, unknown> : undefined,
      screenPropDefs: Array.isArray(obj.screenPropDefs) ? obj.screenPropDefs : undefined,
      customTypes: Array.isArray(obj.customTypes) ? obj.customTypes : undefined,
      _version: typeof obj._version === 'number' ? obj._version : 1,
    }
  }
  // Unknown format — wrap as-is under root
  else {
    layout = {
      root: { id: 'root', type: 'container', props: {}, children: [] },
      stateDefinitions: [],
      dataSources: [],
      namedScripts: {},
      _version: 0,
    }
  }

  // Apply sequential migrations
  if (layout._version < 1) {
    // v0 → v1: ensure arrays exist
    if (!layout.stateDefinitions) layout.stateDefinitions = []
    if (!layout.dataSources) layout.dataSources = []
    if (!layout.namedScripts) layout.namedScripts = {}
    layout._version = 1
  }

  if (layout._version < 2) {
    // v1 → v2: ensure presentation defaults
    if (!layout.presentation) layout.presentation = 'page'
    layout._version = 2
  }

  return layout
}

/** Check whether a layout needs migration */
export function needsMigration(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return true
  const obj = raw as Record<string, unknown>
  if ('id' in obj && 'type' in obj && !('root' in obj)) return true // v0
  if (typeof obj._version === 'number' && obj._version >= CURRENT_VERSION) return false
  return true
}
