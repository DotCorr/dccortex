/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'
import { getDriver, SUPPORTED_DRIVERS } from '@/lib/connectors'
import { encryptPassword, decryptPassword } from '@/lib/connectors/encryption'
import type { ConnectorConfig } from '@/lib/connectors'

type Params = { params: Promise<{ id: string; connectorId: string }> | { id: string; connectorId: string } }

async function resolveParams(params: Params['params']) {
  return Promise.resolve(params)
}

function buildConfig(c: { host: string; port: number; database: string; username: string; passwordEnc: string; ssl: boolean }): ConnectorConfig {
  return { host: c.host, port: c.port, database: c.database, username: c.username, password: decryptPassword(c.passwordEnc), ssl: c.ssl }
}

async function getConnector(connectorId: string, projectId: string) {
  return prisma.externalDbConnector.findFirst({ where: { id: connectorId, projectId } })
}

/** GET — single connector details */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: projectId, connectorId } = await resolveParams(params)
  const access = await requireProjectDataAccess(projectId, false)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const connector = await getConnector(connectorId, projectId)
  if (!connector) return NextResponse.json({ error: 'Connector not found' }, { status: 404 })

  const { passwordEnc, ...safe } = connector
  return NextResponse.json({ connector: safe })
}

/** PATCH — update connector settings */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: projectId, connectorId } = await resolveParams(params)
  const access = await requireProjectDataAccess(projectId, true)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const connector = await getConnector(connectorId, projectId)
  if (!connector) return NextResponse.json({ error: 'Connector not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { name, host, port, database, username, password, ssl, selectedTables, queryLimit, cacheMode } = body as Record<string, any>

  const data: Record<string, any> = {}
  if (name !== undefined) data.name = String(name).trim()
  if (host !== undefined) data.host = String(host).trim()
  if (port !== undefined) data.port = Number(port)
  if (database !== undefined) data.database = String(database).trim()
  if (username !== undefined) data.username = String(username).trim()
  if (password !== undefined) data.passwordEnc = encryptPassword(password)
  if (ssl !== undefined) data.ssl = Boolean(ssl)
  if (selectedTables !== undefined) data.selectedTables = selectedTables
  if (queryLimit !== undefined) data.queryLimit = Math.min(Math.max(Number(queryLimit) || 500, 1), 10000)
  if (cacheMode !== undefined) data.cacheMode = cacheMode === 'realtime' ? 'realtime' : 'cached'

  // If connection details changed, re-test and re-introspect
  const connectionChanged = host !== undefined || port !== undefined || database !== undefined ||
    username !== undefined || password !== undefined || ssl !== undefined
  if (connectionChanged) {
    data.status = 'pending'
    const updated = await prisma.externalDbConnector.update({ where: { id: connectorId }, data })
    const config = buildConfig({ ...connector, ...updated })
    const drv = getDriver(connector.driver)
    const result = await drv.testConnection(config)
    if (!result.ok) {
      await prisma.externalDbConnector.update({
        where: { id: connectorId },
        data: { status: 'error', statusMessage: result.error ?? 'Connection failed' },
      })
      const { passwordEnc: _, ...safe } = updated
      return NextResponse.json({ connector: { ...safe, status: 'error', statusMessage: result.error } })
    }
    try {
      const tables = await drv.introspectTables(config)
      const final = await prisma.externalDbConnector.update({
        where: { id: connectorId },
        data: { status: 'connected', statusMessage: null, tables: tables as any },
      })
      const { passwordEnc: _, ...safe } = final
      return NextResponse.json({ connector: safe })
    } catch {
      const final = await prisma.externalDbConnector.update({
        where: { id: connectorId },
        data: { status: 'connected', statusMessage: 'Connected but introspection failed' },
      })
      const { passwordEnc: _, ...safe } = final
      return NextResponse.json({ connector: safe })
    }
  }

  const updated = await prisma.externalDbConnector.update({ where: { id: connectorId }, data })
  const { passwordEnc: _, ...safe } = updated
  return NextResponse.json({ connector: safe })
}

/** DELETE — remove a connector */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: projectId, connectorId } = await resolveParams(params)
  const access = await requireProjectDataAccess(projectId, true)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const connector = await getConnector(connectorId, projectId)
  if (!connector) return NextResponse.json({ error: 'Connector not found' }, { status: 404 })

  await prisma.externalDbConnector.delete({ where: { id: connectorId } })
  return NextResponse.json({ deleted: true })
}
