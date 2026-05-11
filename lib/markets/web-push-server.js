// Server-side Web Push helper. Uses the `web-push` package + VAPID env vars.
// Safe to import; will return a no-op stub if VAPID_PRIVATE_KEY is missing so
// the rest of the app never crashes.

import webpush from 'web-push'

let configured = false
function configure() {
  if (configured) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:hello@dropvine.pro'
  if (!pub || !priv) return false
  try {
    webpush.setVapidDetails(subject, pub, priv)
    configured = true
    return true
  } catch (e) {
    console.warn('[push] failed to configure VAPID:', e?.message || e)
    return false
  }
}

/**
 * Send a single push notification.
 * @param {{endpoint: string, p256dh: string, auth: string}} subscription DB row
 * @param {object} payload arbitrary serialisable object
 * @returns {Promise<{ ok: true } | { ok: false, statusCode?: number, error: string, gone?: boolean }>}
 */
export async function sendPushTo(subscription, payload) {
  if (!configure()) return { ok: false, error: 'VAPID not configured' }
  const sub = {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  }
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload))
    return { ok: true }
  } catch (e) {
    const code = e?.statusCode
    // 404 / 410 — subscription is dead, caller should delete
    const gone = code === 404 || code === 410
    return { ok: false, statusCode: code, error: e?.body || e?.message || String(e), gone }
  }
}
