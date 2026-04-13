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
import type { ConnectorConfig } from '@/lib/connectors'

type Params = { params: Promise<{ id: string; connectorId: string }> | { id: string; connectorId: string } }

/** POST — test connection for an existing connector */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id: projectId, connectorId } = await Promise.resolve(params)
  const access = await requireProjectDataAccess(projectId, false)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const connector = await prisma.externalDbConnector.findFirst({ where: { id: connectorId, projectId } })
  if (!connector) return NextResponse.json({ error: 'Connector not found' }, { status: 404 })

  const config: ConnectorConfig = {
    host: connector.host,
    port: connector.port,
    database: connector.database,
    username: connector.username,
    password: decryptPassword(connector.passwordEnc),
    ssl: connector.ssl,
  }

  const drv = getDriver(connector.driver)
  const result = await drv.testConnection(config)

  const status = result.ok ? 'connected' : 'error'
  const statusMessage = result.ok ? null : (result.error ?? 'Connection failed')

  await prisma.externalDbConnector.update({
    where: { id: connectorId },
    data: { status, statusMessage },
  })

  return NextResponse.json({ ok: result.ok, status, message: statusMessage })
}
