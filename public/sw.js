// Service worker for Dropvine Markets PWA.
//
// Responsibilities:
//   1. App-shell caching — network-first for navigations, falling back to a
//      pre-cached shell when offline. Static assets are stale-while-revalidate.
//   2. Web Push handling — display notification + handle clicks.
//
// Bump SHELL_VERSION any time the cached routes/assets change.

const SHELL_VERSION = 'dvm-shell-v1'
const RUNTIME_CACHE = 'dvm-runtime-v1'
const SHELL_ROUTES = [
  '/market',
  '/market/shop',
  '/market/calendar',
  '/market/passport',
  '/market/pop',
]

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_VERSION)
    try { await cache.addAll(SHELL_ROUTES) } catch { /* network may be flaky during install */ }
    self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== SHELL_VERSION && k !== RUNTIME_CACHE).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

// Helper: is this a same-origin GET we should care about?
function shouldHandle(request) {
  if (request.method !== 'GET') return false
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return false
  // Never intercept HMR / API / next-data / auth callbacks
  if (url.pathname.startsWith('/_next/webpack-hmr')) return false
  if (url.pathname.startsWith('/api/')) return false
  if (url.pathname.startsWith('/admin')) return false  // admin is not part of the PWA shell
  return true
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (!shouldHandle(req)) return

  const accept = req.headers.get('accept') || ''
  const isNavigation = req.mode === 'navigate' || accept.includes('text/html')

  if (isNavigation) {
    // Network-first for navigations — fall back to cached shell when offline.
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req)
        const cache = await caches.open(RUNTIME_CACHE)
        cache.put(req, fresh.clone())
        return fresh
      } catch {
        const cache = await caches.open(SHELL_VERSION)
        const runtime = await caches.open(RUNTIME_CACHE)
        return (await runtime.match(req))
            || (await cache.match(req))
            || (await cache.match('/market'))
            || new Response('<h1>Offline</h1><p>Reconnect to load this page.</p>', { headers: { 'Content-Type': 'text/html' } })
      }
    })())
    return
  }

  // Stale-while-revalidate for static assets
  if (req.destination === 'style' || req.destination === 'script' || req.destination === 'image' || req.destination === 'font') {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE)
      const cached = await cache.match(req)
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.status === 200) cache.put(req, res.clone())
        return res
      }).catch(() => cached)
      return cached || fetchPromise
    })())
  }
})

// ===========================================================================
// Web Push
// ===========================================================================

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} }
  catch { data = { title: 'Dropvine Markets', body: event.data?.text?.() || '' } }

  const title = data.title || 'Dropvine Markets'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    data: { url: data.url || '/market' },
    tag: data.tag,
    // require interaction for important blasts (e.g. market-day reminders)
    requireInteraction: data.tag === 'market-day',
    // re-notify even when an existing notification with the same tag is showing
    renotify: !!data.tag,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification?.data?.url || '/market'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      try {
        const cu = new URL(c.url)
        if (cu.pathname === url || cu.pathname.startsWith('/market')) {
          await c.focus()
          try { c.navigate(url) } catch { /* not all browsers */ }
          return
        }
      } catch { /* noop */ }
    }
    await self.clients.openWindow(url)
  })())
})
