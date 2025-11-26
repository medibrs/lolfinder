interface NotificationOptions {
  title: string
  body: string
  tag?: string
}

interface BrowserNotificationOptions {
  body?: string
  icon?: string
  badge?: string
  tag?: string
  requireInteraction?: boolean
  silent?: boolean
  vibrate?: number[]
}

interface NotificationData {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: any
  url?: string
  requireInteraction?: boolean
}

export type { NotificationOptions }

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
      console.log('🔕 Notifications not supported on this device/browser')
      return 'default'
    }

    if (this.permission !== 'default') {
      return this.permission
    }

    try {
      // On mobile, permissions often need to be requested from a user gesture
      console.log('🔐 Requesting notification permission...')
      
      // Check if we're in a secure context (required for notifications)
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        console.warn('⚠️ Notifications require HTTPS on most devices')
      }

      const permission = await Notification.requestPermission()
      this.permission = permission
      
      console.log('🔐 Permission result:', permission)
      return permission
    } catch (error) {
      console.error('❌ Error requesting notification permission:', error)
      return 'default'
    }
  }

  isSupported(): boolean {
    return typeof Notification !== 'undefined'
  }

  isPermissionGranted(): boolean {
    return this.permission === 'granted'
  }

  async showNotification(notification: NotificationOptions): Promise<boolean> {
    console.log('🔔 Attempting to show browser notification:', notification)
    
    if (!this.isSupported()) {
      console.log('❌ Browser notifications not supported on this device')
      return false
    }

    const permission = await this.requestPermission()
    
    if (permission !== 'granted') {
      console.log('❌ Browser notifications not permitted:', permission)
      return false
    }

    console.log('✅ Browser notifications supported, permission: granted')

    try {
      const notificationContent = this.getNotificationContent(notification)
      console.log('📱 Creating notification with:', notificationContent)

      // Mobile-specific notification options
      const notificationOptions: BrowserNotificationOptions = {
        body: notificationContent.body,
        icon: notificationContent.icon,
        badge: notificationContent.badge,
        tag: notificationContent.tag,
        requireInteraction: notificationContent.requireInteraction,
        silent: false,
        // Add vibration for mobile devices
        vibrate: [200, 100, 200],
      }

      const browserNotification = new Notification(notificationContent.title, notificationOptions)

      // Handle click
      browserNotification.onclick = () => {
        console.log('🔔 Notification clicked')
        if (notificationContent.url) {
          window.location.href = notificationContent.url
        }
        browserNotification.close()
      }

      // Mobile: Auto-close after 4 seconds (shorter for mobile)
      const closeTime = this.isMobile() ? 4000 : 5000
      setTimeout(() => {
        if (browserNotification) {
          browserNotification.close()
        }
      }, closeTime)

      console.log('✅ Browser notification shown successfully')
      return true
    } catch (error) {
      console.error('❌ Error showing browser notification:', error)
      
      // Fallback for mobile: show an in-app notification
      if (this.isMobile()) {
        this.showMobileFallback(notification)
      }
      
      return false
    }
  }

  private isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }

  private showMobileFallback(notification: NotificationOptions): void {
    console.log('📱 Showing mobile fallback notification')
    
    // Create a simple in-app notification banner
    const fallback = document.createElement('div')
    fallback.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 9999;
      font-family: system-ui, -apple-system, sans-serif;
      animation: slideDown 0.3s ease-out;
    `
    
    fallback.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-weight: 600; margin-bottom: 4px;">${notification.title}</div>
          <div style="font-size: 14px; opacity: 0.9;">${notification.body}</div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          padding: 8px;
          border-radius: 6px;
          cursor: pointer;
          margin-left: 12px;
        ">✕</button>
      </div>
    `
    
    // Add animation
    const style = document.createElement('style')
    style.textContent = `
      @keyframes slideDown {
        from { transform: translateY(-100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `
    document.head.appendChild(style)
    
    document.body.appendChild(fallback)
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (fallback.parentElement) {
        fallback.remove()
      }
    }, 5000)
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
