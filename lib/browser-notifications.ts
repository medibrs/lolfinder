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


  async requestPermission(): Promise<NotificationPermission> {
    if (typeof Notification === 'undefined') {
      return 'default'
    }

    if (this.permission !== 'default') {
      return this.permission
    }

    try {
      // On mobile, permissions often need to be requested from a user gesture

      // Check if we're in a secure context (required for notifications)


      const permission = await Notification.requestPermission()
      this.permission = permission

      return permission
    } catch (error) {

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

    if (!this.isSupported()) {
      return false
    }

    // Check if user is actively browsing the site
    if (this.isUserActiveOnSite()) {
      return false
    }

    const permission = await this.requestPermission()

    if (permission !== 'granted') {
      return false
    }


    try {
      const notificationContent = this.getNotificationContent(notification)

      // Mobile-specific notification options
      const notificationOptions: BrowserNotificationOptions = {
        body: notificationContent.body,
        icon: notificationContent.icon,
        badge: notificationContent.badge,
        tag: notificationContent.tag,
        requireInteraction: notificationContent.requireInteraction,
        silent: false,
        // Add vibration for mobile devices
        vibrate: [500, 100, 500],
      }

      const browserNotification = new Notification(notificationContent.title, notificationOptions)

      // Handle click
      browserNotification.onclick = () => {
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

      return true
    } catch (error) {


      // Fallback for mobile: show an in-app notification
      if (this.isMobile()) {
        this.showMobileFallback(notification)
      }

      return false
    }
  }

  private isUserActiveOnSite(): boolean {
    // Only check activity on client side
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false
    }

    // Check if the page is visible and the window is focused
    const isPageVisible = !document.hidden
    const isWindowFocused = document.hasFocus()

    // Also check if the user was recently active (within last 30 seconds)
    const isRecentlyActive = Date.now() - this.lastActivityTime < 30000

    return isPageVisible && isWindowFocused && isRecentlyActive
  }

  private lastActivityTime = Date.now()

  constructor() {
    this.permission = typeof Notification !== 'undefined' ? Notification.permission : 'default'
    this.lastActivityTime = Date.now()
    this.trackUserActivity()
  }

  private trackUserActivity() {
    // Only track user activity on client side
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    // Track user activity to determine when to show browser notifications
    const updateLastActivity = () => {
      this.lastActivityTime = Date.now()
    }

    // Track various user interactions
    const events = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart',
      'click', 'keydown', 'keyup', 'focus', 'blur'
    ]

    events.forEach(event => {
      document.addEventListener(event, updateLastActivity, true)
    })

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
    })

    // Track window focus
    window.addEventListener('focus', () => {
      updateLastActivity()
    })

    window.addEventListener('blur', () => {
    })
  }

  private isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }

  private showMobileFallback(notification: NotificationOptions): void {

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
    const extractedData = {
      id: notification.id,
      type: notification.type,
      message: notification.message,
      data: notification.data,
      created_at: notification.created_at,
      read: notification.read,
      user_id: notification.user_id
    }

    // Try to extract message from different possible fields
    const message = notification.message ||
      notification.content ||
      notification.body ||
      notification.text ||
      (notification.data && notification.data.message) ||
      'You have a new notification'

    const baseContent: NotificationData = {
      title: 'New Notification',
      body: message,
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

      case 'player_left':
        return {
          ...baseContent,
          title: '👋 Player Left Team',
          body: `${notification.data?.player_name || 'A player'} has left your team`,
          data: { ...baseContent.data, type: 'player_left' }
        }

      case 'team_update':
        return {
          ...baseContent,
          title: '🔄 Team Update',
          body: notification.message || 'Your team has been updated',
          data: { ...baseContent.data, type: 'team_update' }
        }

      default:

        // Create a more informative default message
        let defaultBody = message
        if (message === 'You have a new notification') {
          // If we couldn't extract a proper message, try to be more helpful
          if (notification.type) {
            defaultBody = `New ${notification.type} notification`
          } else if (notification.data && Object.keys(notification.data).length > 0) {
            const dataKeys = Object.keys(notification.data).join(', ')
            defaultBody = `New notification with data: ${dataKeys}`
          } else {
            defaultBody = 'You have a new notification'
          }
        }

        return {
          ...baseContent,
          title: notification.type ? `📬 ${notification.type}` : 'New Notification',
          body: defaultBody
        }
    }
  }
}

export const notificationManager = BrowserNotificationManager.getInstance()
