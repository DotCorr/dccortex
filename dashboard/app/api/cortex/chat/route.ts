/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Cortex AI Chat API — POST /api/cortex/chat
 * Handles: send message → get AI response → execute actions → return results
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildSystemPrompt } from '@/lib/cortex/system-prompt'
import { buildDesignSystemPrompt } from '@/lib/cortex/design-prompt'
import { executeActionsStreaming, type CortexAction, type ActionResult } from '@/lib/cortex/action-executor'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

const GEMINI_KEY = process.env.GEMINI_API_KEY
const MAX_CONTEXT_MESSAGES = 20

type DebugTrace = {
  model: string
  userPrompt: string
  parseMode: 'json' | 'fallback'
  parseError?: string
  repairAttempted?: boolean
  repairSucceeded?: boolean
  repairError?: string
  selfHealAttempted?: boolean
  selfHealSucceeded?: boolean
  selfHealError?: string
  rawOutputPreview: string
  extractedJsonPreview?: string
  parsedActionCount: number
  parsedActionTypes: string[]
  failedActionCount: number
  failedActions: { type: string; error?: string }[]
  auditRunId?: string
  auditFile?: string
}

type AuditArtifact = {
  runId: string
  createdAt: string
  threadId: string
  organizationId: string
  userId: string
  projectId: string | null
  model: string
  prompt: string
  parse: {
    mode: 'json' | 'fallback'
    parseError?: string
    repairAttempted?: boolean
    repairSucceeded?: boolean
    repairError?: string
    selfHealAttempted?: boolean
    selfHealSucceeded?: boolean
    selfHealError?: string
  }
  generation: {
    rawModelOutput: string
    extractedJson?: string
    parsedActionTypes: string[]
    parsedActionCount: number
    assistantMessage: string
    followUp?: string | null
  }
  execution: {
    actionResults: ActionResult[]
    failedActions: { type: string; error?: string }[]
    failedActionCount: number
  }
  assessments: {
    warnings: string[]
  }
}

function safeLongText(input: string, max = 180_000): string {
  if (!input) return ''
  if (input.length <= max) return input
  return `${input.slice(0, max)}\n...[truncated by cortex-audit safeLongText]`
}

async function persistAuditArtifact(artifact: AuditArtifact): Promise<{ runId: string; relativeFile: string }> {
  const auditDir = path.join(process.cwd(), 'uploads', 'cortex-audit')
  await mkdir(auditDir, { recursive: true })
  const fileName = `${artifact.runId}.json`
  const fullPath = path.join(auditDir, fileName)
  await writeFile(fullPath, JSON.stringify(artifact, null, 2), 'utf8')
  return { runId: artifact.runId, relativeFile: `uploads/cortex-audit/${fileName}` }
}

function assessPromptContract(prompt: string, actions: CortexAction[], actionResults: ActionResult[], assistantMessage: string): string[] {
  const warnings: string[] = []
  const promptLower = prompt.toLowerCase()
  const actionTypes = actions.map((a) => a.type)
  const hasActionType = (t: string) => actionTypes.includes(t as CortexAction['type'])
  const serializedActions = JSON.stringify(actions)
  const containsEmoji = (text: string): boolean => {
    if (!text) return false
    for (const ch of text) {
      const cp = ch.codePointAt(0)
      if (!cp) continue
      if (
        (cp >= 0x1f300 && cp <= 0x1faff) ||
        (cp >= 0x2600 && cp <= 0x27bf)
      ) {
        return true
      }
    }
    return false
  }

  const mentionsBackfill = /\bbackfill\b/.test(promptLower)
  const hasRowMutation = hasActionType('add_rows') || hasActionType('delete_rows')
  if (mentionsBackfill && !hasRowMutation) {
    warnings.push('Prompt requested backfill, but no row-level mutation actions were generated.')
  }

  const mentionsNonDestructive = /non-destructive|keep existing screens|do not rebuild/.test(promptLower)
  if (mentionsNonDestructive && hasActionType('create_project')) {
    warnings.push('Prompt requested non-destructive update, but create_project was generated.')
  }
  if (mentionsNonDestructive && hasActionType('create_screen')) {
    warnings.push('Prompt requested in-place update, but create_screen was generated.')
  }

  if (mentionsNonDestructive) {
    const riskyLayoutOverwrite = actions.some((a) =>
      a.type === 'update_screen' &&
      typeof a.params.layout === 'object' &&
      JSON.stringify(a.params.layout).length > 6000
    )
    if (riskyLayoutOverwrite) {
      warnings.push('Prompt requested non-destructive update, but update_screen replaced a very large layout payload (high regression risk).')
    }
  }

  const failed = actionResults.filter((r) => !r.success)
  if (failed.length > 0 && !assistantMessage.toLowerCase().includes('execution warning')) {
    warnings.push('Action failures occurred but assistant summary did not clearly include an execution warning.')
  }

  const generatedEmoji = containsEmoji(serializedActions) || containsEmoji(assistantMessage)
  if (generatedEmoji) {
    warnings.push('Generation contains emoji glyphs. Use explicit icon components (Iconify) instead of emoji in production UI labels/content.')
  }

  const createScreenCount = actions.filter((a) => a.type === 'create_screen').length
  const likelyMultiScreen = createScreenCount >= 3 || /\b(multi[- ]screen|dashboard|app)\b/.test(promptLower)
  const usesReusable = /"type":"reusableInstance"|\breusable\b/i.test(serializedActions)
  if (likelyMultiScreen && !usesReusable && !hasActionType('update_globals')) {
    warnings.push('Multi-screen generation did not include reusable/global patterns (update_globals or reusableInstance). This increases maintenance risk.')
  }

  const createApiActions = actions.filter((a) => a.type === 'create_api_source')
  const hasRelativeApiUrl = createApiActions.some((a) => {
    const url = (a.params as { url?: unknown }).url
    return typeof url === 'string' && url.trim().startsWith('/')
  })
  const urlValidationFailed = failed.some((r) => /invalid url|must be absolute|relative url/i.test(r.error ?? ''))
  if (hasRelativeApiUrl || urlValidationFailed) {
    warnings.push('API source configuration appears non-deployable (relative/invalid URL). Use absolute HTTPS endpoints for external APIs.')
  }

  return warnings
}

function truncateText(input: string, max = 4000): string {
  if (!input) return ''
  if (input.length <= max) return input
  return `${input.slice(0, max)}\n...[truncated]`
}

function inferProjectNameFromPrompt(prompt: string): string | null {
  const quoted = prompt.match(/called\s+"([^"]{2,80})"/i)
  if (quoted?.[1]) return quoted[1].trim()

  const named = prompt.match(/(?:build|create)\s+(?:a|an)?\s*(?:mobile\s+)?app\s+(?:called|named)\s+([A-Za-z0-9\s\-_]{2,80})/i)
  if (named?.[1]) return named[1].trim()

  return null
}

function shouldForceScaffoldFallback(prompt: string): boolean {
  return /\b(build|create|generate|app)\b/i.test(prompt)
}

function extractTextByTag(source: string, tag: string): string[] {
  const out: string[] = []
  const rx = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  let m: RegExpExecArray | null
  while ((m = rx.exec(source)) !== null) {
    const val = m[1].replace(/\s+/g, ' ').trim()
    if (val) out.push(val)
    if (out.length >= 6) break
  }
  return out
}

function normalizeUserDesignRequest(raw: string): { modelMessage: string; normalized: boolean; notes: string[] } {
  const notes: string[] = []
  const trimmed = raw.trim()
  if (!trimmed) return { modelMessage: raw, normalized: false, notes }

  const lower = trimmed.toLowerCase()
  const looksLikeFullHtml = /<!doctype html|<html[\s>]|<head[\s>]|<body[\s>]/i.test(trimmed) && trimmed.length > 2500
  const cloneIntent = /\b(replica(?:te)?|clone|copy\s+exact|same\s+as|1:1)\b/i.test(lower)
  const bananiMention = /\bbanani\b/i.test(lower)

  if (!looksLikeFullHtml && !cloneIntent && !bananiMention) {
    return { modelMessage: raw, normalized: false, notes }
  }

  let normalizedMessage = trimmed

  if (looksLikeFullHtml) {
    const titles = extractTextByTag(trimmed, 'title')
    const metaDescriptionMatch = trimmed.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    const hasGradient = /linear-gradient|radial-gradient/i.test(trimmed)
    const hasInter = /inter\.css|font-family[^>]*inter/i.test(trimmed)
    const hasCards = /card|shadow|border-radius|rounded/i.test(trimmed)
    const hasNav = /<nav|header|menu/i.test(trimmed)
    const hasHero = /hero|welcome|home/i.test(trimmed)

    const signals: string[] = []
    if (titles.length) signals.push(`title ideas: ${titles.join(' | ')}`)
    if (metaDescriptionMatch?.[1]) signals.push(`meta description: ${metaDescriptionMatch[1]}`)
    if (hasInter) signals.push('typography: clean sans style')
    if (hasGradient) signals.push('visual style: gradient accents/backgrounds')
    if (hasCards) signals.push('layout style: card-based surfaces with subtle depth')
    if (hasNav) signals.push('structure: top navigation/header')
    if (hasHero) signals.push('structure: strong hero section with CTA')

    normalizedMessage = [
      'User supplied a full HTML dump as visual reference.',
      'Do NOT reproduce copyrighted markup or brand-identical copy.',
      'Create an ORIGINAL design with similar vibe and structure only.',
      'Extracted style signals:',
      ...signals.map((s) => `- ${s}`),
      '',
      'Deliverables:',
      '- Build screens/components in DCCortex format only (no raw HTML output).',
      '- Use clean, production UI with coherent spacing, typography, and navigation.',
      '- Keep naming/content original (no Banani brand usage).',
    ].join('\n')
    notes.push('Normalized oversized HTML reference into a compact design brief.')
  }

  if (cloneIntent || bananiMention) {
    normalizedMessage += '\n\nConstraint: user asked for cloning a third-party brand. Refuse exact cloning and produce an original, non-infringing variation with similar UX intent.'
    notes.push('Converted direct clone request into non-infringing inspired-build constraint.')
  }

  return { modelMessage: normalizedMessage, normalized: true, notes }
}

// Filter actions for Design mode — only allow screen creation, reject project/database/API actions
function filterDesignActions(actions: CortexAction[]): { filtered: CortexAction[]; rejected: string[] } {
  const DESIGN_FORBIDDEN_ACTIONS = new Set([
    'create_project',
    'delete_project',
    'update_project_settings',
    'create_table',
    'update_table',
    'delete_table',
    'add_rows',
    'update_rows',
    'delete_rows',
    'create_api_source',
    'delete_api_source',
    'validate_api',
    'execute_query',
    'create_webhook',
    'delete_webhook',
  ])

  const filtered: CortexAction[] = []
  const rejected: string[] = []

  for (const action of actions) {
    if (DESIGN_FORBIDDEN_ACTIONS.has(action.type)) {
      rejected.push(action.type)
    } else {
      filtered.push(action)
    }
  }

  return { filtered, rejected }
}

// Simple in-memory rate limiter: 20 requests per user per minute

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60_000

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  if (!checkRateLimit(userId)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before sending another message.' },
      { status: 429 }
    )
  }

  if (!GEMINI_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  let body: {
    message: string
    threadId?: string
    organizationId: string
    projectId?: string | null
    model?: string
    mode?: 'cortex' | 'design'
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { message, organizationId, projectId, mode = 'cortex' } = body
  const selectedModel = body.model ?? 'gemini-2.5-flash'
  const normalizedReq = normalizeUserDesignRequest(message)
  const modelInputMessage = normalizedReq.modelMessage

  if (!message?.trim() || !organizationId) {
    return NextResponse.json({ error: 'message and organizationId required' }, { status: 400 })
  }

  // Verify org membership
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    include: { organization: true },
  })
  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 })
  }

  // Get or create thread
  let threadId = body.threadId
  let thread = threadId
    ? await prisma.cortexThread.findFirst({ where: { id: threadId, userId } })
    : null

  if (!thread) {
    thread = await prisma.cortexThread.create({
      data: {
        userId,
        organizationId,
        projectId: projectId ?? null,
        title: message.slice(0, 80),
      },
    })
    threadId = thread.id
  }

  // Update thread's project context if changed
  if (projectId !== undefined && thread.projectId !== projectId) {
    await prisma.cortexThread.update({
      where: { id: thread.id },
      data: { projectId: projectId ?? null },
    })
  }

  // Save user message
  await prisma.cortexMessage.create({
    data: { threadId: thread.id, role: 'user', content: message },
  })

  // Gather project context for system prompt
  let projectContext: {
    projectName?: string
    projectScreens?: { id: string; name: string; slug: string }[]
    projectScreenSummaries?: { id: string; name: string; slug: string; layout: string | null }[]
    projectTables?: { id: string; name: string; columns: { name: string; type: string }[] }[]
    projectApiSources?: { id: string; name: string; url: string; method: string }[]
    projectReusables?: { id: string; name: string; propsSchema?: object[] }[]
  } = {}

  const activeProjectId = projectId ?? thread.projectId
  if (activeProjectId) {
    const project = await prisma.project.findUnique({
      where: { id: activeProjectId },
      select: { name: true },
    })
    const screens = await prisma.appScreen.findMany({
      where: { projectId: activeProjectId, slug: { not: '__globals__' } },
      select: { id: true, name: true, slug: true, layout: true },
      orderBy: { sortOrder: 'asc' },
    })
    const ds = await prisma.internalDatasource.findUnique({
      where: { projectId: activeProjectId },
      include: {
        tables: {
          include: { columns: { select: { name: true, type: true }, orderBy: { sortOrder: 'asc' } } },
          orderBy: { name: 'asc' },
        },
      },
    })
    const apiSources = await prisma.externalApiSource.findMany({
      where: { projectId: activeProjectId },
      select: { id: true, name: true, url: true, method: true },
    })
    const globalsScreen = await prisma.appScreen.findFirst({
      where: { projectId: activeProjectId, slug: '__globals__' },
      select: { layout: true },
    })
    const existingReusables: { id: string; name: string; propsSchema?: object[] }[] =
      Array.isArray((globalsScreen?.layout as any)?.reusables)
        ? (globalsScreen!.layout as any).reusables.map((r: any) => ({
            id: r.id,
            name: r.name,
            ...(r.propsSchema ? { propsSchema: r.propsSchema } : {}),
          }))
        : []

    projectContext = {
      projectName: project?.name ?? undefined,
      projectScreens: screens.map(s => ({ id: s.id, name: s.name, slug: s.slug })),
      projectScreenSummaries: screens.map(s => ({
        id: s.id, name: s.name, slug: s.slug,
        layout: s.layout ? JSON.stringify(s.layout).slice(0, 12000) : null,
      })),
      projectTables: ds?.tables.map((t) => ({
        id: t.id,
        name: t.name,
        columns: t.columns.map((c) => ({ name: c.name, type: c.type })),
      })),
      projectApiSources: apiSources,
      projectReusables: existingReusables,
    }
  }

  // Build system prompt based on mode
  const systemPrompt = mode === 'design'
    ? buildDesignSystemPrompt({
        orgId: organizationId,
        orgName: membership.organization.name,
      })
    : buildSystemPrompt({
        orgId: organizationId,
        orgName: membership.organization.name,
        projectId: activeProjectId,
        projectName: projectContext.projectName,
        projectScreens: projectContext.projectScreens,
        projectScreenSummaries: projectContext.projectScreenSummaries,
        projectTables: projectContext.projectTables,
        projectApiSources: projectContext.projectApiSources,
        projectReusables: projectContext.projectReusables,
        conversationSummary: thread.summary,
      })

  // Fetch recent messages for context
  const recentMessages = await prisma.cortexMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: 'desc' },
    take: MAX_CONTEXT_MESSAGES,
  })
  recentMessages.reverse()

  // Build Gemini conversation history
  const geminiHistory = recentMessages
    .filter((m) => m.role !== 'system')
    .slice(0, -1) // exclude the message we just added
    .map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: m.content }],
    }))

  // ── SSE helpers ────────────────────────────────────────────
  const encoder = new TextEncoder()

  function inferThinkingStep(text: string): string {
    if (text.includes('"create_project"')) return 'Creating project...'
    if (text.includes('"update_globals"')) return 'Configuring global theme...'
    if (text.includes('"create_table"')) return 'Designing database schema...'
    if (text.includes('"add_rows"')) return 'Seeding sample data...'
    if (text.includes('"validate_api"')) return 'Validating external API...'
    if (text.includes('"create_screen"')) return 'Building screen layouts...'
    if (text.includes('"update_screen"')) return 'Updating screen design...'
    if (text.includes('"create_api_source"')) return 'Connecting external API...'
    if (text.includes('"actions"')) return 'Planning actions...'
    if (text.includes('"message"')) return 'Writing response...'
    return 'Generating response...'
  }

  function extractJson(raw: string): string {
    // Strip markdown code fences if present
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenced) return fenced[1].trim()
    // Try to find the outermost JSON object containing "message" and "actions"
    // Scan for opening brace, then find the matching closing brace
    const firstBrace = raw.indexOf('{')
    if (firstBrace === -1) return raw.trim()
    let depth = 0
    let inStr = false
    let escape = false
    for (let i = firstBrace; i < raw.length; i++) {
      const ch = raw[i]
      if (escape) { escape = false; continue }
      if (ch === '\\') { escape = true; continue }
      if (ch === '"') { inStr = !inStr; continue }
      if (inStr) continue
      if (ch === '{') depth++
      else if (ch === '}') { depth--; if (depth === 0) return raw.slice(firstBrace, i + 1) }
    }
    // Fallback: first { to last }
    const e = raw.lastIndexOf('}')
    if (e > firstBrace) return raw.slice(firstBrace, e + 1)
    return raw.trim()
  }

  // Build Gemini model — NO responseMimeType so streaming works
  const genAI = new GoogleGenerativeAI(GEMINI_KEY)
  const geminiModel = genAI.getGenerativeModel({
    model: selectedModel,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 65536,
      // responseMimeType intentionally omitted — incompatible with streaming
    },
  })

  // Non-stream strict JSON model for repair/self-heal paths.
  const geminiJsonModel = genAI.getGenerativeModel({
    model: selectedModel,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 32768,
      responseMimeType: 'application/json',
    },
  })

  // ── Streaming response ──────────────────────────────────────
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* stream closed */ }
      }

      try {
        push({ type: 'thinking', step: 'Analyzing your request...' })

        const chat = geminiModel.startChat({ history: geminiHistory })

        let accumulatedText = ''
        let lastThinkStep = ''
        let lastThinkAt = Date.now()

        const streamResult = await chat.sendMessageStream(modelInputMessage)
        for await (const chunk of streamResult.stream) {
          accumulatedText += chunk.text()
          const now = Date.now()
          if (now - lastThinkAt > 350) {
            const step = inferThinkingStep(accumulatedText)
            if (step !== lastThinkStep) {
              push({ type: 'thinking', step })
              lastThinkStep = step
            }
            lastThinkAt = now
          }
        }

        // Parse JSON from accumulated text
        let parseMode: DebugTrace['parseMode'] = 'json'
        let parseError: string | undefined
        let repairAttempted = false
        let repairSucceeded = false
        let repairError: string | undefined
        let selfHealAttempted = false
        let selfHealSucceeded = false
        let selfHealError: string | undefined
        let extractedJsonPreview: string | undefined
        let extractedJsonFull: string | undefined
        let aiResponse: { message: string; actions: CortexAction[]; followUp?: string | null }
        try {
          const extracted = extractJson(accumulatedText)
          extractedJsonFull = extracted
          extractedJsonPreview = truncateText(extracted)
          let parsed = JSON.parse(extracted)

          // ── Detect export-format JSON and convert to action format ──
          // AI sometimes outputs { "exportVersion": 1, "screens": [...] } instead of { "message": ..., "actions": [...] }
          if (parsed.exportVersion || (parsed.screens && Array.isArray(parsed.screens) && !parsed.actions)) {
            console.warn('[Cortex] AI produced export-format JSON instead of action format — converting')
            const actions: CortexAction[] = []
            const screenEntries = parsed.screens ?? []
            for (const s of screenEntries) {
              if (s.name && s.slug && s.layout) {
                actions.push({
                  type: 'create_screen',
                  params: {
                    projectId: activeProjectId ?? '$lastProjectId',
                    name: s.name,
                    slug: s.slug,
                    layout: s.layout,
                  },
                } as CortexAction)
              }
            }
            // Extract the preamble text before the JSON as the message
            const preambleEnd = accumulatedText.indexOf('```')
            const jsonStart = accumulatedText.indexOf('{')
            let preamble = ''
            if (preambleEnd > 0) {
              preamble = accumulatedText.slice(0, preambleEnd).trim()
            } else if (jsonStart > 0) {
              preamble = accumulatedText.slice(0, jsonStart).trim()
            }
            if (!preamble) preamble = `I'm building ${screenEntries.length} screen${screenEntries.length !== 1 ? 's' : ''} for you.`

            parsed = {
              message: preamble,
              actions,
              followUp: 'Want me to adjust anything?',
            }
          }

          aiResponse = parsed
          if (!aiResponse.message) aiResponse.message = ''
          if (!Array.isArray(aiResponse.actions)) aiResponse.actions = []
        } catch (err: unknown) {
          parseMode = 'fallback'
          parseError = err instanceof Error ? err.message : String(err)
          repairAttempted = true
          push({ type: 'thinking', step: 'Response format invalid, repairing action JSON...' })

          try {
            const repairPrompt = [
              'Convert the following assistant response into ONE valid JSON object with this exact shape:',
              '{"message":"...","actions":[...],"followUp":"..."}',
              'Rules:',
              '- Output ONLY JSON, no markdown, no explanation.',
              '- If technical details are unknown, keep actions minimal and truthful.',
              '- Keep message concise and factual.',
              '- If no executable actions can be recovered, set actions to [].',
              'Assistant response to convert:',
              accumulatedText,
            ].join('\n')

            const repairResult = await geminiJsonModel.generateContent(repairPrompt)
            const repairedText = repairResult.response.text()
            const repairedExtracted = extractJson(repairedText)
            extractedJsonFull = repairedExtracted
            extractedJsonPreview = truncateText(repairedExtracted)
            const repairedParsed = JSON.parse(repairedExtracted)

            aiResponse = repairedParsed
            if (!aiResponse.message) aiResponse.message = ''
            if (!Array.isArray(aiResponse.actions)) aiResponse.actions = []
            repairSucceeded = true
          } catch (repairErr: unknown) {
            repairError = repairErr instanceof Error ? repairErr.message : String(repairErr)
            selfHealAttempted = true
            push({ type: 'thinking', step: 'Format recovery failed, triggering self-heal regeneration...' })

            try {
              const selfHealPrompt = [
                'You are repairing a failed tool-response format for an app-builder workflow.',
                'Return ONLY one valid JSON object with EXACT shape:',
                '{"message":"...","actions":[...],"followUp":"..."}',
                'Strict rules:',
                '- Output only JSON, no markdown fences or preface.',
                '- Actions must be executable and internally consistent with placeholders.',
                '- If the full request is too large, prioritize foundational execution now:',
                '  create_project, core create_table/add_rows, create 3-5 connected screens, then ask to continue.',
                '- Never claim complete unless actions actually include what you claim.',
                '- Keep actions concise and valid over verbosity.',
                'Original user request:',
                modelInputMessage,
              ].join('\n')

              const selfHealResult = await geminiJsonModel.generateContent(selfHealPrompt)
              const healedText = selfHealResult.response.text()
              const healedExtracted = extractJson(healedText)
              extractedJsonFull = healedExtracted
              extractedJsonPreview = truncateText(healedExtracted)
              const healedParsed = JSON.parse(healedExtracted)

              aiResponse = healedParsed
              if (!aiResponse.message) aiResponse.message = 'Recovered from formatting issue and started execution.'
              if (!Array.isArray(aiResponse.actions)) aiResponse.actions = []

              selfHealSucceeded = aiResponse.actions.length > 0
              if (!selfHealSucceeded) {
                throw new Error('Self-heal produced no executable actions')
              }
            } catch (selfHealErr: unknown) {
              selfHealError = selfHealErr instanceof Error ? selfHealErr.message : String(selfHealErr)

              // Last fallback: never return a pure no-op for app-build requests.
              const inferredName = inferProjectNameFromPrompt(message) ?? 'Recovered App'
              if (shouldForceScaffoldFallback(message)) {
                aiResponse = {
                  message: `Formatting recovery failed, so I created a scaffold project (${inferredName}) and starter dashboard screen to keep progress moving. I can continue building the remaining screens next.`,
                  actions: [
                    {
                      type: 'create_project',
                      params: {
                        name: inferredName,
                        description: 'Auto-recovered scaffold after formatting failure.',
                      },
                    } as CortexAction,
                    {
                      type: 'create_screen',
                      params: {
                        projectId: '$lastProjectId',
                        name: 'Dashboard',
                        slug: 'dashboard',
                        layout: {
                          root: {
                            id: 'root',
                            type: 'container',
                            props: { display: 'flex', flexDirection: 'column', gap: 8, padding: 12, width: '100%', minHeight: '100vh' },
                            children: [
                              {
                                id: 'title',
                                type: 'text',
                                props: { content: inferredName, variant: 'h2', fontWeight: '700' },
                                children: [],
                              },
                              {
                                id: 'subtitle',
                                type: 'text',
                                props: { content: 'Scaffold created via self-heal recovery.', variant: 'body' },
                                children: [],
                              },
                            ],
                          },
                        },
                      },
                    } as CortexAction,
                  ],
                  followUp: 'Continue with full schema, APIs, and connected screens?',
                }
              } else {
                let cleanMessage = accumulatedText
                  .replace(/```(?:json)?\s*[\s\S]*?```/g, '')
                  .replace(/```(?:json)?\s*[\s\S]*/g, '')
                  .replace(/\{[\s\S]*?"(?:actions|screens|exportVersion)"\s*:\s*[\s\S]*$/g, '')
                  .trim()
                if (!cleanMessage) cleanMessage = 'I generated a response but encountered a formatting issue. Please try again.'
                aiResponse = { message: cleanMessage, actions: [], followUp: null }
              }
            }
          }
        }

        // Execute actions with per-action SSE progress
        let actionResults: ActionResult[] = []
        let designRejectedActions: string[] = []
        let designSandboxProjectId: string | null = null
        
        // For Design mode, filter out forbidden actions and inject sandbox project ID
        let actionsToExecute = aiResponse.actions
        if (mode === 'design') {
          const { filtered, rejected } = filterDesignActions(aiResponse.actions)
          actionsToExecute = filtered
          designRejectedActions = rejected
          if (rejected.length > 0) {
            const rejectedList = rejected.join(', ')
            aiResponse.message = `${aiResponse.message}\n\n*Note: I skipped ${rejected.length} backend action(s) (${rejectedList}) since Design creates mockups only.`
          }

          // If Design has create_screen actions, ensure a Design Sandbox project exists
          const hasScreenActions = actionsToExecute.some(a => a.type === 'create_screen' || a.type === 'update_screen' || a.type === 'delete_screen')
          if (hasScreenActions) {
            // Find or create the "Design Sandbox" project for this org
            let sandboxProject = await prisma.project.findFirst({
              where: { organizationId, slug: '__design-sandbox__' },
              select: { id: true },
            })
            if (!sandboxProject) {
              sandboxProject = await prisma.project.create({
                data: {
                  organizationId,
                  userId,
                  name: 'Design Sandbox',
                  slug: '__design-sandbox__',
                  description: 'Auto-created project for DCFlow design mockups.',
                  status: 'draft',
                },
                select: { id: true },
              })
            }
            designSandboxProjectId = sandboxProject.id

            // Inject the sandbox projectId into all screen actions
            actionsToExecute = actionsToExecute.map(action => {
              if (action.type === 'create_screen' || action.type === 'update_screen' || action.type === 'delete_screen') {
                return { ...action, params: { ...action.params, projectId: sandboxProject!.id } }
              }
              return action
            }) as typeof actionsToExecute

            // Also update thread to track this project so UI can show link
            await prisma.cortexThread.update({
              where: { id: thread.id },
              data: { projectId: sandboxProject.id },
            })
          }
        }
        
        if (actionsToExecute.length > 0) {
          push({ type: 'thinking', step: `Executing ${actionsToExecute.length} action${actionsToExecute.length !== 1 ? 's' : ''}...` })
          actionResults = await executeActionsStreaming(
            actionsToExecute,
            userId,
            organizationId,
            (evt) => {
              if (evt.type === 'action_start') {
                push({ type: 'action', actionType: evt.actionType, status: 'running' })
              } else {
                push({ type: 'action', actionType: evt.actionType, status: 'done', ok: evt.result.success, result: evt.result })
              }
            }
          )
        }

        const failedActions = actionResults
          .filter((result) => !result.success)
          .map((result) => ({ type: result.type, error: result.error }))

        if (failedActions.length > 0) {
          const failedTypes = Array.from(new Set(failedActions.map((f) => f.type))).join(', ')
          const suffix = `\n\nExecution warning: ${failedActions.length} action(s) failed (${failedTypes}). Check Debug trace before treating this build as complete.`
          aiResponse.message = `${aiResponse.message ?? ''}${suffix}`.trim()
        }

        const debugTrace: DebugTrace = {
          model: selectedModel,
          userPrompt: truncateText(message, 1200),
          parseMode,
          parseError,
          repairAttempted,
          repairSucceeded,
          repairError,
          selfHealAttempted,
          selfHealSucceeded,
          selfHealError,
          rawOutputPreview: truncateText(accumulatedText),
          extractedJsonPreview,
          parsedActionCount: aiResponse.actions.length,
          parsedActionTypes: aiResponse.actions.map((action) => action.type),
          failedActionCount: failedActions.length,
          failedActions,
        }

        const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        const auditArtifact: AuditArtifact = {
          runId,
          createdAt: new Date().toISOString(),
          threadId: thread.id,
          organizationId,
          userId,
          projectId: activeProjectId ?? null,
          model: selectedModel,
          prompt: safeLongText(message, 80_000),
          parse: {
            mode: parseMode,
            parseError,
            repairAttempted,
            repairSucceeded,
            repairError,
            selfHealAttempted,
            selfHealSucceeded,
            selfHealError,
          },
          generation: {
            rawModelOutput: safeLongText(accumulatedText),
            extractedJson: extractedJsonFull ? safeLongText(extractedJsonFull) : undefined,
            parsedActionTypes: aiResponse.actions.map((action) => action.type),
            parsedActionCount: aiResponse.actions.length,
            assistantMessage: aiResponse.message ?? '',
            followUp: aiResponse.followUp ?? null,
          },
          execution: {
            actionResults,
            failedActions,
            failedActionCount: failedActions.length,
          },
          assessments: {
            warnings: assessPromptContract(modelInputMessage, aiResponse.actions, actionResults, aiResponse.message ?? ''),
          },
        }

        if (normalizedReq.normalized && normalizedReq.notes.length > 0) {
          auditArtifact.assessments.warnings.push(...normalizedReq.notes)
        }

        try {
          const savedAudit = await persistAuditArtifact(auditArtifact)
          debugTrace.auditRunId = savedAudit.runId
          debugTrace.auditFile = savedAudit.relativeFile
        } catch (auditErr: unknown) {
          const msg = auditErr instanceof Error ? auditErr.message : String(auditErr)
          console.warn('[Cortex] Failed to persist audit artifact:', msg)
        }

        // Save assistant message to DB
        await prisma.cortexMessage.create({
          data: {
            threadId: thread.id,
            role: 'assistant',
            content: JSON.stringify(aiResponse),
            metadata: JSON.parse(JSON.stringify({ actionResults, debugTrace, auditArtifact })),
          },
        })

        // Auto-title thread from first message
        if (thread.title === message.slice(0, 80) || thread.title === 'New conversation') {
          try {
            const titleResult = await geminiModel.generateContent(
              `Summarize this in 4-6 words as a chat title (no quotes): "${message}"`
            )
            const title = titleResult.response.text().replace(/["']/g, '').trim().slice(0, 80)
            if (title) {
              await prisma.cortexThread.update({ where: { id: thread.id }, data: { title } })
            }
          } catch { /* ignore */ }
        }

        // Summarize conversation periodically (every 10 messages)
        const msgCount = await prisma.cortexMessage.count({ where: { threadId: thread.id } })
        if (msgCount > 0 && msgCount % 10 === 0) {
          try {
            const allMsgs = await prisma.cortexMessage.findMany({
              where: { threadId: thread.id },
              orderBy: { createdAt: 'asc' },
              select: { role: true, content: true },
            })
            const convoText = allMsgs.map((m) => `${m.role}: ${m.content.slice(0, 200)}`).join('\n')
            const summaryResult = await geminiModel.generateContent(
              `Summarize this conversation concisely for context retention (max 500 chars):\n${convoText}`
            )
            const summary = summaryResult.response.text().slice(0, 500)
            await prisma.cortexThread.update({ where: { id: thread.id }, data: { summary } })
          } catch { /* ignore */ }
        }

        // Send final message + done events
        push({
          type: 'message',
          text: aiResponse.message,
          followUp: aiResponse.followUp ?? null,
          threadId: thread.id,
        })
        push({ type: 'done', threadId: thread.id, projectId: designSandboxProjectId ?? (activeProjectId ?? null), actionResults, debugTrace, auditArtifact })

      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error('[Cortex] Streaming error:', errMsg)
        // Save error to DB
        try {
          await prisma.cortexMessage.create({
            data: {
              threadId: thread.id,
              role: 'assistant',
              content: JSON.stringify({ message: `AI error: ${errMsg}`, actions: [], followUp: null }),
              metadata: { error: errMsg },
            },
          })
        } catch { /* ignore */ }
        push({ type: 'error', message: errMsg, threadId: thread.id })
      } finally {
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
