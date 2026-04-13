/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_ENV = 'CONNECTOR_ENCRYPTION_KEY'

function getKey(): Buffer {
  const raw = process.env[KEY_ENV]
  if (!raw) {
    // Fallback: derive from NEXTAUTH_SECRET or a default for dev
    const fallback = process.env.NEXTAUTH_SECRET ?? process.env.DATABASE_URL ?? 'dccortex-dev-key-change-in-prod'
    return crypto.scryptSync(fallback, 'dccortex-connector-salt', 32)
  }
  // Expect 64-char hex string (32 bytes)
  if (raw.length === 64) return Buffer.from(raw, 'hex')
  return crypto.scryptSync(raw, 'dccortex-connector-salt', 32)
}

export function encryptPassword(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: base64(iv):base64(tag):base64(encrypted)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decryptPassword(ciphertext: string): string {
  const key = getKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted password format')
  const iv = Buffer.from(parts[0], 'base64')
  const tag = Buffer.from(parts[1], 'base64')
  const encrypted = Buffer.from(parts[2], 'base64')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
