'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import MarketHeader from '@/components/markets/MarketHeader'
import { useAuth } from '@/lib/auth-context'
import { Plus, LogIn, Sparkles, Coins } from 'lucide-react'
import { colorFromString } from '@/lib/markets/pop-icons'

export default function PopHomePage() {
  const { user, loading } = useAuth() || {}
  const [children, setChildren] = useState(null)

  useEffect(() => {
    if (loading || !user) return
    fetch('/api/market/pop/children').then((r) => r.json()).then((j) => setChildren(j?.children || []))
  }, [user, loading])

  return (
    <main>
      <MarketHeader title="POP Kids" sub="Stamps, tokens & rewards for the youngest market-goers" />
      <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
        {!loading && !user ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="font-serif text-lg text-stone-800 mb-2">Sign in to start the POP Kids passport</div>
            <p className="text-sm text-stone-600 mb-3">Create profiles for your children, earn stamps for trying new fruits, greeting vendors, and helping carry the basket.</p>
            <Link href="/login?next=/market/pop"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm"
                  style={{ background: 'var(--market-primary, #2F5233)', color: '#FAF7F2' }}>
              <LogIn className="w-4 h-4" /> Sign in
            </Link>
          </div>
        ) : null}

        {user && children !== null && children.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
            <div className="inline-flex w-16 h-16 items-center justify-center rounded-full mb-4"
                 style={{ background: 'color-mix(in srgb, var(--market-accent, #E2A93C) 25%, white)', color: 'var(--market-primary, #2F5233)' }}>
              <Sparkles className="w-8 h-8" strokeWidth={1.4} />
            </div>
            <div className="font-serif text-xl text-stone-800">Add your first POP Kid</div>
            <p className="text-stone-600 text-sm mt-1 max-w-sm mx-auto">
              Create a profile for each child. They’ll collect stamps and POP tokens redeemable at vendor booths.
            </p>
            <Link href="/market/pop/new" className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm"
                  style={{ background: 'var(--market-primary, #2F5233)', color: '#FAF7F2' }}>
              <Plus className="w-4 h-4" /> Add a child
            </Link>
          </div>
        ) : null}

        {user && children?.length > 0 ? (
          <>
            <ul className="space-y-3">
              {children.map((c) => <ChildRow key={c.id} child={c} />)}
            </ul>
            <Link href="/market/pop/new"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm border border-stone-300 text-stone-700 hover:bg-stone-50">
              <Plus className="w-4 h-4" /> Add another child
            </Link>
          </>
        ) : null}
      </div>
    </main>
  )
}

function ChildRow({ child }) {
  const colour = colorFromString(child.name || '?')
  return (
    <li>
      <Link href={`/market/pop/${child.id}`}
            className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 hover:border-stone-300 transition">
        <div className="w-14 h-14 rounded-full grid place-items-center font-serif text-xl text-white" style={{ background: colour }}>
          {(child.name || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-base text-stone-800 truncate">{child.name}</div>
          {child.age != null ? <div className="text-xs text-stone-500">Age {child.age}</div> : null}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
             style={{ background: 'color-mix(in srgb, var(--market-accent, #E2A93C) 25%, white)', color: 'var(--market-primary, #2F5233)' }}>
          <Coins className="w-4 h-4" />
          <span className="font-mono text-sm">{child.total_pop_tokens || 0}</span>
        </div>
      </Link>
    </li>
  )
}
