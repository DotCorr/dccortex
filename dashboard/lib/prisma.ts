/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Prisma Client singleton
 * In development we skip globalThis caching to prevent stale clients after
 * `prisma generate` runs (the old instance survives hot-reload otherwise).
 */

import { PrismaClient } from '@prisma/client'

function makePrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// Always create a fresh client; only cache it to avoid >1 instance per process
export const prisma: PrismaClient = globalForPrisma.prisma ?? makePrisma()

if (process.env.NODE_ENV !== 'production') {
  // Replace cache on every module evaluation so an outdated client is never reused
  globalForPrisma.prisma = prisma
}

