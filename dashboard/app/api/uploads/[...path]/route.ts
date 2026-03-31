/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Serve uploaded assets from the persistent uploads/ directory.
 * This avoids relying on Next.js static file serving from public/,
 * which doesn't work for files added after the build.
 */
import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import path from 'path'

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  avif: 'image/avif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  pdf: 'application/pdf',
  json: 'application/json',
  css: 'text/css',
  js: 'text/javascript',
  ttf: 'font/ttf',
  woff: 'font/woff',
  woff2: 'font/woff2',
}

function getMime(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return MIME_TYPES[ext] ?? 'application/octet-stream'
}

/** Resolve the uploads root, checking both the new persistent location and the legacy public/ location */
function resolveUploadsRoot(): string[] {
  const cwd = process.cwd()
  return [
    path.join(cwd, 'uploads'),           // new persistent location
    path.join(cwd, 'public', 'uploads'),  // legacy location (backward compat)
  ]
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const resolved = await Promise.resolve(params)
  const segments = resolved.path

  // Sanitize: reject path traversal
  if (segments.some(s => s === '..' || s.includes('\0'))) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const relPath = segments.join('/')
  const roots = resolveUploadsRoot()

  let absPath: string | null = null
  for (const root of roots) {
    const candidate = path.join(root, relPath)
    // Ensure the resolved path stays within the root
    if (!candidate.startsWith(root)) continue
    try {
      const s = await stat(candidate)
      if (s.isFile()) {
        absPath = candidate
        break
      }
    } catch {
      // file not found in this root, try next
    }
  }

  if (!absPath) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const buffer = await readFile(absPath)
  const contentType = getMime(absPath)

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': String(buffer.byteLength),
    },
  })
}
