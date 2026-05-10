'use client'
import React from 'react'
import MarketHeader from '@/components/markets/MarketHeader'
import { BadgeCheck, QrCode } from 'lucide-react'

export default function PassportPage() {
  return (
    <main>
      <MarketHeader title="Passport" sub="Stamps · challenges · badges" />
      <div className="max-w-3xl mx-auto px-5 py-10 text-center">
        <div className="inline-flex w-20 h-20 items-center justify-center rounded-full mb-6"
             style={{ background: 'color-mix(in srgb, var(--market-primary, #2F5233) 12%, white)', color: 'var(--market-primary, #2F5233)' }}>
          <BadgeCheck className="w-10 h-10" strokeWidth={1.4} />
        </div>
        <h2 className="font-serif text-2xl text-stone-800 mb-2">Coming this week</h2>
        <p className="text-stone-600 max-w-md mx-auto">
          Sign in with Google, scan a vendor’s booth QR to collect a stamp, and complete challenges to earn season badges.
        </p>
        <button disabled className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-200 text-stone-500 text-sm">
          <QrCode className="w-4 h-4" /> Scan to stamp (soon)
        </button>
      </div>
    </main>
  )
}
