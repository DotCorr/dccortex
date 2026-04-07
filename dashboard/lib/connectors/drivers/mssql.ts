/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import type { DbDriver, ConnectorConfig, TableInfo, ColumnInfo } from '../index'
import sql from 'mssql'

function mapMssqlType(mssqlType: string): string {
  const t = mssqlType.toLowerCase()
  if (t.includes('int') || t.includes('float') || t.includes('decimal') || t.includes('numeric') || t.includes('money') || t.includes('real')) return 'number'
  if (t === 'bit') return 'boolean'
  if (t.includes('date') || t.includes('time')) return 'date'
  if (t === 'xml' || t === 'json') return 'json'
  return 'text'
}

function buildConfig(config: ConnectorConfig): sql.config {
  return {
    server: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    options: {
      encrypt: config.ssl,
      trustServerCertificate: true,
    },
    connectionTimeout: 10000,
    requestTimeout: 15000,
  }
}

export function createMssqlDriver(): DbDriver {
  return {
    async testConnection(config) {
      let pool: sql.ConnectionPool | null = null
      try {
        pool = await new sql.ConnectionPool(buildConfig(config)).connect()
        await pool.query`SELECT 1`
        return { ok: true }
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      } finally {
        await pool?.close().catch(() => {})
      }
    },

    async introspectTables(config) {
      let pool: sql.ConnectionPool | null = null
      try {
        pool = await new sql.ConnectionPool(buildConfig(config)).connect()
        const tablesRes = await pool.query`
          SELECT TABLE_SCHEMA, TABLE_NAME
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_TYPE = 'BASE TABLE'
            AND TABLE_SCHEMA != 'sys'
          ORDER BY TABLE_SCHEMA, TABLE_NAME
        `
        const tables: TableInfo[] = []
        for (const row of tablesRes.recordset) {
          const fullName = row.TABLE_SCHEMA === 'dbo' ? row.TABLE_NAME : `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`
          const colsRes = await pool.request()
            .input('schema', sql.NVarChar, row.TABLE_SCHEMA)
            .input('table', sql.NVarChar, row.TABLE_NAME)
            .query(`
              SELECT COLUMN_NAME, DATA_TYPE
              FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
              ORDER BY ORDINAL_POSITION
            `)
          const columns: ColumnInfo[] = colsRes.recordset.map((c: any) => ({
            name: c.COLUMN_NAME,
            type: mapMssqlType(c.DATA_TYPE),
          }))
          tables.push({ name: fullName, schema: row.TABLE_SCHEMA, columns })
        }
        return tables
      } finally {
        await pool?.close().catch(() => {})
      }
    },

    async queryTable(config, tableName, limit) {
      let pool: sql.ConnectionPool | null = null
      try {
        pool = await new sql.ConnectionPool(buildConfig(config)).connect()
        const safeLimit = Math.min(Math.max(1, limit), 10000)
        const parts = tableName.split('.')
        const quoted = parts.map(p => `[${p.replace(/\]/g, ']]')}]`).join('.')
        const res = await pool.query(`SELECT TOP (${safeLimit}) * FROM ${quoted}`)
        return { rows: res.recordset, rowCount: res.recordset.length }
      } finally {
        await pool?.close().catch(() => {})
      }
    },

    async queryTables(config, tableNames, limit) {
      let pool: sql.ConnectionPool | null = null
      const result: Record<string, unknown[]> = {}
      try {
        pool = await new sql.ConnectionPool(buildConfig(config)).connect()
        const safeLimit = Math.min(Math.max(1, limit), 10000)
        for (const tableName of tableNames) {
          try {
            const parts = tableName.split('.')
            const quoted = parts.map(p => `[${p.replace(/\]/g, ']]')}]`).join('.')
            const res = await pool.query(`SELECT TOP (${safeLimit}) * FROM ${quoted}`)
            result[tableName] = res.recordset
          } catch {
            result[tableName] = []
          }
        }
        return result
      } finally {
        await pool?.close().catch(() => {})
      }
    },
  }
}
