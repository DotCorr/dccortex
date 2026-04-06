/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Animation sequence executor utility.
 * Plays multiple animations in sequence or parallel, firing events at appropriate times.
 */

import type { AnimationSequenceConfig, AnimationStep } from './AnimationSequenceBuilder'

const SEQUENCE_TOKEN_KEY = '__animationSequenceToken'

function normalizeAnimationTime(raw: unknown, fallback: string): string {
  const s = String(raw ?? '').trim()
  if (!s) return fallback
  if (/^-?\d*\.?\d+$/.test(s)) return `${s}s`
  if (/^-?\d*\.?\d+(ms|s)$/i.test(s)) return s
  return fallback
}

export type AnimationSequenceExecutorOptions = {
  previewMode?: boolean
  onStart?: () => void
  onEnd?: () => void
  onTick?: () => void
}

/**
 * Convert animation sequence to a CSS animation string and execute with events
 */
export async function executeAnimationSequence(
  element: HTMLElement | null,
  sequence: AnimationSequenceConfig | undefined,
  options: AnimationSequenceExecutorOptions
): Promise<void> {
  if (!element || !sequence || sequence.steps.length === 0) return
  if (!options.previewMode) return // Only execute in preview mode

  const { onStart, onEnd, onTick } = options
  const playMode = sequence.playMode || 'sequential'
  const tickMode = sequence.tickMode || 'per-step'
  const tickEvery = Math.max(1, Number(sequence.tickEvery ?? 1) || 1)
  const sequenceIterationRaw = String(sequence.sequenceIterationCount ?? '1').trim().toLowerCase()
  const sequenceIterations = sequenceIterationRaw === 'infinite' ? Infinity : Math.max(1, Number(sequenceIterationRaw) || 1)

  const token = Number((element as unknown as Record<string, unknown>)[SEQUENCE_TOKEN_KEY] ?? 0) + 1
  ;(element as unknown as Record<string, unknown>)[SEQUENCE_TOKEN_KEY] = token

  let stepTickCount = 0
  let sequenceTickCount = 0
  const isCancelled = () => Number((element as unknown as Record<string, unknown>)[SEQUENCE_TOKEN_KEY] ?? 0) !== token

  const playParallelOnce = async (): Promise<void> => {
    const animations = sequence.steps.map((step) => buildAnimationString(step)).join(', ')
    element.style.animation = animations

    await new Promise<void>((resolve) => {
      let ended = 0
      const expectedEnds = Math.max(1, sequence.steps.length)

      const cleanup = () => {
        element.removeEventListener('animationend', handleAnimationEnd)
        element.removeEventListener('animationcancel', handleAnimationCancel)
        element.removeEventListener('animationiteration', handleAnimationIteration)
      }

      const handleAnimationEnd = () => {
        ended += 1
        if (ended >= expectedEnds || isCancelled()) {
          cleanup()
          resolve()
        }
      }

      const handleAnimationCancel = () => {
        cleanup()
        resolve()
      }

      const handleAnimationIteration = () => {
        if (tickMode !== 'per-step') return
        stepTickCount += 1
        if (stepTickCount % tickEvery === 0) onTick?.()
      }

      element.addEventListener('animationend', handleAnimationEnd)
      element.addEventListener('animationcancel', handleAnimationCancel)
      element.addEventListener('animationiteration', handleAnimationIteration)
    })
  }

  const playSequentialOnce = async (): Promise<void> => {
    for (const step of sequence.steps) {
      if (isCancelled()) return

      element.style.animation = buildAnimationString(step)

      await new Promise<void>((resolve) => {
        const cleanup = () => {
          element.removeEventListener('animationend', handleAnimationEnd)
          element.removeEventListener('animationcancel', handleAnimationCancel)
          element.removeEventListener('animationiteration', handleAnimationIteration)
        }

        const handleAnimationEnd = () => {
          cleanup()
          resolve()
        }

        const handleAnimationCancel = () => {
          cleanup()
          resolve()
        }

        const handleAnimationIteration = () => {
          if (tickMode !== 'per-step') return
          stepTickCount += 1
          if (stepTickCount % tickEvery === 0) onTick?.()
        }

        element.addEventListener('animationend', handleAnimationEnd, { once: true })
        element.addEventListener('animationcancel', handleAnimationCancel, { once: true })
        element.addEventListener('animationiteration', handleAnimationIteration)
      })

      if (isCancelled()) return
      element.style.animation = 'none'
      void element.offsetWidth
    }
  }

  onStart?.()
  for (let cycle = 0; cycle < sequenceIterations || sequenceIterations === Infinity; cycle += 1) {
    if (isCancelled()) return
    if (playMode === 'parallel') await playParallelOnce()
    else await playSequentialOnce()
    if (isCancelled()) return

    if (tickMode === 'per-sequence') {
      sequenceTickCount += 1
      if (sequenceTickCount % tickEvery === 0) onTick?.()
    }

    if (sequenceIterations !== Infinity && cycle >= sequenceIterations - 1) break
  }

  if (!isCancelled()) onEnd?.()
}

/** Build CSS animation string from a single step */
function buildAnimationString(step: AnimationStep): string {
  const duration = normalizeAnimationTime(step.duration, '0.5s')
  const timing = step.timingFunction || 'ease'
  const delay = normalizeAnimationTime(step.delay, '0s')
  const iteration = step.iterationCount || '1'
  const fillMode = 'both'

  return `${step.preset} ${duration} ${timing} ${delay} ${iteration} ${fillMode}`
}

/**
 * Clear animation from element and reset state
 */
export function clearAnimationSequence(element: HTMLElement | null): void {
  if (!element) return
  ;(element as unknown as Record<string, unknown>)[SEQUENCE_TOKEN_KEY] = Number((element as unknown as Record<string, unknown>)[SEQUENCE_TOKEN_KEY] ?? 0) + 1
  element.style.animation = 'none'
  element.style.animationPlayState = 'running'
}
