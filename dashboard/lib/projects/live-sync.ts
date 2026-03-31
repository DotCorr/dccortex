/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

type SyncSubscriber = (event: ProjectSyncEvent) => void

export type ProjectSyncEvent = {
  type: 'layout' | 'script' | 'globals' | 'screen' | 'presence'
  projectId: string
  screenId?: string
  clientId?: string
  payload?: unknown
  at: number
}

type PresenceEntry = {
  userId: string
  name: string | null
  screenId: string | null
  selectionId: string | null
  cursorX: number | null
  cursorY: number | null
  clientId: string
  updatedAt: number
}

type HubState = {
  subscribers: Map<string, Set<SyncSubscriber>>
  presence: Map<string, Map<string, PresenceEntry>>
}

function getHubState(): HubState {
  const g = globalThis as typeof globalThis & { __dccortexSyncHub?: HubState }
  if (!g.__dccortexSyncHub) {
    g.__dccortexSyncHub = {
      subscribers: new Map(),
      presence: new Map(),
    }
  }
  return g.__dccortexSyncHub
}

export function subscribeProjectSync(projectId: string, subscriber: SyncSubscriber): () => void {
  const state = getHubState()
  let set = state.subscribers.get(projectId)
  if (!set) {
    set = new Set<SyncSubscriber>()
    state.subscribers.set(projectId, set)
  }
  set.add(subscriber)

  return () => {
    const current = state.subscribers.get(projectId)
    if (!current) return
    current.delete(subscriber)
    if (current.size === 0) state.subscribers.delete(projectId)
  }
}

export function publishProjectSync(event: Omit<ProjectSyncEvent, 'at'>): void {
  const state = getHubState()
  const fullEvent: ProjectSyncEvent = { ...event, at: Date.now() }
  const subscribers = state.subscribers.get(event.projectId)
  if (!subscribers || subscribers.size === 0) return
  for (const fn of Array.from(subscribers)) {
    try {
      fn(fullEvent)
    } catch {
      // Ignore subscriber failures to keep fan-out robust.
    }
  }
}

function getProjectPresenceMap(projectId: string): Map<string, PresenceEntry> {
  const state = getHubState()
  let map = state.presence.get(projectId)
  if (!map) {
    map = new Map<string, PresenceEntry>()
    state.presence.set(projectId, map)
  }
  return map
}

export function upsertPresence(params: {
  projectId: string
  userId: string
  name: string | null
  screenId: string | null
  selectionId: string | null
  cursorX: number | null
  cursorY: number | null
  clientId: string
}): PresenceEntry[] {
  const map = getProjectPresenceMap(params.projectId)
  // Replace stale entries for the same user (common on refresh/new tab) so
  // collaborators do not see duplicate ghost cursors/avatars.
  for (const [existingClientId, entry] of Array.from(map.entries())) {
    if (existingClientId !== params.clientId && entry.userId === params.userId) {
      map.delete(existingClientId)
    }
  }
  map.set(params.clientId, {
    userId: params.userId,
    name: params.name,
    screenId: params.screenId,
    selectionId: params.selectionId,
    cursorX: params.cursorX,
    cursorY: params.cursorY,
    clientId: params.clientId,
    updatedAt: Date.now(),
  })
  return listPresence(params.projectId)
}

export function removePresence(projectId: string, clientId: string): PresenceEntry[] {
  const state = getHubState()
  const map = state.presence.get(projectId)
  if (!map) return []
  map.delete(clientId)
  if (map.size === 0) state.presence.delete(projectId)
  return listPresence(projectId)
}

export function listPresence(projectId: string): PresenceEntry[] {
  const map = getHubState().presence.get(projectId)
  if (!map) return []
  const now = Date.now()
  const ttlMs = 45_000
  for (const [clientId, entry] of Array.from(map.entries())) {
    if (now - entry.updatedAt > ttlMs) map.delete(clientId)
  }
  return Array.from(map.values()).map((p) => ({ ...p }))
}
