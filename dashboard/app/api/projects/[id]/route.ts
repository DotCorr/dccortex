/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { corsJson, withCors } from '@/lib/cors'
import { warmProjectRuntimeCache } from '@/lib/public-runtime-cache'
import { warmProjectPayloadCache } from '@/lib/public-project-cache'

export async function OPTIONS(req: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), req.headers.get('origin'))
}

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return corsJson(request, { error: 'Unauthorized' }, 401)
    }
    const userId = (session.user as any).id
    if (!userId) {
      return corsJson(request, { error: 'Unauthorized' }, 401)
    }

    const resolvedParams = await Promise.resolve(context.params)
    const project = await prisma.project.findFirst({
      where: {
        id: resolvedParams.id,
        OR: [
          { userId: userId },
          {
            organization: {
              members: {
                some: {
                  userId: userId,
                },
              },
            },
          },
        ],
      },
      include: {
        organization: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!project) {
      return corsJson(request, { error: 'Project not found' }, 404)
    }

    return corsJson(request, { project })
  } catch (error: any) {
    console.error('[Projects API] GET error:', error)
    console.error('[Projects API] Error stack:', error.stack)
    return corsJson(request, {
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, 500)
  }
}

export async function PUT(
  request: NextRequest,
  context: any
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { script, scriptType, activeBuildId, builderGlobals, isPublished, organizationId, customDomain, faviconUrl, seoDefaults } = body

    const resolvedParams = await Promise.resolve(context.params)
    const project = await prisma.project.findFirst({
      where: {
        id: resolvedParams.id,
        OR: [
          { userId: (session.user as any).id },
          {
            organization: {
              members: {
                some: {
                  userId: (session.user as any).id,
                },
              },
            },
          },
        ],
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Update script based on type
    const updateData: any = {}
    if (scriptType === 'backend') {
      updateData.backendScript = script
    } else if (scriptType === 'frontend') {
      updateData.frontendScript = script
    } else if (scriptType === 'scripts') {
      updateData.scriptsScript = script
    }
    // link/unlink organization
    if (organizationId !== undefined) {
      updateData.organizationId = organizationId || null
    }
    // isPublished → stored in the `status` column (metadata not in deployed client)
    if (isPublished !== undefined) {
      updateData.status = isPublished ? 'published' : 'draft'
    }
    // domain, favicon, seo
    if (customDomain !== undefined) updateData.customDomain = customDomain || null
    if (faviconUrl !== undefined) updateData.faviconUrl = faviconUrl || null
    if (seoDefaults !== undefined) updateData.seoDefaults = seoDefaults
    // builderGlobals → attempt metadata write; fall back silently if field not in client
    if (builderGlobals !== undefined) {
      try {
        const currentMeta = (project as any).metadata && typeof (project as any).metadata === 'object'
          ? ((project as any).metadata as Record<string, unknown>)
          : {}
        updateData.metadata = {
          ...currentMeta,
          builderGlobals: builderGlobals && typeof builderGlobals === 'object' ? builderGlobals : {},
        }
      } catch (_) {
        // metadata field not available in this deployment — globals are stored in localStorage
      }
    }

    const updated = await prisma.project.update({
      where: { id: resolvedParams.id },
      data: updateData,
    })

    if (updateData.status === 'published') {
      void Promise.all([
        warmProjectPayloadCache(resolvedParams.id),
        warmProjectRuntimeCache(resolvedParams.id),
      ]).then(([payloadStats, runtimeStats]) => {
        if (payloadStats.failed) {
          console.warn(
            `[Publish warm][payload] project=${payloadStats.projectId} failed durationMs=${payloadStats.durationMs} error=${payloadStats.error ?? 'unknown'}`
          )
        } else {
          console.info(
            `[Publish warm][payload] project=${payloadStats.projectId} cacheHit=${payloadStats.cacheHit ? '1' : '0'} durationMs=${payloadStats.durationMs}`
          )
        }

        if (runtimeStats.failed) {
          console.warn(
            `[Publish warm][runtime] project=${runtimeStats.projectId} failed durationMs=${runtimeStats.durationMs} error=${runtimeStats.error ?? 'unknown'}`
          )
        } else {
          console.info(
            `[Publish warm][runtime] project=${runtimeStats.projectId} signatures=${runtimeStats.signatureCount} warmed=${runtimeStats.warmedCount} misses=${runtimeStats.cacheMissCount} durationMs=${runtimeStats.durationMs}`
          )
        }
      })
    }

    return corsJson(request, { project: updated })
  } catch (error: any) {
    console.error('[Projects API] PUT error:', error)
    console.error('[Projects API] Error stack:', error.stack)
    return corsJson(request, {
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, 500)
  }
}

// DELETE /api/projects/[id] - Delete project and ALL related data
export async function DELETE(
  request: NextRequest,
  context: any
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return corsJson(request, { error: 'Unauthorized' }, 401)
    }
    const userId = (session.user as any).id
    if (!userId) {
      return corsJson(request, { error: 'Unauthorized' }, 401)
    }

    const body = await request.json().catch(() => ({}))
    const { verificationName } = body

    const resolvedParams = await Promise.resolve(context.params)
    
    // Get project and verify ownership
    const project = await prisma.project.findFirst({
      where: {
        id: resolvedParams.id,
        OR: [
          { userId: userId },
          {
            organization: {
              members: {
                some: {
                  userId: userId,
                  role: { in: ['owner', 'admin'] }, // Only owners/admins can delete
                },
              },
            },
          },
        ],
      },
      include: {
        organization: true,
      },
    })

    if (!project) {
      return corsJson(request, { error: 'Project not found or you do not have permission' }, 404)
    }

    // Verify project name matches
    if (!verificationName || verificationName !== project.name) {
      return corsJson(request, { error: 'Verification failed. Project name does not match.' }, 400)
    }

    // Delete the project (cascades to screens, datasources, builds, etc. via Prisma)
    await prisma.project.delete({
      where: {
        id: project.id,
      },
    })

    console.log(`[Projects API] ✅ Deleted project and all related data: ${project.id}`)

    return corsJson(request, {
      success: true,
      message: 'Project and all related data deleted successfully',
    })
  } catch (error: any) {
    console.error('[Projects API] DELETE error:', error)
    return corsJson(request, { error: 'Failed to delete project', message: error.message }, 500)
  }
}

