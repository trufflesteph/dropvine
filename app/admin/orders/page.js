'use client'
import React, { useEffect, useMemo, useState } from 'react'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import Link from 'next/link'

function money(c) { return `$${((c || 0) / 100).toFixed(2)}` }
function date(s) { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }

const STATUSES = ['all','pending_payment','payment_received','fulfilled','cancelled']
const LABEL = { pending_payment: 'Pending', payment_received: 'Paid', fulfilled: 'Fulfilled', cancelled: 'Cancelled', refunded: 'Refunded' }

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('all')
  useEffect(() => { adminFetch('/api/market/admin/orders').then((r) => r.json()).then((j) => setOrders(j?.orders || [])) }, [])

  const filtered = useMemo(() => filter === 'all' ? orders : orders.filter((o) => o.status === filter), [orders, filter])

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl text-stone-900 mb-2">Orders</h1>
      <p className="text-sm text-stone-500 mb-6">All Markets pre-orders. Vendors mark payments / fulfilment via their own magic-link page.</p>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
                  className="text-xs uppercase tracking-wide px-3 py-1.5 rounded-full whitespace-nowrap"
                  style={filter === s ? { background: '#0E0E0C', color: '#FAFAF7' } : { background: 'white', color: '#56534D', border: '1px solid #E8E5DE' }}>
            {s === 'all' ? 'All' : LABEL[s] || s}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white divide-y divide-stone-100">
        {filtered.length === 0 ? <p className="p-5 text-sm text-stone-500">No orders.</p> : filtered.map((o) => (
          <div key={o.id} className="p-4 grid grid-cols-12 gap-3 items-center text-sm">
            <span className="col-span-2 font-mono text-xs text-stone-500">#{o.short_code}</span>
            <span className="col-span-3 truncate">{o.vendors?.name}</span>
            <span className="col-span-3 truncate text-stone-600">{o.shopper_name || '—'} · {o.shopper_email}</span>
            <span className="col-span-1 text-right font-medium text-stone-800">{money(o.total_cents)}</span>
            <span className="col-span-2"><span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-stone-100 text-stone-700">{LABEL[o.status] || o.status}</span></span>
            <span className="col-span-1 text-right text-[11px] text-stone-400">{date(o.created_at)}</span>
            <span className="col-span-12 text-[11px] text-stone-500">Pay-to: <strong>@{o.vendors?.venmo_handle || '?'}</strong> · Note: <code className="bg-stone-100 px-1 rounded">{o.venmo_note || `Order #${o.short_code}`}</code></span>
          </div>
        ))}
      </div>
    </AdminShell>
  )
}
