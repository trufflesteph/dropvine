'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import MarketHeader from '@/components/markets/MarketHeader'
import { Coins, Sparkles, Wallet, BadgeCheck, Trash2 } from 'lucide-react'
import { iconFor, colorFromString } from '@/lib/markets/pop-icons'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function ChildDetailPage() {
  const { childId } = useParams()
  const router = useRouter()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = () => fetch(`/api/market/pop/children/${childId}`).then((r) => r.json())
    .then((j) => j?.error ? setError(j.error) : setData(j))

  useEffect(() => { if (childId) load() }, [childId]) // eslint-disable-line

  const remove = async () => {
    if (!confirm('Remove this child profile? Their stamps and tokens will be permanently deleted.')) return
    const r = await fetch(`/api/market/pop/children/${childId}`, { method: 'DELETE' })
    if (r.ok) { toast.success('Removed'); router.replace('/market/pop') }
    else toast.error('Failed to remove')
  }

  if (error) return <Empty>Couldn’t load: {error}</Empty>
  if (!data) return <Empty>Loading…</Empty>

  const { child, stamps, redemptions } = data
  const colour = colorFromString(child.name || '?')
  const balance = child.total_pop_tokens || 0

  return (
    <main>
      <MarketHeader back title={child.name} sub={child.age != null ? `Age ${child.age}` : ''} />
      <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">

        {/* Wallet card */}
        <div className="rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, var(--market-primary, #2F5233), color-mix(in srgb, var(--market-primary, #2F5233) 70%, black))` }}>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full grid place-items-center font-serif text-xl shrink-0"
                 style={{ background: colour, color: '#FAF7F2' }}>
              {(child.name || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[0.22em] opacity-70">POP Wallet</div>
              <div className="font-serif text-4xl mt-1 flex items-center gap-2">
                {balance}
                <Coins className="w-7 h-7" style={{ color: 'var(--market-accent, #E2A93C)' }} />
              </div>
              <div className="text-xs opacity-80 mt-0.5">POP tokens · {stamps?.length || 0} stamps collected</div>
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <Link href={`/market/pop/${child.id}/earn`}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm"
                  style={{ background: 'rgba(255,255,255,0.16)', color: '#FAF7F2' }}>
              <Sparkles className="w-4 h-4" /> Earn stamp
            </Link>
            <Link href={`/market/pop/${child.id}/redeem`}
                  aria-disabled={balance === 0}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm"
                  style={{ background: 'var(--market-accent, #E2A93C)', color: 'var(--market-primary, #2F5233)', opacity: balance === 0 ? 0.5 : 1, pointerEvents: balance === 0 ? 'none' : 'auto' }}>
              <Wallet className="w-4 h-4" /> Redeem
            </Link>
          </div>
        </div>

        {/* Recent stamps */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-xs uppercase tracking-widest text-stone-500">Recent stamps</h2>
            <span className="text-xs text-stone-500">{stamps?.length || 0} total</span>
          </div>
          {stamps?.length ? (
            <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
              {stamps.slice(0, 8).map((s) => {
                const Icon = iconFor(s.pop_stamp_types?.icon)
                return (
                  <li key={s.id} className="p-3 px-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full grid place-items-center"
                         style={{ background: 'color-mix(in srgb, var(--market-accent, #E2A93C) 25%, white)', color: 'var(--market-primary, #2F5233)' }}>
                      <Icon className="w-5 h-5" strokeWidth={1.6} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-stone-800 truncate">{s.pop_stamp_types?.name}</div>
                      <div className="text-[10px] uppercase tracking-widest text-stone-400">{new Date(s.earned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    </div>
                    <span className="font-mono text-xs text-emerald-700">+{s.pop_stamp_types?.token_reward || 0}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-stone-500 italic">No stamps yet — try earning one!</p>
          )}
        </section>

        {/* Recent redemptions */}
        {redemptions?.length ? (
          <section>
            <h2 className="text-xs uppercase tracking-widest text-stone-500 mb-2">Recent redemptions</h2>
            <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
              {redemptions.slice(0, 6).map((r) => (
                <li key={r.id} className="p-3 px-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full grid place-items-center bg-stone-100">
                    <Wallet className="w-5 h-5 text-stone-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-stone-800 truncate">{r.vendors?.name || 'Vendor'}</div>
                    <div className="text-[10px] uppercase tracking-widest text-stone-400">{new Date(r.redeemed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </div>
                  <span className="font-mono text-xs text-rose-700">-{r.amount}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Danger zone */}
        <button onClick={remove}
                className="inline-flex items-center gap-2 text-xs text-stone-500 hover:text-rose-600">
          <Trash2 className="w-3.5 h-3.5" /> Remove this child
        </button>
      </div>
    </main>
  )
}

function Empty({ children }) {
  return (
    <main>
      <MarketHeader back title="POP Kids" />
      <div className="max-w-md mx-auto px-5 py-12 text-center text-stone-500">{children}</div>
    </main>
  )
}
