/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { COMPONENT_REGISTRY, nodePropsToStyle, type Node } from '@/components/builder/registry'
import { parseEventSteps, type EventActionConfig } from '@/components/builder/eventHelpers'

export type InterpolatedNextJsSource = {
  code: string
  warnings: string[]
  nodeCount: number
}

type EventStub = {
  key: string
  fnName: string
  nodeId: string
  eventKey: string
  steps: EventActionConfig[]
}

const registryMap = new Map(COMPONENT_REGISTRY.map((c) => [c.id, c]))

const layoutTypes = new Set([
  'container', 'suspense', 'section', 'stackV', 'stackH', 'card', 'formWrapper',
  'dataRepeater', 'tabs', 'tooltip', 'modal',
  'header', 'main', 'footer', 'nav', 'aside', 'article',
])

const EVENT_KEY_TO_REACT_ATTR: Record<string, string> = {
  onClick: 'onClick',
  onDoubleClick: 'onDoubleClick',
  onChange: 'onChange',
  onSubmit: 'onSubmit',
  onFocus: 'onFocus',
  onBlur: 'onBlur',
  onInput: 'onInput',
  onMouseEnter: 'onMouseEnter',
  onMouseLeave: 'onMouseLeave',
  onKeyDown: 'onKeyDown',
  onKeyUp: 'onKeyUp',
}

function countNodes(node: Node): number {
  return 1 + (node.children ?? []).reduce((sum, child) => sum + countNodes(child), 0)
}

function esc(raw: string): string {
  return JSON.stringify(raw)
}

function styleLiteral(style: Record<string, string | number>): string {
  const entries = Object.entries(style)
  if (!entries.length) return '{}'
  const chunks = entries.map(([k, v]) => `${JSON.stringify(k)}: ${typeof v === 'number' ? String(v) : JSON.stringify(v)}`)
  return `{ ${chunks.join(', ')} }`
}

function resolveTextExpr(raw: unknown): string {
  if (typeof raw !== 'string') return JSON.stringify(String(raw ?? ''))
  if (raw.includes('{{')) return `{resolveText(${JSON.stringify(raw)}, runtimeCtx)}`
  return JSON.stringify(raw)
}

function resolveValueExpr(raw: unknown): string {
  if (typeof raw !== 'string') return JSON.stringify(raw ?? '')
  if (raw.includes('{{')) return `resolveText(${JSON.stringify(raw)}, runtimeCtx)`
  return JSON.stringify(raw)
}

function csvItems(input: unknown): string[] {
  return String(input ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

function openTag(tag: string, attrs: string): string {
  return attrs ? `<${tag} ${attrs}>` : `<${tag}>`
}

function sanitizeIdent(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  return cleaned || 'node'
}

function buildEventStubs(root: Node, warnings: string[]): EventStub[] {
  const out: EventStub[] = []

  const walk = (node: Node) => {
    const props = (node.props ?? {}) as Record<string, unknown>
    for (const [eventKey, reactAttr] of Object.entries(EVENT_KEY_TO_REACT_ATTR)) {
      const raw = props[eventKey]
      if (raw == null || raw === '') continue
      const steps = parseEventSteps(raw)
      if (!steps.length) continue
      const key = `${node.id}:${eventKey}`
      const fnName = `handle_${sanitizeIdent(node.id)}_${reactAttr}`
      out.push({ key, fnName, nodeId: node.id, eventKey, steps })
    }

    for (const key of Object.keys(props)) {
      if (!key.startsWith('on')) continue
      if (EVENT_KEY_TO_REACT_ATTR[key]) continue
      if (props[key] == null || props[key] === '') continue
      warnings.push(`Skipped unsupported event '${key}' on node ${node.id} during interpolation`) 
    }

    for (const child of node.children ?? []) walk(child)
  }

  walk(root)
  return out
}

function eventStubBody(stub: EventStub): string {
  const lines: string[] = []
  lines.push(`  // Deterministic stub generated from ${stub.nodeId}.${stub.eventKey}`)
  lines.push(`  console.debug('[DCCortex generated event]', { nodeId: '${stub.nodeId}', event: '${stub.eventKey}' })`)
  for (let i = 0; i < stub.steps.length; i += 1) {
    const step = stub.steps[i]
    lines.push(`  // Step ${i + 1}: ${step.action}`)
    if (step.action === 'setState') {
      lines.push(`  // TODO(runtime): set state key '${String(step.stateKey ?? '')}' with value '${String(step.value ?? '')}'`)
    } else if (step.action === 'navigate') {
      lines.push(`  // TODO(runtime): navigate to '${String(step.targetScreenId ?? step.url ?? '')}'`)
    } else if (step.action === 'runScript') {
      lines.push(`  // TODO(runtime): invoke script '${String(step.scriptName ?? '')}'`)
    } else {
      lines.push(`  // TODO(runtime): apply action '${step.action}' with deterministic runtime bridge`) 
    }
  }
  return lines.join('\n')
}

function eventAttrs(node: Node, stubsByKey: Map<string, EventStub>): string {
  const attrs: string[] = []
  for (const [eventKey, reactAttr] of Object.entries(EVENT_KEY_TO_REACT_ATTR)) {
    const key = `${node.id}:${eventKey}`
    if (!stubsByKey.has(key)) continue
    attrs.push(`${reactAttr}={(event) => runConfiguredEvent(${JSON.stringify(node.id)}, ${JSON.stringify(eventKey)}, event)}`)
  }
  return attrs.join(' ')
}

function renderNode(node: Node, depth: number, warnings: string[], stubsByKey: Map<string, EventStub>): string {
  const indent = '  '.repeat(depth)
  const def = registryMap.get(node.type)
  const mergedProps: Record<string, unknown> = def?.defaultProps
    ? { ...def.defaultProps, ...(node.props ?? {}) }
    : (node.props ?? {})
  const style = nodePropsToStyle(mergedProps, layoutTypes.has(node.type))
  const styleExpr = styleLiteral(style)

  const children = (node.children ?? []).map((child) => renderNode(child, depth + 1, warnings, stubsByKey)).join('\n')
  const domId = String(mergedProps.customId ?? node.id)
  const eventAttr = eventAttrs(node, stubsByKey)
  const eventAttrSegment = eventAttr ? ` ${eventAttr}` : ''

  if (!def) warnings.push(`Unknown component type: ${node.type} at ${node.id}`)

  if (node.type === 'text') {
    const variant = String(mergedProps.variant ?? 'body').toLowerCase()
    const tag = variant === 'h1' || variant === 'h2' || variant === 'h3' ? variant : variant === 'small' || variant === 'caption' ? 'small' : 'p'
    const content = resolveTextExpr(mergedProps.content ?? '')
    return `${indent}${openTag(tag, `id=${esc(domId)} data-node-id=${esc(node.id)} style={${styleExpr}}${eventAttrSegment}`)}${content}</${tag}>`
  }

  if (node.type === 'button') {
    const label = resolveTextExpr(mergedProps.label ?? 'Button')
    return `${indent}<button id=${esc(domId)} data-node-id=${esc(node.id)} style={${styleExpr}} type="button"${eventAttrSegment}>${label}</button>`
  }

  if (node.type === 'link') {
    const label = resolveTextExpr(mergedProps.label ?? 'Link')
    const hrefExpr = resolveValueExpr(mergedProps.url ?? '#')
    return `${indent}<a id=${esc(domId)} data-node-id=${esc(node.id)} style={${styleExpr}} href={${hrefExpr}}${eventAttrSegment}>${label}</a>`
  }

  if (node.type === 'image') {
    const srcExpr = resolveValueExpr(mergedProps.url ?? '')
    const altExpr = resolveValueExpr(mergedProps.alt ?? '')
    return `${indent}<img id=${esc(domId)} data-node-id=${esc(node.id)} style={${styleExpr}} src={${srcExpr}} alt={${altExpr}}${eventAttrSegment} />`
  }

  if (node.type === 'textarea') {
    const placeholderExpr = resolveValueExpr(mergedProps.placeholder ?? '')
    const valueExpr = resolveValueExpr(mergedProps.value ?? '')
    return `${indent}<textarea id=${esc(domId)} data-node-id=${esc(node.id)} style={${styleExpr}} placeholder={${placeholderExpr}} defaultValue={${valueExpr}}${eventAttrSegment} />`
  }

  if (node.type === 'textInput' || node.type === 'searchInput' || node.type === 'numberInput' || node.type === 'datepicker') {
    const inputType = node.type === 'numberInput' ? 'number' : node.type === 'searchInput' ? 'search' : node.type === 'datepicker' ? String(mergedProps.type ?? 'date') : 'text'
    const placeholderExpr = resolveValueExpr(mergedProps.placeholder ?? '')
    const valueExpr = resolveValueExpr(mergedProps.value ?? '')
    return `${indent}<input id=${esc(domId)} data-node-id=${esc(node.id)} style={${styleExpr}} type=${esc(inputType)} placeholder={${placeholderExpr}} defaultValue={${valueExpr}}${eventAttrSegment} />`
  }

  if (node.type === 'checkbox' || node.type === 'toggle') {
    const label = resolveTextExpr(mergedProps.label ?? '')
    const checked = Boolean(mergedProps.checked)
    return `${indent}<label id=${esc(domId)} data-node-id=${esc(node.id)} style={${styleExpr}}><input type="checkbox" defaultChecked={${checked ? 'true' : 'false'}}${eventAttrSegment} /> ${label}</label>`
  }

  if (node.type === 'dropdown') {
    const options = csvItems(mergedProps.options)
      .map((opt) => `<option value=${esc(opt)}>${opt}</option>`)
      .join('')
    return `${indent}<select id=${esc(domId)} data-node-id=${esc(node.id)} style={${styleExpr}}${eventAttrSegment}>${options}</select>`
  }

  if (node.type === 'radioGroup') {
    const options = csvItems(mergedProps.options)
    const radioNodes = options
      .map((opt) => `<label><input type="radio" name=${esc(node.id)} value=${esc(opt)} /> ${opt}</label>`)
      .join('')
    return `${indent}<div id=${esc(domId)} data-node-id=${esc(node.id)} style={${styleExpr}}${eventAttrSegment}>${radioNodes}</div>`
  }

  const tag = node.type === 'section' ? 'section' : node.type === 'main' ? 'main' : node.type === 'header' ? 'header' : node.type === 'footer' ? 'footer' : node.type === 'article' ? 'article' : node.type === 'nav' ? 'nav' : 'div'

  if (!children.trim()) return `${indent}${openTag(tag, `id=${esc(domId)} data-node-id=${esc(node.id)} data-component-type=${esc(node.type)} style={${styleExpr}}${eventAttrSegment}`)}</${tag}>`

  return `${indent}${openTag(tag, `id=${esc(domId)} data-node-id=${esc(node.id)} data-component-type=${esc(node.type)} style={${styleExpr}}${eventAttrSegment}`)}\n${children}\n${indent}</${tag}>`
}

export function interpolateScreenToNextJs(root: Node, screenName = 'Screen'): InterpolatedNextJsSource {
  const warnings: string[] = []
  const eventStubs = buildEventStubs(root, warnings)
  const stubsByKey = new Map(eventStubs.map((stub) => [stub.key, stub]))
  const safeName = screenName
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('') || 'Screen'

  const jsx = renderNode(root, 2, warnings, stubsByKey)
  const handlerFunctions = eventStubs
    .map((stub) => `function ${stub.fnName}(event: unknown): void {\n${eventStubBody(stub)}\n}`)
    .join('\n\n')
  const eventHandlerEntries = eventStubs
    .map((stub) => `  ${JSON.stringify(stub.key)}: ${stub.fnName},`)
    .join('\n')
  const code = [
    '/* Generated by DCCortex Next.js interpolation */',
    "import { resolveBinding } from '@/components/builder/bindingResolver'",
    '',
    'type RuntimeCtx = {',
    '  state?: Record<string, unknown>',
    '  data?: Record<string, unknown>',
    '  event?: Record<string, unknown>',
    '}',
    '',
    'function resolveText(raw: string, ctx: RuntimeCtx): string {',
    "  return raw.includes('{{') ? resolveBinding(raw, ctx) : raw",
    '}',
    '',
    eventStubs.length > 0 ? handlerFunctions : '// No configured event handlers found during interpolation.',
    '',
    `export default function ${safeName}({ state = {}, data = {}, event = {} }: RuntimeCtx) {`,
    '  const runtimeCtx: RuntimeCtx = { state, data, event }',
    eventStubs.length > 0
      ? ['  const eventHandlers: Record<string, (event: unknown) => void> = {', eventHandlerEntries, '  }'].join('\n')
      : '  const eventHandlers: Record<string, (event: unknown) => void> = {}',
    '  const runConfiguredEvent = (nodeId: string, eventKey: string, eventPayload: unknown) => {',
    "    const handler = eventHandlers[`${nodeId}:${eventKey}`]",
    '    if (!handler) return',
    '    handler(eventPayload)',
    '  }',
    '  return (',
    jsx,
    '  )',
    '}',
    '',
  ].join('\n')

  return {
    code,
    warnings,
    nodeCount: countNodes(root),
  }
}
