// Service worker for Dropvine. Caching is intentionally minimal
// (network-first for navigation, fall back to cached shell). Push
// notifications are forwarded to the browser as standard notifications.

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'Dropvine', body: event.data?.text?.() || '' } }
  const title = data.title || 'Dropvine Markets'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon.png',
    badge: data.badge || '/icon.png',
    data: { url: data.url || '/market' },
    tag: data.tag,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification?.data?.url || '/market'
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      try { if (new URL(c.url).pathname === url) { await c.focus(); return } } catch { /* noop */ }
    }
    await clients.openWindow(url)
  })())
})
