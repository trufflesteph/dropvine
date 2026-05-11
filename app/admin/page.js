'use client'
import React, { useEffect, useState } from 'react'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { Store, Calendar, ShoppingCart, Inbox, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

function money(c) { return `$${((c || 0) / 100).toFixed(2)}` }
function relTime(s) {
  const d = new Date(s); const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  useEffect(() => {
    adminFetch('/api/market/admin/dashboard').then((r) => r.json()).then(setData)
  }, [])

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl text-stone-900 mb-1">Dashboard</h1>
      {data?.market ? <p className="text-stone-500 mb-8">{data.market.name} · {data.market.season}</p> : null}

      {data ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <Stat Icon={Store} label="Active vendors" value={data.counts.vendors_active} sub={`${data.counts.vendors_total} total`} href="/admin/vendors" />
          <Stat Icon={Calendar} label="Products" value={data.counts.products_total} />
          <Stat Icon={ShoppingCart} label="Pending payment" value={data.counts.orders_pending_payment} sub={`${data.counts.orders_total} orders · ${data.counts.orders_fulfilled} fulfilled`} href="/admin/orders" highlight />
          <Stat Icon={Inbox} label="Pending submissions" value={data.counts.submissions_pending} href="/admin/submissions" highlight />
        </div>
      ) : <p className="text-stone-500">Loading…</p>}

      {data ? (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-stone-500 mb-2">Recent orders</h2>
          <div className="rounded-2xl border border-stone-200 bg-white divide-y divide-stone-100">
            {data.recent_orders.length === 0 ? (
              <p className="p-5 text-sm text-stone-500">No orders yet.</p>
            ) : data.recent_orders.map((o) => (
              <Link href="/admin/orders" key={o.id} className="p-3 px-4 flex items-center gap-3 hover:bg-stone-50">
                <span className="text-xs font-mono text-stone-500 w-20 truncate">#{o.short_code}</span>
                <span className="flex-1 text-sm text-stone-800 truncate">{o.vendors?.name} — {o.shopper_email}</span>
                <span className="text-sm text-stone-700 w-20 text-right">{money(o.total_cents)}</span>
                <StatusPill status={o.status} />
                <span className="text-[11px] text-stone-400 w-20 text-right">{relTime(o.created_at)}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </AdminShell>
  )
}

function Stat({ Icon, label, value, sub, href, highlight }) {
  const inner = (
    <div className="rounded-2xl border bg-white p-5 transition"
         style={{ borderColor: highlight && value > 0 ? '#E2A93C' : '#E8E5DE' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-stone-500">{label}</span>
        <Icon className="w-4 h-4 text-stone-400" />
      </div>
      <div className="font-serif text-3xl mt-1 text-stone-900">{value}</div>
      {sub ? <div className="text-xs text-stone-500 mt-1">{sub}</div> : null}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function StatusPill({ status }) {
  const map = {
    pending_payment: { color: '#9F2A14', bg: '#FEE7E2', Icon: AlertTriangle, label: 'Pending' },
    payment_received: { color: '#1f6e1f', bg: '#E2F1DE', Icon: CheckCircle2, label: 'Paid' },
    fulfilled: { color: '#1f6e1f', bg: '#E2F1DE', Icon: CheckCircle2, label: 'Fulfilled' },
    cancelled: { color: '#56534D', bg: '#F2F0EA', Icon: AlertTriangle, label: 'Cancelled' },
    refunded: { color: '#56534D', bg: '#F2F0EA', Icon: AlertTriangle, label: 'Refunded' },
  }
  const m = map[status] || map.pending_payment
  return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full" style={{ background: m.bg, color: m.color }}><m.Icon className="w-3 h-3" />{m.label}</span>
}
