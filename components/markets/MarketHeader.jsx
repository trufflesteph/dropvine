'use client'
import React from 'react'
import Link from 'next/link'
import { useMarketConfig } from '@/lib/markets/config-context'
import { ChevronLeft } from 'lucide-react'

export default function MarketHeader({ title, back = false, sub = null }) {
  const { config } = useMarketConfig()
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-white/85 border-b">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        {back ? (
          <Link href="/market" aria-label="Back"
                className="p-1 -ml-1 rounded hover:bg-stone-100">
            <ChevronLeft className="w-5 h-5 text-stone-600" />
          </Link>
        ) : (
          <div className="text-[10px] uppercase tracking-[0.22em] text-stone-500">
            {config?.pwa_short_name || 'Market'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-lg leading-tight truncate" style={{ color: 'var(--market-primary, #2F5233)' }}>
            {title || config?.name}
          </h1>
          {sub ? <p className="text-xs text-stone-500 truncate">{sub}</p> : null}
        </div>
      </div>
    </header>
  )
}
