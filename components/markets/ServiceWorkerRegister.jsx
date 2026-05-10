'use client'
// Tiny client component mounted in the /market layout to register the service
// worker. Re-uses the existing helper from push-client so registration is
// idempotent (subscribing for push later reuses the same registration).
//
// We deliberately do NOT request push permission here — that only happens when
// the user opts in via the explicit UI in the PWA.

import React from 'react'
import { ensureServiceWorker, pushSupported } from '@/lib/markets/push-client'

export default function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (!pushSupported()) return
    // Defer slightly so it doesn't block first paint.
    const t = setTimeout(() => {
      ensureServiceWorker().catch((e) => {
        console.warn('[sw] registration failed:', e?.message || e)
      })
    }, 1500)
    return () => clearTimeout(t)
  }, [])
  return null
}
