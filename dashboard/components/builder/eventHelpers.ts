/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Helpers exposed to event expressions and scripts (Budibase-style).
 * Documented for the Events tab so users can reference state, data, DateTime, Math, etc.
 */
export const EVENT_HELPERS = {
  DateTime: [
    { name: 'DateTime.now()', desc: 'Current date/time (Date object)' },
    { name: 'DateTime.format(date, "YYYY-MM-DD")', desc: 'Format date (use any format string)' },
    { name: 'DateTime.today()', desc: 'Date only, no time' },
    { name: 'DateTime.addDays(date, n)', desc: 'Add n days' },
  ],
  Math: [
    { name: 'Math.round(n)', desc: 'Round to integer' },
    { name: 'Math.min(a, b)', desc: 'Minimum' },
    { name: 'Math.max(a, b)', desc: 'Maximum' },
    { name: 'Math.abs(n)', desc: 'Absolute value' },
    { name: 'Math.floor(n) / Math.ceil(n)', desc: 'Round down/up' },
  ],
  State: [
    { name: '{{state.name}}', desc: 'Read state variable' },
    { name: 'Set state in action', desc: 'Use "Set state" action type' },
  ],
  Event: [
    { name: '{{event.type}}', desc: 'Current event name (onClick, onPressIn, ...)' },
    { name: '{{event.value}} / {{event.checked}}', desc: 'Callback payload from inputs/toggles' },
    { name: '{{event.pressed}}', desc: 'Gesture press state for press in/out' },
  ],
  Data: [
    { name: '{{data.sourceName.field}}', desc: 'Read from data source' },
  ],
  Compare: [
    { name: '=== / !== / > / < / >= / <=', desc: 'Comparisons in conditions' },
    { name: 'Run only when', desc: 'Left (state/data) op Right (literal or binding)' },
  ],
} as const

export type EventActionType =
  | 'setState'
  | 'mutateState'
  | 'runScript'
  | 'navigate'
  | 'goBack'
  | 'alert'
  | 'log'
  | 'haptic'
  | 'speak'
  | 'playAudio'
  | 'uploadFile'
  | 'insertRow'
  | 'updateRow'
  | 'deleteRow'
  | 'startAnimationSequence'
  | 'stopAnimationSequence'
  | 'resetAnimationSequence'
  | 'startAnimationStep'
  | 'custom'
export type MutationOp = 'increment' | 'decrement' | 'toggle' | 'multiply' | 'append'
export type EventCondition = { left: string; op: string; right: string }
export type EventActionConfig = {
  action: EventActionType
  stateKey?: string
  value?: string
  /** If true, persist this state value in localStorage for this screen. */
  cacheValue?: boolean
  /** For mutateState action: operation to apply (increment, decrement, toggle, multiply, append) */
  mutationOp?: MutationOp
  /** For mutateState action: custom amount (e.g., "2" for multiply by 2, or text to append) */
  mutationAmount?: string
  scriptName?: string
  url?: string
  targetScreenId?: string
  targetScreenType?: 'page' | 'modal' | 'sidebar'
  /** Key-value pairs to pass to the target screen as {{navProp.key}} bindings. Values support binding expressions. */
  navProps?: Record<string, string>
  message?: string
  customScript?: string
  condition?: EventCondition
  // haptic
  hapticPreset?: string  // 'success'|'error'|'warning'|'light'|'medium'|'heavy'|'selection'|'custom'
  hapticCustom?: string  // raw pattern: e.g. '100,50,100' or '[{"duration":50},{"delay":50,"duration":50}]'
  // speak (TTS)
  speakText?: string
  speakRate?: string
  speakPitch?: string
  // playAudio
  audioUrl?: string
  audioAssetId?: string
  // uploadFile
  uploadStateKey?: string
  uploadUrl?: string
  uploadLoadingStateKey?: string
  // CRUD (insertRow / updateRow / deleteRow)
  tableName?: string
  rowData?: string  // JSON string or binding expression → object
  rowId?: string    // binding expression for updateRow/deleteRow
  /** State key to store the result (inserted/updated row or deleted id) */
  resultStateKey?: string
  /** State key to trigger data refresh after mutation (sets a refreshTick) */
  refreshStateKey?: string
  /** Animation target DOM id or node id. Empty means "current component". */
  animationTargetId?: string
  /** 1-based step index used by startAnimationStep action. */
  animationStep?: string
}

export type EventRuntimeContext = {
  type?: string
  value?: unknown
  checked?: boolean
  pressed?: boolean
  key?: string
  x?: number
  y?: number
  targetId?: string
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function coerceActionName(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const key = raw.toLowerCase().replace(/[-_\s]/g, '')
  const map: Record<string, string> = {
    setstate: 'setState',
    setglobalstate: 'setState',
    runscript: 'runScript',
    goback: 'goBack',
    uploadfile: 'uploadFile',
    insertrow: 'insertRow',
    updaterow: 'updateRow',
    deleterow: 'deleteRow',
    openmodal: 'openModal',
    closemodal: 'closeModal',
    togglemodal: 'toggleModal',
    startanimationsequence: 'startAnimationSequence',
    stopanimationsequence: 'stopAnimationSequence',
    resetanimationsequence: 'resetAnimationSequence',
    startanimationstep: 'startAnimationStep',
  }
  return map[key] ?? raw
}

const CONDITION_OPS = [
  { value: '==', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: 'contains', label: 'contains' },
  { value: 'empty', label: 'is empty' },
] as const

/**
 * Normalize AI-generated steps that use the wrong `{type, params}` format.
 * The correct format is `{action, ...flatProps}`.
 * E.g. `{type:"navigate", params:{screenId:"x"}}` → `{action:"navigate", targetScreenId:"x"}`
 */
function normalizeStep(raw: Record<string, unknown>): EventActionConfig {
  const params = (raw.params && typeof raw.params === 'object' ? raw.params : {}) as Record<string, unknown>
  const action = coerceActionName(raw.action ?? raw.type)

  if (!action) return raw as unknown as EventActionConfig

  if (action === 'navigate') {
    const targetScreenId =
      readString(params.targetScreenId)
      ?? readString(params.screenId)
      ?? readString(params.screen)
      ?? readString(params.slug)
      ?? readString(params.id)
      ?? readString(raw.targetScreenId)
      ?? readString(raw.screenId)
      ?? readString(raw.screen)
      ?? readString(raw.slug)
      ?? readString(raw.id)

    const url =
      readString(params.url)
      ?? readString(params.href)
      ?? readString(raw.url)
      ?? readString(raw.href)

    const targetScreenType = (params.targetScreenType ?? raw.targetScreenType) as EventActionConfig['targetScreenType'] | undefined
    const navProps = (params.navProps ?? raw.navProps) as Record<string, string> | undefined
    return {
      action: 'navigate',
      ...(targetScreenId ? { targetScreenId } : {}),
      ...(url ? { url } : {}),
      ...(targetScreenType ? { targetScreenType } : {}),
      ...(navProps && typeof navProps === 'object' ? { navProps } : {}),
    }
  }

  if (action === 'goBack') {
    return { action: 'goBack' }
  }

  if (action === 'setState') {
    return {
      action: 'setState',
      stateKey: String(params.stateKey ?? params.key ?? params.state ?? raw.stateKey ?? raw.key ?? raw.state ?? ''),
      value: String(params.value ?? params.val ?? raw.value ?? raw.val ?? ''),
      ...(typeof params.cacheValue === 'boolean' ? { cacheValue: params.cacheValue } : typeof raw.cacheValue === 'boolean' ? { cacheValue: raw.cacheValue as boolean } : {}),
    }
  }

  if (action === 'openModal' || action === 'closeModal') {
    const stateKey =
      readString(params.modalStateKey)
      ?? readString(params.stateKey)
      ?? readString(params.key)
      ?? readString(raw.modalStateKey)
      ?? readString(raw.stateKey)
      ?? readString(raw.key)
      ?? ''
    return {
      action: 'setState',
      stateKey,
      value: action === 'openModal' ? 'true' : 'false',
    }
  }

  if (action === 'toggleModal') {
    const stateKey =
      readString(params.modalStateKey)
      ?? readString(params.stateKey)
      ?? readString(params.key)
      ?? readString(raw.modalStateKey)
      ?? readString(raw.stateKey)
      ?? readString(raw.key)
      ?? ''
    if (!stateKey) return { action: 'custom', customScript: '' }
    return {
      action: 'custom',
      customScript: `setState("${stateKey.replace(/"/g, '\\"')}", !(state["${stateKey.replace(/"/g, '\\"')}"]));`,
    }
  }

  if (action === 'runScript') {
    return { action: 'runScript', scriptName: String(params.scriptName ?? params.name ?? raw.scriptName ?? raw.name ?? '') }
  }

  if (action === 'alert') {
    return { action: 'alert', message: String(params.message ?? params.text ?? raw.message ?? raw.text ?? '') }
  }

  if (action === 'custom') {
    return { action: 'custom', customScript: String(params.customScript ?? params.script ?? params.code ?? raw.customScript ?? raw.script ?? raw.code ?? '') }
  }

  if (action === 'uploadFile') {
    return {
      action: 'uploadFile',
      uploadStateKey: String(params.uploadStateKey ?? params.stateKey ?? params.key ?? raw.uploadStateKey ?? raw.stateKey ?? raw.key ?? ''),
      uploadUrl: String(params.uploadUrl ?? params.url ?? params.endpoint ?? raw.uploadUrl ?? raw.url ?? raw.endpoint ?? ''),
      uploadLoadingStateKey: String(params.uploadLoadingStateKey ?? params.loadingKey ?? raw.uploadLoadingStateKey ?? raw.loadingKey ?? ''),
    }
  }

  if (action === 'insertRow' || action === 'updateRow' || action === 'deleteRow') {
    return {
      action,
      tableName: String(params.tableName ?? params.table ?? raw.tableName ?? raw.table ?? ''),
      rowData: String(params.rowData ?? params.data ?? raw.rowData ?? raw.data ?? ''),
      rowId: String(params.rowId ?? params.id ?? raw.rowId ?? raw.id ?? ''),
      resultStateKey: String(params.resultStateKey ?? params.resultKey ?? raw.resultStateKey ?? raw.resultKey ?? ''),
      refreshStateKey: String(params.refreshStateKey ?? params.refreshKey ?? raw.refreshStateKey ?? raw.refreshKey ?? ''),
    }
  }

  // Generic fallback: flatten params into the object
  if (Object.keys(params).length > 0) {
    return { action: action as EventActionType, ...params } as unknown as EventActionConfig
  }

  if (typeof raw.action === 'string') return raw as unknown as EventActionConfig

  // Unrecognized shape — return as-is (may fail silently)
  return raw as unknown as EventActionConfig
}

export function parseEventConfig(raw: unknown): EventActionConfig | null {
  if (raw == null) return null
  if (typeof raw === 'object') {
    const normalized = normalizeStep(raw as Record<string, unknown>)
    return normalized.action ? normalized : null
  }
  if (typeof raw !== 'string' || !raw.trim()) return null
  const s = raw.trim()
  if (s.startsWith('{')) {
    try {
      const o = JSON.parse(s) as EventActionConfig
      if (o && typeof o.action === 'string') return o
    } catch (_) {}
  }
  return { action: 'custom', customScript: s }
}

export function stringifyEventConfig(c: EventActionConfig): string {
  if (c.action === 'custom' && c.customScript && !c.condition && Object.keys(c).length <= 2) return c.customScript
  return JSON.stringify(c)
}

/**
 * Parse an event prop value into an array of steps.
 * - New format: `{ steps: [...] }` → returns the array
 * - Old single-config format: any valid EventActionConfig JSON/string → `[config]`
 * - Empty/null → `[]`
 */
export function parseEventSteps(raw: unknown): EventActionConfig[] {
  if (raw == null) return []
  // Handle already-parsed object
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (Array.isArray(o.steps)) return (o.steps as Record<string, unknown>[]).map(normalizeStep)
    if (typeof o.action === 'string' || typeof o.type === 'string') return [normalizeStep(o)]
    return []
  }
  if (typeof raw !== 'string' || !raw.trim()) return []
  const s = raw.trim()
  if (s.startsWith('{')) {
    try {
      const o = JSON.parse(s)
      if (Array.isArray(o.steps)) return (o.steps as Record<string, unknown>[]).map(normalizeStep)
      if (o && (typeof o.action === 'string' || typeof o.type === 'string')) return [normalizeStep(o as Record<string, unknown>)]
    } catch (_) {}
  }
  // Plain script string → single custom step
  return [{ action: 'custom', customScript: s }]
}

/**
 * Stringify an array of steps back to a prop value string.
 * Single-step: uses the old single-config format for backward compat with the runtime.
 * Multi-step: uses `{ steps: [...] }`.
 */
export function stringifyEventSteps(steps: EventActionConfig[]): string {
  if (steps.length === 0) return ''
  if (steps.length === 1) return stringifyEventConfig(steps[0])
  return JSON.stringify({ steps })
}

export { CONDITION_OPS }
