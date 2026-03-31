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

  if (playMode === 'parallel') {
    // Play all animations at once
    const animations = sequence.steps
      .map((step) => buildAnimationString(step))
      .join(', ')

    element.style.animation = animations
    onStart?.()

    // Listen for completion
    await new Promise<void>((resolve) => {
      const handleAnimationEnd = () => {
        element.removeEventListener('animationend', handleAnimationEnd)
        element.removeEventListener('animationiteration', handleAnimationTick)
        onEnd?.()
        resolve()
      }
      const handleAnimationTick = () => {
        onTick?.()
      }
      element.addEventListener('animationend', handleAnimationEnd, { once: true })
      element.addEventListener('animationiteration', handleAnimationTick)
    })
  } else {
    // Sequential: play one after another
    for (let i = 0; i < sequence.steps.length; i++) {
      const step = sequence.steps[i]
      const isFirst = i === 0
      const isLast = i === sequence.steps.length - 1

      if (isFirst) {
        onStart?.()
      }

      // Play this animation
      element.style.animation = buildAnimationString(step)

      // Wait for completion
      await new Promise<void>((resolve) => {
        const handleAnimationEnd = () => {
          element.removeEventListener('animationend', handleAnimationEnd)
          element.removeEventListener('animationiteration', handleAnimationTick)

          if (isLast) {
            onEnd?.()
          }
          resolve()
        }
        const handleAnimationTick = () => {
          onTick?.()
        }
        element.addEventListener('animationend', handleAnimationEnd, { once: true })
        element.addEventListener('animationiteration', handleAnimationTick)
      })

      // Clear animation for next step (if any)
      element.style.animation = 'none'
    }
  }
}

/** Build CSS animation string from a single step */
function buildAnimationString(step: AnimationStep): string {
  const duration = step.duration || '0.5s'
  const timing = step.timingFunction || 'ease'
  const delay = step.delay || '0s'
  const iteration = step.iterationCount || '1'
  const fillMode = 'both'

  return `${step.preset} ${duration} ${timing} ${delay} ${iteration} ${fillMode}`
}

/**
 * Clear animation from element and reset state
 */
export function clearAnimationSequence(element: HTMLElement | null): void {
  if (!element) return
  element.style.animation = 'none'
  element.style.animationPlayState = 'running'
}
