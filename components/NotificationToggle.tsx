"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Bell, BellOff, Check, X } from 'lucide-react'

export default function NotificationToggle() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSupported, setIsSupported] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if ('Notification' in window) {
      setIsSupported(true)
      setPermission(Notification.permission)
    }
  }, [])

  const requestPermission = async () => {
    if (!isSupported) return

    setIsLoading(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      
      if (result === 'granted') {
        // Show a test notification
        new Notification('Notifications Enabled! 🔔', {
          body: 'You\'ll now receive updates about tournaments and team invitations.',
          icon: '/favicon.ico',
          badge: '/favicon.ico'
        })
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <BellOff className="w-4 h-4" />
        <span>Not supported</span>
      </div>
    )
  }

  if (permission === 'granted') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <Check className="w-4 h-4" />
        <span>Enabled</span>
      </div>
    )
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600">
        <X className="w-4 h-4" />
        <span>Blocked</span>
      </div>
    )
  }

  return (
    <Button
      onClick={requestPermission}
      size="sm"
      variant="outline"
      disabled={isLoading}
      className="text-xs"
    >
      {isLoading ? (
        'Requesting...'
      ) : (
        <>
          <Bell className="w-3 h-3 mr-1" />
          Enable
        </>
      )}
    </Button>
  )
}
