// ──────────────────────────────────────────────────────────────
// LoL Finder Service Worker v3
// Strategy:
//   • Pre-cache all public pages + static assets on install
//   • Navigation requests: Stale-While-Revalidate (instant load, background refresh)
//   • Static assets (_next/static, fonts, images): Cache-First (immutable)
//   • API calls for public data: Network-First with short cache fallback
//   • Everything else: Network-only
// ──────────────────────────────────────────────────────────────

const CACHE_NAME = 'lolfinder-v5'

// All public pages users can visit without auth
const PAGE_URLS = [
  '/',
  '/teams',
  '/players',
  '/tournaments',
  '/matches',
  '/leaderboard',
  '/auth',
  '/terms',
]

// Static assets to pre-cache
const STATIC_URLS = [
  '/favicon.ico',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
  '/site.webmanifest',
  '/og-image.png',
  '/default-avatar.svg',
  // Role icons
  '/roles/top.svg',
  '/roles/jungle.svg',
  '/roles/mid.svg',
  '/roles/adc.svg',
  '/roles/support.svg',
  // Rank images used everywhere
  '/iron.webp',
  '/bronze.webp',
  '/silver.webp',
  '/gold.webp',
  '/platinum.webp',
  '/emerald.webp',
  '/diamond.webp',
  '/master.webp',
  '/grandmaster.webp',
  '/challenger.webp',
  '/unranked.png',
]

const ALL_PRECACHE = [...PAGE_URLS, ...STATIC_URLS]

// ── Helpers ──────────────────────────────────────────────────

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))
}

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/roles/') ||
    url.pathname.startsWith('/tournament_assets/') ||
    url.pathname.match(/\.(woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico|gif|avif|css|js)$/)
}

function isPublicApiCall(url) {
  return url.pathname.startsWith('/api/players') ||
    url.pathname.startsWith('/api/teams') ||
    url.pathname.startsWith('/api/matches') ||
    url.pathname.startsWith('/api/tournaments')
}

function isCacheablePage(url) {
  // Match exact public pages or dynamic public routes
  const path = url.pathname
  if (PAGE_URLS.includes(path)) return true
  // Dynamic public pages: /tournaments/*, /matches/*, /players/*, /teams/*
  if (path.startsWith('/tournaments/') ||
    path.startsWith('/matches/') ||
    path.startsWith('/players/') ||
    path.startsWith('/teams/')) return true
  return false
}

// ── Install ─────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use addAll for critical pages, but don't fail install if some assets 404
      return cache.addAll(PAGE_URLS).then(() => {
        // Best-effort cache static assets (some may not exist yet)
        return Promise.allSettled(
          STATIC_URLS.map((url) =>
            fetch(url).then((resp) => {
              if (resp.ok) return cache.put(url, resp)
            }).catch(() => {/* ignore */ })
          )
        )
      })
    })
  )
})

// ── Activate ────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch ───────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Skip non-same-origin requests (CDN images, analytics, etc.)
  if (url.origin !== self.location.origin) return

  // Skip admin pages — never cache
  if (url.pathname.startsWith('/admin')) return

  // Skip auth-related API calls
  if (url.pathname.startsWith('/api/auth') ||
    url.pathname.startsWith('/api/admin')) return

  // ── 1. Navigation requests → Network-First ──
  if (isNavigationRequest(request) && isCacheablePage(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const networkResponse = await fetch(request)
          if (networkResponse.ok) {
            cache.put(request, networkResponse.clone())
          }
          return networkResponse
        } catch (error) {
          const cached = await cache.match(request)
          return cached || new Response('Offline', { status: 503 })
        }
      })
    )
    return
  }

  // ── 2. Static assets → Cache-First ──
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached

        const response = await fetch(request)
        if (response.ok) {
          cache.put(request, response.clone())
        }
        return response
      })
    )
    return
  }

  // ── 3. Public API calls → Network-First with cache fallback ──
  if (isPublicApiCall(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch(request)
          if (response.ok) {
            cache.put(request, response.clone())
          }
          return response
        } catch {
          const cached = await cache.match(request)
          return cached || new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      })
    )
    return
  }
});

// Push event - handle push notifications (for future PWA implementation)
self.addEventListener('push', (event) => {
  if (!event.data) {
    return
  }

  const data = event.data.json()
  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag,
    data: data.data,
    requireInteraction: true,
    actions: [
      {
        action: 'view',
        title: 'View'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') {
    return
  }

  // Handle notification click
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus()
        }
      }

      // Open new window
      if (clients.openWindow) {
        const url = event.notification.data?.url || '/notifications'
        return clients.openWindow(url)
      }
    })
  )
})
