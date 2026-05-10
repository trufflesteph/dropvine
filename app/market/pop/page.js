'use client'
import React from 'react'
import MarketHeader from '@/components/markets/MarketHeader'
import { Sparkles } from 'lucide-react'

export default function PopPage() {
  return (
    <main>
      <MarketHeader title="POP Kids" sub="Stamps, tokens & rewards for the youngest market-goers" />
      <div className="max-w-3xl mx-auto px-5 py-10 text-center">
        <div className="inline-flex w-20 h-20 items-center justify-center rounded-full mb-6"
             style={{ background: 'color-mix(in srgb, var(--market-accent, #E2A93C) 25%, white)', color: 'var(--market-primary, #2F5233)' }}>
          <Sparkles className="w-10 h-10" strokeWidth={1.4} />
        </div>
        <h2 className="font-serif text-2xl text-stone-800 mb-2">POP Kids Passport</h2>
        <p className="text-stone-600 max-w-md mx-auto">
          Add a child profile, collect stamps for trying new fruits, greeting vendors, and helping carry the basket. Each stamp earns POP tokens redeemable at vendor booths.
        </p>
        <p className="text-xs text-stone-400 mt-4">Coming in the next phase.</p>
      </div>
    </main>
  )
}
