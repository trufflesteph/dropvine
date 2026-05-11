'use client'
import React, { useEffect, useState, useMemo } from 'react'
import { useMarketConfig } from '@/lib/markets/config-context'
import MarketStreetMap from '@/components/markets/MarketStreetMap'
import VendorCard from '@/components/markets/VendorCard'
import MarketHeader from '@/components/markets/MarketHeader'
import { Map as MapIcon, List } from 'lucide-react'

export default function ShopPage() {
  const { config } = useMarketConfig()
  const [vendors, setVendors] = useState([])
  const [view, setView] = useState('map') // 'map' | 'list'
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetch('/api/market/vendors').then((r) => r.json()).then((j) => setVendors(j?.vendors || []))
  }, [])

  const allCategories = useMemo(() => {
    const set = new Set()
    for (const v of vendors) (v.categories || []).forEach((c) => set.add(c))
    return Array.from(set).sort()
  }, [vendors])

  const filtered = useMemo(() => {
    if (filter === 'all') return vendors
    return vendors.filter((v) => (v.categories || []).includes(filter))
  }, [vendors, filter])

  return (
    <main>
      <MarketHeader title="Shop the market" sub={`${vendors.length} vendor${vendors.length === 1 ? '' : 's'}`} />

      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <ToggleButton active={view === 'map'} onClick={() => setView('map')} Icon={MapIcon} label="Map" />
          <ToggleButton active={view === 'list'} onClick={() => setView('list')} Icon={List} label="List" />
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
          {allCategories.map((c) => (
            <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>{c}</Chip>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">
        {view === 'map' ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-3 overflow-x-auto">
            <MarketStreetMap config={config} vendors={filter === 'all' ? vendors : filtered} />
            <Legend vendors={vendors} accent={config?.accent_color} />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.length === 0 ? (
              <p className="text-stone-500 text-sm col-span-full">No vendors match this filter.</p>
            ) : filtered.map((v) => <VendorCard key={v.id} vendor={v} />)}
          </div>
        )}
      </div>
    </main>
  )
}

function ToggleButton({ active, onClick, Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition"
      style={active
        ? { background: 'var(--market-primary, #2F5233)', color: '#FAF7F2', borderColor: 'transparent' }
        : { background: 'white', color: '#3D3B36', borderColor: '#E8E5DE' }}
    >
      <Icon className="w-4 h-4" strokeWidth={1.6} />{label}
    </button>
  )
}

function Chip({ active, children, onClick }) {
  return (
    <button onClick={onClick}
            className="text-xs uppercase tracking-wide whitespace-nowrap px-3 py-1.5 rounded-full border transition"
            style={active
              ? { background: 'var(--market-primary, #2F5233)', color: '#FAF7F2', borderColor: 'transparent' }
              : { background: 'white', color: '#56534D', borderColor: '#E8E5DE' }}>
      {children}
    </button>
  )
}

function Legend({ vendors, accent }) {
  // build a unique-category swatch list using same color logic as the map
  const COLORS = {
    produce: '#7B9E5C', eggs: '#D9C46E',
    bakery: '#B68660', pastries: '#C99A6A',
    coffee: '#5B3F2C', drinks: '#7A4F35', tea: '#A88BB6',
    food: '#C46B3A', tacos: '#C46B3A',
    apothecary: '#9C7BAA', wellness: '#9C7BAA',
    crafts: '#7A8DA1', ceramics: '#7A8DA1', flowers: '#D08FA0',
  }
  const seen = new Set()
  const items = []
  for (const v of vendors) {
    const c = (v.categories || [])[0]
    if (!c || seen.has(c)) continue
    seen.add(c)
    items.push({ category: c, color: COLORS[c] || accent || '#E2A93C' })
  }
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 pt-3 border-t border-stone-100">
      {items.map((it) => (
        <span key={it.category} className="inline-flex items-center gap-2 text-xs text-stone-600">
          <span className="inline-block w-3 h-3 rounded" style={{ background: it.color }} />
          <span className="capitalize">{it.category}</span>
        </span>
      ))}
      <span className="inline-flex items-center gap-2 text-xs text-stone-500">
        <span className="inline-block w-3 h-3 rounded border border-dashed border-stone-400" />
        Available booth
      </span>
    </div>
  )
}
