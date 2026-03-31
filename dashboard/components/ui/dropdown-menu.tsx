/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import * as React from 'react'

interface DropdownMenuContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const DropdownMenuContext = React.createContext<DropdownMenuContextType | null>(null)

interface DropdownMenuProps {
  children: React.ReactNode
}

interface DropdownMenuTriggerProps {
  asChild?: boolean
  children: React.ReactNode
  className?: string
}

interface DropdownMenuContentProps {
  children: React.ReactNode
  align?: 'start' | 'end' | 'center'
  className?: string
}

interface DropdownMenuItemProps {
  children: React.ReactNode
  onSelect?: () => void
  className?: string
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div ref={containerRef} className="relative">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  )
}

export const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuTriggerProps
>(({ asChild, children, className = '' }, ref) => {
  const context = React.useContext(DropdownMenuContext)
  if (!context) throw new Error('DropdownMenuTrigger must be used within DropdownMenu')

  const handleClick = () => {
    context.setOpen(!context.open)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleClick,
      ref,
      className: `${children.props.className || ''} ${className}`,
    } as any)
  }
  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      className={`cursor-pointer ${className}`}
    >
      {children}
    </button>
  )
})
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger'

export const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  DropdownMenuContentProps
>(({ children, align = 'start', className = '' }, ref) => {
  const context = React.useContext(DropdownMenuContext)
  if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu')

  if (!context.open) return null

  const alignClasses = {
    start: 'left-0',
    end: 'right-0',
    center: 'left-1/2 -translate-x-1/2',
  }

  return (
    <div
      ref={ref}
      className={`absolute z-50 mt-1 min-w-[8rem] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg ${alignClasses[align]} ${className}`}
    >
      <div className="py-1">
        {React.Children.map(children, (child: any) => {
          if (child?.type === DropdownMenuItem) {
            return React.cloneElement(child, {
              onClose: () => context.setOpen(false),
            })
          }
          return child
        })}
      </div>
    </div>
  )
})
DropdownMenuContent.displayName = 'DropdownMenuContent'

export const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  DropdownMenuItemProps & { onClose?: () => void }
>(({ children, onSelect, className = '', onClose }, ref) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    onSelect?.()
    onClose?.()
  }

  return (
    <div
      ref={ref}
      onClick={handleClick}
      className={`relative flex cursor-pointer select-none items-center px-2 py-1.5 text-sm text-black dark:text-white outline-none hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800 ${className}`}
    >
      {children}
    </div>
  )
})
DropdownMenuItem.displayName = 'DropdownMenuItem'

export const DropdownMenuSeparator = ({ className = '' }: { className?: string }) => {
  return <div className={`h-px bg-gray-200 dark:bg-gray-700 my-1 ${className}`} />
}

