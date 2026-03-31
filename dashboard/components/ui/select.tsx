/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
}

interface SelectTriggerProps {
  children: React.ReactNode
  className?: string
}

interface SelectContentProps {
  children: React.ReactNode
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
}

interface SelectValueProps {
  placeholder?: string
}

export function Select({ value, onValueChange, children }: SelectProps) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Find all SelectItem children (nested in SelectContent)
  const findSelectItems = React.useMemo(() => {
    const items: any[] = []
    const traverse = (node: React.ReactNode) => {
      React.Children.forEach(node, (child: any) => {
        if (!child) return
        // Check if it's a SelectItem component by comparing the function reference
        if (child.type === SelectItem) {
          items.push(child)
        }
        // Recursively search in children
        if (child?.props?.children) {
          traverse(child.props.children)
        }
      })
    }
    traverse(children)
    return items
  }, [children])

  const selectedItem = findSelectItems.find((item: any) => item?.props?.value === value)

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center justify-between border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:border-black dark:border-gray-600 dark:bg-[#161b22] dark:text-white"
      >
        <span>{selectedItem?.props?.children || 'Select...'}</span>
        <ChevronDown size={16} className="text-gray-400" />
      </button>
      {open && findSelectItems.length > 0 && (
        <div
          ref={contentRef}
          className="absolute z-[100] mt-1 w-full border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-[#161b22] min-w-[200px]"
          style={{ top: '100%' }}
        >
          {findSelectItems.map((item: any, index: number) => {
            return React.cloneElement(item, {
              key: item.props.value || index,
              onClick: (e: React.MouseEvent) => {
                e.stopPropagation()
                onValueChange(item.props.value)
                  setOpen(false)
                },
              })
          })}
        </div>
      )}
    </div>
  )
}

export function SelectTrigger({ children, className = '' }: SelectTriggerProps) {
  return <>{children}</>
}

export function SelectContent({ children }: SelectContentProps) {
  return <>{children}</>
}

export function SelectItem({ value, children, onClick }: SelectItemProps & { onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer px-3 py-2 text-sm text-black hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800"
    >
      {children}
    </div>
  )
}

export function SelectValue({ placeholder }: SelectValueProps) {
  return <span>{placeholder}</span>
}

