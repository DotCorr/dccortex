/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { Button } from './button'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

interface DialogContentProps {
  children: React.ReactNode
  className?: string
}

interface DialogHeaderProps {
  children: React.ReactNode
}

interface DialogTitleProps {
  children: React.ReactNode
}

interface DialogDescriptionProps {
  children: React.ReactNode
  className?: string
}

interface DialogTriggerProps {
  asChild?: boolean
  children: React.ReactNode
}

const DialogContext = React.createContext<{ onOpenChange: (open: boolean) => void }>({ onOpenChange: () => {} })

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const triggers: React.ReactNode[] = []
  const content: React.ReactNode[] = []
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && (child as React.ReactElement<any>).type === DialogTrigger) {
      triggers.push(child)
    } else {
      content.push(child)
    }
  })

  return (
    <DialogContext.Provider value={{ onOpenChange }}>
      {triggers}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
          {content}
        </div>
      )}
    </DialogContext.Provider>
  )
}

export function DialogContent({ children, className = '' }: DialogContentProps) {
  return (
    <div className={`relative bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] shadow-lg p-6 max-w-md w-full mx-4 z-50 overflow-visible ${className}`}>
      {children}
    </div>
  )
}

export function DialogHeader({ children }: DialogHeaderProps) {
  return <div className="mb-4">{children}</div>
}

export function DialogTitle({ children }: DialogTitleProps) {
  return <h2 className="text-lg font-semibold text-black dark:text-white">{children}</h2>
}

export function DialogDescription({ children, className = '' }: DialogDescriptionProps) {
  return <p className={`text-sm text-gray-500 dark:text-gray-400 mt-1 ${className}`}>{children}</p>
}

export function DialogTrigger({ asChild, children }: DialogTriggerProps) {
  const { onOpenChange } = React.useContext(DialogContext)
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        (children as React.ReactElement<any>).props.onClick?.(e)
        onOpenChange(true)
      },
    })
  }
  return <button type="button" onClick={() => onOpenChange(true)}>{children}</button>
}

