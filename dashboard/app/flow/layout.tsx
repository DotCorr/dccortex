import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DCFlow — AI-Powered Mockup & Prototyping Tool',
  description: 'Design production-quality mockups in seconds. AI-powered, multi-device, component-driven. Part of the DCCortex ecosystem by Dotcorr.',
}

export default function FlowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
