/*
 * Runtime resolve API – takes a layout tree, state, and data context,
 * returns exactly how each node would render (resolved content, computed styles,
 * effective flex direction, border-radius, etc.).
 *
 * POST /api/runtime-resolve
 * Body: { root: Node, state?: Record<string,unknown>, data?: Record<string,unknown> }
 * Returns: { nodes: ResolvedNode[] }
 */
import { NextResponse } from 'next/server'
import { COMPONENT_REGISTRY, nodePropsToStyle, type Node } from '@/components/builder/registry'
import { resolveBinding } from '@/components/builder/bindingResolver'

type ResolvedNode = {
  id: string
  type: string
  resolvedProps: Record<string, unknown>
  computedStyle: Record<string, string | number>
  resolvedContent: string | null
  children: ResolvedNode[]
  issues: string[]
}

const layoutTypes = new Set([
  'container', 'suspense', 'section', 'stackV', 'stackH', 'card', 'formWrapper',
  'dataRepeater', 'tabs', 'tooltip', 'modal',
  'header', 'main', 'footer', 'nav', 'aside', 'article',
])

const registryMap = new Map(COMPONENT_REGISTRY.map(c => [c.id, c]))

function resolveNode(
  node: Node,
  state: Record<string, unknown>,
  data: Record<string, unknown>,
): ResolvedNode {
  const issues: string[] = []

  // Merge registry defaults
  const regDef = registryMap.get(node.type)
  if (!regDef) issues.push(`Unknown component type: ${node.type}`)
  const mergedProps = regDef?.defaultProps ? { ...regDef.defaultProps, ...node.props } : node.props

  // Resolve bindings
  const resolvedProps: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(mergedProps)) {
    if (typeof v === 'string') {
      const resolved = resolveBinding(v, { state, data })
      resolvedProps[k] = resolved
      // Check for unresolved bindings
      if (v.includes('{{') && resolved.includes('{{')) {
        issues.push(`Unresolved binding in prop '${k}': ${v}`)
      }
      // Check for empty resolved state bindings
      if (v.includes('{{state.') && resolved === '') {
        issues.push(`State binding resolved to empty in '${k}': ${v}`)
      }
    } else {
      resolvedProps[k] = v
    }
  }

  // Compute styles
  const hasLayout = layoutTypes.has(node.type)
  const computedStyle = nodePropsToStyle(resolvedProps, hasLayout)

  // Validate styles
  for (const [key, val] of Object.entries(computedStyle)) {
    const sv = String(val)
    if (key === 'borderRadius' && /^\d+$/.test(sv)) {
      issues.push(`borderRadius '${sv}' missing CSS units`)
    }
    if (key === 'flexDirection' && node.type === 'stackH' && sv !== 'row') {
      issues.push(`stackH has flexDirection '${sv}' instead of 'row'`)
    }
  }

  // Resolve content-bearing props
  let resolvedContent: string | null = null
  if ('content' in resolvedProps) resolvedContent = String(resolvedProps.content ?? '')
  else if ('label' in resolvedProps) resolvedContent = String(resolvedProps.label ?? '')

  const children = (node.children ?? []).map(child => resolveNode(child, state, data))

  return {
    id: node.id,
    type: node.type,
    resolvedProps,
    computedStyle,
    resolvedContent,
    children,
    issues,
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { root, state = {}, data = {} } = body

    if (!root || typeof root !== 'object') {
      return NextResponse.json({ error: 'Missing root node' }, { status: 400 })
    }

    const resolved = resolveNode(root as Node, state, data)

    // Collect all issues across the tree
    const allIssues: Array<{ nodeId: string; type: string; issues: string[] }> = []
    const collectIssues = (n: ResolvedNode) => {
      if (n.issues.length > 0) allIssues.push({ nodeId: n.id, type: n.type, issues: n.issues })
      n.children.forEach(collectIssues)
    }
    collectIssues(resolved)

    // Flat node summary for quick assertions
    const flatNodes: Array<{
      id: string
      type: string
      flexDirection?: string
      backgroundColor?: string
      borderRadius?: string
      padding?: string
      content?: string | null
      issues: string[]
    }> = []
    const flatten = (n: ResolvedNode) => {
      flatNodes.push({
        id: n.id,
        type: n.type,
        flexDirection: n.computedStyle.flexDirection as string | undefined,
        backgroundColor: n.computedStyle.backgroundColor as string | undefined,
        borderRadius: n.computedStyle.borderRadius as string | undefined,
        padding: n.computedStyle.padding as string | undefined,
        content: n.resolvedContent,
        issues: n.issues,
      })
      n.children.forEach(flatten)
    }
    flatten(resolved)

    return NextResponse.json({
      tree: resolved,
      flatNodes,
      issueCount: allIssues.length,
      issues: allIssues,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
