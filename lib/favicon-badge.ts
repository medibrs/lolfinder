interface FaviconBadgeOptions {
  count: number
  backgroundColor?: string
  color?: string
  size?: number
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

export class FaviconBadge {
  private static instance: FaviconBadge
  private originalFavicon: string = ''
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private faviconSize: number = 32
  private isInitialized: boolean = false

  static getInstance(): FaviconBadge {
    if (!FaviconBadge.instance) {
      FaviconBadge.instance = new FaviconBadge()
    }
    return FaviconBadge.instance
  }

  constructor() {
    // Don't initialize during SSR
    if (typeof window !== 'undefined') {
      this.initialize()
    }
  }

  private initialize() {
    if (this.isInitialized || typeof document === 'undefined') return

    try {
      this.canvas = document.createElement('canvas')
      this.ctx = this.canvas.getContext('2d')!
      this.canvas.width = this.faviconSize
      this.canvas.height = this.faviconSize
      
      // Store original favicon
      const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']") || 
                                            document.querySelector("link[rel='shortcut icon']")
      if (link) {
        this.originalFavicon = link.href
      }
      
      this.isInitialized = true
    } catch (error) {
      console.error('Error initializing favicon badge:', error)
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }

  private drawBadge(count: number, options: Partial<FaviconBadgeOptions> = {}) {
    if (!this.isInitialized || !this.ctx || !this.canvas) return

    const {
      backgroundColor = '#ef4444', // red-500
      color = '#ffffff',
      size = this.faviconSize,
      position = 'top-right'
    } = options

    // Clear canvas
    this.ctx.clearRect(0, 0, size, size)

    // Calculate badge properties
    const badgeSize = Math.floor(size * 0.5)
    const badgeRadius = badgeSize / 2
    const fontSize = Math.floor(badgeSize * 0.6)

    // Calculate badge position
    let badgeX = 0, badgeY = 0
    const padding = 2

    switch (position) {
      case 'top-right':
        badgeX = size - badgeRadius - padding
        badgeY = badgeRadius + padding
        break
      case 'top-left':
        badgeX = badgeRadius + padding
        badgeY = badgeRadius + padding
        break
      case 'bottom-right':
        badgeX = size - badgeRadius - padding
        badgeY = size - badgeRadius - padding
        break
      case 'bottom-left':
        badgeX = badgeRadius + padding
        badgeY = size - badgeRadius - padding
        break
    }

    // Draw badge circle
    this.ctx.beginPath()
    this.ctx.arc(badgeX, badgeY, badgeRadius, 0, 2 * Math.PI)
    this.ctx.fillStyle = backgroundColor
    this.ctx.fill()

    // Draw count text
    this.ctx.fillStyle = color
    this.ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'

    let displayText = count.toString()
    if (count > 99) {
      displayText = '99+'
    } else if (count > 9) {
      // Adjust font size for two-digit numbers
      this.ctx.font = `bold ${fontSize - 2}px system-ui, -apple-system, sans-serif`
    }

    this.ctx.fillText(displayText, badgeX, badgeY)
  }

  async setBadge(count: number, options: Partial<FaviconBadgeOptions> = {}) {
    if (typeof window === 'undefined') return

    // Initialize if not already done
    if (!this.isInitialized) {
      this.initialize()
    }

    if (!this.isInitialized || !this.ctx || !this.canvas) return

    try {
      // Load original favicon
      const img = await this.loadImage(this.originalFavicon || '/favicon.ico')
      
      // Clear canvas and draw favicon
      this.ctx.clearRect(0, 0, this.faviconSize, this.faviconSize)
      this.ctx.drawImage(img, 0, 0, this.faviconSize, this.faviconSize)

      // Draw badge if count > 0
      if (count > 0) {
        this.drawBadge(count, options)
      }

      // Update favicon
      const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']") || 
                                            document.querySelector("link[rel='shortcut icon']")
      
      if (link) {
        link.href = this.canvas.toDataURL('image/png')
      }

      // Also update apple-touch-icon
      const appleLink: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']")
      if (appleLink) {
        appleLink.href = this.canvas.toDataURL('image/png')
      }

    } catch (error) {
      console.error('Error setting favicon badge:', error)
    }
  }

  clear() {
    if (typeof window === 'undefined' || !this.isInitialized) return

    // Reset to original favicon
    const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']") || 
                                          document.querySelector("link[rel='shortcut icon']")
    
    if (link && this.originalFavicon) {
      link.href = this.originalFavicon
    }

    // Also reset apple-touch-icon
    const appleLink: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']")
    if (appleLink && this.originalFavicon) {
      appleLink.href = this.originalFavicon
    }
  }
}

export const faviconBadge = FaviconBadge.getInstance()
