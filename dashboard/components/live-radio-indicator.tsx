'use client'

import { useEffect, useRef, useState } from 'react'

const RADIO_ORIGIN = 'https://radio.dccortex.com'
const RADIO_CONTROL_URL = `${RADIO_ORIGIN}/player`
const DEV_RADIO_ORIGIN = 'http://localhost:3010'
const RADIO_BRIDGE_URL = `${RADIO_ORIGIN}/bridge`

type RadioWindow = Window & {
  __dccortexRadioController?: Window | null
}

function getControllerWindow() {
  if (typeof window === 'undefined') return null
  const w = window as RadioWindow
  if (w.__dccortexRadioController && !w.__dccortexRadioController.closed) {
    return w.__dccortexRadioController
  }
  return null
}

function openControllerWindow(autoplay: boolean) {
  if (typeof window === 'undefined') return null
  const w = window as RadioWindow
  const handle = window.open('', 'dccortex_radio_controller', 'popup=yes,width=480,height=260')
  if (!handle) return null

  let isFreshWindow = false
  try {
    const href = handle.location?.href
    if (!href || href === 'about:blank') isFreshWindow = true
  } catch {
    isFreshWindow = false
  }

  if (isFreshWindow) {
    handle.location.href = `${RADIO_CONTROL_URL}?autoplay=${autoplay ? '1' : '0'}`
  }

  w.__dccortexRadioController = handle
  return w.__dccortexRadioController
}

export function LiveRadioIndicator() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [volume, setVolume] = useState(0.6)
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: 16 }, () => 20))
  const statePoll = useRef<number | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const bridgeRef = useRef<HTMLIFrameElement | null>(null)
  const lastLevelsAt = useRef(0)
  const fallbackPhase = useRef(0)

  function postCommand(command: string, value?: number) {
    const payload = { type: 'dc-radio-command', command, value }
    const controllerWindow = getControllerWindow()
    channelRef.current?.postMessage(payload)

    const bridgeWindow = bridgeRef.current?.contentWindow
    bridgeWindow?.postMessage(payload, '*')

    controllerWindow?.postMessage(payload, '*')
  }

  function sendCommandWithRetry(command: 'play' | 'pause') {
    postCommand(command)
    window.setTimeout(() => postCommand(command), 250)
    window.setTimeout(() => postCommand(command), 750)
    window.setTimeout(() => postCommand(command), 1500)
  }

  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel('dc-radio-sync')
    channelRef.current = channel
    return () => {
      channelRef.current = null
      channel.close()
    }
  }, [])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== RADIO_ORIGIN && event.origin !== DEV_RADIO_ORIGIN) return
      const payload = event.data as {
        type?: string
        playing?: boolean
        buffering?: boolean
        volume?: number
        levels?: number[]
      }
      if (!payload || payload.type !== 'dc-radio-state') return
      setIsPlaying(Boolean(payload.playing))
      setIsBuffering(Boolean(payload.buffering))
      if (typeof payload.volume === 'number') setVolume(payload.volume)
      if (Array.isArray(payload.levels) && payload.levels.length > 0) {
        lastLevelsAt.current = Date.now()
        setBars(payload.levels.map((level) => Math.max(14, Math.min(100, Math.floor(level)))))
      }
    }

    const onChannelState = (event: MessageEvent) => {
      const payload = event.data as {
        type?: string
        playing?: boolean
        buffering?: boolean
        volume?: number
        levels?: number[]
      }
      if (!payload || payload.type !== 'dc-radio-state') return
      setIsPlaying(Boolean(payload.playing))
      setIsBuffering(Boolean(payload.buffering))
      if (typeof payload.volume === 'number') setVolume(payload.volume)
      if (Array.isArray(payload.levels) && payload.levels.length > 0) {
        lastLevelsAt.current = Date.now()
        setBars(payload.levels.map((level) => Math.max(14, Math.min(100, Math.floor(level)))))
      }
    }

    window.addEventListener('message', onMessage)
    channelRef.current?.addEventListener('message', onChannelState)

    postCommand('state')
    statePoll.current = window.setInterval(() => postCommand('state'), 900)

    return () => {
      window.removeEventListener('message', onMessage)
      channelRef.current?.removeEventListener('message', onChannelState)
      if (statePoll.current) {
        window.clearInterval(statePoll.current)
        statePoll.current = null
      }
    }
  }, [])

  useEffect(() => {
    const tick = window.setInterval(() => {
      if (!isPlaying) {
        setBars((prev) => prev.map(() => 16))
        return
      }

      if (Date.now() - lastLevelsAt.current < 1200) return

      fallbackPhase.current += 0.16
      setBars((prev) => prev.map((_, i) => {
        const pulse = Math.sin(fallbackPhase.current + i * 0.42)
        return Math.max(14, Math.min(100, Math.floor(((pulse + 1) / 2) * 62 + 18)))
      }))
    }, 120)

    return () => window.clearInterval(tick)
  }, [isPlaying])

  function togglePlayback() {
    const shouldPlay = !isPlaying
    const existing = getControllerWindow()
    if (!existing) {
      const opened = openControllerWindow(shouldPlay)
      if (!opened || opened.closed) return
      window.setTimeout(() => {
        sendCommandWithRetry(shouldPlay ? 'play' : 'pause')
        postCommand('state')
      }, 500)
      return
    }
    if (existing.closed) return
    sendCommandWithRetry(isPlaying ? 'pause' : 'play')
  }

  function handleVolumeChange(nextVolume: number) {
    setVolume(nextVolume)
    postCommand('setVolume', nextVolume)
  }

  const status = isPlaying ? (isBuffering ? 'BUFFERING' : 'LIVE') : 'OFF'

  return (
    <>
      <iframe
        ref={bridgeRef}
        src={RADIO_BRIDGE_URL}
        title="radio-sync-bridge"
        className="hidden"
        aria-hidden="true"
      />
      <div className="hidden md:flex min-h-10 md:min-w-[380px] lg:min-w-[430px] items-center flex-wrap gap-x-2 gap-y-1 border border-gray-200 dark:border-[#30363d] px-3 py-1">
      <button
        type="button"
        onClick={togglePlayback}
        className="h-7 px-3 text-[11px] leading-none font-bold tracking-[0.14em] text-black dark:text-white border border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
        aria-label={isPlaying ? 'Pause radio stream' : 'Play radio stream'}
      >
        {isPlaying ? 'PAUSE' : 'PLAY'}
      </button>

      <div className="h-4 flex items-end gap-0.5 min-w-[84px]" aria-hidden="true">
        {bars.map((height, index) => (
          <span
            key={index}
            className="w-1 bg-black dark:bg-white transition-all duration-150"
            style={{ height: `${height}%`, opacity: isPlaying ? 1 : 0.3 }}
          />
        ))}
      </div>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(event) => handleVolumeChange(Number(event.target.value))}
        className="w-28 accent-black dark:accent-white"
        aria-label="Radio volume"
      />

      <a
        href="https://radio.dccortex.com"
        className="w-[88px] text-right text-[11px] leading-none font-medium tracking-[0.12em] text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
      >
        RADIO {status}
      </a>
      </div>
    </>
  )
}
