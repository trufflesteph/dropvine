'use client'
import React, { useEffect, useState } from 'react'
import MarketHeader from '@/components/markets/MarketHeader'
import { useMarketConfig } from '@/lib/markets/config-context'

function fmt(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function monthKey(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function CalendarPage() {
  const { config } = useMarketConfig()
  const [dates, setDates] = useState([])
  useEffect(() => {
    fetch('/api/market/dates').then((r) => r.json()).then((j) => setDates(j?.dates || []))
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // group by month
  const groups = []
  let current = null
  for (const d of dates) {
    const k = monthKey(d.date)
    if (!current || current.key !== k) {
      current = { key: k, items: [] }
      groups.push(current)
    }
    current.items.push(d)
  }

  const activeCount = dates.filter((d) => !d.is_cancelled).length

  return (
    <main>
      <MarketHeader title="Season calendar" sub={`${activeCount} market days · ${config?.season || ''}`} />
      <div className="max-w-3xl mx-auto px-5 py-6 space-y-8">
        {groups.map((g) => (
          <section key={g.key}>
            <h2 className="text-[11px] uppercase tracking-[0.22em] text-stone-500 mb-2">{g.key}</h2>
            <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
              {g.items.map((d) => {
                const isPast = new Date(d.date + 'T00:00:00') < today
                const isCancelled = d.is_cancelled
                return (
                  <li key={d.id} className="p-4 flex items-start gap-4">
                    <DateTile date={d.date} muted={isPast} cancelled={isCancelled} primary={config?.primary_color} />
                    <div className="flex-1 min-w-0">
                      <div className="font-serif text-base text-stone-800 truncate">{fmt(d.date)}</div>
                      <div className="text-xs text-stone-500">
                        {isCancelled
                          ? <span className="text-rose-700">{d.notes || 'Cancelled'}</span>
                          : `${(d.start_time || '').slice(0,5)} – ${(d.end_time || '').slice(0,5)}`}
                      </div>
                    </div>
                    {isCancelled ? (
                      <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-rose-50 text-rose-700">Dark</span>
                    ) : isPast ? (
                      <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-stone-100 text-stone-500">Past</span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}

function DateTile({ date, muted, cancelled, primary }) {
  const d = new Date(date + 'T00:00:00')
  const day = d.getDate()
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  return (
    <div className="shrink-0 w-12 h-12 rounded-md flex flex-col items-center justify-center text-center"
         style={{
           background: cancelled ? '#FEE7E2' : muted ? '#F2F0EA' : 'color-mix(in srgb, var(--market-primary, #2F5233) 12%, white)',
           color: cancelled ? '#9F2A14' : muted ? '#A8A398' : (primary || '#2F5233'),
         }}>
      <div className="text-[9px] tracking-widest leading-none">{wd}</div>
      <div className="font-serif text-lg leading-none mt-0.5">{day}</div>
    </div>
  )
}
