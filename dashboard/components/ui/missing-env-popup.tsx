/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useState, useEffect } from 'react'
import { X, AlertCircle, ExternalLink } from 'lucide-react'
import { Button } from './button'

interface MissingEnvVar {
  key: string
  description: string
  isRequired: boolean
}

interface MissingEnvPopupProps {
  missingVars: MissingEnvVar[]
  onAddToVariables: (vars: MissingEnvVar[]) => void
  onDismiss: () => void
}

export function MissingEnvPopup({ missingVars, onAddToVariables, onDismiss }: MissingEnvPopupProps) {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible || missingVars.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md bg-white border-2 border-red-200 shadow-lg">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} className="text-red-600" />
            <h3 className="font-semibold text-black">Missing Environment Variables</h3>
          </div>
          <button
            onClick={() => {
              setIsVisible(false)
              onDismiss()
            }}
            className="text-gray-400 hover:text-black"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-3">
          The AI detected that your code requires these environment variables:
        </p>

        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {missingVars.map((envVar) => (
            <div
              key={envVar.key}
              className="p-2 bg-gray-50 border border-gray-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <code className="text-sm font-mono text-black">{envVar.key}</code>
                  {envVar.isRequired && (
                    <span className="ml-2 text-xs text-red-600 font-medium">Required</span>
                  )}
                </div>
              </div>
              {envVar.description && (
                <p className="text-xs text-gray-500 mt-1">{envVar.description}</p>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => {
              onAddToVariables(missingVars)
              setIsVisible(false)
              onDismiss()
            }}
            size="sm"
            className="flex-1"
          >
            Add to Variables Tab
          </Button>
          <Button
            onClick={() => {
              setIsVisible(false)
              onDismiss()
            }}
            size="sm"
            variant="outline"
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  )
}

