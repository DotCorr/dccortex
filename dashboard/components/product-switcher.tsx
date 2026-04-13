'use client'

import { useState } from 'react'

const PRODUCTS = [
  {
    name: 'DCCortex',
    description: 'App Runtime & Builder',
    href: 'https://dccortex.com',
    active: false,
  },
  {
    name: 'DCFlow',
    description: 'AI Mockup & Prototyping',
    href: 'https://flow.dccortex.com',
    active: false,
  },
]

export function ProductSwitcher({ current }: { current: 'dcflow' | 'dccortex' }) {
  const [open, setOpen] = useState(false)

  const products = PRODUCTS.map(p => ({
    ...p,
    active: current === 'dccortex' ? p.name === 'DCCortex' : p.name === 'DCFlow',
  }))

  const currentProduct = products.find(p => p.active)!

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        {currentProduct.name}
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-52 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
            {products.map(p => (
              <a
                key={p.name}
                href={p.href}
                className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                  p.active
                    ? 'text-foreground bg-muted'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                onClick={() => setOpen(false)}
              >
                <span className={`w-2 h-2 rounded-full ${p.active ? 'bg-primary' : 'bg-border'}`} />
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">{p.description}</div>
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
