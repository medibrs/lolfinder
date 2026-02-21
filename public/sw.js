const CACHE_NAME = 'lolfinder-v2' // Incremented to forcefully wipe v1
const urlsToCache = [
  '/',
  '/tournaments',
  '/auth',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/favicon-16x16.png'
]

// Install event - cache resources and forcefully take over
self.addEventListener('install', (event) => {
  self.skipWaiting() // Force the waiting service worker to become the active service worker
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  )
})

// Activate event - clean up old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName) // Wipes the old 'lolfinder-v1' completely
          }
        })
      )
    }).then(() => self.clients.claim()) // Immediately take control of all open pages
  )
})

// Fetch event - Network First, falling back to cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache valid responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }

        const responseClone = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone)
        })
        return response
      })
      .catch(() => {
        // Offline fallback
        return caches.match(event.request)
      })
  )
})

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
