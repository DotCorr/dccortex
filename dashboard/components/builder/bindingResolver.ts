/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Resolve {{state.x}}, {{data.source.field}} in display strings so the UI shows the value, not the variable name.
 * Used in BuilderCanvas when rendering label, content, placeholder, title, etc.
 */
export type ResolveContext = {
  state?: Record<string, unknown>
  data?: Record<string, unknown>
  event?: Record<string, unknown>
  props?: Record<string, unknown>
  /** Navigation params passed via navigate action: accessed as {{navProp.key}} */
  navProp?: Record<string, unknown>
  /** Run a named script with (state, data) and return its value. Used for {{script.name}} bindings. */
  runScript?: (scriptName: string) => unknown
}

const BINDING_REGEX = /\{\{([^}]+)\}\}/g

// ── Live date/time helper ────────────────────────────────────────────────────

/**
 * Returns a map of all live date/time properties resolved at call time.
 * Accessible via {{dateNow.xxx}} — values are never settable; always "now".
 */
export function getDateNowMap(): Record<string, unknown> {
  const now = new Date()
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const y = now.getFullYear()
  const mo = now.getMonth()        // 0-11
  const d = now.getDate()          // 1-31
  const dow = now.getDay()         // 0-6
  const h = now.getHours()
  const mi = now.getMinutes()
  const s = now.getSeconds()
  const ms = now.getMilliseconds()
  const h12 = h % 12 || 12
  const ampm = h < 12 ? 'AM' : 'PM'
  const pad = (n: number) => String(n).padStart(2, '0')
  const startOfYear = new Date(y, 0, 1)
  const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
  const daysInMonth = new Date(y, mo + 1, 0).getDate()
  const isLeapYear = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  return {
    // Granular components
    year:          y,
    month:         mo + 1,
    monthName:     MONTHS[mo],
    monthShort:    MONTHS_SHORT[mo],
    day:           d,
    dayOfWeek:     dow,
    weekday:       DAYS[dow],
    weekdayShort:  DAYS_SHORT[dow],
    hour:          h,
    hour12:        h12,
    minute:        mi,
    second:        s,
    millisecond:   ms,
    ampm,
    quarter:       Math.floor(mo / 3) + 1,
    week:          weekNum,
    daysInMonth,
    isLeapYear,
    isWeekend:     dow === 0 || dow === 6,
    // Formatted strings
    date:          `${y}-${pad(mo + 1)}-${pad(d)}`,
    time:          `${pad(h)}:${pad(mi)}`,
    time12:        `${h12}:${pad(mi)} ${ampm}`,
    timeWithSeconds: `${pad(h)}:${pad(mi)}:${pad(s)}`,
    datetime:      `${y}-${pad(mo + 1)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}`,
    iso:           now.toISOString(),
    locale:        now.toLocaleDateString(),
    localeTime:    now.toLocaleTimeString(),
    localeDateTime: now.toLocaleString(),
    // Short combined formats
    monthDay:      `${MONTHS_SHORT[mo]} ${d}`,
    fullDate:      `${DAYS[dow]}, ${MONTHS[mo]} ${d}, ${y}`,
    // Unix timestamps
    timestamp:     now.getTime(),
    unix:          Math.floor(now.getTime() / 1000),
  }
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.trim().split('.')
  let current: unknown = obj
  for (const p of parts) {
    if (typeof current === 'string') {
      const raw = current.trim()
      if (raw.startsWith('{') || raw.startsWith('[')) {
        try {
          current = JSON.parse(raw) as unknown
        } catch {
          return undefined
        }
      }
    }
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[p]
  }
  return current
}

function findPathInObject(root: unknown, parts: string[], depth = 0): unknown {
  if (!parts.length || root == null || typeof root !== 'object' || depth > 10) return undefined
  const obj = root as Record<string, unknown>
  const direct = getByPath(obj, parts.join('.'))
  if (direct !== undefined) return direct
  for (const value of Object.values(obj)) {
    const nested = findPathInObject(value, parts, depth + 1)
    if (nested !== undefined) return nested
  }
  return undefined
}

function getPreferredNestedValue(sourceRoot: unknown, key: string): unknown {
  if (sourceRoot == null || typeof sourceRoot !== 'object') return undefined
  const obj = sourceRoot as Record<string, unknown>
  const preferredContainers = ['current', 'latest', 'value', 'data']
  for (const container of preferredContainers) {
    const candidate = obj[container]
    if (candidate && typeof candidate === 'object') {
      const value = (candidate as Record<string, unknown>)[key]
      if (value !== undefined) return value
    }
  }
  return undefined
}

function resolveDataPath(data: Record<string, unknown>, path: string): unknown {
  const direct = getByPath(data, path)
  if (direct !== undefined) return direct

  const parts = path.trim().split('.').filter(Boolean)
  if (parts.length < 2) return direct

  const source = parts[0]
  const tail = parts.slice(1)

  const sourceAliases = Array.from(new Set([
    source,
    source.trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase(),
    source.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase(),
    source.trim().replace(/[^a-zA-Z0-9]+/g, '').toLowerCase(),
  ].filter(Boolean)))

  let sourceRoot: unknown = undefined
  for (const alias of sourceAliases) {
    if (Object.prototype.hasOwnProperty.call(data, alias)) {
      sourceRoot = data[alias]
      break
    }
  }

  if ((sourceRoot == null || typeof sourceRoot !== 'object') && sourceRoot === undefined) {
    const sourceCompact = sourceAliases[sourceAliases.length - 1]
    const matchingKey = Object.keys(data).find((key) => {
      const normalized = key.trim().replace(/[^a-zA-Z0-9]+/g, '').toLowerCase()
      return normalized && normalized === sourceCompact
    })
    if (matchingKey) sourceRoot = data[matchingKey]
  }

  if (typeof sourceRoot === 'string') {
    const raw = sourceRoot.trim()
    if (raw.startsWith('{') || raw.startsWith('[')) {
      try {
        sourceRoot = JSON.parse(raw) as unknown
      } catch {
        sourceRoot = undefined
      }
    }
  }

  if (sourceRoot == null || typeof sourceRoot !== 'object') return direct

  if (tail.length === 1) {
    const preferred = getPreferredNestedValue(sourceRoot, tail[0])
    if (preferred !== undefined) return preferred
  }

  const exactPath = findPathInObject(sourceRoot, tail)
  if (exactPath !== undefined) return exactPath

  const normalizedTail = tail.map((p) =>
    p.trim()
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase()
  )
  const normalizedPath = findPathInObject(sourceRoot, normalizedTail)
  if (normalizedPath !== undefined) return normalizedPath

  return direct
}

export function resolveBinding(raw: string, ctx: ResolveContext): string {
  if (typeof raw !== 'string') return String(raw ?? '')
  return raw.replace(BINDING_REGEX, (_, expr) => {
    const e = expr.trim()
    if (e.startsWith('state.')) {
      const v = ctx.state ? getByPath(ctx.state as Record<string, unknown>, e.slice(6).trim()) : undefined
      return v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    }
    if (e.startsWith('data.')) {
      const path = e.slice(5).trim()
      const v = ctx.data ? resolveDataPath(ctx.data, path) : undefined
      return v === undefined || v === null ? '[data]' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    }
    if (e.startsWith('event.')) {
      const path = e.slice(6).trim()
      const v = ctx.event ? getByPath(ctx.event, path) : undefined
      return v === undefined || v === null ? '' : String(v)
    }
    if (e.startsWith('prop.')) {
      const path = e.slice(5).trim()
      const v = ctx.props ? getByPath(ctx.props, path) : undefined
      return v === undefined || v === null ? '' : String(v)
    }
    if (e.startsWith('navProp.')) {
      const path = e.slice(8).trim()
      const v = ctx.navProp ? getByPath(ctx.navProp, path) : undefined
      return v === undefined || v === null ? '' : String(v)
    }
    if (e.startsWith('script.') && ctx.runScript) {
      const scriptName = e.slice(7).trim()
      const v = ctx.runScript(scriptName)
      return v === undefined || v === null ? '' : String(v)
    }
    if (e.startsWith('dateNow.') || e.startsWith('dateTime.')) {
      const key = e.startsWith('dateNow.') ? e.slice(8).trim() : e.slice(9).trim()
      const v = getDateNowMap()[key]
      return v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    }
    // Fallback: bare item-var bindings like {{task.title}} — check ctx.props
    if (ctx.props) {
      const dotIdx = e.indexOf('.')
      const ns = dotIdx > 0 ? e.slice(0, dotIdx) : e
      if (Object.prototype.hasOwnProperty.call(ctx.props, ns)) {
        const v = getByPath(ctx.props, e)
        return v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
      }
    }
    return `{{${expr}}}`
  })
}

export function isBinding(value: unknown): boolean {
  return typeof value === 'string' && /\{\{[^}]+\}\}/.test(value)
}

// ── Structural expression evaluator (no eval / new Function needed) ───────────

/** Extract a runtime value for a single {{...}} token */
function resolveToken(expr: string, ctx: ResolveContext): unknown {
  const e = expr.trim()
  if (e.startsWith('state.'))   return ctx.state ? getByPath(ctx.state as Record<string, unknown>, e.slice(6).trim()) : undefined
  if (e.startsWith('data.'))    return ctx.data    ? resolveDataPath(ctx.data, e.slice(5).trim()) : undefined
  if (e.startsWith('event.'))   return ctx.event   ? getByPath(ctx.event,   e.slice(6).trim()) : undefined
  if (e.startsWith('prop.'))    return ctx.props   ? getByPath(ctx.props,   e.slice(5).trim()) : undefined
  if (e.startsWith('navProp.')) return ctx.navProp ? getByPath(ctx.navProp, e.slice(8).trim()) : undefined
  if (e.startsWith('script.') && ctx.runScript) return ctx.runScript(e.slice(7).trim())
  if (e.startsWith('dateNow.') || e.startsWith('dateTime.')) {
    const key = e.startsWith('dateNow.') ? e.slice(8).trim() : e.slice(9).trim()
    return getDateNowMap()[key]
  }
  // Fallback: bare item-var bindings like {{task.title}} — check ctx.props
  if (ctx.props) {
    const dotIdx = e.indexOf('.')
    const ns = dotIdx > 0 ? e.slice(0, dotIdx) : e
    if (Object.prototype.hasOwnProperty.call(ctx.props, ns)) {
      return getByPath(ctx.props, e)
    }
  }
  return undefined
}

/** Parse a JS literal string like 'hello', "world", 123, true, false, null */
function parseLiteral(s: string): unknown {
  const t = s.trim()
  if (t === 'null')  return null
  if (t === 'true')  return true
  if (t === 'false') return false
  const n = Number(t)
  if (!Number.isNaN(n) && t !== '') return n
  // single or double quoted string
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1)
  }
  return t // unknown — return as-is
}

/** Find the index of needle at paren/bracket depth 0, searching left-to-right from `from` */
function topLevelIdx(s: string, needle: string, from = 0): number {
  let depth = 0
  let inSingle = false
  let inDouble = false
  let escaped = false
  for (let i = from; i <= s.length - needle.length; i++) {
    const c = s[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (c === '\\') {
      escaped = true
      continue
    }
    if (!inDouble && c === "'") {
      inSingle = !inSingle
      continue
    }
    if (!inSingle && c === '"') {
      inDouble = !inDouble
      continue
    }
    if (inSingle || inDouble) continue
    if (c === '(' || c === '[') { depth++; continue }
    if (c === ')' || c === ']') { depth--; continue }
    if (depth === 0 && s.startsWith(needle, i)) return i
  }
  return -1
}

/** Resolve all {{...}} tokens; return a parallel array of segments and their values */
function substituteTokens(raw: string, ctx: ResolveContext): { expr: string; values: Map<string, unknown> } {
  const values = new Map<string, unknown>()
  const substituted = raw.replace(BINDING_REGEX, (match, inner) => {
    const v = resolveToken(inner, ctx)
    values.set(match, v)
    return match // keep the placeholder so we can locate it later
  })
  return { expr: substituted, values }
}

/**
 * Resolve a single operand string — either a {{token}} or a literal.
 * Returns the typed value (string, number, boolean, null).
 */
function resolveOperand(s: string, values: Map<string, unknown>): unknown {
  const t = s.trim()
  // {{token}}
  if (t.startsWith('{{') && t.endsWith('}}')) {
    const v = values.get(t)
    return v === undefined ? null : v
  }
  return parseLiteral(t)
}

function compare(left: unknown, op: string, right: unknown): boolean {
  switch (op) {
    case '===': return left === right
    case '!==': return left !== right
    case '==':  return String(left) === String(right)
    case '!=':  return String(left) !== String(right)
    case '>':   return Number(left) > Number(right)
    case '>=':  return Number(left) >= Number(right)
    case '<':   return Number(left) < Number(right)
    case '<=':  return Number(left) <= Number(right)
    case 'includes':   return String(left).includes(String(right))
    case 'startsWith': return String(left).startsWith(String(right))
    case 'endsWith':   return String(left).endsWith(String(right))
  }
  return false
}

function evalExpr(s: string, values: Map<string, unknown>): unknown {
  s = s.trim()
  if (!s) return ''

  // ── Simple 2-arg math helpers emitted by Expression Builder ──
  for (const fn of ['pow', 'floorDiv', 'min', 'max'] as const) {
    if (s.startsWith(`${fn}(`) && s.endsWith(')')) {
      const inner = s.slice(fn.length + 1, -1)
      const commaIdx = topLevelIdx(inner, ',')
      if (commaIdx > 0) {
        const a = Number(evalExpr(inner.slice(0, commaIdx), values))
        const b = Number(evalExpr(inner.slice(commaIdx + 1), values))
        if (fn === 'pow') return Math.pow(a, b)
        if (fn === 'floorDiv') return b !== 0 ? Math.floor(a / b) : 0
        if (fn === 'min') return Math.min(a, b)
        if (fn === 'max') return Math.max(a, b)
      }
    }
  }

  // ── Ternary: COND ? THEN : ELSE ──
  const qi = topLevelIdx(s, '?')
  if (qi > 0) {
    const ci = topLevelIdx(s, ':', qi + 1)
    if (ci > qi) {
      const condResult = evalExpr(s.slice(0, qi), values)
      const truthy = condResult !== false && condResult !== null &&
                     condResult !== undefined && condResult !== '' &&
                     condResult !== 0 && condResult !== 'false'
      return truthy ? evalExpr(s.slice(qi + 1, ci), values) : evalExpr(s.slice(ci + 1), values)
    }
  }

  // ── Nullish coalescing: A ?? B ──
  const nqi = topLevelIdx(s, '??')
  if (nqi >= 0) {
    const left = evalExpr(s.slice(0, nqi), values)
    return (left === null || left === undefined || left === '') ? evalExpr(s.slice(nqi + 2), values) : left
  }

  // ── Logical OR: A || B ──
  const ori = topLevelIdx(s, '||')
  if (ori >= 0) {
    const left = evalExpr(s.slice(0, ori), values)
    return left ? left : evalExpr(s.slice(ori + 2), values)
  }

  // ── Logical AND: A && B ──
  const andi = topLevelIdx(s, '&&')
  if (andi >= 0) {
    const left = evalExpr(s.slice(0, andi), values)
    return left ? evalExpr(s.slice(andi + 2), values) : left
  }

  // ── String method comparisons ──
  const strM = s.match(/^String\((.+)\)\.(includes|startsWith|endsWith)\((.+)\)$/)
  if (strM) {
    const l = evalExpr(strM[1], values)
    const r = evalExpr(strM[3], values)
    return compare(l, strM[2], r)
  }

  // ── isEmpty / notEmpty via !!/! ──
  if (s.startsWith('!!')) { const v = evalExpr(s.slice(2), values); return v !== null && v !== undefined && v !== '' && v !== false && v !== 0 }
  if (s.startsWith('!'))  { const v = evalExpr(s.slice(1), values); return !v }

  // ── Comparison operators (longest first) ──
  for (const op of ['===', '!==', '>=', '<=', '>', '<', '==', '!='] as const) {
    const idx = topLevelIdx(s, ' ' + op + ' ')
    if (idx >= 0) {
      return compare(evalExpr(s.slice(0, idx), values), op, evalExpr(s.slice(idx + op.length + 2), values))
    }
    // without spaces
    const idx2 = topLevelIdx(s, op)
    if (idx2 >= 0) {
      return compare(evalExpr(s.slice(0, idx2), values), op, evalExpr(s.slice(idx2 + op.length), values))
    }
  }

  // ── Arithmetic ──
  for (const op of ['**', '+', '-', '*', '/', '%'] as const) {
    const idx = topLevelIdx(s, ' ' + op + ' ')
    if (idx >= 0) {
      const l = Number(evalExpr(s.slice(0, idx), values))
      const r = Number(evalExpr(s.slice(idx + op.length + 2), values))
      if (op === '**') return Math.pow(l, r)
      if (op === '+') return l + r
      if (op === '-') return l - r
      if (op === '*') return l * r
      if (op === '/') return r !== 0 ? l / r : 0
      if (op === '%') return r !== 0 ? l % r : 0
    }
  }

  // ── Strip wrapping parens ──
  if (s.startsWith('(') && s.endsWith(')')) return evalExpr(s.slice(1, -1), values)

  // ── Single operand ──
  return resolveOperand(s, values)
}

/**
 * Resolve {{state.x}} tokens and evaluate JS expressions (ternary, comparisons,
 * arithmetic, logical) — no eval() or new Function required.
 *
 * Examples:
 *   "{{state.direction}} === 'row' ? 'column' : 'row'"  → "column" or "row"
 *   "{{state.count}} > 0 ? 'Shown' : 'Hidden'"          → "Shown" or "Hidden"
 *   "{{state.price}} + 10"                               → "110"
 *   "{{state.name}}"                                     → raw value
 */
export function resolveExpression(raw: string, ctx: ResolveContext): string {
  if (typeof raw !== 'string') return String(raw ?? '')
  const bareScoped = raw.trim().match(/^(state|data|prop|script|navProp|dateNow|dateTime)\.([A-Za-z0-9_.$\-\s]+)$/)
  if (bareScoped && !raw.includes('{{')) {
    if (bareScoped[1] === 'data') {
      const rawPath = String(bareScoped[2] ?? '')
      const parts = rawPath.split('.')
      const source = String(parts[0] ?? '')
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase()
      const tail = parts.slice(1).join('.')
      raw = tail ? `{{data.${source}.${tail}}}` : `{{data.${source}}}`
    } else {
      raw = `{{${raw.trim()}}}`
    }
  }
  // Users often start from {{data.sourceName}} and then append .field via transform UI.
  // Normalize that shape so both forms resolve the same.
  raw = raw.replace(
    /\{\{\s*data\.([^}]+?)\s*\}\}\.([a-zA-Z0-9_.$-]+)/g,
    (_m, sourcePath: string, extraPath: string) => `{{data.${sourcePath.trim()}.${extraPath.trim()}}}`
  )
  // Users sometimes wrap bindings in quotes inside expressions (e.g. '!\'{{prop.icon}}\' ? ...').
  // Normalize quoted tokens back to raw {{...}} so ternary/logic evaluation still works.
  raw = raw.replace(/(['"])\s*\{\{\s*([^}]+?)\s*\}\}\s*\1/g, '{{$2}}')
  // sanitize any chained string-method invocations to guard against undefined
  const methodPattern = /([^\s]+?)\.(toLowerCase|toUpperCase|trim|split|replace|slice|substring|includes|startsWith|endsWith|charAt|concat|repeat|padStart|padEnd)\(([^)]*)\)/g
  raw = raw.replace(methodPattern, (m, g, method, args) => {
    const expr = g.endsWith('?') ? g.slice(0, -1) : g
    if (typeof window !== 'undefined' && !(window as any).__cortexSanitizeLogged) {
      (window as any).__cortexSanitizeLogged = true
      console.warn(`%c⚠️ Cortex Sanitizer (runtime): AI expression "${m}" was auto-fixed`, 'color:#f59e0b')
    }
    return `String(${expr}||'').${method}(${args})`
  })

  // Quick path: no expression syntax, just token substitution
  if (!raw.includes('{{')) return raw

  // For plain text templates like "data dump: {{data.source}}", avoid expression parsing.
  // This guarantees object tokens are shown as JSON and avoids accidental operator parsing
  // from characters inside token paths (e.g. hyphens in source names).
  const stripped = raw.replace(BINDING_REGEX, '').trim()
  const hasExpressionOperators = /\?|\|\||&&|\?\?|===|!==|>=|<=|==|!=|\+|\-|\*|\/|%|>|</.test(raw)
  const isTokenOnlyTemplate = stripped.length === 0
  if (isTokenOnlyTemplate) {
    return raw.replace(BINDING_REGEX, (_, expr) => {
      const v = resolveToken(expr, ctx)
      if (v === undefined || v === null) return ''
      if (typeof v === 'object') {
        try { return JSON.stringify(v) } catch { return String(v) }
      }
      return String(v)
    })
  }
  const isLikelyTemplateString = stripped.length > 0 && !hasExpressionOperators
  if (isLikelyTemplateString) {
    return raw.replace(BINDING_REGEX, (_, expr) => {
      const v = resolveToken(expr, ctx)
      if (v === undefined || v === null) return ''
      if (typeof v === 'object') {
        try { return JSON.stringify(v) } catch { return String(v) }
      }
      return String(v)
    })
  }

  // Helper: coerce a resolved value to string, serialising arrays/objects as JSON
  // so that dataRepeater, chart, and table nodes can JSON.parse them back
  function coerce(v: unknown): string {
    if (v === undefined || v === null) return ''
    if (typeof v === 'object') { try { return JSON.stringify(v) } catch { return String(v) } }
    return String(v)
  }

  // Check if it's purely a single token with nothing else
  const singleToken = raw.match(/^\s*(\{\{[^}]+\}\})\s*$/)
  if (singleToken) {
    const v = resolveToken(singleToken[1].replace(/^\{\{|\}\}$/g, ''), ctx)
    return coerce(v)
  }

  // Substitute tokens, keeping placeholders so evalExpr can resolve them
  const { expr, values } = substituteTokens(raw, ctx)

  let result: unknown
  try {
    result = evalExpr(expr, values)
  } catch {
    result = expr
  }

  let resultStr = coerce(result)

  // Final pass: substitute any remaining {{tokens}} (handles "Hello {{state.name}}" interpolation
  // where the whole string isn't a pure expression and evalExpr returned it untouched)
  if (resultStr.includes('{{')) {
    for (const [placeholder, v] of Array.from(values)) {
      resultStr = resultStr.replaceAll(placeholder, coerce(v))
    }
  }

  return resultStr
}
