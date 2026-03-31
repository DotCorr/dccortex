/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

type BuilderDragPayload =
  | { kind: 'tree-node'; nodeId: string }
  | { kind: 'component'; type: string; reusableId?: string }
  | null

const KEY = '__DCCORTEX_BUILDER_DRAG_PAYLOAD__'

function getWindowSafe(): (Window & { [KEY]?: BuilderDragPayload }) | null {
  if (typeof window === 'undefined') return null
  return window as Window & { [KEY]?: BuilderDragPayload }
}

export function setBuilderDragPayload(payload: Exclude<BuilderDragPayload, null>) {
  const w = getWindowSafe()
  if (!w) return
  w[KEY] = payload
}

export function getBuilderDragPayload(): BuilderDragPayload {
  const w = getWindowSafe()
  if (!w) return null
  return w[KEY] ?? null
}

export function clearBuilderDragPayload() {
  const w = getWindowSafe()
  if (!w) return
  w[KEY] = null
}
