/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import type { DbDriver, ConnectorConfig, TableInfo, QueryResult, ColumnInfo } from '../index'
import pg from 'pg'

function mapPgType(pgType: string): string {
  const t = pgType.toLowerCase()
  if (t.includes('int') || t.includes('float') || t.includes('numeric') || t.includes('decimal') || t.includes('real') || t.includes('double')) return 'number'
  if (t.includes('bool')) return 'boolean'
  if (t.includes('date') || t.includes('time') || t.includes('timestamp')) return 'date'
  if (t.includes('json')) return 'json'
  return 'text'
}

function createClient(config: ConnectorConfig): pg.Client {
  return new pg.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
  })
}

export function createPostgresDriver(): DbDriver {
  return {
    async testConnection(config) {
      const client = createClient(config)
      try {
        await client.connect()
        await client.query('SELECT 1')
        return { ok: true }
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      } finally {
        await client.end().catch(() => {})
      }
    },

    async introspectTables(config) {
      const client = createClient(config)
      try {
        await client.connect()
        const tablesRes = await client.query(`
          SELECT table_schema, table_name
          FROM information_schema.tables
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema', '_prisma_migrations')
            AND table_type = 'BASE TABLE'
          ORDER BY table_schema, table_name
        `)
        const tables: TableInfo[] = []
        for (const row of tablesRes.rows) {
          const fullName = row.table_schema === 'public' ? row.table_name : `${row.table_schema}.${row.table_name}`
          const colsRes = await client.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position
          `, [row.table_schema, row.table_name])
          const columns: ColumnInfo[] = colsRes.rows.map((c: any) => ({
            name: c.column_name,
            type: mapPgType(c.data_type),
          }))
          tables.push({ name: fullName, schema: row.table_schema, columns })
        }
        return tables
      } finally {
        await client.end().catch(() => {})
      }
    },

    async queryTable(config, tableName, limit) {
      const client = createClient(config)
      try {
        await client.connect()
        const safeLimit = Math.min(Math.max(1, limit), 10000)
        // Use double-quoting for table name safety
        const parts = tableName.split('.')
        const quoted = parts.map(p => `"${p.replace(/"/g, '""')}"`).join('.')
        const res = await client.query(`SELECT * FROM ${quoted} LIMIT ${safeLimit}`)
        return { rows: res.rows, rowCount: res.rows.length }
      } finally {
        await client.end().catch(() => {})
      }
    },

    async queryTables(config, tableNames, limit) {
      const client = createClient(config)
      const result: Record<string, unknown[]> = {}
      try {
        await client.connect()
        const safeLimit = Math.min(Math.max(1, limit), 10000)
        for (const tableName of tableNames) {
          try {
            const parts = tableName.split('.')
            const quoted = parts.map(p => `"${p.replace(/"/g, '""')}"`).join('.')
            const res = await client.query(`SELECT * FROM ${quoted} LIMIT ${safeLimit}`)
            result[tableName] = res.rows
          } catch {
            result[tableName] = []
          }
        }
        return result
      } finally {
        await client.end().catch(() => {})
      }
    },
  }
}
