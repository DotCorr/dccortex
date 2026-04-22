export type AnimationStep = {
  id: string
  /** Preset name like 'fadeIn', 'slideUp', or custom 'pulse 1.5s ease infinite' */
  preset: string
  /** Duration override, e.g. '0.5s' */
  duration?: string
  /** Timing function override */
  timingFunction?: string
  /** Delay before this animation starts */
  delay?: string
  /** Loop count for this step only: 1,2,3... or infinite */
  iterationCount?: string
  /** 'auto' = wait for prev to finish, 'manual' = trigger via event */
  mode?: 'auto' | 'manual'
}

export type AnimationSequenceConfig = {
  steps: AnimationStep[]
  /** 'sequential' = play one after another, 'parallel' = play all at once */
  playMode?: 'sequential' | 'parallel'
  /** Loop the full sequence N times (or infinite). */
  sequenceIterationCount?: string
  /** Emit onAnimationTick each step iteration or once per whole sequence cycle. */
  tickMode?: 'per-step' | 'per-sequence'
  /** Fire onAnimationTick every N cycles. */
  tickEvery?: number
}
