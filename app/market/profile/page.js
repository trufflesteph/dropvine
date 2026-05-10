'use client'
import React, { useEffect, useState } from 'react'
import MarketHeader from '@/components/markets/MarketHeader'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { LogIn, Bell, BellOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { pushSupported, subscribeToPush, unsubscribeFromPush, getCurrentSubscription } from '@/lib/markets/push-client'

export default function ProfilePage() {
  const { user, loading } = useAuth() || {}

  const [pushState, setPushState] = useState({ supported: false, subscribed: false, busy: false })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const supported = pushSupported()
    setPushState((p) => ({ ...p, supported }))
    if (supported) {
      getCurrentSubscription().then((s) => setPushState((p) => ({ ...p, subscribed: !!s })))
    }
  }, [])

  const togglePush = async () => {
    setPushState((p) => ({ ...p, busy: true }))
    try {
      if (pushState.subscribed) {
        await unsubscribeFromPush()
        setPushState((p) => ({ ...p, subscribed: false }))
        toast.success('Notifications disabled')
      } else {
        await subscribeToPush()
        setPushState((p) => ({ ...p, subscribed: true }))
        toast.success('Notifications enabled')
      }
    } catch (e) {
      toast.error(e?.message || 'Failed')
    } finally {
      setPushState((p) => ({ ...p, busy: false }))
    }
  }

  return (
    <main>
      <MarketHeader title="Your account" />
      <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">
        {loading ? (
          <p className="text-stone-500 text-sm">Loading…</p>
        ) : user ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">Signed in</div>
            <div className="font-serif text-lg text-stone-800">{user.email}</div>
            <p className="text-sm text-stone-600 mt-2">Your passport stamps, follows and POP children will appear here.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="font-serif text-lg text-stone-800 mb-2">Sign in to use the passport</div>
            <p className="text-sm text-stone-600 mb-3">You don’t need an account to browse vendors or place pre-orders, but signing in unlocks stamps, follows, and POP Kids profiles.</p>
            <Link href="/login"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm"
                  style={{ background: 'var(--market-primary, #2F5233)', color: '#FAF7F2' }}>
              <LogIn className="w-4 h-4" /> Sign in
            </Link>
          </div>
        )}

        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-start gap-3">
            {pushState.subscribed ? <Bell className="w-5 h-5 text-stone-700 mt-0.5" /> : <BellOff className="w-5 h-5 text-stone-500 mt-0.5" />}
            <div className="flex-1">
              <div className="font-serif text-base text-stone-800">Market-day notifications</div>
              <p className="text-sm text-stone-600">A gentle nudge on market mornings, plus flash deals.</p>
            </div>
            <button onClick={togglePush} disabled={!pushState.supported || pushState.busy}
                    className="text-xs px-3 py-1.5 rounded-full transition disabled:opacity-50"
                    style={pushState.subscribed
                      ? { background: '#F2F0EA', color: '#3D3B36' }
                      : { background: 'var(--market-primary, #2F5233)', color: '#FAF7F2' }}>
              {pushState.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : pushState.subscribed ? 'On' : 'Enable'}
            </button>
          </div>
          {!pushState.supported ? (
            <p className="text-[11px] text-stone-400 mt-2">Push isn’t supported in this browser. Try installing the Markets PWA on your phone.</p>
          ) : null}
        </div>
      </div>
    </main>
  )
}
