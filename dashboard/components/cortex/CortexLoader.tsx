'use client'

import dynamic from 'next/dynamic'

const Cortex = dynamic(() => import('@/components/cortex/Cortex'), { ssr: false })

export default function CortexLoader() {
  return <Cortex />
}
