'use client'
import React, { useEffect, useState } from 'react'
import MarketHeader from '@/components/markets/MarketHeader'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { LogIn, Bell, BellOff, Loader2, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { pushSupported, subscribeToPush, unsubscribeFromPush, getCurrentSubscription } from '@/lib/markets/push-client'

export default function ProfilePage() {
  const { user, loading } = useAuth() || {}

  const [pushState, setPushState] = useState({ supported: false, subscribed: false, busy: false })
  const [sms, setSms] = useState({ loaded: false, phone: '', sms_opt_in: false, busy: false })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const supported = pushSupported()
    setPushState((p) => ({ ...p, supported }))
    if (supported) {
      getCurrentSubscription().then((s) => setPushState((p) => ({ ...p, subscribed: !!s })))
    }
  }, [])

  // Load SMS prefs when user is known.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/market/profile/notifications')
        if (!res.ok) return
        const j = await res.json()
        if (cancelled) return
        const p = j?.profile || {}
        setSms({ loaded: true, phone: p.phone || '', sms_opt_in: !!p.sms_opt_in, busy: false })
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [user])

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

  const saveSms = async ({ phone, sms_opt_in }) => {
    setSms((s) => ({ ...s, busy: true }))
    try {
      const res = await fetch('/api/market/profile/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, sms_opt_in }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Save failed')
      const p = j?.profile || {}
      setSms({ loaded: true, phone: p.phone || '', sms_opt_in: !!p.sms_opt_in, busy: false })
      return true
    } catch (e) {
      toast.error(e?.message || 'Save failed')
      setSms((s) => ({ ...s, busy: false }))
      return false
    }
  }

  const onSavePhone = async (e) => {
    e?.preventDefault?.()
    if (!sms.phone?.trim()) return
    const ok = await saveSms({ phone: sms.phone.trim(), sms_opt_in: sms.sms_opt_in })
    if (ok) toast.success('Phone saved')
  }

  const toggleSmsOptIn = async () => {
    const next = !sms.sms_opt_in
    if (next && !sms.phone?.trim()) {
      toast.error('Add a phone number first')
      return
    }
    const ok = await saveSms({ phone: sms.phone, sms_opt_in: next })
    if (ok) toast.success(next ? 'SMS enabled' : 'SMS disabled')
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

        {/* --- SMS notifications (Twilio) --- */}
        {user ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <MessageSquare className={`w-5 h-5 mt-0.5 ${sms.sms_opt_in ? 'text-stone-700' : 'text-stone-500'}`} />
              <div className="flex-1">
                <div className="font-serif text-base text-stone-800">Text-message reminders</div>
                <p className="text-sm text-stone-600">
                  Order updates + a single market-morning text. Standard rates apply.
                  Reply STOP to opt out anytime.
                </p>
              </div>
              <button onClick={toggleSmsOptIn} disabled={sms.busy}
                      className="text-xs px-3 py-1.5 rounded-full transition disabled:opacity-50"
                      style={sms.sms_opt_in
                        ? { background: '#F2F0EA', color: '#3D3B36' }
                        : { background: 'var(--market-primary, #2F5233)', color: '#FAF7F2' }}>
                {sms.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : sms.sms_opt_in ? 'On' : 'Enable'}
              </button>
            </div>
            <form onSubmit={onSavePhone} className="mt-3 flex items-center gap-2">
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+1 415 555 1234"
                value={sms.phone}
                onChange={(e) => setSms((s) => ({ ...s, phone: e.target.value }))}
                disabled={sms.busy}
                className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={sms.busy || !sms.phone?.trim()}
                className="text-xs px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-50">
                {sms.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
              </button>
            </form>
            <p className="text-[11px] text-stone-400 mt-2">
              Enter in E.164 format (with country code). We’ll only text you for market-day reminders and your own orders.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  )
}
