'use client'
import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import MarketHeader from '@/components/markets/MarketHeader'
import { Coins, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function RedeemPage() {
  const { childId } = useParams()
  const router = useRouter()
  const [child, setChild] = useState(null)
  const [vendors, setVendors] = useState([])
  const [vendorId, setVendorId] = useState('')
  const [amount, setAmount] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/market/pop/children/${childId}`).then((r) => r.json()).then((j) => setChild(j?.child || null))
    fetch('/api/market/vendors').then((r) => r.json()).then((j) => setVendors(j?.vendors || []))
  }, [childId])

  const balance = child?.total_pop_tokens || 0

  const submit = async (e) => {
    e.preventDefault()
    if (!vendorId) return toast.error('Choose a vendor')
    if (amount <= 0 || amount > balance) return toast.error(`Amount must be 1 – ${balance}`)
    setSubmitting(true)
    try {
      const r = await fetch('/api/market/pop/redemptions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: childId, vendor_id: vendorId, amount }),
      })
      const j = await r.json()
      if (!r.ok || j?.error) { toast.error(j?.error || 'Failed'); setSubmitting(false); return }
      const v = vendors.find((x) => x.id === vendorId)
      toast.success(`Show ${v?.name || 'vendor'} this screen — they’ll honour ${amount} POP tokens.`)
      router.replace(`/market/pop/${childId}`)
    } catch (e) {
      toast.error(e?.message || 'Failed'); setSubmitting(false)
    }
  }

  return (
    <main>
      <MarketHeader back title="Redeem POP tokens" sub={child?.name ? `for ${child.name}` : ''} />
      <form onSubmit={submit} className="max-w-md mx-auto px-5 py-6 space-y-5">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 text-center">
          <div className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Available</div>
          <div className="font-serif text-4xl mt-1 flex items-center justify-center gap-2" style={{ color: 'var(--market-primary, #2F5233)' }}>
            {balance}<Coins className="w-7 h-7" style={{ color: 'var(--market-accent, #E2A93C)' }} />
          </div>
          <div className="text-xs text-stone-500 mt-0.5">POP tokens</div>
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-widest text-stone-500">Vendor</span>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-stone-300">
            <option value="">Choose a booth…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}{v.booth_number ? ` · Booth #${v.booth_number}` : ''}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-widest text-stone-500">Amount (max {balance})</span>
          <input type="number" min="1" max={balance} value={amount}
                 onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
                 className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-300" />
        </label>

        <button type="submit" disabled={submitting || balance === 0}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm"
                style={{ background: 'var(--market-primary, #2F5233)', color: '#FAF7F2', opacity: (submitting || balance === 0) ? 0.5 : 1 }}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {submitting ? 'Redeeming…' : `Redeem ${amount || 0} POP token${amount === 1 ? '' : 's'}`}
        </button>
        <p className="text-[11px] text-stone-500 text-center">After redeeming, show the success screen to the vendor at their booth.</p>
      </form>
    </main>
  )
}
