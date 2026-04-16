'use client'

const PRODUCTS = [
  {
    id: 'dccortex',
    name: 'DCCortex',
    description: 'App Runtime & Builder',
    href: 'https://dccortex.com',
    active: false,
  },
  {
    id: 'dcflow',
    name: 'DCFlow',
    description: 'AI Mockup & Prototyping',
    href: 'https://flow.dccortex.com',
    active: false,
  },
  {
    id: 'radio',
    name: 'DCRadio',
    description: 'Focus radio stream',
    href: 'https://radio.dccortex.com',
    active: false,
  },
]

export function ProductSwitcher({ current }: { current: 'dcflow' | 'dccortex' | 'radio' }) {
  return (
    <div className="hidden md:flex items-center border border-gray-200 dark:border-[#30363d] p-0.5">
      {PRODUCTS.map((p) => {
        const active = p.id === current
        return (
          <a
            key={p.id}
            href={p.href}
            className={`px-2.5 py-1 text-[11px] leading-none font-semibold tracking-[0.08em] transition-colors ${
              active
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
            }`}
            aria-current={active ? 'page' : undefined}
            title={p.description}
          >
            {p.name}
          </a>
        )
      })}
    </div>
  )
}
