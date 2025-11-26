interface NotificationData {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: any
}

export class BrowserNotificationManager {
  private static instance: BrowserNotificationManager
  private permission: NotificationPermission = 'default'

  static getInstance(): BrowserNotificationManager {
    if (!BrowserNotificationManager.instance) {
      BrowserNotificationManager.instance = new BrowserNotificationManager()
    }
    return BrowserNotificationManager.instance
  }

  constructor() {
    this.permission = typeof Notification !== 'undefined' ? Notification.permission : 'default'
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (typeof Notification === 'undefined') {
      return 'default'
    }

    if (this.permission !== 'default') {
      return this.permission
    }

    try {
      const permission = await Notification.requestPermission()
      this.permission = permission
      return permission
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return 'default'
    }
  }

  isSupported(): boolean {
    return typeof Notification !== 'undefined'
  }

  isPermissionGranted(): boolean {
    return this.permission === 'granted'
  }

  async showNotification(data: NotificationData): Promise<boolean> {
    console.log('🔔 Attempting to show browser notification:', data)
    
    if (!this.isSupported()) {
      console.log('❌ Browser notifications not supported')
      return false
    }

    console.log('✅ Browser notifications supported, permission:', this.permission)

    if (this.permission !== 'granted') {
      console.log('🔐 Requesting notification permission...')
      const permission = await this.requestPermission()
      console.log('🔐 Permission result:', permission)
      if (permission !== 'granted') {
        console.log('❌ Notification permission not granted')
        return false
      }
    }

    try {
      console.log('📱 Creating notification with:', {
        title: data.title,
        body: data.body,
        icon: data.icon,
        tag: data.tag
      })
      
      const notification = new Notification(data.title, {
        body: data.body,
        icon: data.icon || '/favicon.ico',
        badge: data.badge || '/favicon.ico',
        tag: data.tag,
        data: data.data,
        requireInteraction: true, // Keep notification visible until user interacts
        silent: false, // Play sound if supported
      })

      console.log('✅ Notification created successfully')

      // Auto-close after 8 seconds
      setTimeout(() => {
        notification.close()
      }, 8000)

      // Handle click events
      notification.onclick = (event) => {
        console.log('🖱️ Notification clicked')
        event.preventDefault() // Prevent default browser behavior
        window.focus() // Bring window to front
        notification.close()
        
        // Navigate to relevant page based on notification type
        if (data.data?.type === 'tournament_approved' || data.data?.type === 'tournament_rejected') {
          window.location.href = '/tournaments'
        } else if (data.data?.type === 'team_invitation') {
          window.location.href = '/teams'
        } else if (data.data?.type === 'admin_message') {
          window.location.href = '/notifications'
        } else {
          window.location.href = '/notifications'
        }
      }

      console.log('✅ Browser notification shown successfully')
      return true
    } catch (error) {
      console.error('❌ Error showing browser notification:', error)
      return false
    }
  }

  getNotificationContent(notification: any): NotificationData {
    const baseContent: NotificationData = {
      title: 'New Notification',
      body: notification.message || 'You have a new notification',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: notification.id,
      data: notification.data || {}
    }

    switch (notification.type) {
      case 'admin_message':
        return {
          ...baseContent,
          title: '📨 Message from Admin',
          body: notification.message || 'You have a new message from an admin',
          data: { ...baseContent.data, type: 'admin_message' }
        }

      case 'tournament_approved':
        return {
          ...baseContent,
          title: '🏆 Tournament Registration Approved!',
          body: `Your team registration for ${notification.data?.tournament_name || 'tournament'} has been approved`,
          data: { ...baseContent.data, type: 'tournament_approved' }
        }

      case 'tournament_rejected':
        return {
          ...baseContent,
          title: '❌ Tournament Registration Rejected',
          body: `Your team registration was rejected: ${notification.message}`,
          data: { ...baseContent.data, type: 'tournament_rejected' }
        }

      case 'team_invitation':
        return {
          ...baseContent,
          title: '👥 Team Invitation',
          body: `You've been invited to join ${notification.data?.team_name || 'a team'}`,
          data: { ...baseContent.data, type: 'team_invitation' }
        }

      case 'join_request':
        return {
          ...baseContent,
          title: '🎯 Join Request',
          body: `Someone wants to join your team: ${notification.data?.player_name || 'Unknown player'}`,
          data: { ...baseContent.data, type: 'join_request' }
        }

      default:
        return baseContent
    }
  }
}

export const notificationManager = BrowserNotificationManager.getInstance()
