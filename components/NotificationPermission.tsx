"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Bell, BellOff, X } from 'lucide-react'
import { notificationManager } from '@/lib/browser-notifications'

export default function NotificationPermission() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    // Check if browser supports notifications
    setIsSupported(notificationManager.isSupported())
    const currentPermission = notificationManager.isPermissionGranted() ? 'granted' : 'default'
    setPermission(currentPermission)
    
    // Show prompt after a delay if permission is default
    if (currentPermission === 'default') {
      const timer = setTimeout(() => {
        setShowPrompt(true)
      }, 5000) // Show after 5 seconds
      
      return () => clearTimeout(timer)
    }
  }, [])

  const requestPermission = async () => {
    if (!isSupported) return

    try {
      const result = await notificationManager.requestPermission()
      setPermission(result)
      setShowPrompt(false)
      
      if (result === 'granted') {
        // Show a test notification
        await notificationManager.showNotification({
          title: 'Notifications Enabled!',
          body: 'You\'ll now receive updates about tournaments and team invitations.',
          tag: 'welcome-notification'
        })
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error)
    }
  }

  const dismissPrompt = () => {
    setShowPrompt(false)
    // Don't show again for this session
    sessionStorage.setItem('notificationPromptDismissed', 'true')
  }

  if (!isSupported || permission !== 'default' || !showPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto sm:left-auto sm:right-4 sm:mx-0">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 relative">
        <button
          onClick={dismissPrompt}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-1">
              Stay Updated
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              Enable browser notifications to get instant updates about tournaments, team invitations, and important announcements.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={requestPermission}
                size="sm"
                className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
              >
                <Bell className="w-4 h-4 mr-1" />
                Enable Notifications
              </Button>
              <Button
                onClick={dismissPrompt}
                size="sm"
                variant="outline"
                className="w-full sm:w-auto"
              >
                <BellOff className="w-4 h-4 mr-1" />
                Not Now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
