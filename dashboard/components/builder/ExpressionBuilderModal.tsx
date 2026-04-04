/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

// ── Visual flow-based no-code expression builder ──────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { EditorProps } from '@monaco-editor/react'
import type { StateDefinition } from './PropertyPanel'
import type { DataSourceDef } from './PropertyPanel'

const MonacoEditorBase = dynamic(() => import('@monaco-editor/react'), { ssr: false })
const MonacoEditor = (props: EditorProps) => <MonacoEditorBase keepCurrentModel {...props} />

// ─── Props (unchanged — PropertyPanel compatibility) ──────────────────────────

type Props = {
  open: boolean
  onClose: () => void
  onInsert: (expression: string) => void
  stateDefinitions: StateDefinition[]
  dataSources: DataSourceDef[]
  namedScripts?: Record<string, string>
  propNames?: string[]
  initialValue?: string
}

// ─── Data model ───────────────────────────────────────────────────────────────

type ValueSource =
  | { kind: 'state'; name: string; field?: string }
  | { kind: 'data'; name: string; field?: string }
  | { kind: 'script'; name: string }
  | { kind: 'prop'; name: string; field?: string }
  | { kind: 'literal'; value: string }
  | { kind: 'prev' }

type CompareOp = '===' | '!==' | '>' | '>=' | '<' | '<=' | 'includes' | 'startsWith' | 'endsWith' | 'isEmpty' | 'notEmpty'
type MathOp = '+' | '-' | '*' | '/' | '%' | '**' | '//' | 'min' | 'max'
type TransformOp =
  | 'uppercase' | 'lowercase' | 'trim' | 'length'
  | 'round' | 'floor' | 'ceil' | 'abs' | 'toFixed'
  | 'toString' | 'toNumber' | 'toBoolean'
  | 'not' | 'first' | 'last' | 'join' | 'split' | 'reverse'
  | 'jsonStringify' | 'jsonParse'

type FlowBlock =
  | { id: string; type: 'start'; source: ValueSource }
  | { id: string; type: 'if'; left: ValueSource; op: CompareOp; right: ValueSource; then: ValueSource; else: ValueSource }
  | { id: string; type: 'map'; source: ValueSource; itemExpr: string }
  | { id: string; type: 'filter'; source: ValueSource; itemField: string; op: CompareOp; itemValue: string }
  | { id: string; type: 'transform'; op: TransformOp; arg?: string }
  | { id: string; type: 'format'; template: string }
  | { id: string; type: 'math'; left: ValueSource; mathOp: MathOp; right: ValueSource }
  | { id: string; type: 'nullish'; fallback: ValueSource }

function normalizeSourceName(name: string): string {
  return String(name ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

// ─── Expression codegen ───────────────────────────────────────────────────────

function srcExpr(v: ValueSource, prev: string): string {
  switch (v.kind) {
    case 'state': return v.field ? `{{state.${v.name}.${v.field}}}` : `{{state.${v.name}}}`
    case 'data': {
      const normalized = normalizeSourceName(v.name)
      return v.field ? `{{data.${normalized}.${v.field}}}` : `{{data.${normalized}}}`
    }
    case 'script': return `{{script.${v.name}}}`
    case 'prop': return v.field ? `{{prop.${v.name}.${v.field}}}` : `{{prop.${v.name}}}`
    case 'literal': {
      const n = Number(v.value)
      if (v.value === 'true' || v.value === 'false' || (!isNaN(n) && v.value !== '')) return v.value
      return `'${v.value}'`
    }
    case 'prev': return prev
  }
}

function buildExpression(blocks: FlowBlock[]): string {
  let cur = ''
  for (const block of blocks) {
    switch (block.type) {
      case 'start':
        cur = srcExpr(block.source, cur)
        break
      case 'if': {
        const l = srcExpr(block.left, cur)
        const r = srcExpr(block.right, cur)
        const th = srcExpr(block.then, cur)
        const el = srcExpr(block.else, cur)
        const cond =
          block.op === 'includes'   ? `String(${l}).includes(${r})` :
          block.op === 'startsWith' ? `String(${l}).startsWith(${r})` :
          block.op === 'endsWith'   ? `String(${l}).endsWith(${r})` :
          block.op === 'isEmpty'    ? `!${l}` :
          block.op === 'notEmpty'   ? `!!${l}` :
          `${l} ${block.op} ${r}`
        cur = `${cond} ? ${th} : ${el}`
        break
      }
      case 'map':
        cur = `(${srcExpr(block.source, cur)} || []).map(item => ${block.itemExpr || 'item'})`
        break
      case 'filter': {
        const src = srcExpr(block.source, cur)
        const fr = block.itemField ? `item.${block.itemField}` : 'item'
        const nv = Number(block.itemValue)
        const ve = (!isNaN(nv) && block.itemValue !== '') ? block.itemValue : `'${block.itemValue}'`
        const cond =
          block.op === 'includes' ? `String(${fr}).includes(${ve})` :
          block.op === 'isEmpty'  ? `!${fr}` :
          block.op === 'notEmpty' ? `!!${fr}` :
          `${fr} ${block.op} ${ve}`
        cur = `(${src} || []).filter(item => ${cond})`
        break
      }
      case 'transform': {
        const a = block.arg ?? '2'
        const ops: Record<string, string> = {
          uppercase:     `String(${cur}).toUpperCase()`,
          lowercase:     `String(${cur}).toLowerCase()`,
          trim:          `String(${cur}).trim()`,
          length:        `(${cur} || '').length`,
          round:         `Math.round(${cur})`,
          floor:         `Math.floor(${cur})`,
          ceil:          `Math.ceil(${cur})`,
          abs:           `Math.abs(${cur})`,
          toFixed:       `Number(${cur}).toFixed(${a})`,
          toString:      `String(${cur})`,
          toNumber:      `Number(${cur})`,
          toBoolean:     `Boolean(${cur})`,
          not:           `!(${cur})`,
          first:         `(${cur} || [])[0]`,
          last:          `(${cur} || []).slice(-1)[0]`,
          join:          '(' + cur + ' || []).join(' + (block.arg ? "'" + block.arg + "'" : "', '") + ')',
          split:         'String(' + cur + ').split(' + (block.arg ? "'" + block.arg + "'" : "','") + ')',
          reverse:       `[...(${cur} || [])].reverse()`,
          jsonStringify: `JSON.stringify(${cur})`,
          jsonParse:     `JSON.parse(${cur})`,
        }
        if (ops[block.op]) cur = ops[block.op]
        break
      }
      case 'format':
        cur = block.template.replaceAll('{value}', cur)
        break
      case 'math': {
        const l = srcExpr(block.left, cur)
        const r = srcExpr(block.right, cur)
        if (block.mathOp === '**') cur = `pow(${l}, ${r})`
        else if (block.mathOp === '//') cur = `floorDiv(${l}, ${r})`
        else if (block.mathOp === 'min') cur = `min(${l}, ${r})`
        else if (block.mathOp === 'max') cur = `max(${l}, ${r})`
        else cur = `${l} ${block.mathOp} ${r}`
        break
      }
      case 'nullish':
        cur = `(${cur}) ?? ${srcExpr(block.fallback, cur)}`
        break
    }
  }
  return cur
}

// ─── Expression → Blocks parser ─────────────────────────────────────────────

/** Find the first occurrence of `needle` at paren-depth 0, searching from `from`. */
function topIdx(s: string, needle: string, from = 0): number {
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
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (depth === 0 && s.startsWith(needle, i)) return i
  }
  return -1
}

function parseSrc(s: string): ValueSource {
  s = s.trim()
  const parseScoped = (prefix: 'state' | 'data' | 'prop'): ValueSource | null => {
    const m = s.match(new RegExp(`^\\{\\{${prefix}\\.([^}]+)\\}\\}$`))
    if (!m) return null
    const path = String(m[1] ?? '').trim()
    if (!path) return { kind: 'literal', value: '' }
    const dot = path.indexOf('.')
    if (dot < 0) {
      return prefix === 'state'
        ? { kind: 'state', name: path }
        : prefix === 'data'
          ? { kind: 'data', name: path }
          : { kind: 'prop', name: path }
    }
    const name = path.slice(0, dot)
    const field = path.slice(dot + 1)
    return prefix === 'state'
      ? { kind: 'state', name, field }
      : prefix === 'data'
        ? { kind: 'data', name, field }
        : { kind: 'prop', name, field }
  }
  const stateSrc = parseScoped('state')
  if (stateSrc) return stateSrc
  const dataSrc = parseScoped('data')
  if (dataSrc) return dataSrc
  const propSrc = parseScoped('prop')
  if (propSrc) return propSrc
  const sc = s.match(/^\{\{script\.([^}]+)\}\}$/)
  if (sc) return { kind: 'script', name: String(sc[1]).trim() }
  const qm = s.match(/^['"](.*)['"\s]*$/)
  if (qm) return { kind: 'literal', value: qm[1] }
  return { kind: 'literal', value: s }
}

function makeIfBlocks(
  leftStr: string, op: CompareOp, rightStr: string,
  thenVal: ValueSource, elseVal: ValueSource,
  sn: string[], dn: string[],
): FlowBlock[] {
  const leftSrc = parseSrc(leftStr)
  const rightSrc = parseSrc(rightStr)
  // If left is a real reference, promote it to the start block and use prev in IF
  if (leftSrc.kind !== 'literal') {
    return [
      { id: uid(), type: 'start', source: leftSrc },
      { id: uid(), type: 'if', left: { kind: 'prev' }, op, right: rightSrc, then: thenVal, else: elseVal },
    ]
  }
  return [
    { id: uid(), type: 'start', source: makeDefaultSrc(sn, dn) },
    { id: uid(), type: 'if', left: leftSrc, op, right: rightSrc, then: thenVal, else: elseVal },
  ]
}

function parseToBlocks(expr: string, sn: string[], dn: string[]): FlowBlock[] | null {
  expr = expr.trim()
  if (!expr) return null

  // ── Ternary: COND ? THEN : ELSE ──
  const qi = topIdx(expr, '?')
  if (qi > 0) {
    const ci = topIdx(expr, ':', qi + 1)
    if (ci > qi) {
      const condStr = expr.slice(0, qi).trim()
      const thenVal = parseSrc(expr.slice(qi + 1, ci).trim())
      const elseVal = parseSrc(expr.slice(ci + 1).trim())

      // notEmpty: !!EXPR
      if (condStr.startsWith('!!')) {
        return makeIfBlocks(condStr.slice(2).trim(), 'notEmpty', '', thenVal, elseVal, sn, dn)
      }
      // isEmpty: !EXPR (but not !=)
      if (condStr.startsWith('!') && !condStr.startsWith('!=')) {
        return makeIfBlocks(condStr.slice(1).trim(), 'isEmpty', '', thenVal, elseVal, sn, dn)
      }
      // String method: String(X).includes/startsWith/endsWith(Y)
      const strM = condStr.match(/^String\((.+)\)\.(includes|startsWith|endsWith)\((.+)\)$/)
      if (strM) {
        return makeIfBlocks(strM[1].trim(), strM[2] as CompareOp, strM[3].trim(), thenVal, elseVal, sn, dn)
      }
      // Standard comparison operators (longest first to avoid partial match)
      for (const op of ['===', '!==', '>=', '<=', '>', '<'] as const) {
        const oi = topIdx(condStr, ' ' + op + ' ')
        if (oi >= 0) {
          return makeIfBlocks(
            condStr.slice(0, oi).trim(), op,
            condStr.slice(oi + op.length + 2).trim(),
            thenVal, elseVal, sn, dn,
          )
        }
        // Also try without spaces
        const oi2 = topIdx(condStr, op)
        if (oi2 >= 0) {
          return makeIfBlocks(
            condStr.slice(0, oi2).trim(), op,
            condStr.slice(oi2 + op.length).trim(),
            thenVal, elseVal, sn, dn,
          )
        }
      }
    }
  }

  // ── Nullish: (EXPR) ?? FALLBACK ──
  const nqi = topIdx(expr, ' ?? ')
  if (nqi >= 0) {
    const inner = expr.slice(0, nqi).trim().replace(/^\(|\)$/g, '')
    const fallback = parseSrc(expr.slice(nqi + 4).trim())
    const src = parseSrc(inner)
    return [
      { id: uid(), type: 'start', source: src },
      { id: uid(), type: 'nullish', fallback },
    ]
  }

  // ── Map: (SRC || []).map(item => EXPR) ──
  const mapM = expr.match(/^\((.+?)\s*\|\|\s*\[\]\)\.map\(item\s*=>\s*([\s\S]+)\)$/)
  if (mapM) {
    const src = parseSrc(mapM[1].trim())
    return [
      { id: uid(), type: 'start', source: src },
      { id: uid(), type: 'map', source: { kind: 'prev' }, itemExpr: mapM[2].trim() },
    ]
  }

  // ── Filter: (SRC || []).filter(item => COND) ──
  const filtM = expr.match(/^\((.+?)\s*\|\|\s*\[\]\)\.filter\(item\s*=>\s*([\s\S]+)\)$/)
  if (filtM) {
    const src = parseSrc(filtM[1].trim())
    const cond = filtM[2].trim()
    const fldM = cond.match(/^item\.?(\w*)\s*(===|!==|>=|<=|>|<)\s*(.+)$/)
    if (fldM) {
      const raw = fldM[3].trim()
      const val = raw.replace(/^['"]|['"\s]*$/g, '')
      return [
        { id: uid(), type: 'start', source: src },
        { id: uid(), type: 'filter', source: { kind: 'prev' }, itemField: fldM[1], op: fldM[2] as CompareOp, itemValue: val },
      ]
    }
    return [
      { id: uid(), type: 'start', source: src },
      { id: uid(), type: 'filter', source: { kind: 'prev' }, itemField: '', op: '!==', itemValue: cond },
    ]
  }

  // ── Math: LEFT OP RIGHT ──
  for (const fn of ['pow', 'floorDiv', 'min', 'max'] as const) {
    if (expr.startsWith(`${fn}(`) && expr.endsWith(')')) {
      const inner = expr.slice(fn.length + 1, -1)
      const comma = topIdx(inner, ',')
      if (comma > 0) {
        const left = parseSrc(inner.slice(0, comma).trim())
        const right = parseSrc(inner.slice(comma + 1).trim())
        const op: MathOp = fn === 'pow' ? '**' : fn === 'floorDiv' ? '//' : fn
        if (left.kind !== 'literal') {
          return [
            { id: uid(), type: 'start', source: left },
            { id: uid(), type: 'math', left: { kind: 'prev' }, mathOp: op, right },
          ]
        }
        return [
          { id: uid(), type: 'start', source: makeDefaultSrc(sn, dn) },
          { id: uid(), type: 'math', left, mathOp: op, right },
        ]
      }
    }
  }

  for (const mathOp of ['+', '-', '*', '/', '%'] as const) {
    const mi = topIdx(expr, ' ' + mathOp + ' ')
    if (mi >= 0) {
      const left = parseSrc(expr.slice(0, mi).trim())
      const right = parseSrc(expr.slice(mi + mathOp.length + 2).trim())
      if (left.kind !== 'literal') {
        return [
          { id: uid(), type: 'start', source: left },
          { id: uid(), type: 'math', left: { kind: 'prev' }, mathOp, right },
        ]
      }
      return [
        { id: uid(), type: 'start', source: makeDefaultSrc(sn, dn) },
        { id: uid(), type: 'math', left, mathOp, right },
      ]
    }
  }

  // ── Simple value reference ──
  const src = parseSrc(expr)
  return [{ id: uid(), type: 'start', source: src }]
}

// ─── Constants ────────────────────────────────────────────────────────────────

let _uid = 0
const uid = () => `b${++_uid}`

const COMPARE_OPS: { value: CompareOp; label: string }[] = [
  { value: '===',        label: 'equals' },
  { value: '!==',        label: 'does not equal' },
  { value: '>',          label: 'is greater than' },
  { value: '>=',         label: 'is >= ' },
  { value: '<',          label: 'is less than' },
  { value: '<=',         label: 'is <=' },
  { value: 'includes',   label: 'contains' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'endsWith',   label: 'ends with' },
  { value: 'isEmpty',    label: 'is empty / null' },
  { value: 'notEmpty',   label: 'is not empty' },
]

const TRANSFORM_GROUPS: { label: string; ops: { value: TransformOp; label: string; hasArg?: boolean; argPlaceholder?: string }[] }[] = [
  { label: 'Text', ops: [
    { value: 'uppercase', label: 'Uppercase' },
    { value: 'lowercase', label: 'Lowercase' },
    { value: 'trim',      label: 'Trim whitespace' },
    { value: 'length',    label: 'Length / count' },
    { value: 'split',     label: 'Split into list', hasArg: true, argPlaceholder: 'separator e.g. ,' },
    { value: 'join',      label: 'Join list to text', hasArg: true, argPlaceholder: 'separator e.g. ,  ' },
  ]},
  { label: 'Number', ops: [
    { value: 'round',   label: 'Round' },
    { value: 'floor',   label: 'Round down' },
    { value: 'ceil',    label: 'Round up' },
    { value: 'abs',     label: 'Absolute value' },
    { value: 'toFixed', label: 'Decimal places', hasArg: true, argPlaceholder: 'places e.g. 2' },
  ]},
  { label: 'Convert', ops: [
    { value: 'toString',  label: 'To text' },
    { value: 'toNumber',  label: 'To number' },
    { value: 'toBoolean', label: 'To true/false' },
    { value: 'not',       label: 'Invert (NOT)' },
  ]},
  { label: 'List', ops: [
    { value: 'first',   label: 'First item' },
    { value: 'last',    label: 'Last item' },
    { value: 'reverse', label: 'Reverse list' },
  ]},
  { label: 'JSON', ops: [
    { value: 'jsonStringify', label: 'To JSON text' },
    { value: 'jsonParse',     label: 'Parse JSON' },
  ]},
]

const BLOCK_META: Record<string, { label: string; color: string; badge: string; desc: string }> = {
  start:     { label: 'Get value',   badge: 'GET',       color: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',     desc: 'Where does your data come from?' },
  if:        { label: 'If / Else',   badge: 'IF',        color: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800', desc: 'Return different values based on a condition' },
  map:       { label: 'Map / Loop',  badge: 'MAP',       color: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800', desc: 'Transform each item in a list' },
  filter:    { label: 'Filter list', badge: 'FILTER',    color: 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800', desc: 'Keep only items that match a condition' },
  transform: { label: 'Transform',   badge: 'APPLY',     color: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',     desc: 'Apply an operation to the value' },
  format:    { label: 'Format text', badge: 'FORMAT',    color: 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800',     desc: 'Embed value inside a text template' },
  math:      { label: 'Math',        badge: 'MATH',      color: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800', desc: 'Add, subtract, multiply or divide' },
  nullish:   { label: 'Fallback',    badge: 'FALLBACK',  color: 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700',     desc: 'Use a default when value is empty or null' },
}

const ADD_OPTIONS = [
  { type: 'if',        label: 'If / Else',   desc: 'Conditional branch' },
  { type: 'map',       label: 'Map / Loop',  desc: 'Transform each list item' },
  { type: 'filter',    label: 'Filter list', desc: 'Keep matching items' },
  { type: 'transform', label: 'Transform',   desc: 'Apply operation' },
  { type: 'format',    label: 'Format text', desc: 'Wrap in template' },
  { type: 'math',      label: 'Math',        desc: 'Arithmetic' },
  { type: 'nullish',   label: 'Fallback',    desc: 'Default when empty' },
]

const MATH_OP_HELP: Record<MathOp, string> = {
  '+': 'Add: combine two numbers.',
  '-': 'Subtract: take the right value away from the left value.',
  '*': 'Multiply: left value times right value.',
  '/': 'Divide: split left value by right value.',
  '%': 'Remainder: what is left after division.',
  '**': 'Power: left value raised to the right value (a^b).',
  '//': 'Floor divide: division result rounded down to a whole number.',
  min: 'Minimum: choose the smaller value.',
  max: 'Maximum: choose the larger value.',
}

// ─── ValuePicker ──────────────────────────────────────────────────────────────

function ValuePicker({ value, onChange, stateNames, dataNames, scriptNames, propNames, allowPrev = false }: {
  value: ValueSource
  onChange: (v: ValueSource) => void
  stateNames: string[]
  dataNames: string[]
  scriptNames: string[]
  propNames: string[]
  allowPrev?: boolean
}) {
  const cls = 'px-2 py-1 text-xs rounded border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-gray-700 dark:text-gray-300'
  return (
    <div className="flex gap-1.5 flex-wrap items-center">
      <select
        value={value.kind}
        onChange={(e) => {
          const k = e.target.value as ValueSource['kind']
          if (k === 'state')   onChange({ kind: 'state', name: stateNames[0] ?? '' })
          else if (k === 'data')   onChange({ kind: 'data', name: dataNames[0] ?? '' })
          else if (k === 'script') onChange({ kind: 'script', name: scriptNames[0] ?? '' })
          else if (k === 'prop') onChange({ kind: 'prop', name: propNames[0] ?? '' })
          else if (k === 'literal') onChange({ kind: 'literal', value: '' })
          else onChange({ kind: 'prev' })
        }}
        className={cls + ' shrink-0'}
      >
        {allowPrev && <option value="prev">prev result</option>}
        {stateNames.length > 0 && <option value="state">State</option>}
        {dataNames.length > 0  && <option value="data">Data</option>}
        {scriptNames.length > 0 && <option value="script">Script</option>}
        {propNames.length > 0 && <option value="prop">Prop</option>}
        <option value="literal">Value</option>
      </select>

      {value.kind === 'state' && (
        <select value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} className={cls}>
          {stateNames.length === 0 && <option value="">no state yet</option>}
          {stateNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      )}
      {value.kind === 'data' && (
        <>
          <select value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} className={cls}>
            {dataNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <input type="text" value={value.field ?? ''} placeholder="field"
            onChange={(e) => onChange({ ...value, field: e.target.value } as ValueSource)}
            className={cls + ' w-20'} />
        </>
      )}
      {value.kind === 'script' && (
        <select value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} className={cls}>
          {scriptNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      )}
      {value.kind === 'prop' && (
        <>
          <select value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} className={cls}>
            {propNames.length === 0 && <option value="">no props yet</option>}
            {propNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <input type="text" value={value.field ?? ''} placeholder="field"
            onChange={(e) => onChange({ ...value, field: e.target.value } as ValueSource)}
            className={cls + ' w-20'} />
        </>
      )}
      {value.kind === 'literal' && (
        <input
          type="text"
          value={(value as { kind: 'literal'; value: string }).value}
          onChange={(e) => onChange({ kind: 'literal', value: e.target.value })}
          placeholder="type a value..."
          className={cls + ' w-32'}
        />
      )}
      {value.kind === 'prev' && (
        <span className="text-xs text-gray-400 italic">the result above</span>
      )}
    </div>
  )
}

// ─── BlockCard ────────────────────────────────────────────────────────────────

function BlockCard({ block, stateNames, dataNames, scriptNames, propNames, onChange, onDelete, canDelete }: {
  block: FlowBlock
  stateNames: string[]
  dataNames: string[]
  scriptNames: string[]
  propNames: string[]
  onChange: (b: FlowBlock) => void
  onDelete: () => void
  canDelete: boolean
}) {
  const meta = BLOCK_META[block.type]
  const cls = 'px-2 py-1 text-xs rounded border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-gray-700 dark:text-gray-300'

  const vp = (v: ValueSource, cb: (s: ValueSource) => void, ap = false) => (
    <ValuePicker value={v} onChange={cb} stateNames={stateNames} dataNames={dataNames} scriptNames={scriptNames} propNames={propNames} allowPrev={ap} />
  )

  return (
    <div className={`rounded-lg border p-3 ${meta.color}`}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900">{meta.badge}</span>
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{meta.label}</span>
          <span className="text-[10px] text-gray-400 hidden sm:inline">{meta.desc}</span>
        </div>
        {canDelete && (
          <button type="button" onClick={onDelete}
            className="text-[10px] text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0">
            remove
          </button>
        )}
      </div>

      {/* GET */}
      {block.type === 'start' && vp(block.source, (s) => onChange({ ...block, source: s }))}

      {/* IF / ELSE */}
      {block.type === 'if' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-8 shrink-0">IF</span>
            {vp(block.left, (s) => onChange({ ...block, left: s }), true)}
            <select value={block.op} onChange={(e) => onChange({ ...block, op: e.target.value as CompareOp })} className={cls}>
              {COMPARE_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {block.op !== 'isEmpty' && block.op !== 'notEmpty' && vp(block.right, (s) => onChange({ ...block, right: s }))}
          </div>
          <div className="flex items-center gap-2 flex-wrap pl-3 border-l-2 border-amber-300 dark:border-amber-600">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 w-8 shrink-0">THEN</span>
            {vp(block.then, (s) => onChange({ ...block, then: s }), true)}
          </div>
          <div className="flex items-center gap-2 flex-wrap pl-3 border-l-2 border-amber-300 dark:border-amber-600">
            <span className="text-xs font-semibold text-rose-500 dark:text-rose-400 w-8 shrink-0">ELSE</span>
            {vp(block.else, (s) => onChange({ ...block, else: s }), true)}
          </div>
        </div>
      )}

      {/* MAP */}
      {block.type === 'map' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 shrink-0">LIST</span>
            {vp(block.source, (s) => onChange({ ...block, source: s }), true)}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 shrink-0">each item returns</span>
            <input type="text" value={block.itemExpr}
              onChange={(e) => onChange({ ...block, itemExpr: e.target.value })}
              placeholder="item.name"
              className={cls + ' flex-1 min-w-0 font-mono'} />
          </div>
          <p className="text-[10px] text-gray-400">
            Use <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">item</code> for each element —
            e.g. <code className="font-mono">item.name</code>, <code className="font-mono">item.price * 2</code>
          </p>
        </div>
      )}

      {/* FILTER */}
      {block.type === 'filter' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 shrink-0">LIST</span>
            {vp(block.source, (s) => onChange({ ...block, source: s }), true)}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 shrink-0">WHERE item.</span>
            <input type="text" value={block.itemField}
              onChange={(e) => onChange({ ...block, itemField: e.target.value })}
              placeholder="field"
              className={cls + ' w-20 font-mono'} />
            <select value={block.op} onChange={(e) => onChange({ ...block, op: e.target.value as CompareOp })} className={cls}>
              {COMPARE_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {block.op !== 'isEmpty' && block.op !== 'notEmpty' && (
              <input type="text" value={block.itemValue}
                onChange={(e) => onChange({ ...block, itemValue: e.target.value })}
                placeholder="value"
                className={cls + ' w-24'} />
            )}
          </div>
        </div>
      )}

      {/* TRANSFORM */}
      {block.type === 'transform' && (() => {
        const allOps = TRANSFORM_GROUPS.flatMap((g) => g.ops)
        const curOp = allOps.find((o) => o.value === block.op)
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 shrink-0">Apply</span>
            <select value={block.op}
              onChange={(e) => onChange({ ...block, op: e.target.value as TransformOp, arg: undefined })}
              className={cls}>
              {TRANSFORM_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
            {curOp?.hasArg && (
              <input type="text" value={block.arg ?? ''}
                onChange={(e) => onChange({ ...block, arg: e.target.value })}
                placeholder={curOp.argPlaceholder ?? 'value'}
                className={cls + ' w-36'} />
            )}
            <span className="text-xs text-gray-400">to the result above</span>
          </div>
        )
      })()}

      {/* FORMAT */}
      {block.type === 'format' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 shrink-0">Template</span>
            <input type="text" value={block.template}
              onChange={(e) => onChange({ ...block, template: e.target.value })}
              placeholder="Hello, {value}!"
              className={cls + ' flex-1 font-mono'} />
          </div>
          <p className="text-[10px] text-gray-400">
            Use <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{value}'}</code> where the result above should appear
          </p>
        </div>
      )}

      {/* MATH */}
      {block.type === 'math' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {vp(block.left, (s) => onChange({ ...block, left: s }), true)}
            <select value={block.mathOp}
              onChange={(e) => onChange({ ...block, mathOp: e.target.value as MathOp })}
              className={cls + ' font-mono'}>
              <optgroup label="Basic">
                <option value="+">Add (+)</option>
                <option value="-">Subtract (-)</option>
                <option value="*">Multiply (*)</option>
                <option value="/">Divide (/)</option>
                <option value="%">Remainder (%)</option>
              </optgroup>
              <optgroup label="Advanced">
                <option value="**">Power (a^b)</option>
                <option value="//">Floor divide (//)</option>
                <option value="min">Minimum (min)</option>
                <option value="max">Maximum (max)</option>
              </optgroup>
            </select>
            {vp(block.right, (s) => onChange({ ...block, right: s }), true)}
          </div>
          <p className="text-[10px] text-gray-400">{MATH_OP_HELP[block.mathOp]}</p>
        </div>
      )}

      {/* NULLISH */}
      {block.type === 'nullish' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 shrink-0">If result above is empty, use</span>
          {vp(block.fallback, (s) => onChange({ ...block, fallback: s }))}
          <span className="text-xs text-gray-500">instead</span>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDefaultSrc(sn: string[], dn: string[]): ValueSource {
  if (sn.length > 0) return { kind: 'state', name: sn[0] }
  if (dn.length > 0) return { kind: 'data', name: dn[0] }
  return { kind: 'literal', value: '' }
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function ExpressionBuilderModal({
  open, onClose, onInsert, stateDefinitions, dataSources, namedScripts = {}, propNames = [], initialValue = '',
}: Props) {
  const stateNames = stateDefinitions.filter((s) => s.name.trim()).map((s) => s.name)
  const dataNames = dataSources.filter((d) => d.name.trim()).map((d) => d.name)
  const scriptNames = Object.keys(namedScripts).filter(Boolean)

  const [blocks, setBlocks] = useState<FlowBlock[]>([])
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [rawMode, setRawMode] = useState(false)
  const [rawExpr, setRawExpr] = useState('')
  const [monacoReady, setMonacoReady] = useState(false)

  const toSnakeCase = useCallback((name: string) => {
    return String(name ?? '')
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase()
  }, [])

  const generatedExpr = buildExpression(blocks)
  const finalExpr = rawMode ? rawExpr.trim() : generatedExpr

  const normalizeInsertExpression = useCallback((expr: string): string => {
    const trimmed = String(expr ?? '').trim()
    if (!trimmed) return ''
    if (!trimmed.includes('{{')) {
      const bareRef = trimmed.match(/^(state|data|prop|script|navProp|dateNow|dateTime)\.[A-Za-z0-9_.$\-\s]+$/)
      if (bareRef) {
        if (bareRef[1] === 'data') {
          const rawPath = trimmed.slice(5)
          const parts = rawPath.split('.')
          const source = normalizeSourceName(parts[0] ?? '')
          const tail = parts.slice(1).join('.')
          return tail ? `{{data.${source}.${tail}}}` : `{{data.${source}}}`
        }
        return `{{${trimmed}}}`
      }
    }
    return trimmed
  }, [])

  const reset = useCallback((sn: string[], dn: string[]) => {
    setBlocks([{ id: uid(), type: 'start', source: makeDefaultSrc(sn, dn) }])
  }, [])

  useEffect(() => {
    let raf = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    raf = window.requestAnimationFrame(() => {
      timer = setTimeout(() => setMonacoReady(true), 0)
    })
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      if (timer) clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setAddMenuOpen(false)
    const iv = initialValue?.trim() ?? ''
    setRawExpr(iv)
    setRawMode(false)

    // 1. Try to restore previously saved block list (visual insert)
    const saved = iv
      ? (() => { try { return JSON.parse(localStorage.getItem('__eb:' + iv) ?? 'null') } catch { return null } })()
      : null

    if (Array.isArray(saved) && saved.length > 0) {
      setBlocks(saved)
      return
    }

    // 2. Try to parse the expression into visual blocks
    if (iv) {
      const parsed = parseToBlocks(iv, stateNames, dataNames)
      if (parsed && parsed.length > 0) {
        setBlocks(parsed)
        return
      }
    }

    // 3. Fall back to default GET block
    reset(stateNames, dataNames)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const addBlock = (type: string) => {
    const defCond: { left: ValueSource; op: CompareOp; right: ValueSource } = {
      left: { kind: 'prev' }, op: '===', right: { kind: 'literal', value: '' },
    }
    const newBlocks: Record<string, FlowBlock> = {
      if:        { id: uid(), type: 'if', ...defCond, then: { kind: 'literal', value: 'yes' }, else: { kind: 'literal', value: 'no' } },
      map:       { id: uid(), type: 'map', source: { kind: 'prev' }, itemExpr: 'item' },
      filter:    { id: uid(), type: 'filter', source: { kind: 'prev' }, itemField: '', op: '!==', itemValue: '' },
      transform: { id: uid(), type: 'transform', op: 'uppercase' },
      format:    { id: uid(), type: 'format', template: '{value}' },
      math:      { id: uid(), type: 'math', left: { kind: 'prev' }, mathOp: '+', right: { kind: 'literal', value: '1' } },
      nullish:   { id: uid(), type: 'nullish', fallback: { kind: 'literal', value: '' } },
    }
    const nb = newBlocks[type]
    if (!nb) return
    setBlocks((prev) => [...prev, nb])
    setAddMenuOpen(false)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] shadow-2xl w-full max-w-2xl flex flex-col"
        style={{ minHeight: '72vh', maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-[#30363d] shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Expression Builder</span>
            {!rawMode && (
              <span className="text-[10px] text-gray-400 hidden sm:block">
                Select and connect — no code needed
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setRawMode((v) => !v); if (!rawMode) setRawExpr((prev) => prev || generatedExpr) }}
              className={`text-[10px] px-2.5 py-1 border transition-colors ${
                rawMode
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-[#30363d] text-gray-500 hover:border-gray-400'
              }`}
            >
              {rawMode ? 'Visual flow' : 'Edit raw'}
            </button>
            <button type="button" onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-[#21262d] text-gray-500 text-xs">
              x
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {rawMode ? (
            /* Raw expression editor */
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Raw expression</label>
              <div className="w-full h-[190px] border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22]">
                {!monacoReady ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="w-4 h-4 border-2 border-gray-300 dark:border-[#30363d] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <MonacoEditor
                    language="javascript"
                    value={rawExpr}
                    onChange={(value) => setRawExpr(value ?? '')}
                    options={{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      fontSize: 12,
                      lineNumbers: 'on',
                      padding: { top: 8, bottom: 8 },
                    }}
                    loading={
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="w-4 h-4 border-2 border-gray-300 dark:border-[#30363d] border-t-transparent rounded-full animate-spin" />
                      </div>
                    }
                  />
                )}
              </div>
              {(stateNames.length > 0 || dataNames.length > 0 || propNames.length > 0) && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {stateNames.map((n) => (
                    <button key={n} type="button"
                      onClick={() => setRawExpr((p) => p + `{{state.${n}}}`)}
                      className="px-2 py-0.5 text-[10px] font-mono border border-gray-200 dark:border-[#30363d] hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-600 dark:text-gray-400">
                      state.{n}
                    </button>
                  ))}
                  {dataNames.map((n) => (
                    <button key={n} type="button"
                      onClick={() => setRawExpr((p) => p + `{{data.${toSnakeCase(n)}}}`)}
                      className="px-2 py-0.5 text-[10px] font-mono border border-gray-200 dark:border-[#30363d] hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-600 dark:text-gray-400">
                      data.{toSnakeCase(n)}
                    </button>
                  ))}
                  {propNames.map((n) => (
                    <button key={n} type="button"
                      onClick={() => setRawExpr((p) => p + `{{prop.${n}}}`)}
                      className="px-2 py-0.5 text-[10px] font-mono border border-gray-200 dark:border-[#30363d] hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-600 dark:text-gray-400">
                      prop.{n}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Visual flow */
            <>
              {blocks.map((block, i) => (
                <div key={block.id} className="flex flex-col gap-2">
                  {i > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-gray-200 dark:bg-[#30363d]" />
                      <span className="text-[9px] uppercase tracking-widest text-gray-400 px-1">then</span>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-[#30363d]" />
                    </div>
                  )}
                  <BlockCard
                    block={block}
                    stateNames={stateNames}
                    dataNames={dataNames}
                    scriptNames={scriptNames}
                    propNames={propNames}
                    onChange={(b) => setBlocks((prev) => prev.map((x) => x.id === block.id ? b : x))}
                    onDelete={() => setBlocks((prev) => prev.filter((x) => x.id !== block.id))}
                    canDelete={blocks.length > 1}
                  />
                </div>
              ))}

              {/* Add step */}
              <div className="relative">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-[#30363d]" />
                  <button
                    type="button"
                    onClick={() => setAddMenuOpen((v) => !v)}
                    className="px-3 py-1.5 text-xs text-gray-500 border border-dashed border-gray-300 dark:border-[#30363d] hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    + Add step
                  </button>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-[#30363d]" />
                </div>
                {addMenuOpen && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-10 w-72 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] shadow-xl p-2 grid grid-cols-2 gap-1">
                    {ADD_OPTIONS.map((opt) => (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => addBlock(opt.type)}
                        className="flex flex-col gap-0.5 p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left"
                      >
                        <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{opt.label}</span>
                        <span className="text-[10px] text-gray-400">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Output + actions */}
        <div className="border-t border-gray-200 dark:border-[#30363d] px-4 py-3 shrink-0 flex flex-col gap-2.5">
          <div className="flex items-start gap-2 min-h-[24px]">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 shrink-0 mt-0.5">Output</span>
            <code className="flex-1 text-xs font-mono text-green-700 dark:text-green-400 break-all leading-relaxed">
              {finalExpr || <span className="text-gray-400 font-sans text-xs not-italic">Build your flow above</span>}
            </code>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => { reset(stateNames, dataNames); setRawExpr('') }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Reset
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#21262d]">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (finalExpr) {
                    const normalizedExpr = normalizeInsertExpression(finalExpr)
                    if (!normalizedExpr) return
                    try {
                      if (rawMode) {
                        // Raw insert — save a marker so we know to reopen in raw mode
                        localStorage.setItem('__eb:' + normalizedExpr, JSON.stringify({ __raw: true }))
                      } else {
                        // Visual insert — save full block list for exact restoration
                        localStorage.setItem('__eb:' + normalizedExpr, JSON.stringify(blocks))
                      }
                    } catch {}
                    onInsert(normalizedExpr)
                    onClose()
                  }
                }}
                disabled={!finalExpr}
                className="px-4 py-1.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
