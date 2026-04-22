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
import { logAuditEvent } from '@/lib/audit'
import { z } from 'zod'
import axios from 'axios'

const updateOrgSchema = z.object({
	name: z.string().trim().min(1).optional(),
	description: z.string().optional(),
	metadata: z.record(z.any()).optional(),
})

function toSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
}

async function resolveUserId() {
	const session = await getServerSession(authOptions)
	if (!session?.user) return null

	let userId = (session.user as any).id as string | undefined
	if (!userId && session.user.email) {
		const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } })
		userId = dbUser?.id
	}

	return userId ?? null
}

async function canManageOrganization(organizationId: string, userId: string): Promise<boolean> {
	const member = await prisma.organizationMember.findFirst({
		where: { organizationId, userId },
		include: {
			roleRef: {
				select: {
					permissions: true,
				},
			},
		},
	})

	if (!member) return false
	if (member.role === 'owner' || member.role === 'admin') return true

	const permissions = Array.isArray(member.roleRef?.permissions)
		? (member.roleRef.permissions as string[])
		: []

	return permissions.includes('org.manage')
}

async function getOrganizationForMember(organizationId: string, userId: string) {
	return prisma.organization.findFirst({
		where: {
			id: organizationId,
			members: {
				some: {
					userId,
				},
			},
		},
		include: {
			owner: {
				select: {
					id: true,
					name: true,
					email: true,
				},
			},
			members: {
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
					roleRef: {
						select: {
							id: true,
							name: true,
							permissions: true,
						},
					},
				},
				orderBy: {
					createdAt: 'asc',
				},
			},
			projects: {
				orderBy: {
					updatedAt: 'desc',
				},
			},
			invitations: {
				orderBy: {
					createdAt: 'desc',
				},
			},
			_count: {
				select: {
					projects: true,
					members: true,
				},
			},
		},
	})
}

export async function OPTIONS(req: NextRequest) {
	return withCors(new NextResponse(null, { status: 204 }), req.headers.get('origin'))
}

export async function GET(req: NextRequest, context: any) {
	const userId = await resolveUserId()
	if (!userId) {
		return corsJson(req, { error: 'Unauthorized' }, 401)
	}

	try {
		const resolvedParams = await Promise.resolve(context.params)
		const organizationId = resolvedParams.id as string

		const organization = await getOrganizationForMember(organizationId, userId)
		if (!organization) {
			return corsJson(req, { error: 'Organization not found' }, 404)
		}

		const platformApiUrl = process.env.PLATFORM_API_URL || 'http://localhost:3001'
		let liveContainer: any = null
		try {
			const response = await axios.get(
				`${platformApiUrl}/api/v1/apps/organizations/${organizationId}/container`,
				{ timeout: 2000 }
			)
			liveContainer = response.data?.container ?? null
		} catch {
			liveContainer = null
		}

		const mergedOrganization = liveContainer
			? {
					...organization,
					metadata: {
						...((organization.metadata as Record<string, unknown> | null) ?? {}),
						containerStatus: liveContainer.status,
						containerBackend: liveContainer.backend,
						containerProvisionedAt: liveContainer.provisionedAt,
						containerRequestedAt: liveContainer.requestedAt,
						containerLastError: liveContainer.lastError,
					},
				}
			: organization

		return corsJson(req, { organization: mergedOrganization })
	} catch (error: any) {
		return corsJson(req, { error: 'Failed to fetch organization', message: error.message }, 500)
	}
}

export async function PUT(req: NextRequest, context: any) {
	const userId = await resolveUserId()
	if (!userId) {
		return corsJson(req, { error: 'Unauthorized' }, 401)
	}

	try {
		const resolvedParams = await Promise.resolve(context.params)
		const organizationId = resolvedParams.id as string

		const canManage = await canManageOrganization(organizationId, userId)
		if (!canManage) {
			await logAuditEvent({
				action: 'organization.update',
				status: 'denied',
				actorUserId: userId,
				organizationId,
				targetType: 'organization',
				targetId: organizationId,
				reason: 'insufficient_permissions',
				request: req,
			})
			return corsJson(req, { error: 'Forbidden' }, 403)
		}

		const body = await req.json()
		const parsed = updateOrgSchema.parse(body)

		const current = await prisma.organization.findUnique({
			where: { id: organizationId },
			select: { id: true, name: true, metadata: true },
		})

		if (!current) {
			return corsJson(req, { error: 'Organization not found' }, 404)
		}

		const nextName = parsed.name?.trim()
		const nextSlug = nextName ? toSlug(nextName) : undefined

		if (nextSlug) {
			const existing = await prisma.organization.findFirst({
				where: {
					slug: nextSlug,
					id: { not: organizationId },
				},
				select: { id: true },
			})
			if (existing) {
				return corsJson(req, { error: 'Organization name already taken' }, 400)
			}
		}

		const updated = await prisma.organization.update({
			where: { id: organizationId },
			data: {
				...(nextName ? { name: nextName, slug: nextSlug } : {}),
				...(parsed.description !== undefined ? { description: parsed.description } : {}),
				...(parsed.metadata !== undefined
					? {
							metadata: {
								...((current.metadata as Record<string, unknown> | null) ?? {}),
								...parsed.metadata,
							},
						}
					: {}),
			},
		})

		await logAuditEvent({
			action: 'organization.update',
			status: 'success',
			actorUserId: userId,
			organizationId,
			targetType: 'organization',
			targetId: organizationId,
			metadata: {
				updatedName: nextName ?? current.name,
			},
			request: req,
		})

		const hydrated = await getOrganizationForMember(updated.id, userId)
		return corsJson(req, { organization: hydrated ?? updated })
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			return corsJson(req, { error: 'Invalid input', details: error.errors }, 400)
		}
		return corsJson(req, { error: 'Failed to update organization', message: error.message }, 500)
	}
}

export async function DELETE(req: NextRequest, context: any) {
	const userId = await resolveUserId()
	if (!userId) {
		return corsJson(req, { error: 'Unauthorized' }, 401)
	}

	try {
		const resolvedParams = await Promise.resolve(context.params)
		const organizationId = resolvedParams.id as string

		const membership = await prisma.organizationMember.findFirst({
			where: { organizationId, userId },
		})

		if (!membership) {
			return corsJson(req, { error: 'Organization not found' }, 404)
		}

		if (membership.role !== 'owner') {
			await logAuditEvent({
				action: 'organization.delete',
				status: 'denied',
				actorUserId: userId,
				organizationId,
				targetType: 'organization',
				targetId: organizationId,
				reason: 'owner_required',
				request: req,
			})
			return corsJson(req, { error: 'Only organization owners can delete organizations' }, 403)
		}

		const body = await req.json().catch(() => ({}))
		const verificationName = typeof body?.verificationName === 'string' ? body.verificationName : ''

		const org = await prisma.organization.findUnique({
			where: { id: organizationId },
			select: { id: true, name: true },
		})

		if (!org) {
			return corsJson(req, { error: 'Organization not found' }, 404)
		}

		if (!verificationName || verificationName !== org.name) {
			return corsJson(req, { error: 'Verification failed. Organization name does not match.' }, 400)
		}

		await prisma.$transaction(async (tx) => {
			await tx.project.updateMany({
				where: { organizationId },
				data: { organizationId: null },
			})

			await tx.organization.delete({
				where: { id: organizationId },
			})
		})

		await logAuditEvent({
			action: 'organization.delete',
			status: 'success',
			actorUserId: userId,
			organizationId,
			targetType: 'organization',
			targetId: organizationId,
			request: req,
		})

		return corsJson(req, { success: true, message: 'Organization deleted successfully' })
	} catch (error: any) {
		return corsJson(req, { error: 'Failed to delete organization', message: error.message }, 500)
	}
}
