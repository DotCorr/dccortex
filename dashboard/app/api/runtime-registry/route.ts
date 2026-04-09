/*
 * Component registry API – returns all registered component types with their
 * default props, categories, and supported events. Useful for tests and tooling.
 *
 * GET /api/runtime-registry
 */
import { NextResponse } from 'next/server'
import { COMPONENT_REGISTRY, STYLE_PROP_KEYS, BUILDER_EVENT_KEYS } from '@/components/builder/registry'

export async function GET() {
  const components = COMPONENT_REGISTRY.map(c => ({
    id: c.id,
    label: c.label,
    category: c.category,
    defaultProps: c.defaultProps,
    allowsChildren: c.allowsChildren,
    bindableProps: c.bindableProps,
    events: c.events ?? [...BUILDER_EVENT_KEYS],
  }))

  return NextResponse.json({
    componentCount: components.length,
    components,
    stylePropKeys: [...STYLE_PROP_KEYS],
    eventKeys: [...BUILDER_EVENT_KEYS],
  })
}
