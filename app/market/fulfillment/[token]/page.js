'use client'
import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function money(c) { return `$${((c || 0) / 100).toFixed(2)}` }

export default function FulfillmentPage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(null)

  const load = () => fetch(`/api/market/fulfillment/${token}`).then((r) => r.json())
    .then((j) => j?.error ? setErr(j.error) : setData(j))

  useEffect(() => { if (token) load() }, [token]) // eslint-disable-line

  const action = async (kind) => {
    setBusy(kind)
    try {
      const res = await fetch(`/api/market/fulfillment/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: kind }),
      })
      const j = await res.json()
      if (!res.ok || j?.error) toast.error(j?.error || 'Action failed')
      else { toast.success('Updated'); await load() }
    } finally { setBusy(null) }
  }

  if (err) return <Box>Couldn’t load: {err}</Box>
  if (!data) return <Box>Loading…</Box>

  const { order, vendor, items } = data
  return (
    <main className="min-h-screen px-5 py-10 max-w-2xl mx-auto">
      <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Fulfillment · {vendor?.name}</p>
      <h1 className="font-serif text-3xl text-stone-900 mt-2">Pre-order #{order.short_code}</h1>
      <p className="text-sm text-stone-600 mt-1">{order.shopper_name || 'Anonymous'} — {order.shopper_email}{order.shopper_phone ? ` — ${order.shopper_phone}` : ''}</p>

      <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-5">
        <div className="text-xs uppercase tracking-widest text-stone-500">Total</div>
        <div className="font-serif text-3xl text-stone-900">{money(order.total_cents)}</div>
        <div className="text-sm text-stone-600 mt-2">Pay-to: <strong>@{vendor?.venmo_handle}</strong> with note <code className="px-1 rounded bg-stone-100">{order.venmo_note}</code></div>
      </div>

      <ol className="mt-6 space-y-3 text-sm">
        {items?.map((it) => (
          <li key={it.id} className="flex justify-between border-b border-stone-100 pb-2">
            <span><span className="font-mono text-stone-500">{it.quantity}×</span> {it.product_name_snapshot}</span>
            <span className="text-stone-700">{money(it.line_total_cents)}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid sm:grid-cols-2 gap-3">
        <ActionButton
          label="Mark payment received"
          done={Boolean(order.payment_received_at)}
          disabled={order.status !== 'pending_payment'}
          loading={busy === 'payment_received'}
          onClick={() => action('payment_received')}
          primary
        />
        <ActionButton
          label="Mark fulfilled"
          done={Boolean(order.fulfilled_at)}
          disabled={order.status !== 'payment_received' && order.status !== 'fulfilled'}
          loading={busy === 'fulfilled'}
          onClick={() => action('fulfilled')}
        />
      </div>

      <button onClick={() => action('cancelled')}
              disabled={order.status === 'cancelled' || order.status === 'fulfilled' || busy === 'cancelled'}
              className="mt-6 text-xs underline text-stone-500 disabled:opacity-40">
        Cancel this order
      </button>
    </main>
  )
}

function Box({ children }) {
  return <div className="min-h-screen flex items-center justify-center text-stone-500">{children}</div>
}

function ActionButton({ label, done, disabled, loading, onClick, primary }) {
  return (
    <button onClick={onClick} disabled={disabled || done || loading}
            className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm transition"
            style={primary
              ? { background: done ? '#E2F1DE' : '#2F5233', color: done ? '#1f6e1f' : '#FAF7F2', opacity: (disabled && !done) ? 0.4 : 1 }
              : { border: '1px solid #C9C0AE', color: done ? '#1f6e1f' : '#3D3B36', background: done ? '#E2F1DE' : 'white', opacity: (disabled && !done) ? 0.4 : 1 }}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <CheckCircle2 className="w-4 h-4" /> : null}
      {done ? `✔ ${label.replace(/^Mark /, '')}` : label}
    </button>
  )
}
