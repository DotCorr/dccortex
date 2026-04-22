/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Cortex Action Executor — takes AI action responses and executes them
 * against the DCCortex API endpoints server-side.
 */
import { prisma } from '@/lib/prisma'
import { validateApiSource } from '@/lib/cortex/api-validator'
import { migrateLayout } from '@/lib/layout-migration'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

export type CortexAction =
  | { type: 'create_project'; params: { name: string; description?: string } }
  | { type: 'create_screen'; params: { projectId: string; name: string; slug: string; layout?: object; script?: string; sortOrder?: number; screenId?: string } }
  | { type: 'update_screen'; params: { projectId: string; screenId: string; name?: string; slug?: string; layout?: object; script?: string; sortOrder?: number } }
  | { type: 'delete_screen'; params: { projectId: string; screenId: string } }
  | { type: 'validate_api'; params: { projectId: string; sourceId: string; urlOverride?: string } }
  | { type: 'create_table'; params: { projectId: string; name: string; columns: { name: string; type: string; options?: object }[] } }
  | { type: 'update_table'; params: { projectId: string; tableId: string; name?: string; columns?: { name: string; type: string; options?: object }[] } }
  | { type: 'update_row'; params: { projectId: string; tableId?: string; tableName?: string; rowId: string; rowData: Record<string, unknown> | string; refreshStateKey?: string } }
  | { type: 'add_rows'; params: { projectId: string; tableId: string; rows: Record<string, unknown>[] } }
  | { type: 'delete_rows'; params: { projectId: string; tableId: string; rowIds: string[] } }
  | { type: 'delete_table'; params: { projectId: string; tableId: string } }
  | { type: 'create_api_source'; params: { projectId: string; name: string; url: string; method?: string; headers?: object; body?: string; authType?: string; authValue?: string } }
  | { type: 'update_datasource'; params: { projectId: string; sourceId: string; name?: string; url?: string; method?: string; headers?: object; body?: string; authType?: string; authValue?: string } }
  | { type: 'delete_api_source'; params: { projectId: string; sourceId: string } }
  | { type: 'create_webhook'; params: { projectId: string; name: string; url: string; events: string[]; secret?: string } }
  | { type: 'update_webhook'; params: { projectId: string; webhookId: string; name?: string; url?: string; events?: string[]; secret?: string } }
  | { type: 'update_project'; params: { projectId: string; name?: string; description?: string; seoDefaults?: object; faviconUrl?: string; customDomain?: string } }
  | { type: 'update_globals'; params: { projectId: string; reusables?: object; globalState?: object; globalTheme?: object } }

export type ActionResult = {
  type: string
  success: boolean
  data?: unknown
  error?: string
}

const NAV_EVENT_KEYS = [
  'onLoad', 'onClick', 'onDoubleClick', 'onChange', 'onSubmit',
  'onFocus', 'onBlur', 'onInput', 'onMouseEnter', 'onMouseLeave',
  'onPressIn', 'onPressOut', 'onKeyDown', 'onKeyUp',
]

const FORBIDDEN_PLACEHOLDER_TEXT = [
  'work in progress',
  'coming soon',
  'todo',
  'placeholder',
  'under construction',
]

const EMOJI_TEXT_KEYS = new Set([
  'content',
  'label',
  'title',
  'subtitle',
  'placeholder',
  'description',
  'helperText',
  'emptyStateText',
  'badgeText',
  'buttonText',
])

function stripEmojiGlyphs(input: string): { value: string; removed: number } {
  if (!input) return { value: input, removed: 0 }

  let removed = 0
  let out = ''
  for (const ch of input) {
    const cp = ch.codePointAt(0)
    if (!cp) {
      out += ch
      continue
    }
    const isEmoji =
      (cp >= 0x1f300 && cp <= 0x1faff) ||
      (cp >= 0x2600 && cp <= 0x27bf) ||
      cp === 0xfe0f
    if (isEmoji) {
      removed++
      continue
    }
    out += ch
  }
  return { value: out, removed }
}

function sanitizeLayoutEmojiText(input: unknown): {
  value: unknown
  notes: string[]
  touchedFields: number
  removedGlyphs: number
  fallbackFields: number
} {
  const notes: string[] = []
  let touchedFields = 0
  let removedGlyphs = 0
  let fallbackFields = 0

  const fallbackForKey = (key: string): string => {
    if (key === 'placeholder') return 'Enter value'
    if (key === 'title' || key === 'label' || key === 'content') return 'Label'
    return 'Text'
  }

  const walk = (val: unknown, path: string): unknown => {
    if (Array.isArray(val)) {
      return val.map((item, idx) => walk(item, `${path}[${idx}]`))
    }
    if (!val || typeof val !== 'object') return val

    const src = val as Record<string, unknown>
    const out: Record<string, unknown> = {}

    for (const [key, raw] of Object.entries(src)) {
      const currentPath = `${path}.${key}`
      if (typeof raw === 'string' && EMOJI_TEXT_KEYS.has(key)) {
        const stripped = stripEmojiGlyphs(raw)
        if (stripped.removed > 0) {
          touchedFields++
          removedGlyphs += stripped.removed
          const compact = stripped.value.replace(/\s{2,}/g, ' ').trim()
          if (!compact) {
            const fallback = fallbackForKey(key)
            out[key] = fallback
            fallbackFields++
            notes.push(`${currentPath}: removed emoji-only text and applied fallback "${fallback}"`)
          } else {
            out[key] = compact
            notes.push(`${currentPath}: removed ${stripped.removed} emoji glyph(s)`) 
          }
          continue
        }
      }

      out[key] = walk(raw, currentPath)
    }

    return out
  }

  return {
    value: walk(input, 'layout'),
    notes,
    touchedFields,
    removedGlyphs,
    fallbackFields,
  }
}

function normalizeAiLayoutQuality(input: unknown): { value: unknown; notes: string[] } {
  const notes: string[] = []

  const walk = (val: unknown, path: string): unknown => {
    if (Array.isArray(val)) {
      return val.map((item, idx) => walk(item, `${path}[${idx}]`))
    }

    if (!val || typeof val !== 'object') return val

    const src = val as Record<string, unknown>
    const out: Record<string, unknown> = {}

    for (const [key, raw] of Object.entries(src)) {
      const p = `${path}.${key}`

      if ((key === 'padding' || key === 'gap') && (typeof raw === 'number' || typeof raw === 'string')) {
        const n = Number(raw)
        if (!Number.isNaN(n) && n > 32) {
          out[key] = 32
          notes.push(`${p}: clamped ${key} to 32`)
          continue
        }
      }

      if (/^borderRadius/i.test(key) && (typeof raw === 'number' || typeof raw === 'string')) {
        const n = Number(raw)
        if (!Number.isNaN(n) && n > 24) {
          out[key] = 24
          notes.push(`${p}: clamped ${key} to 24`)
          continue
        }
      }

      if (key === 'content' && typeof raw === 'string') {
        const lower = raw.toLowerCase()
        if (FORBIDDEN_PLACEHOLDER_TEXT.some((t) => lower.includes(t))) {
          out[key] = 'Ready'
          notes.push(`${p}: replaced placeholder text`)
          continue
        }
      }

      out[key] = walk(raw, p)
    }

    return out
  }

  return { value: walk(input, 'layout'), notes }
}

function isValidScreenLayoutPayload(layout: unknown): boolean {
  if (!layout || typeof layout !== 'object') return false
  const obj = layout as Record<string, unknown>

  // Accept wrapped payloads ({ root: Node, ... })
  if (obj.root && typeof obj.root === 'object') {
    const root = obj.root as Record<string, unknown>
    return typeof root.id === 'string' && typeof root.type === 'string'
  }

  // Accept bare node payloads ({ id, type, ... })
  return typeof obj.id === 'string' && typeof obj.type === 'string'
}

function parseRawEvent(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null
  if (typeof raw === 'object') return raw as Record<string, unknown>
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try { return JSON.parse(raw) } catch { return null }
  }
  return null
}

function collectTargetScreenIds(node: unknown): string[] {
  if (!node || typeof node !== 'object') return []
  const out: string[] = []
  const record = node as Record<string, unknown>
  const props = (record.props as Record<string, unknown> | undefined) ?? {}
  for (const key of NAV_EVENT_KEYS) {
    const value = props[key]
    const raws = Array.isArray(value) ? value : value ? [value] : []
    for (const raw of raws) {
      const parsed = parseRawEvent(raw)
      if (!parsed) continue
      if (parsed.action === 'navigate' && typeof parsed.targetScreenId === 'string') {
        out.push(parsed.targetScreenId)
      }
      const steps = parsed.steps
      if (Array.isArray(steps)) {
        for (const step of steps) {
          const parsedStep = parseRawEvent(step)
          if (parsedStep?.action === 'navigate' && typeof parsedStep.targetScreenId === 'string') {
            out.push(parsedStep.targetScreenId)
          }
        }
      }
    }
  }
  const children = Array.isArray(record.children) ? record.children : []
  for (const child of children) out.push(...collectTargetScreenIds(child))
  return out
}

function validatePlannedScreenConnectivity(actions: CortexAction[]): ActionResult | null {
  const screenCreates = actions.filter((action): action is Extract<CortexAction, { type: 'create_screen' }> => action.type === 'create_screen')
  if (screenCreates.length <= 1) return null

  const keys = screenCreates.map((_, index) => `$screen${index + 1}Id`)
  const graph = new Map<string, Set<string>>()
  for (const key of keys) graph.set(key, new Set())

  screenCreates.forEach((action, index) => {
    const sourceKey = keys[index]
    const layout = (action.params.layout as Record<string, unknown> | undefined) ?? {}
    const root = (layout.root as Record<string, unknown> | undefined) ?? layout
    const targets = collectTargetScreenIds(root)
    for (const target of targets) {
      if (graph.has(target)) graph.get(sourceKey)?.add(target)
    }
  })

  const visited = new Set<string>()
  const queue = [keys[0]]
  while (queue.length > 0) {
    const current = queue.shift() as string
    if (visited.has(current)) continue
    visited.add(current)
    for (const next of Array.from(graph.get(current) ?? [])) {
      if (!visited.has(next)) queue.push(next)
    }
  }

  if (visited.size === keys.length) return null

  const missing = keys
    .map((key, index) => ({ key, name: screenCreates[index].params.name }))
    .filter(({ key }) => !visited.has(key))
    .map(({ name }) => name)

  return {
    type: 'validate_navigation',
    success: false,
    error: `Multi-screen app is disconnected. Missing navigation path to: ${missing.join(', ')}`,
    data: { reachableScreens: visited.size, totalScreens: keys.length, missing },
  }
}

function injectApiValidationActions(actions: CortexAction[]): CortexAction[] {
  const normalized: CortexAction[] = []

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]
    normalized.push(action)

    if (action.type !== 'create_api_source' && action.type !== 'update_datasource') continue

    const nextAction = actions[i + 1]
    if (nextAction?.type === 'validate_api') continue

    normalized.push({
      type: 'validate_api',
      params: {
        projectId: action.params.projectId,
        sourceId: action.type === 'create_api_source' ? '$lastSourceId' : action.params.sourceId,
      },
    })
  }

  return normalized
}

/**
 * Execute a single Cortex action. All actions are done server-side via Prisma.
 */
export async function executeAction(
  action: CortexAction,
  userId: string,
  organizationId: string
): Promise<ActionResult> {
  // sanitize layout objects produced by AI to avoid runtime errors like
  // "Cannot read properties of undefined (reading 'toLowerCase')".
  // Recursively walk any layout and wrap `.toLowerCase()` calls with
  // `String(...||'').toLowerCase()` so undefined values become harmless.
  const _sanitizedExpressions: string[] = []
  const _qualityNormalizationNotes: string[] = []
  const sanitize = (val: unknown): unknown => {
    if (typeof val === 'string') {
      // replace occurrences of X.toLowerCase() with String(X||'').toLowerCase()
      return val.replace(/([^\s]+?)\.toLowerCase\(\)/g, (m, group) => {
        // strip trailing '?' from optional chaining
        const expr = group.endsWith('?') ? group.slice(0, -1) : group
        _sanitizedExpressions.push(`[Cortex Sanitizer] AI wrote: "${m}" → fixed to: "String(${expr}||'').toLowerCase()"`)
        return `String(${expr}||'').toLowerCase()`
      })
    }
    if (Array.isArray(val)) return val.map(sanitize)
    if (val && typeof val === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        out[k] = sanitize(v)
      }
      return out
    }
    return val
  }

  // Log any sanitized expressions so devs can see what the AI tried to do
  const _flushSanitizeLog = () => {
    if (_sanitizedExpressions.length > 0) {
      console.warn(`\n⚠️  Cortex Sanitizer caught ${_sanitizedExpressions.length} unsafe expression(s) from AI output:`)
      _sanitizedExpressions.forEach(msg => console.warn('  ', msg))
      _sanitizedExpressions.length = 0
    }
    if (_qualityNormalizationNotes.length > 0) {
      console.warn(`\n⚠️  Cortex Quality Normalizer adjusted ${_qualityNormalizationNotes.length} layout field(s):`)
      _qualityNormalizationNotes.forEach(msg => console.warn('  ', msg))
      _qualityNormalizationNotes.length = 0
    }
  }

  try {
    switch (action.type) {
      case 'create_project': {
        const nameStr = String(action.params.name || '')
        const slug = nameStr
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
        const project = await prisma.project.create({
          data: {
            name: action.params.name ?? nameStr,
            slug: slug + '-' + randomUUID().slice(0, 6),
            description: action.params.description ?? '',
            userId,
            organizationId,
            status: 'draft',
          },
        })
        return { type: action.type, success: true, data: { projectId: project.id, name: project.name, slug: project.slug } }
      }

      case 'create_screen': {
        const defaultLayout = {
          id: 'root',
          type: 'container',
          props: { display: 'flex', flexDirection: 'column', gap: 8, padding: 12, minHeight: 48 },
          children: [],
        }
        const rawLayout = action.params.layout ?? defaultLayout
        const sanitizedLayout = sanitize(rawLayout)
        const emojiSanitized = sanitizeLayoutEmojiText(sanitizedLayout)
        _qualityNormalizationNotes.push(...emojiSanitized.notes)
        if (emojiSanitized.touchedFields >= 10 || emojiSanitized.fallbackFields >= 4) {
          return {
            type: action.type,
            success: false,
            error: `Rejected layout: emoji-heavy UI text (${emojiSanitized.touchedFields} fields, ${emojiSanitized.removedGlyphs} glyphs). Use icon components and plain labels.`,
          }
        }
        const migratedLayout = migrateLayout(emojiSanitized.value ?? sanitizedLayout)
        const normalized = normalizeAiLayoutQuality(emojiSanitized.value ?? migratedLayout)
        _qualityNormalizationNotes.push(...normalized.notes)
        const layoutObj = migrateLayout(normalized.value ?? migratedLayout) as any
        // Keep screen order deterministic for multi-screen AI generation.
        // If sortOrder is not provided, append to the end of the project's screen list.
        const sortOrder = typeof action.params.sortOrder === 'number'
          ? action.params.sortOrder
          : (((await prisma.appScreen.aggregate({ where: { projectId: action.params.projectId }, _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1)
        _flushSanitizeLog()
        const screen = await prisma.appScreen.create({
          data: {
            id: action.params.screenId,
            projectId: action.params.projectId,
            name: action.params.name,
            slug: action.params.slug,
            layout: layoutObj,
            script: action.params.script ?? null,
            sortOrder,
          },
        })
        return {
          type: action.type,
          success: true,
          data: {
            screenId: screen.id,
            name: screen.name,
            slug: screen.slug,
            qualityGate: {
              emojiTouchedFields: emojiSanitized.touchedFields,
              emojiRemovedGlyphs: emojiSanitized.removedGlyphs,
              emojiFallbackFields: emojiSanitized.fallbackFields,
            },
          },
        }
      }

      case 'update_screen': {
        // Check if screen is AI-protected
        const existingScreen = await prisma.appScreen.findUnique({ where: { id: action.params.screenId }, select: { layout: true, name: true } })
        if (existingScreen) {
          const existingLayout = existingScreen.layout as Record<string, unknown> | null
          if (existingLayout?.aiProtected === true) {
            return { type: action.type, success: false, error: `Screen "${existingScreen.name}" is locked from AI modifications. The user has protected this screen.` }
          }
        }
        const updateData: Record<string, unknown> = {}
        if (action.params.name) updateData.name = action.params.name
        if (action.params.slug) updateData.slug = action.params.slug
        if (action.params.layout) {
          if (!isValidScreenLayoutPayload(action.params.layout)) {
            return {
              type: action.type,
              success: false,
              error: `Rejected malformed layout update for screen "${existingScreen?.name ?? action.params.screenId}". Existing layout was preserved.`,
            }
          }
          const sanitizedLayout = sanitize(action.params.layout)
          const emojiSanitized = sanitizeLayoutEmojiText(sanitizedLayout)
          _qualityNormalizationNotes.push(...emojiSanitized.notes)
          if (emojiSanitized.touchedFields >= 10 || emojiSanitized.fallbackFields >= 4) {
            return {
              type: action.type,
              success: false,
              error: `Rejected layout update: emoji-heavy UI text (${emojiSanitized.touchedFields} fields, ${emojiSanitized.removedGlyphs} glyphs). Use icon components and plain labels.`,
            }
          }
          const normalized = normalizeAiLayoutQuality(emojiSanitized.value)
          _qualityNormalizationNotes.push(...normalized.notes)
          updateData.layout = migrateLayout(normalized.value)
          updateData.__qualityGate = {
            emojiTouchedFields: emojiSanitized.touchedFields,
            emojiRemovedGlyphs: emojiSanitized.removedGlyphs,
            emojiFallbackFields: emojiSanitized.fallbackFields,
          }
        }
        _flushSanitizeLog()
        if (action.params.script !== undefined) updateData.script = action.params.script
        if (action.params.sortOrder !== undefined) updateData.sortOrder = action.params.sortOrder
        const qualityGate = (updateData.__qualityGate as Record<string, number> | undefined)
        delete updateData.__qualityGate
        const screen = await prisma.appScreen.update({
          where: { id: action.params.screenId },
          data: updateData,
        })
        return { type: action.type, success: true, data: { screenId: screen.id, name: screen.name, qualityGate } }
      }

      case 'delete_screen': {
        // Check if screen is AI-protected
        const protectedCheck = await prisma.appScreen.findUnique({ where: { id: action.params.screenId }, select: { layout: true, name: true } })
        if (protectedCheck) {
          const protectedLayout = protectedCheck.layout as Record<string, unknown> | null
          if (protectedLayout?.aiProtected === true) {
            return { type: action.type, success: false, error: `Screen "${protectedCheck.name}" is locked from AI modifications. The user has protected this screen.` }
          }
        }
        await prisma.appScreen.delete({ where: { id: action.params.screenId } })
        return { type: action.type, success: true, data: { deleted: action.params.screenId } }
      }

      case 'validate_api': {
        try {
          const result = await validateApiSource({
            projectId: action.params.projectId,
            sourceId: action.params.sourceId,
            urlOverride: action.params.urlOverride,
            limit: 3,
          })
          return { type: action.type, success: result.success ?? false, data: result }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          return { type: action.type, success: false, error: `Sandbox validation failed: ${msg}`, data: null }
        }
      }

      case 'create_table': {
        // Ensure datasource exists
        let ds = await prisma.internalDatasource.findUnique({ where: { projectId: action.params.projectId } })
        if (!ds) {
          ds = await prisma.internalDatasource.create({ data: { projectId: action.params.projectId } })
        }
        const table = await prisma.internalTable.create({
          data: { datasourceId: ds.id, name: action.params.name },
        })
        // Create columns
        for (let i = 0; i < action.params.columns.length; i++) {
          const col = action.params.columns[i]
          await prisma.internalColumn.create({
            data: {
              tableId: table.id,
              name: col.name,
              type: col.type,
              options: col.options ?? {},
              sortOrder: i,
            },
          })
        }
        return { type: action.type, success: true, data: { tableId: table.id, name: table.name, columns: action.params.columns.length } }
      }

      case 'add_rows': {
        const created: string[] = []
        for (const rowData of action.params.rows) {
          const row = await prisma.internalRow.create({
            data: {
              tableId: action.params.tableId,
              data: rowData as object,
              createdBy: userId,
            },
          })
          created.push(row.id)
        }
        return { type: action.type, success: true, data: { rowIds: created, count: created.length } }
      }

      case 'update_row': {
        // Resolve table either by explicit id or by table name inside the project's internal datasource.
        let tableId = action.params.tableId
        if (!tableId && action.params.tableName) {
          const ds = await prisma.internalDatasource.findUnique({ where: { projectId: action.params.projectId } })
          if (!ds) {
            return { type: action.type, success: false, error: `No internal datasource found for project ${action.params.projectId}` }
          }
          const table = await prisma.internalTable.findFirst({
            where: {
              datasourceId: ds.id,
              name: { equals: action.params.tableName, mode: 'insensitive' },
            },
            select: { id: true },
          })
          if (!table) {
            return { type: action.type, success: false, error: `Table not found by name: ${action.params.tableName}` }
          }
          tableId = table.id
        }

        if (!tableId) {
          return { type: action.type, success: false, error: 'update_row requires tableId or tableName' }
        }

        // Resolve row by real UUID id first. If AI sends positional ids like "1", map to 1-based row index.
        let row = await prisma.internalRow.findFirst({
          where: { id: action.params.rowId, tableId },
          select: { id: true, data: true },
        })

        if (!row && /^\d+$/.test(action.params.rowId)) {
          const idx = Number(action.params.rowId)
          if (idx > 0) {
            const byIndex = await prisma.internalRow.findMany({
              where: { tableId },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              skip: idx - 1,
              take: 1,
              select: { id: true, data: true },
            })
            row = byIndex[0] ?? null
          }
        }

        if (!row) {
          return { type: action.type, success: false, error: `Row not found: ${action.params.rowId}` }
        }

        let patchData: Record<string, unknown>
        if (typeof action.params.rowData === 'string') {
          try {
            const parsed = JSON.parse(action.params.rowData)
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              return { type: action.type, success: false, error: 'rowData string must parse to an object' }
            }
            patchData = parsed as Record<string, unknown>
          } catch {
            return { type: action.type, success: false, error: 'rowData string is not valid JSON' }
          }
        } else if (action.params.rowData && typeof action.params.rowData === 'object' && !Array.isArray(action.params.rowData)) {
          patchData = action.params.rowData as Record<string, unknown>
        } else {
          return { type: action.type, success: false, error: 'rowData must be an object or JSON object string' }
        }

        const current = (row.data && typeof row.data === 'object' && !Array.isArray(row.data))
          ? (row.data as Record<string, unknown>)
          : {}
        const merged = { ...current, ...patchData }

        const updated = await prisma.internalRow.update({
          where: { id: row.id },
          data: { data: merged as object },
        })

        return { type: action.type, success: true, data: { rowId: updated.id, tableId } }
      }

      case 'delete_table': {
        await prisma.internalTable.delete({ where: { id: action.params.tableId } })
        return { type: action.type, success: true, data: { deleted: action.params.tableId } }
      }

      case 'create_api_source': {
        const source = await prisma.externalApiSource.create({
          data: {
            projectId: action.params.projectId,
            name: action.params.name,
            url: action.params.url,
            method: action.params.method ?? 'GET',
            headers: (action.params.headers as object) ?? {},
            body: action.params.body ?? null,
            authType: action.params.authType ?? 'none',
            authValue: action.params.authValue ?? null,
          },
        })
        return { type: action.type, success: true, data: { sourceId: source.id, name: source.name } }
      }

      case 'create_webhook': {
        const raw = action.params as unknown as {
          name?: string
          url?: string
          targetUrl?: string
          events?: string[]
          eventType?: string
          event?: string
          secret?: string
        }
        const url = typeof raw.url === 'string' && raw.url.trim().length > 0
          ? raw.url.trim()
          : (typeof raw.targetUrl === 'string' ? raw.targetUrl.trim() : '')

        const events = Array.isArray(raw.events)
          ? raw.events.filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
          : (typeof raw.eventType === 'string' && raw.eventType.trim().length > 0
              ? [raw.eventType.trim()]
              : (typeof raw.event === 'string' && raw.event.trim().length > 0 ? [raw.event.trim()] : []))

        if (!url) {
          return { type: action.type, success: false, error: 'Webhook url is required (accepted keys: url, targetUrl).' }
        }
        if (events.length === 0) {
          return { type: action.type, success: false, error: 'Webhook events are required (accepted keys: events[], eventType, event).' }
        }

        const wh = await prisma.projectWebhook.create({
          data: {
            projectId: action.params.projectId,
            name: action.params.name,
            url,
            events,
            secret: raw.secret ?? null,
          },
        })
        return { type: action.type, success: true, data: { webhookId: wh.id, name: wh.name } }
      }

      case 'update_project': {
        const pData: Record<string, unknown> = {}
        if (action.params.name) pData.name = action.params.name
        if (action.params.description !== undefined) pData.description = action.params.description
        if (action.params.seoDefaults) pData.seoDefaults = action.params.seoDefaults
        if (action.params.faviconUrl) pData.faviconUrl = action.params.faviconUrl
        if (action.params.customDomain) pData.customDomain = action.params.customDomain
        const proj = await prisma.project.update({
          where: { id: action.params.projectId },
          data: pData,
        })
        return { type: action.type, success: true, data: { projectId: proj.id, name: proj.name } }
      }

      case 'update_globals': {
        // Globals are stored on a pseudo-screen with slug '__globals__'
        const existing = await prisma.appScreen.findFirst({
          where: { projectId: action.params.projectId, slug: '__globals__' },
        })
        const currentLayout = (existing?.layout as Record<string, unknown>) || {}

        // Merge reusables by ID (upsert) rather than replacing the whole array.
        // This lets the AI add or update a single reusable without knowing all existing ones.
        let mergedReusables: unknown[]
        if (action.params.reusables !== undefined) {
          const incoming = Array.isArray(action.params.reusables) ? action.params.reusables as Record<string, unknown>[] : []
          const existingReusables = Array.isArray(currentLayout.reusables) ? currentLayout.reusables as Record<string, unknown>[] : []
          const existingMap = new Map(existingReusables.map(r => [r.id as string, r]))
          for (const r of incoming) {
            if (r && typeof r === 'object' && typeof r.id === 'string') {
              existingMap.set(r.id, r)
            }
          }
          mergedReusables = Array.from(existingMap.values())
        } else {
          mergedReusables = Array.isArray(currentLayout.reusables) ? currentLayout.reusables as unknown[] : []
        }

        const globalsData: Record<string, unknown> = {
          reusables: mergedReusables,
          globalState: action.params.globalState !== undefined ? action.params.globalState : (currentLayout.globalState ?? []),
          globalTheme: action.params.globalTheme !== undefined ? action.params.globalTheme : (currentLayout.globalTheme ?? {}),
        }
        const nextLayout = { ...currentLayout, ...globalsData } as Prisma.InputJsonValue
        if (existing) {
          await prisma.appScreen.update({
            where: { id: existing.id },
            data: {
              layout: nextLayout,
            },
          })
        } else {
          await prisma.appScreen.create({
            data: {
              projectId: action.params.projectId,
              name: 'Globals',
              slug: '__globals__',
              layout: globalsData as Prisma.InputJsonValue,
            },
          })
        }
        return { type: action.type, success: true, data: { updated: 'globals', reusablesCount: mergedReusables.length } }
      }

      case 'update_table': {
        const updateData: Record<string, unknown> = {}
        if (action.params.name) updateData.name = action.params.name
        if (updateData.name) {
          await prisma.internalTable.update({ where: { id: action.params.tableId }, data: updateData })
        }
        if (action.params.columns) {
          // Delete existing columns and recreate (simple strategy for AI edits)
          await prisma.internalColumn.deleteMany({ where: { tableId: action.params.tableId } })
          for (let i = 0; i < action.params.columns.length; i++) {
            const col = action.params.columns[i]
            await prisma.internalColumn.create({
              data: { tableId: action.params.tableId, name: col.name, type: col.type, options: col.options ?? {}, sortOrder: i },
            })
          }
        }
        return { type: action.type, success: true, data: { tableId: action.params.tableId } }
      }

      case 'delete_rows': {
        const deleted: string[] = []
        for (const rowId of action.params.rowIds) {
          await prisma.internalRow.delete({ where: { id: rowId } })
          deleted.push(rowId)
        }
        return { type: action.type, success: true, data: { deleted, count: deleted.length } }
      }

      case 'update_datasource': {
        const srcData: Record<string, unknown> = {}
        if (action.params.name) srcData.name = action.params.name
        if (action.params.url) srcData.url = action.params.url
        if (action.params.method) srcData.method = action.params.method
        if (action.params.headers) srcData.headers = action.params.headers as object
        if (action.params.body !== undefined) srcData.body = action.params.body
        if (action.params.authType) srcData.authType = action.params.authType
        if (action.params.authValue !== undefined) srcData.authValue = action.params.authValue
        const src = await prisma.externalApiSource.update({ where: { id: action.params.sourceId }, data: srcData })
        return { type: action.type, success: true, data: { sourceId: src.id, name: src.name } }
      }

      case 'delete_api_source': {
        await prisma.externalApiSource.delete({ where: { id: action.params.sourceId } })
        return { type: action.type, success: true, data: { deleted: action.params.sourceId } }
      }

      case 'update_webhook': {
        const whData: Record<string, unknown> = {}
        if (action.params.name) whData.name = action.params.name
        if (action.params.url) whData.url = action.params.url
        if (action.params.events) whData.events = action.params.events
        if (action.params.secret !== undefined) whData.secret = action.params.secret
        const wh = await prisma.projectWebhook.update({ where: { id: action.params.webhookId }, data: whData })
        return { type: action.type, success: true, data: { webhookId: wh.id, name: wh.name } }
      }

      default:
        return { type: (action as { type: string }).type, success: false, error: `Unknown action type: ${(action as { type: string }).type}` }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { type: action.type, success: false, error: msg }
  }
}

/**
 * Recursively replace placeholder strings in an object.
 * $lastProjectId, $lastScreenId, $lastTableId get substituted with real IDs.
 */
function resolvePlaceholders(
  params: Record<string, unknown>,
  vars: Record<string, string>
): void {
  for (const key of Object.keys(params)) {
    const val = params[key]
    if (typeof val === 'string') {
      let resolved = val
      for (const [placeholder, id] of Object.entries(vars)) {
        resolved = resolved.split(placeholder).join(id)
      }
      params[key] = resolved
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      resolvePlaceholders(val as Record<string, unknown>, vars)
    } else if (Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item === 'object') {
          resolvePlaceholders(item as Record<string, unknown>, vars)
        }
      }
    }
  }
}

/**
 * Execute multiple actions sequentially, collecting results.
 * Actions can use these placeholders which get replaced with real IDs after each step:
 *   $lastProjectId  — ID of the last created project
 *   $lastScreenId   — ID of the last created screen (same as $screenNId for most recent)
 *   $lastTableId    — ID of the last created table (same as $tableNId for most recent)
 *   $lastSourceId   — ID of the last created API source
 *   $table1Id       — ID of the 1st created table in this response
 *   $table2Id       — ID of the 2nd created table
 *   $table3Id / $table4Id / $table5Id — 3rd–5th tables
 *   $screen1Id      — ID of the 1st created screen
 *   $screen2Id / $screen3Id / $screen4Id / $screen5Id — 2nd–5th screens
 */
export async function executeActions(
  actions: CortexAction[],
  userId: string,
  organizationId: string
): Promise<ActionResult[]> {
  const normalizedActions = injectApiValidationActions(actions)
  const navValidation = validatePlannedScreenConnectivity(normalizedActions)
  if (navValidation) return [navValidation]

  const results: ActionResult[] = []
  const vars: Record<string, string> = {}
  const preassignedScreenIds = normalizedActions
    .filter((action): action is Extract<CortexAction, { type: 'create_screen' }> => action.type === 'create_screen')
    .map(() => randomUUID())
  preassignedScreenIds.forEach((id, idx) => {
    vars[`$screen${idx + 1}Id`] = id
  })
  let tableCount = 0
  let screenCount = 0

  // Critical action types — if these fail, abort remaining actions.
  // validate_api is intentionally non-critical so app generation can continue
  // with fallback UX when one external endpoint is down.
  const criticalTypes = new Set(['create_project', 'create_screen', 'create_table'])

  for (const action of normalizedActions) {
    if (action.type === 'create_screen') {
      const preassignedId = preassignedScreenIds[screenCount]
      if (preassignedId) {
        action.params.screenId = preassignedId
      }
    }

    // Replace all placeholders in params before executing
    if (Object.keys(vars).length > 0) {
      resolvePlaceholders(action.params as Record<string, unknown>, vars)
    }

    const result = await executeAction(action, userId, organizationId)
    results.push(result)

    // Abort chain if a critical action fails (downstream actions depend on its ID)
    if (!result.success && criticalTypes.has(action.type)) {
      break
    }

    // Track IDs for chaining
    if (result.success && result.data) {
      const d = result.data as Record<string, string>
      if (action.type === 'create_project' && d.projectId) {
        vars['$lastProjectId'] = d.projectId
      }
      if (action.type === 'create_screen' && d.screenId) {
        screenCount++
        vars['$lastScreenId'] = d.screenId
        vars[`$screen${screenCount}Id`] = d.screenId
      }
      if (action.type === 'create_table' && d.tableId) {
        tableCount++
        vars['$lastTableId'] = d.tableId
        vars[`$table${tableCount}Id`] = d.tableId
      }
      if (action.type === 'create_api_source' && d.sourceId) {
        vars['$lastSourceId'] = d.sourceId
      }
    }
  }

  return results
}

export type ActionProgressEvent =
  | { type: 'action_start'; actionType: string; index: number }
  | { type: 'action_done'; actionType: string; index: number; result: ActionResult }

/**
 * Execute actions sequentially with per-action progress callbacks for SSE streaming.
 */
export async function executeActionsStreaming(
  actions: CortexAction[],
  userId: string,
  organizationId: string,
  onProgress: (event: ActionProgressEvent) => void
): Promise<ActionResult[]> {
  const normalizedActions = injectApiValidationActions(actions)
  const navValidation = validatePlannedScreenConnectivity(normalizedActions)
  if (navValidation) {
    onProgress({ type: 'action_start', actionType: 'validate_navigation', index: -1 })
    onProgress({ type: 'action_done', actionType: 'validate_navigation', index: -1, result: navValidation })
    return [navValidation]
  }

  const results: ActionResult[] = []
  const vars: Record<string, string> = {}
  const preassignedScreenIds = normalizedActions
    .filter((action): action is Extract<CortexAction, { type: 'create_screen' }> => action.type === 'create_screen')
    .map(() => randomUUID())
  preassignedScreenIds.forEach((id, idx) => {
    vars[`$screen${idx + 1}Id`] = id
  })
  let tableCount = 0
  let screenCount = 0

  const criticalTypes = new Set(['create_project', 'create_screen', 'create_table'])

  for (let i = 0; i < normalizedActions.length; i++) {
    const action = normalizedActions[i]

    if (action.type === 'create_screen') {
      const preassignedId = preassignedScreenIds[screenCount]
      if (preassignedId) {
        action.params.screenId = preassignedId
      }
    }

    if (Object.keys(vars).length > 0) {
      resolvePlaceholders(action.params as Record<string, unknown>, vars)
    }

    onProgress({ type: 'action_start', actionType: action.type, index: i })
    const result = await executeAction(action, userId, organizationId)
    results.push(result)
    onProgress({ type: 'action_done', actionType: action.type, index: i, result })

    if (!result.success && criticalTypes.has(action.type)) {
      break
    }

    if (result.success && result.data) {
      const d = result.data as Record<string, string>
      if (action.type === 'create_project' && d.projectId) vars['$lastProjectId'] = d.projectId
      if (action.type === 'create_screen' && d.screenId) {
        screenCount++
        vars['$lastScreenId'] = d.screenId
        vars[`$screen${screenCount}Id`] = d.screenId
      }
      if (action.type === 'create_table' && d.tableId) {
        tableCount++
        vars['$lastTableId'] = d.tableId
        vars[`$table${tableCount}Id`] = d.tableId
      }
      if (action.type === 'create_api_source' && d.sourceId) vars['$lastSourceId'] = d.sourceId
    }
  }

  return results
}
