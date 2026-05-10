'use client'
import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import MarketHeader from '@/components/markets/MarketHeader'
import { CheckCircle2, Copy } from 'lucide-react'
import { toast } from 'sonner'

function money(c) { return `$${((c || 0) / 100).toFixed(2)}` }

export default function OrderConfirmationPage() {
  const { shortCode } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!shortCode) return
    const load = () => fetch(`/api/market/orders/${shortCode}`).then((r) => r.json())
      .then((j) => j?.error ? setError(j.error) : setData(j))
    load()
    const t = setInterval(load, 8000) // poll for status updates
    return () => clearInterval(t)
  }, [shortCode])

  if (error) return (
    <main><MarketHeader back title="Order" />
      <div className="max-w-3xl mx-auto px-5 py-10 text-center text-stone-600">
        <p>Couldn’t load this order.</p>
        <p className="text-xs text-stone-400 mt-1">{error}</p>
      </div>
    </main>
  )
  if (!data) return (
    <main><MarketHeader back title="Order" />
      <div className="max-w-3xl mx-auto px-5 py-10 text-stone-500">Loading…</div>
    </main>
  )
  const { order, vendor, items, venmo_url } = data

  return (
    <main>
      <MarketHeader back title={`Order #${order.short_code}`} sub={vendor?.name} />
      <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">
        <StatusBadge status={order.status} />

        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="flex items-baseline justify-between mb-4">
            <span className="text-xs uppercase tracking-widest text-stone-500">Pay this amount</span>
            <span className="font-serif text-3xl text-stone-900">{money(order.total_cents)}</span>
          </div>
          <DetailRow label="To" value={`@${vendor?.venmo_handle || ''}`} copy />
          <DetailRow label="Note" value={order.venmo_note || `Order #${order.short_code}`} copy />

          {venmo_url && order.status === 'pending_payment' ? (
            <a href={venmo_url}
               className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm"
               style={{ background: '#3D95CE', color: '#FFFFFF' }}>
              Open Venmo →
            </a>
          ) : null}
          <p className="text-xs text-stone-500 mt-3">
            Your order will be confirmed once <strong>{vendor?.name}</strong> sees the Venmo transfer. We’ll keep this page in sync.
          </p>
        </div>

        <section>
          <h2 className="text-xs uppercase tracking-widest text-stone-500 mb-2">Items</h2>
          <div className="rounded-2xl border border-stone-200 bg-white divide-y divide-stone-100">
            {items?.map((it) => (
              <div key={it.id} className="p-3 px-4 flex items-center gap-3 text-sm">
                <span className="font-mono text-stone-500 w-8">{it.quantity}×</span>
                <span className="flex-1 text-stone-800">{it.product_name_snapshot}</span>
                <span className="text-stone-700">{money(it.line_total_cents)}</span>
              </div>
            ))}
          </div>
        </section>

        {vendor?.booth_number ? (
          <p className="text-sm text-stone-600">Pickup at <strong>Booth #{vendor.booth_number}</strong>.</p>
        ) : null}
        <div>
          <Link href="/market/shop" className="text-sm underline text-stone-600">← Back to shop</Link>
        </div>
      </div>
    </main>
  )
}

function StatusBadge({ status }) {
  const map = {
    pending_payment: { color: '#9F2A14', bg: '#FEE7E2', label: 'Awaiting payment' },
    payment_received: { color: '#1f6e1f', bg: '#E2F1DE', label: 'Payment received' },
    fulfilled: { color: '#1f6e1f', bg: '#E2F1DE', label: 'Ready for pickup' },
    cancelled: { color: '#56534D', bg: '#F2F0EA', label: 'Cancelled' },
    refunded: { color: '#56534D', bg: '#F2F0EA', label: 'Refunded' },
  }
  const m = map[status] || map.pending_payment
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: m.bg, color: m.color }}>
      <CheckCircle2 className="w-4 h-4" />
      <span className="text-xs uppercase tracking-widest">{m.label}</span>
    </div>
  )
}

function DetailRow({ label, value, copy }) {
  const onCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(value).then(() => toast.success(`${label} copied`))
    }
  }
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-[10px] uppercase tracking-widest text-stone-500">{label}</span>
      <span className="flex items-center gap-2 font-medium text-stone-800">
        {value}
        {copy ? <button onClick={onCopy} className="text-stone-400 hover:text-stone-700" aria-label={`Copy ${label}`}><Copy className="w-3.5 h-3.5" /></button> : null}
      </span>
    </div>
  )
}
