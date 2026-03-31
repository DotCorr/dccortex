/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * GET /api/cortex/models — returns available Gemini models that support generateContent
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const GEMINI_KEY = process.env.GEMINI_API_KEY

// Well-known stable models — used as fallback or merged with live data
const KNOWN_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast, capable — recommended' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Stable, highly capable' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Stable, fast' },
  { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', description: 'Compact, very fast' },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: 'Lightweight 2.0' },
]

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!GEMINI_KEY) {
    return NextResponse.json({ models: KNOWN_MODELS })
  }

  try {
    // Attempt to fetch live model list from Gemini
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}&pageSize=50`,
      { next: { revalidate: 300 } } // cache 5 min
    )
    if (!res.ok) {
      return NextResponse.json({ models: KNOWN_MODELS })
    }
    const data = await res.json() as {
      models?: { name: string; displayName: string; description?: string; supportedGenerationMethods?: string[] }[]
    }

    const available = (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .filter((m) => m.name.includes('gemini'))
      .map((m) => {
        const id = m.name.replace('models/', '')
        const known = KNOWN_MODELS.find((k) => k.id === id)
        return {
          id,
          name: m.displayName || id,
          description: known?.description ?? m.description ?? '',
        }
      })
      // Prefer known models order, then append any extra live ones
      .sort((a, b) => {
        const ai = KNOWN_MODELS.findIndex((k) => k.id === a.id)
        const bi = KNOWN_MODELS.findIndex((k) => k.id === b.id)
        if (ai !== -1 && bi === -1) return -1
        if (ai === -1 && bi !== -1) return 1
        if (ai !== -1 && bi !== -1) return ai - bi
        return a.id.localeCompare(b.id)
      })

    if (available.length === 0) {
      return NextResponse.json({ models: KNOWN_MODELS })
    }

    return NextResponse.json({ models: available })
  } catch {
    return NextResponse.json({ models: KNOWN_MODELS })
  }
}
