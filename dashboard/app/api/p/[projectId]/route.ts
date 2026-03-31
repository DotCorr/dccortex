/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Public (unauthenticated) endpoint for published projects.
 * Returns all screens + globals so the public preview page can render the app.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> | { projectId: string } }
) {
  try {
    const { projectId } = await Promise.resolve(params)

    // Only select fields that exist in the deployed Prisma client
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, status: true, customDomain: true, faviconUrl: true, seoDefaults: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (project.status !== 'published') {
      return NextResponse.json({ error: 'Not published' }, { status: 404 })
    }

    const [screensRows, globalsRow] = await Promise.all([
      prisma.appScreen.findMany({
        where: { projectId, NOT: { slug: '__globals__' } },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, slug: true, layout: true, script: true, sortOrder: true },
      }),
      prisma.appScreen.findUnique({
        where: { projectId_slug: { projectId, slug: '__globals__' } },
        select: { layout: true },
      }),
    ])

    // sanitize layouts before returning
    const sanitize = (val: unknown): unknown => {
      if (typeof val === 'string') {
        return val.replace(/([^\s]+?)\.toLowerCase\(\)/g,(m,g)=>{
          const expr = g.endsWith('?') ? g.slice(0,-1) : g
          return `String(${expr}||'').toLowerCase()`
        });
      }
      if (Array.isArray(val)) return val.map(sanitize);
      if (val && typeof val === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
          out[k] = sanitize(v);
        }
        return out;
      }
      return val;
    }

    return NextResponse.json({
      project: { id: project.id, name: project.name, faviconUrl: project.faviconUrl, seoDefaults: project.seoDefaults },
      screens: screensRows.map(r => ({ ...r, layout: sanitize(r.layout) })),
      globals: sanitize(globalsRow?.layout ?? {}) as Record<string, unknown>,
    })
  } catch (err: any) {
    console.error('[Public API] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
