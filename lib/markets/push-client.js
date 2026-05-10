'use client'
// Web Push helpers — client-side only.
import { getSupabaseBrowser } from '@/lib/supabase/client'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = typeof window !== 'undefined' ? window.atob(base64) : ''
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export function pushSupported() {
  return typeof window !== 'undefined' &&
         'serviceWorker' in navigator &&
         'PushManager' in window &&
         'Notification' in window
}

export async function ensureServiceWorker() {
  if (!pushSupported()) return null
  // Register at root scope so the SW can later receive push events for the whole app.
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  await navigator.serviceWorker.ready
  return reg
}

export async function subscribeToPush() {
  if (!pushSupported()) throw new Error('Push not supported in this browser.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notification permission denied.')

  const reg = await ensureServiceWorker()
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) throw new Error('VAPID public key missing.')

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  })

  // Send to server (auth via Supabase cookies if signed in)
  const res = await fetch('/api/market/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
  })
  if (!res.ok) throw new Error('Failed to register subscription.')
  return sub
}

export async function unsubscribeFromPush() {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager?.getSubscription?.()
  if (sub) {
    await fetch('/api/market/push/unsubscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    })
    await sub.unsubscribe()
  }
}

export async function getCurrentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return reg?.pushManager?.getSubscription?.() || null
}

// Re-export for convenience
export { getSupabaseBrowser }
