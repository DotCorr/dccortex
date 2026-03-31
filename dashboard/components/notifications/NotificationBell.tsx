/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { useSession } from 'next-auth/react'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  metadata?: any
  isRead: boolean
  createdAt: string
}

export function NotificationBell() {
  const { data: session } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  
  // Get organization ID from current path or session
  const getOrgId = () => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname
      const match = path.match(/\/organizations\/([^/]+)/)
      return match ? match[1] : null
    }
    return null
  }

  // Fetch notifications
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await axios.get('/api/notifications')
      return res.data
    },
    enabled: !!session?.user,
    refetchInterval: 30000, // Poll every 30 seconds (reduced from 5s to avoid DB spam)
  })

  const notifications: Notification[] = notificationsData?.notifications || []
  const unreadCount = notifications.filter(n => !n.isRead).length

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.put(`/api/notifications/${id}/read`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await axios.put('/api/notifications/read-all')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Play success sound for compilation success notifications
  useEffect(() => {
    if (notifications.length > 0) {
      const latestNotification = notifications[0]
      if (
        latestNotification.type === 'compilation_success' &&
        !latestNotification.isRead
      ) {
        // Play success sound using Web Audio API (no file needed)
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          const oscillator = audioContext.createOscillator()
          const gainNode = audioContext.createGain()
          
          oscillator.connect(gainNode)
          gainNode.connect(audioContext.destination)
          
          oscillator.frequency.value = 800 // Higher pitch for success
          oscillator.type = 'sine'
          
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
          
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.3)
        } catch (e) {
          // Fallback: try to play a file if it exists
          try {
            const audio = new Audio('/sounds/success.mp3')
            audio.play().catch(() => {})
          } catch {
            // Ignore if audio fails
          }
        }
      }
    }
  }, [notifications])

  if (!session?.user) return null

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-black transition-colors rounded-md hover:bg-gray-50"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-black text-white text-[10px] font-medium rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[500px] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
              <h3 className="font-semibold text-black text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsReadMutation.mutate()}
                  className="text-xs font-medium text-black hover:underline transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.isRead ? 'bg-gray-50/50 border-l-2 border-l-black' : ''
                      }`}
                      onClick={() => {
                        if (!notification.isRead) {
                          markAsReadMutation.mutate(notification.id)
                        }
                        setIsOpen(false)
                        // Navigate to workspace with notification ID
                        const orgId = getOrgId()
                        if (orgId) {
                          router.push(`/organizations/${orgId}/workspace?notification=${notification.id}`)
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 mb-1">
                            <h4 className="font-medium text-black text-sm leading-tight">
                              {notification.title}
                            </h4>
                            {!notification.isRead && (
                              <span className="w-1.5 h-1.5 bg-black rounded-full mt-1.5 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(notification.createdAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

