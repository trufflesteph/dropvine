'use client'
import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import MarketHeader from '@/components/markets/MarketHeader'
import { iconFor } from '@/lib/markets/pop-icons'
import { toast } from 'sonner'
import { Coins, Loader2 } from 'lucide-react'

export default function EarnStampPage() {
  const { childId } = useParams()
  const router = useRouter()
  const [types, setTypes] = useState([])
  const [child, setChild] = useState(null)
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    fetch('/api/market/pop/stamp-types').then((r) => r.json()).then((j) => setTypes(j?.types || []))
    fetch(`/api/market/pop/children/${childId}`).then((r) => r.json()).then((j) => setChild(j?.child || null))
  }, [childId])

  const earn = async (type) => {
    setBusy(type.id)
    try {
      const r = await fetch('/api/market/pop/stamps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: childId, stamp_type_id: type.id }),
      })
      const j = await r.json()
      if (!r.ok || j?.error) { toast.error(j?.error || 'Failed'); setBusy(null); return }
      toast.success(`+${j.reward} POP tokens — ${j.stamp_type?.name || 'stamp'} earned!`)
      router.replace(`/market/pop/${childId}`)
    } catch (e) {
      toast.error(e?.message || 'Failed'); setBusy(null)
    }
  }

  return (
    <main>
      <MarketHeader back title="Earn a stamp" sub={child?.name ? `for ${child.name}` : ''} />
      <div className="max-w-3xl mx-auto px-5 py-6">
        <p className="text-sm text-stone-600 mb-4">Pick the activity your POP Kid completed. They’ll earn POP tokens straight away.</p>
        <ul className="grid sm:grid-cols-2 gap-3">
          {types.map((t) => {
            const Icon = iconFor(t.icon)
            const loading = busy === t.id
            return (
              <li key={t.id}>
                <button onClick={() => earn(t)} disabled={busy != null}
                        className="w-full flex items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4 hover:border-stone-300 transition disabled:opacity-50 text-left">
                  <div className="w-12 h-12 rounded-full grid place-items-center shrink-0"
                       style={{ background: 'color-mix(in srgb, var(--market-accent, #E2A93C) 25%, white)', color: 'var(--market-primary, #2F5233)' }}>
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-6 h-6" strokeWidth={1.6} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-serif text-base text-stone-800">{t.name}</div>
                    {t.description ? <p className="text-xs text-stone-500 mt-0.5">{t.description}</p> : null}
                  </div>
                  <div className="shrink-0 inline-flex items-center gap-1 font-mono text-sm" style={{ color: 'var(--market-primary, #2F5233)' }}>
                    +{t.token_reward}<Coins className="w-3.5 h-3.5" />
                  </div>
                </button>
              </li>
            )
          })}
          {types.length === 0 ? <li className="text-sm text-stone-500 italic col-span-full">No stamps configured yet.</li> : null}
        </ul>
      </div>
    </main>
  )
}
