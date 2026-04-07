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

function buildConfig(connector: { host: string; port: number; database: string; username: string; passwordEnc: string; ssl: boolean }): ConnectorConfig {
  return {
    host: connector.host,
    port: connector.port,
    database: connector.database,
    username: connector.username,
    password: decryptPassword(connector.passwordEnc),
    ssl: connector.ssl,
  }
}

/** GET — list all connectors for a project */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id: projectId } = await Promise.resolve(params)
  const access = await requireProjectDataAccess(projectId, false)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const connectors = await prisma.externalDbConnector.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, name: true, driver: true, host: true, port: true, database: true,
      username: true, ssl: true, status: true, statusMessage: true, tables: true,
      selectedTables: true, cacheMode: true, queryLimit: true, cachedAt: true,
      createdAt: true, updatedAt: true,
    },
  })
  return NextResponse.json({ connectors, supportedDrivers: SUPPORTED_DRIVERS })
}

/** POST — create a new connector, test connection, introspect tables */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id: projectId } = await Promise.resolve(params)
  const access = await requireProjectDataAccess(projectId, true)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = await req.json().catch(() => ({}))
  const { name, driver: driverName, host, port, database, username, password, ssl, cacheMode } = body as {
    name?: string; driver?: string; host?: string; port?: number; database?: string
    username?: string; password?: string; ssl?: boolean; cacheMode?: string
  }

  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!driverName) return NextResponse.json({ error: 'driver is required' }, { status: 400 })
  if (!SUPPORTED_DRIVERS.some(d => d.value === driverName)) {
    return NextResponse.json({ error: `Unsupported driver: ${driverName}` }, { status: 400 })
  }
  if (!host?.trim()) return NextResponse.json({ error: 'host is required' }, { status: 400 })
  if (!database?.trim()) return NextResponse.json({ error: 'database is required' }, { status: 400 })
  if (!username?.trim()) return NextResponse.json({ error: 'username is required' }, { status: 400 })

  const defaultPort = SUPPORTED_DRIVERS.find(d => d.value === driverName)!.defaultPort
  const passwordEnc = encryptPassword(password ?? '')

  const connector = await prisma.externalDbConnector.create({
    data: {
      projectId,
      name: name.trim(),
      driver: driverName,
      host: host.trim(),
      port: port ?? defaultPort,
      database: database.trim(),
      username: username.trim(),
      passwordEnc,
      ssl: ssl ?? false,
      cacheMode: cacheMode === 'realtime' ? 'realtime' : 'cached',
      status: 'pending',
    },
  })

  // Test connection + introspect in background
  const config = buildConfig(connector)
  const drv = getDriver(driverName)
  const testResult = await drv.testConnection(config)

  if (!testResult.ok) {
    await prisma.externalDbConnector.update({
      where: { id: connector.id },
      data: { status: 'error', statusMessage: testResult.error ?? 'Connection failed' },
    })
    return NextResponse.json({
      connector: { ...connector, passwordEnc: undefined, status: 'error', statusMessage: testResult.error },
    }, { status: 201 })
  }

  // Introspect tables
  try {
    const tables = await drv.introspectTables(config)
    await prisma.externalDbConnector.update({
      where: { id: connector.id },
      data: { status: 'connected', statusMessage: null, tables: tables as any },
    })
    return NextResponse.json({
      connector: { ...connector, passwordEnc: undefined, status: 'connected', tables },
    }, { status: 201 })
  } catch (err) {
    await prisma.externalDbConnector.update({
      where: { id: connector.id },
      data: { status: 'connected', statusMessage: 'Connected but table introspection failed' },
    })
    return NextResponse.json({
      connector: { ...connector, passwordEnc: undefined, status: 'connected', statusMessage: 'Connected but introspection failed: ' + (err as Error).message },
    }, { status: 201 })
  }
}
