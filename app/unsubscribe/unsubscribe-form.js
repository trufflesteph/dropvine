'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

const DROPVINE_GREEN = '#4CAF50'

// Buttons for /unsubscribe. Each click posts the chosen scope; repeating a
// click is harmless (the API treats an existing suppression as success).
export default function UnsubscribeForm({ token, businessName, hasVendor }) {
  const [pending, setPending] = useState(null) // 'vendor' | 'all' | null
  const [done, setDone] = useState(null)       // 'vendor' | 'all' | null
  const [error, setError] = useState(null)

  async function unsubscribe(scope) {
    setPending(scope)
    setError(null)
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, scope }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error || 'Something went wrong. Please try again.')
      setDone(scope)
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.')
    } finally {
      setPending(null)
    }
  }

  const headline = done === 'all'
    ? 'You won’t get any more emails from Dropvine.'
    : done === 'vendor'
      ? `You’re unsubscribed from ${businessName} emails.`
      : hasVendor
        ? `Unsubscribe from ${businessName} emails?`
        : 'Stop all emails from Dropvine?'

  return (
    <>
      <h1 className="font-serif font-light text-4xl md:text-5xl tracking-tighter leading-[1.05] mb-10">
        {headline}
      </h1>

      {done !== 'all' ? (
        <div className="flex flex-col items-center gap-4">
          {hasVendor && !done ? (
            <button
              type="button"
              onClick={() => unsubscribe('vendor')}
              disabled={!!pending}
              className="inline-flex items-center justify-center gap-2 text-white px-8 py-4 text-sm font-medium tracking-wide rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: DROPVINE_GREEN }}
            >
              {pending === 'vendor' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Unsubscribe
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => unsubscribe('all')}
            disabled={!!pending}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-medium tracking-wide rounded-sm border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            {pending === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Stop all emails from Dropvine
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-6 text-sm text-red-600" role="alert">{error}</p> : null}

      <p className="mt-10 text-xs text-muted-foreground leading-relaxed">
        Order receipts and other emails about your own orders still arrive.
      </p>
    </>
  )
}
