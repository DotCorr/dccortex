/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import type { DbDriver, ConnectorConfig, TableInfo, QueryResult, ColumnInfo } from '../index'
import mysql from 'mysql2/promise'

function mapMysqlType(mysqlType: string): string {
  const t = mysqlType.toLowerCase()
  if (t.includes('int') || t.includes('float') || t.includes('double') || t.includes('decimal') || t.includes('numeric')) return 'number'
  if (t.includes('bool') || t === 'tinyint(1)') return 'boolean'
  if (t.includes('date') || t.includes('time') || t.includes('timestamp')) return 'date'
  if (t.includes('json')) return 'json'
  return 'text'
}

async function createConnection(config: ConnectorConfig): Promise<mysql.Connection> {
  return mysql.createConnection({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 10000,
  })
}

export function createMysqlDriver(): DbDriver {
  return {
    async testConnection(config) {
      let conn: mysql.Connection | null = null
      try {
        conn = await createConnection(config)
        await conn.query('SELECT 1')
        return { ok: true }
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      } finally {
        await conn?.end().catch(() => {})
      }
    },

    async introspectTables(config) {
      let conn: mysql.Connection | null = null
      try {
        conn = await createConnection(config)
        const [tableRows] = await conn.query<mysql.RowDataPacket[]>(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name`,
          [config.database]
        )
        const tables: TableInfo[] = []
        for (const row of tableRows) {
          const [colRows] = await conn.query<mysql.RowDataPacket[]>(
            `SELECT column_name, data_type, column_type FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position`,
            [config.database, row.table_name ?? row.TABLE_NAME]
          )
          const columns: ColumnInfo[] = colRows.map((c) => ({
            name: c.column_name ?? c.COLUMN_NAME,
            type: mapMysqlType(c.column_type ?? c.COLUMN_TYPE ?? c.data_type ?? c.DATA_TYPE ?? ''),
          }))
          const tableName = row.table_name ?? row.TABLE_NAME
          tables.push({ name: tableName, columns })
        }
        return tables
      } finally {
        await conn?.end().catch(() => {})
      }
    },

    async queryTable(config, tableName, limit) {
      let conn: mysql.Connection | null = null
      try {
        conn = await createConnection(config)
        const safeLimit = Math.min(Math.max(1, limit), 10000)
        const quoted = `\`${tableName.replace(/`/g, '``')}\``
        const [rows] = await conn.query<mysql.RowDataPacket[]>(`SELECT * FROM ${quoted} LIMIT ?`, [safeLimit])
        return { rows: rows as Record<string, unknown>[], rowCount: rows.length }
      } finally {
        await conn?.end().catch(() => {})
      }
    },

    async queryTables(config, tableNames, limit) {
      let conn: mysql.Connection | null = null
      const result: Record<string, unknown[]> = {}
      try {
        conn = await createConnection(config)
        const safeLimit = Math.min(Math.max(1, limit), 10000)
        for (const tableName of tableNames) {
          try {
            const quoted = `\`${tableName.replace(/`/g, '``')}\``
            const [rows] = await conn.query<mysql.RowDataPacket[]>(`SELECT * FROM ${quoted} LIMIT ?`, [safeLimit])
            result[tableName] = rows as Record<string, unknown>[]
          } catch {
            result[tableName] = []
          }
        }
        return result
      } finally {
        await conn?.end().catch(() => {})
      }
    },
  }
}
