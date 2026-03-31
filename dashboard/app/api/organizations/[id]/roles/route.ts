/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * List roles for an organization (system roles + org custom roles).
 * Used by no-code member role assignment.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, hasPermission } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await Promise.resolve(params)
    const organizationId = resolvedParams.id

    const canManage = await hasPermission(organizationId, 'org.manage', session)
    const canEdit = await hasPermission(organizationId, 'app.edit', session)
    if (!canManage && !canEdit) {
      return NextResponse.json(
        { error: 'Insufficient permissions to list roles' },
        { status: 403 }
      )
    }

    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { organizationId: null },
          { organizationId },
        ],
      },
      select: {
        id: true,
        name: true,
        permissions: true,
        organizationId: true,
      },
      orderBy: [{ organizationId: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ roles })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch roles', message: error.message },
      { status: 500 }
    )
  }
}
