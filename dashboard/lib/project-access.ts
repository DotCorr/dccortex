/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Get project and enforce access. For org projects, check data.read / data.write (task 01 RBAC).
 */
import { getServerSession } from 'next-auth'
import { authOptions, hasPermission } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'

export async function getProjectForAccess(projectId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const userId = (session.user as any).id

  // Fetch project first, then verify access — avoids edge cases in nested Prisma OR filter
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { organization: true },
  })
  if (!project) return null

  // Direct ownership
  if (project.userId === userId) return { project, session }

  // Org membership fallback
  if (project.organizationId) {
    const member = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: project.organizationId, userId } },
    })
    if (member) return { project, session }
  }

  return null
}

export async function requireProjectDataAccess(
  projectId: string,
  needWrite: boolean
): Promise<
  | { ok: false; status: number; error: string }
  | { ok: true; project: NonNullable<Awaited<ReturnType<typeof getProjectForAccess>>>['project']; session: NonNullable<Awaited<ReturnType<typeof getProjectForAccess>>>['session'] }
> {
  const out = await getProjectForAccess(projectId)
  if (!out) return { ok: false, status: 401, error: 'Unauthorized' }
  const { project, session } = out
  if (project.organizationId && project.organization) {
    const perm = needWrite ? PERMISSIONS.DATA_WRITE : PERMISSIONS.DATA_READ
    const allowed = await hasPermission(project.organizationId, perm, session)
    if (!allowed) return { ok: false, status: 403, error: needWrite ? 'data.write required' : 'data.read required' }
  }
  return { ok: true, project, session }
}
