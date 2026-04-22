/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import React, { useState } from 'react'
import { ChevronUp, ChevronDown, Trash2, Plus, GripVertical, HelpCircle } from 'lucide-react'

import type { AnimationStep, AnimationSequenceConfig } from '@dccortex/runtime-kernel';

const ANIMATION_PRESETS: { label: string; value: string; description: string }[] = [
  { label: 'Fade in', value: 'fadeIn', description: 'Fade element into view' },
  { label: 'Fade out', value: 'fadeOut', description: 'Fade element out' },
  { label: 'Slide up', value: 'slideInUp', description: 'Slide in from bottom' },
  { label: 'Slide down', value: 'slideInDown', description: 'Slide in from top' },
  { label: 'Slide left', value: 'slideInLeft', description: 'Slide in from right' },
  { label: 'Slide right', value: 'slideInRight', description: 'Slide in from left' },
  { label: 'Zoom in', value: 'zoomIn', description: 'Scale up entrance' },
  { label: 'Zoom out', value: 'zoomOut', description: 'Scale down exit' },
  { label: 'Bounce in', value: 'bounceIn', description: 'Elastic bounce entrance' },
  { label: 'Pulse', value: 'pulse', description: 'Repeating scale pulse' },
  { label: 'Shake', value: 'shake', description: 'Shake side-to-side' },
  { label: 'Spin', value: 'spin', description: '360° rotation loop' },
  { label: 'Ping', value: 'ping', description: 'Expanding ripple effect' },
  { label: 'Float', value: 'float', description: 'Gentle up-down floating' },
]

const TIMING_FUNCTIONS = ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'step-start', 'step-end', 'cubic-bezier(0.4,0,0.2,1)']
const ITERATION_OPTIONS = ['1', '2', '3', '4', '5', 'infinite']
const SEQUENCE_ITERATION_OPTIONS = ['1', '2', '3', '4', '5', 'infinite']

type Props = {
  value?: AnimationSequenceConfig
  onChange: (config: AnimationSequenceConfig) => void
}

export const AnimationSequenceBuilder: React.FC<Props> = ({ value, onChange }) => {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null)
  const [showPresetPicker, setShowPresetPicker] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const config = value || { steps: [], playMode: 'sequential', sequenceIterationCount: '1', tickMode: 'per-step', tickEvery: 1 }

  const updateStep = (id: string, updates: Partial<AnimationStep>) => {
    const newSteps = config.steps.map((s) => (s.id === id ? { ...s, ...updates } : s))
    onChange({ ...config, steps: newSteps })
  }

  const removeStep = (id: string) => {
    const newSteps = config.steps.filter((s) => s.id !== id)
    onChange({ ...config, steps: newSteps })
  }

  const addStep = (preset: string) => {
    const newStep: AnimationStep = {
      id: Math.random().toString(36).slice(2, 9),
      preset,
      iterationCount: '1',
      mode: 'auto',
    }
    onChange({ ...config, steps: [...config.steps, newStep] })
    setShowPresetPicker(false)
  }

  const moveStep = (id: string, direction: 'up' | 'down') => {
    const idx = config.steps.findIndex((s) => s.id === id)
    if (idx === -1) return

    const newSteps = [...config.steps]
    if (direction === 'up' && idx > 0) {
      [newSteps[idx], newSteps[idx - 1]] = [newSteps[idx - 1], newSteps[idx]]
    } else if (direction === 'down' && idx < newSteps.length - 1) {
      [newSteps[idx], newSteps[idx + 1]] = [newSteps[idx + 1], newSteps[idx]]
    }
    onChange({ ...config, steps: newSteps })
  }

  const handleDragStart = (id: string) => setDraggedId(id)
  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      return
    }
    const dragIdx = config.steps.findIndex((s) => s.id === draggedId)
    const targetIdx = config.steps.findIndex((s) => s.id === targetId)
    if (dragIdx === -1 || targetIdx === -1) return

    const newSteps = [...config.steps]
    ;[newSteps[dragIdx], newSteps[targetIdx]] = [newSteps[targetIdx], newSteps[dragIdx]]
    onChange({ ...config, steps: newSteps })
    setDraggedId(null)
  }

  return (
    <div className="space-y-3">
      {/* Help tip */}
      <div className="flex items-start gap-2 p-2 rounded bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40">
        <HelpCircle className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <div className="text-[11px] text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-medium">Animation Sequences</p>
          <p>
            Chain multiple animations in order. Drag to reorder. Use <strong>Auto</strong> to play sequentially, or <strong>Manual</strong> to trigger via events.
          </p>
        </div>
      </div>

      {/* Play mode toggle */}
      <div className="flex gap-2">
        <label className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
          Play Mode:
        </label>
        <div className="flex gap-1 border border-gray-300 dark:border-[#30363d] rounded p-0.5">
          {(['sequential', 'parallel'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ ...config, playMode: mode })}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                config.playMode === mode
                  ? 'bg-blue-500 text-white'
                  : 'bg-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {mode === 'sequential' ? '↓ Sequential' : '↕ Parallel'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Sequence Loop</label>
          <select
            value={config.sequenceIterationCount || '1'}
            onChange={(e) => onChange({ ...config, sequenceIterationCount: e.target.value })}
            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white rounded"
          >
            {SEQUENCE_ITERATION_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Tick Mode</label>
          <select
            value={config.tickMode || 'per-step'}
            onChange={(e) => onChange({ ...config, tickMode: e.target.value as 'per-step' | 'per-sequence' })}
            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white rounded"
          >
            <option value="per-step">Per step iteration</option>
            <option value="per-sequence">Per sequence cycle</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Tick Every</label>
        <input
          type="number"
          min={1}
          value={Number(config.tickEvery || 1)}
          onChange={(e) => onChange({ ...config, tickEvery: Math.max(1, Number(e.target.value || 1)) })}
          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white rounded"
        />
      </div>

      {/* Animation steps list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {config.steps.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-gray-300 dark:border-[#30363d] rounded">
            <p className="text-xs text-gray-500 dark:text-gray-400">No animations yet</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">Click the button below to add one</p>
          </div>
        ) : (
          config.steps.map((step, idx) => (
            <div
              key={step.id}
              draggable
              onDragStart={() => handleDragStart(step.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(step.id)}
              className={`border rounded p-2 space-y-2 transition-colors cursor-move ${
                draggedId === step.id
                  ? 'bg-gray-100 dark:bg-gray-800 border-gray-400 dark:border-gray-600 opacity-50'
                  : 'border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] hover:bg-gray-50 dark:hover:bg-[#161b22]'
              }`}
            >
              {/* Step header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {idx + 1}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                      {ANIMATION_PRESETS.find((p) => p.value === step.preset)?.label || step.preset}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      {ANIMATION_PRESETS.find((p) => p.value === step.preset)?.description}
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => moveStep(step.id, 'up')}
                    disabled={idx === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStep(step.id, 'down')}
                    disabled={idx === config.steps.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStep(step.id)}
                    className="p-1 text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedStepId(expandedStepId === step.id ? null : step.id)}
                    className="px-2 py-0.5 text-[10px] font-medium border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    {expandedStepId === step.id ? '▼' : '▶'}
                  </button>
                </div>
              </div>

              {/* Expandable fine-tune section */}
              {expandedStepId === step.id && (
                <div className="border-t border-gray-200 dark:border-[#30363d] pt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Duration</label>
                      <input
                        type="text"
                        value={step.duration || '0.5s'}
                        onChange={(e) => updateStep(step.id, { duration: e.target.value })}
                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white font-mono rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Delay</label>
                      <input
                        type="text"
                        value={step.delay || '0s'}
                        onChange={(e) => updateStep(step.id, { delay: e.target.value })}
                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white font-mono rounded"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Timing Function</label>
                      <select
                        value={step.timingFunction || 'ease'}
                        onChange={(e) => updateStep(step.id, { timingFunction: e.target.value })}
                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white rounded"
                      >
                        {TIMING_FUNCTIONS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Step Loop</label>
                      <select
                        value={step.iterationCount || '1'}
                        onChange={(e) => updateStep(step.id, { iterationCount: e.target.value })}
                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white rounded"
                      >
                        {ITERATION_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Trigger Mode</label>
                      <select
                        value={step.mode || 'auto'}
                        onChange={(e) => updateStep(step.id, { mode: e.target.value as 'auto' | 'manual' })}
                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white rounded"
                      >
                        <option value="auto">Auto (Wait for previous)</option>
                        <option value="manual">Manual (Trigger via event)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add animation button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowPresetPicker(!showPresetPicker)}
          className="w-full px-3 py-2 text-sm font-medium border border-dashed border-gray-300 dark:border-[#30363d] text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Animation
        </button>

        {showPresetPicker && (
          <div className="absolute top-full left-0 right-0 mt-1 border border-gray-300 dark:border-[#30363d] rounded bg-white dark:bg-[#0d1117] shadow-lg z-10 max-h-64 overflow-y-auto">
            {ANIMATION_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => addStep(p.value)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-950 border-b border-gray-200 dark:border-[#30363d] last:border-b-0 transition-colors"
              >
                <div className="font-medium text-gray-800 dark:text-gray-200">{p.label}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">{p.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Generated sequence preview */}
      {config.steps.length > 0 && (
        <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-[#30363d]">
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Generated Sequence</p>
          <code className="text-[10px] text-gray-700 dark:text-gray-300 font-mono break-all">
            {config.steps.map((s, i) => `${i + 1}. ${s.preset}`).join(' → ')}
          </code>
        </div>
      )}
    </div>
  )
}
