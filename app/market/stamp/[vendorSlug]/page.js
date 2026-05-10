'use client'
import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import MarketHeader from '@/components/markets/MarketHeader'
import { useAuth } from '@/lib/auth-context'
import { BadgeCheck, Loader2, LogIn } from 'lucide-react'

export default function StampRedeemPage() {
  const { vendorSlug } = useParams()
  const router = useRouter()
  const { user, loading } = useAuth() || {}

  const [state, setState] = useState({ status: 'idle' }) // idle | working | done | error | needsLogin

  useEffect(() => {
    if (loading) return
    if (!user) {
      setState({ status: 'needsLogin' })
      return
    }
    setState({ status: 'working' })
    fetch('/api/market/passport', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_slug: vendorSlug }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.error) setState({ status: 'error', error: j.error })
        else setState({ status: 'done', vendor: j.vendor, alreadyStamped: j.alreadyStamped })
      })
      .catch((e) => setState({ status: 'error', error: e?.message || 'failed' }))
  }, [user, loading, vendorSlug])

  return (
    <main>
      <MarketHeader back title="Stamp" />
      <div className="max-w-md mx-auto px-5 py-12 text-center">
        {state.status === 'needsLogin' ? (
          <>
            <div className="font-serif text-2xl text-stone-800 mb-2">Sign in to stamp</div>
            <p className="text-stone-600 mb-6">Sign in with Google or your email to start your passport. We’ll bring you back here right after.</p>
            <Link href={`/login?next=/market/stamp/${vendorSlug}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm"
                  style={{ background: 'var(--market-primary, #2F5233)', color: '#FAF7F2' }}>
              <LogIn className="w-4 h-4" /> Sign in
            </Link>
          </>
        ) : state.status === 'working' ? (
          <div className="text-stone-500 inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Stamping…
          </div>
        ) : state.status === 'done' ? (
          <>
            <div className="inline-flex w-20 h-20 items-center justify-center rounded-full mb-5"
                 style={{ background: 'color-mix(in srgb, var(--market-primary, #2F5233) 12%, white)', color: 'var(--market-primary, #2F5233)' }}>
              <BadgeCheck className="w-10 h-10" />
            </div>
            <div className="font-serif text-2xl text-stone-800">{state.alreadyStamped ? 'Already stamped today' : 'Stamp collected!'}</div>
            <p className="text-stone-600 mt-1">{state.vendor?.name}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/market/passport" className="text-sm underline text-stone-700">View passport</Link>
              <Link href="/market/passport/scan" className="text-sm underline text-stone-700">Scan another</Link>
            </div>
          </>
        ) : state.status === 'error' ? (
          <>
            <div className="font-serif text-2xl text-stone-800 mb-2">Couldn’t stamp</div>
            <p className="text-stone-600 text-sm">{state.error}</p>
          </>
        ) : null}
      </div>
    </main>
  )
}
