'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useMarketConfig } from '@/lib/markets/config-context'
import VendorCard from '@/components/markets/VendorCard'
import { Calendar, MapPin } from 'lucide-react'

function nextMarketDate(dates = []) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return dates.find((d) => new Date(d.date + 'T00:00:00') >= today && !d.is_cancelled) || null
}

function formatDate(s) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

export default function MarketHomePage() {
  const { config, loading } = useMarketConfig()
  const [vendors, setVendors] = useState([])
  const [dates, setDates] = useState([])

  useEffect(() => {
    if (!config) return
    fetch('/api/market/vendors').then((r) => r.json()).then((j) => setVendors(j?.vendors || []))
    fetch('/api/market/dates').then((r) => r.json()).then((j) => setDates(j?.dates || []))
  }, [config])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-stone-500">Loading market…</div>
  }
  if (!config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-serif text-stone-800 mb-3">No active market configured</h1>
        <p className="text-stone-600 max-w-md">
          Run <code className="bg-stone-100 px-1 rounded">supabase/markets_schema.sql</code> in the Supabase SQL Editor.
        </p>
        <Link href="/" className="text-sm underline text-stone-500 mt-6">← Back to Dropvine</Link>
      </div>
    )
  }

  const upcoming = nextMarketDate(dates)

  return (
    <main>
      {/* Hero */}
      <section className="px-5 pt-8 pb-10" style={{ background: 'var(--market-primary, #2F5233)', color: '#FAF7F2' }}>
        <div className="max-w-3xl mx-auto">
          <p className="uppercase tracking-[0.22em] text-[11px] opacity-70 mb-3">
            {config.pwa_short_name} · {config.season}
          </p>
          <h1 className="text-4xl md:text-5xl font-serif leading-tight">{config.name}</h1>
          {config.subtitle && <p className="mt-3 text-base md:text-lg opacity-90">{config.subtitle}</p>}

          {upcoming ? (
            <div className="mt-6 inline-flex items-center gap-3 px-4 py-3 rounded-2xl"
                 style={{ background: 'rgba(255,255,255,0.08)' }}>
              <Calendar className="w-4 h-4" strokeWidth={1.6} />
              <div>
                <div className="text-[10px] uppercase tracking-widest opacity-70">Next market</div>
                <div className="font-serif text-lg leading-tight">{formatDate(upcoming.date)}</div>
                <div className="text-xs opacity-80">{upcoming.start_time?.slice(0, 5)} – {upcoming.end_time?.slice(0, 5)}</div>
              </div>
            </div>
          ) : null}

          {(config.map_street_name || config.map_cross_street_start) && (
            <div className="mt-3 flex items-center gap-2 text-sm opacity-80">
              <MapPin className="w-4 h-4" strokeWidth={1.6} />
              <span>{config.map_street_name} · {config.map_cross_street_start} → {config.map_cross_street_end}</span>
            </div>
          )}
        </div>
      </section>

      {/* Featured vendors */}
      <section className="px-5 py-8 max-w-3xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-serif text-xl text-stone-800">Featured vendors</h2>
          <Link href="/market/shop" className="text-sm underline text-stone-600">See all →</Link>
        </div>
        {vendors.length === 0 ? (
          <p className="text-stone-500 text-sm">No vendors yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {vendors.slice(0, 4).map((v) => <VendorCard key={v.id} vendor={v} />)}
          </div>
        )}
      </section>

      {/* About */}
      {config.about_md ? (
        <section className="px-5 pb-10 max-w-3xl mx-auto">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 whitespace-pre-line text-stone-700 leading-relaxed text-sm">
            {config.about_md}
          </div>
        </section>
      ) : null}
    </main>
  )
}
