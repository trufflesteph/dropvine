'use client'
import React from 'react'
import MarketHeader from '@/components/markets/MarketHeader'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { LogIn, Bell } from 'lucide-react'

export default function ProfilePage() {
  const { user, loading } = useAuth() || {}

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
            <Bell className="w-5 h-5 text-stone-500 mt-0.5" />
            <div className="flex-1">
              <div className="font-serif text-base text-stone-800">Market-day notifications</div>
              <p className="text-sm text-stone-600">Get a push notification every Wednesday morning when the market is on. (Push opt-in coming next.)</p>
            </div>
            <button disabled className="text-xs px-3 py-1.5 rounded-full bg-stone-200 text-stone-500">Soon</button>
          </div>
        </div>
      </div>
    </main>
  )
}
