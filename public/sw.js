// Retired service worker.
//
// The old Dropvine Markets app registered a service worker at this path with
// scope '/', which cached pages and scripts for the whole site. Browsers that
// installed it keep checking this URL for updates, so it stays here as a
// replacement that cleans up after itself: on activate it deletes every cache
// it can see, unregisters itself, and reloads any open tabs so they are no
// longer controlled by it. Nothing on dropvine.pro registers a service worker
// any more. Keep this file for several months before deleting it.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
    await self.registration.unregister()
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const client of clients) {
      try { client.navigate(client.url) } catch { /* not supported everywhere */ }
    }
  })())
})
