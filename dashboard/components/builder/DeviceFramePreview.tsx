/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

export type DeviceFrameType =
  | 'none'
  | 'iphone-island'
  | 'iphone-notch'
  | 'iphone-legacy'
  | 'ipad-modern'
  | 'ipad-legacy'
  | 'android-phone'
  | 'android-tablet'

const DEVICE_OPTIONS: { value: DeviceFrameType; label: string }[] = [
  { value: 'none', label: 'No frame' },
  { value: 'iphone-island', label: 'iPhone 15 Pro' },
  { value: 'iphone-notch', label: 'iPhone 14' },
  { value: 'iphone-legacy', label: 'iPhone SE' },
  { value: 'ipad-modern', label: 'iPad Pro' },
  { value: 'ipad-legacy', label: 'iPad (legacy)' },
  { value: 'android-phone', label: 'Android Phone' },
  { value: 'android-tablet', label: 'Android Tablet' },
]

export { DEVICE_OPTIONS }

type Props = {
  device: DeviceFrameType
  /** Inner content width in px (screen width inside the frame). */
  screenWidth: number
  children: React.ReactNode
}

/** CSS-only device frame wrapper – no external package. */
function DeviceFrame({ children, screenWidth, variant }: { children: React.ReactNode; screenWidth: number; variant: 'phone-island' | 'phone-notch' | 'phone-legacy' | 'tablet-modern' | 'tablet-legacy' | 'android-phone' | 'android-tablet' }) {
  const isTablet = variant.startsWith('tablet') || variant === 'android-tablet'
  const isAndroid = variant.startsWith('android')
  const frameWidth = isTablet ? Math.min(screenWidth + 80, 900) : screenWidth + 32
  const frameHeight = isTablet ? 680 : Math.min(screenWidth * 2.1 + 80, 780)

  return (
    <div
      className="rounded-[2rem] border-[10px] border-gray-800 dark:border-gray-600 bg-gray-800 dark:bg-gray-600 flex flex-col items-center justify-start overflow-hidden shadow-2xl"
      style={{
        width: frameWidth,
        minHeight: frameHeight,
        paddingTop: isTablet ? 14 : 12,
        paddingBottom: isTablet ? 14 : 12,
        paddingLeft: isTablet ? 14 : 10,
        paddingRight: isTablet ? 14 : 10,
      }}
    >
      {/* Top area: dynamic island, notch, or camera */}
      {variant === 'phone-island' && (
        <div className="w-[100px] h-6 rounded-full bg-black dark:bg-black mb-2 shrink-0" />
      )}
      {variant === 'phone-notch' && (
        <div className="w-[120px] h-6 rounded-b-xl bg-black dark:bg-black mb-2 shrink-0" />
      )}
      {variant === 'phone-legacy' && (
        <div className="w-8 h-8 rounded-full bg-black dark:bg-black mb-2 shrink-0" />
      )}
      {isTablet && !isAndroid && (
        <div className="w-3 h-3 rounded-full bg-black dark:bg-black mb-2 shrink-0" />
      )}
      {isAndroid && (
        <div className="w-2 h-2 rounded-full bg-black dark:bg-black mb-2 shrink-0" />
      )}

      {/* Screen area */}
      <div
        className="w-full flex-1 rounded-xl overflow-hidden flex flex-col bg-white dark:bg-[#0d1117] min-h-[400px]"
        style={{ width: screenWidth, maxWidth: '100%' }}
      >
        {children}
      </div>
    </div>
  )
}

export function DeviceFramePreview({ device, screenWidth, children }: Props) {
  if (device === 'none') {
    return <>{children}</>
  }

  const screenContent = (
    <div className="w-full h-full min-h-[500px] overflow-auto flex flex-col bg-white dark:bg-[#0d1117]">
      {children}
    </div>
  )

  const frameVariant =
    device === 'iphone-island' ? 'phone-island' :
    device === 'iphone-notch' ? 'phone-notch' :
    device === 'iphone-legacy' ? 'phone-legacy' :
    device === 'ipad-modern' ? 'tablet-modern' :
    device === 'ipad-legacy' ? 'tablet-legacy' :
    device === 'android-phone' ? 'android-phone' :
    'android-tablet'

  return (
    <DeviceFrame screenWidth={screenWidth} variant={frameVariant}>
      {screenContent}
    </DeviceFrame>
  )
}
