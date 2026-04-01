/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type AuditStatus = 'success' | 'denied' | 'failure'

export interface AuditEventInput {
  action: string
  status?: AuditStatus
  actorUserId?: string | null
  organizationId?: string | null
  projectId?: string | null
  targetType?: string | null
  targetId?: string | null
  reason?: string | null
  metadata?: Prisma.InputJsonValue | null
  request?: NextRequest
}

function truncate(value: string | null | undefined, maxLen: number): string | null {
  if (!value) return null
  return value.length > maxLen ? value.slice(0, maxLen) : value
}

function extractClientIp(request?: NextRequest): string | null {
  if (!request) return null

  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(',')
    const ip = firstIp?.trim()
    if (ip) return ip
  }

  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp.trim()

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  return null
}

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        status: input.status ?? 'success',
        actorUserId: input.actorUserId ?? null,
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        reason: truncate(input.reason ?? null, 1000),
        ipAddress: truncate(extractClientIp(input.request), 128),
        userAgent: truncate(input.request?.headers.get('user-agent') ?? null, 512),
        metadata: input.metadata ?? undefined,
      },
    })
  } catch (error) {
    // Audit logging should never block user-facing actions.
    console.error('[audit] failed to persist event', {
      action: input.action,
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      error,
    })
  }
}
