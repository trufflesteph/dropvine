'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import MarketHeader from '@/components/markets/MarketHeader'
import { useAuth } from '@/lib/auth-context'
import { BadgeCheck, QrCode, LogIn } from 'lucide-react'

export default function PassportPage() {
  const { user, loading } = useAuth() || {}
  const [stamps, setStamps] = useState([])
  const [vendors, setVendors] = useState([])
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/market/vendors').then((r) => r.json()).then((j) => setVendors(j?.vendors || []))
    if (user) {
      fetch('/api/market/passport').then((r) => r.json()).then((j) => {
        setStamps(j?.stamps || []); setDataLoaded(true)
      })
    } else {
      setDataLoaded(true)
    }
  }, [user])

  const stampedSet = new Set(stamps.map((s) => s.vendor_id))
  const collected = stampedSet.size
  const total = vendors.length

  return (
    <main>
      <MarketHeader title="Passport" sub={user ? `${collected} of ${total} vendors stamped` : 'Sign in to start collecting'} />
      <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">

        {/* Scan CTA */}
        <Link href="/market/passport/scan"
              className="flex items-center gap-3 rounded-2xl px-5 py-4"
              style={{ background: 'var(--market-primary, #2F5233)', color: '#FAF7F2' }}>
          <QrCode className="w-5 h-5" strokeWidth={1.6} />
          <div className="flex-1">
            <div className="font-medium">Scan a vendor’s QR</div>
            <div className="text-xs opacity-75">Point your camera at a booth’s code to collect a stamp.</div>
          </div>
          <span className="text-lg">→</span>
        </Link>

        {!loading && !user ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="font-serif text-base text-stone-800">Sign in to record your stamps</div>
            <p className="text-sm text-stone-600 mt-1">Stamps are tied to your account so they sync across devices.</p>
            <Link href="/login" className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full text-sm"
                  style={{ background: 'var(--market-primary, #2F5233)', color: '#FAF7F2' }}>
              <LogIn className="w-4 h-4" /> Sign in
            </Link>
          </div>
        ) : null}

        {/* Progress */}
        {user && total > 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-widest text-stone-500">Progress</span>
              <span className="font-mono text-stone-700">{collected}/{total}</span>
            </div>
            <div className="h-2 rounded-full bg-stone-100 mt-2 overflow-hidden">
              <div className="h-full transition-all"
                   style={{ width: `${total ? (collected / total) * 100 : 0}%`,
                            background: 'var(--market-accent, #E2A93C)' }} />
            </div>
          </div>
        ) : null}

        {/* Stamp grid */}
        {dataLoaded && total > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {vendors.map((v) => {
              const stamped = stampedSet.has(v.id)
              return (
                <div key={v.id}
                     className="aspect-square rounded-2xl border-2 flex flex-col items-center justify-center text-center px-2"
                     style={stamped
                       ? { background: 'color-mix(in srgb, var(--market-primary, #2F5233) 12%, white)', borderColor: 'transparent', color: 'var(--market-primary, #2F5233)' }
                       : { background: 'white', borderStyle: 'dashed', borderColor: '#D5D1C7', color: '#A8A398' }}>
                  <BadgeCheck className="w-7 h-7 mb-1" strokeWidth={stamped ? 2 : 1.4} />
                  <span className="text-[11px] font-medium leading-tight line-clamp-2">{v.name}</span>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </main>
  )
}
