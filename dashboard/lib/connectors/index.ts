/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Unified driver interface for external database connectors.
 * Each driver implements connect, introspect, query, and disconnect.
 */

export type ColumnInfo = {
  name: string
  type: string // text, number, boolean, date, json, unknown
}

export type TableInfo = {
  name: string
  schema?: string
  columns: ColumnInfo[]
  rowCount?: number
}

export type QueryResult = {
  rows: Record<string, unknown>[]
  rowCount: number
}

export type ConnectorConfig = {
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl: boolean
}

export interface DbDriver {
  /** Test the connection and return true if successful */
  testConnection(config: ConnectorConfig): Promise<{ ok: boolean; error?: string }>

  /** List all user tables (excluding system tables) */
  introspectTables(config: ConnectorConfig): Promise<TableInfo[]>

  /** Query rows from a specific table with a limit */
  queryTable(config: ConnectorConfig, tableName: string, limit: number): Promise<QueryResult>

  /** Query multiple tables at once, returning { tableName: rows[] } */
  queryTables(config: ConnectorConfig, tableNames: string[], limit: number): Promise<Record<string, unknown[]>>
}

export type SupportedDriver = 'postgres' | 'mysql' | 'mssql'

import { createPostgresDriver } from './drivers/postgres'
import { createMysqlDriver } from './drivers/mysql'
import { createMssqlDriver } from './drivers/mssql'

const driverRegistry: Record<SupportedDriver, DbDriver> = {
  postgres: createPostgresDriver(),
  mysql: createMysqlDriver(),
  mssql: createMssqlDriver(),
}

export function getDriver(driver: string): DbDriver {
  const d = driverRegistry[driver as SupportedDriver]
  if (!d) throw new Error(`Unsupported database driver: ${driver}`)
  return d
}

export const SUPPORTED_DRIVERS: { value: SupportedDriver; label: string; defaultPort: number }[] = [
  { value: 'postgres', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'mysql', label: 'MySQL', defaultPort: 3306 },
  { value: 'mssql', label: 'Microsoft SQL Server', defaultPort: 1433 },
]
