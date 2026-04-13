/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'
import { getDriver } from '@/lib/connectors'
import { decryptPassword } from '@/lib/connectors/encryption'
import { invalidateRuntimeCache } from '@/lib/public-runtime-cache'
import type { ConnectorConfig } from '@/lib/connectors'

type Params = { params: Promise<{ id: string; connectorId: string }> | { id: string; connectorId: string } }

/** POST — refresh cached data for a connector (query selected tables) */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id: projectId, connectorId } = await Promise.resolve(params)
  const access = await requireProjectDataAccess(projectId, true)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const connector = await prisma.externalDbConnector.findFirst({ where: { id: connectorId, projectId } })
  if (!connector) return NextResponse.json({ error: 'Connector not found' }, { status: 404 })

  if (connector.status !== 'connected') {
    return NextResponse.json({ error: 'Connector is not connected. Test connection first.' }, { status: 400 })
  }

  const selectedTables = (connector.selectedTables as string[] | null) ?? []
  if (selectedTables.length === 0) {
    return NextResponse.json({ error: 'No tables selected. Select tables to cache first.' }, { status: 400 })
  }

  const config: ConnectorConfig = {
    host: connector.host,
    port: connector.port,
    database: connector.database,
    username: connector.username,
    password: decryptPassword(connector.passwordEnc),
    ssl: connector.ssl,
  }

  const drv = getDriver(connector.driver)
  try {
    const data = await drv.queryTables(config, selectedTables, connector.queryLimit)
    await prisma.externalDbConnector.update({
      where: { id: connectorId },
      data: { cachedData: data as any, cachedAt: new Date() },
    })
    invalidateRuntimeCache(projectId)
    return NextResponse.json({ ok: true, tables: Object.keys(data), cachedAt: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
