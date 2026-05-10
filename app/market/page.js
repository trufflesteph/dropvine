'use client'
import React from 'react'
import Link from 'next/link'
import { useMarketConfig } from '@/lib/markets/config-context'

export default function MarketHomePage() {
  const { config, loading, error } = useMarketConfig()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-500">
        Loading market…
      </div>
    )
  }

  if (!config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-serif text-stone-800 mb-3">No active market configured</h1>
        <p className="text-stone-600 max-w-md">
          Run <code className="bg-stone-100 px-1 rounded">supabase/markets_schema.sql</code> in the Supabase SQL Editor and ensure one
          <code className="bg-stone-100 px-1 rounded">market_config</code> row has <code className="bg-stone-100 px-1 rounded">is_active=true</code>.
        </p>
        {error && <p className="text-xs text-rose-600 mt-3">{error}</p>}
        <Link href="/" className="text-sm underline text-stone-500 mt-6">← Back to Dropvine
        </Link>
      </div>
    )
  }

  return (
    <main className="min-h-screen">
      <header
        className="px-6 py-12 border-b"
        style={{ background: 'var(--market-primary, #2F5233)', color: '#FAF7F2', borderColor: 'rgba(0,0,0,0.06)' }}
      >
        <div className="max-w-3xl mx-auto">
          {config.pwa_short_name && (
            <p className="uppercase tracking-[0.2em] text-xs opacity-70 mb-3">{config.pwa_short_name} · {config.season || ''}</p>
          )}
          <h1 className="text-4xl md:text-5xl font-serif leading-tight">{config.name}</h1>
          {config.subtitle && (
            <p className="mt-3 text-lg opacity-90">{config.subtitle}</p>
          )}
        </div>
      </header>

      <section className="px-6 py-10 max-w-3xl mx-auto">
        <div className="grid sm:grid-cols-2 gap-4">
          <ShortcutCard href="/market/shop" label="Shop the market" sub="Vendors, products & map" />
          <ShortcutCard href="/market/calendar" label="Season calendar" sub="Every market day" />
          <ShortcutCard href="/market/passport" label="Passport" sub="Stamps & badges" />
          <ShortcutCard href="/market/pop" label="POP Kids" sub="Stamps, tokens & rewards" />
        </div>

        <div className="mt-10 text-sm text-stone-600 space-y-2">
          {config.contact_email && (
            <p>Contact: <a className="underline" href={`mailto:${config.contact_email}`}>{config.contact_email}</a></p>
          )}
          {config?.social_links?.instagram && (
            <p>Instagram: <span className="font-medium">{config.social_links.instagram}</span></p>
          )}
        </div>

        <p className="mt-12 text-xs text-stone-400">
          Theme → primary <span style={{ color: config.primary_color }}>{config.primary_color}</span> · accent <span style={{ color: config.accent_color }}>{config.accent_color}</span>
        </p>
      </section>
    </main>
  )
}

function ShortcutCard({ href, label, sub }) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-stone-200 bg-white p-5 hover:border-stone-300 transition"
    >
      <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--market-accent, #E2A93C)' }}>{sub}</div>
      <div className="text-xl font-serif text-stone-800">{label}</div>
    </Link>
  )
}
