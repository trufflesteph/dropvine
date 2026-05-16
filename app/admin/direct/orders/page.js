'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { toast } from 'sonner'
import {
  Search, Loader2, CheckCircle2, PackageCheck, XCircle,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ClipboardList,
} from 'lucide-react'

// Status → pill style + label.
const STATUS_PILL = {
  pending_payment: { bg: '#FEF3C7', fg: '#92400E', label: 'Pending payment' },
  paid:            { bg: '#E2F1DE', fg: '#1f6e1f', label: 'Paid' },
  fulfilled:       { bg: '#D1F0EC', fg: '#0F766E', label: 'Fulfilled' },
  cancelled:       { bg: '#F2F0EA', fg: '#56534D', label: 'Cancelled' },
  refunded:        { bg: '#F2F0EA', fg: '#56534D', label: 'Refunded' },
}
const MODE_PILL = {
  'pre-order':   { bg: '#F1ECE0', fg: '#5A4A2A', label: 'Pre-order' },
  'deposit':     { bg: '#E8E5F7', fg: '#3F2A6B', label: 'Deposit' },
}
const TABS = [
  { key: 'all',             label: 'All' },
  { key: 'pending_payment', label: 'Pending payment' },
  { key: 'paid',            label: 'Paid' },
  { key: 'fulfilled',       label: 'Fulfilled' },
  { key: 'cancelled',       label: 'Cancelled' },
]
const PAGE_SIZE = 50

function money(c) { return c == null ? '—' : `$${(Number(c) / 100).toFixed(2)}` }
function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

export default function DirectOrdersPage() {
  return (
    <AdminShell requireRole={['platform','organiser']}>
      <DirectOrdersInner />
    </AdminShell>
  )
}

function DirectOrdersInner() {
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ orders: [], total: 0, counts: null, migration_pending: false })
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [expandedId, setExpandedId] = useState(null) // currently-open row id

  // Debounce the search input.
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (tab !== 'all') params.set('status', tab)
      if (debouncedQ) params.set('q', debouncedQ)
      const r = await adminFetch(`/api/market/admin/direct/orders?${params.toString()}`)
      const j = await r.json()
      if (!r.ok || j?.error) { toast.error(j?.error || 'Load failed'); return }
      setData({
        orders: j.orders || [],
        total: j.total || 0,
        counts: j.counts || null,
        migration_pending: !!j.migration_pending,
      })
    } catch (e) { toast.error(e?.message || 'Load failed') }
    finally { setLoading(false) }
  }, [tab, debouncedQ, page])

  useEffect(() => { load() }, [load])

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE))

  const onAction = async (order, action, confirmText) => {
    if (confirmText && !confirm(confirmText)) return
    setBusyId(order.id)
    try {
      const r = await adminFetch(`/api/market/admin/direct/orders/${order.id}`, {
        method: 'PATCH', body: JSON.stringify({ action }),
      })
      const j = await r.json()
      if (!r.ok || j?.error) { toast.error(j?.error || 'Action failed'); return }
      if (j.alreadyAtTarget) toast(`Already ${j.order.status.replace('_', ' ')}.`)
      else if (action === 'mark_paid') toast.success('Marked paid · receipt emailed.')
      else if (action === 'mark_fulfilled') toast.success('Marked fulfilled.')
      else if (action === 'cancel') toast.success('Order cancelled.')
      // Update the row in place.
      setData((d) => ({
        ...d,
        orders: d.orders.map((o) => o.id === order.id ? { ...o, ...j.order } : o),
      }))
    } catch (e) { toast.error(e?.message || 'Action failed') }
    finally { setBusyId(null) }
  }

  return (
    <div className="max-w-7xl mx-auto px-5 py-6 space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-stone-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-stone-400" /> Direct · Orders
          </h1>
          <p className="text-sm text-stone-500">Pre-order and deposit orders placed against published drops.</p>
        </div>
        <div className="text-xs text-stone-500">{data.total} order{data.total === 1 ? '' : 's'}</div>
      </div>

      {data.migration_pending ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-4 py-2 text-xs">
          The <code>drop_orders</code> table has not been provisioned yet. Apply
          <code className="mx-1">supabase/migrations/2026-06-drop-orders.sql</code>
          and orders placed via the public drop pages will appear here.
        </div>
      ) : null}

      {/* Filter tabs + search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const cnt = data.counts ? (t.key === 'all' ? data.counts.all : data.counts[t.key] ?? 0) : null
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => { setTab(t.key); setPage(1) }}
                className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition ${
                  active ? 'bg-stone-900 text-stone-50 border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                }`}
              >
                {t.label}{cnt != null ? <span className="opacity-60 ml-1">({cnt})</span> : null}
              </button>
            )
          })}
        </div>
        <label className="relative inline-flex items-center w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email, name, or order code"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
        </label>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-[11px] uppercase tracking-widest text-stone-500">
              <tr>
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Drop</th>
                <th className="px-4 py-3 text-left">Shopper</th>
                <th className="px-4 py-3 text-left">Mode</th>
                <th className="px-4 py-3 text-right">Items</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Placed</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="10" className="px-4 py-10 text-center text-stone-400"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…</td></tr>
              ) : data.orders.length === 0 ? (
                <tr><td colSpan="10" className="px-4 py-10 text-center text-stone-400">No orders match this filter.</td></tr>
              ) : data.orders.map((o) => {
                const s = STATUS_PILL[o.status] || { bg: '#F2F0EA', fg: '#56534D', label: o.status }
                const m = MODE_PILL[o.collection_mode] || { bg: '#F2F0EA', fg: '#56534D', label: o.collection_mode || '—' }
                const busy = busyId === o.id
                const items = Array.isArray(o.items) ? o.items : []
                const itemCount = items.length
                const isExpanded = expandedId === o.id
                const canExpand = itemCount > 1 || (itemCount === 1 && items[0]?.launch_product_id)
                return (
                  <React.Fragment key={o.id}>
                  <tr className={`border-t border-stone-100 hover:bg-stone-50 ${isExpanded ? 'bg-stone-50/60' : ''}`}>
                    <td className="px-4 py-3 align-top">
                      {canExpand ? (
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : o.id)}
                          aria-label={isExpanded ? 'Collapse line items' : 'Expand line items'}
                          className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-stone-200 text-stone-500"
                          data-testid={`expand-${o.id}`}
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{o.short_code}</td>
                    <td className="px-4 py-3">
                      <div className="font-serif text-stone-900">{o.launch_title || '—'}</div>
                      {o.launch_handle ? <div className="text-[11px] text-stone-400 font-mono">/l/{o.launch_handle}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      <div>{o.shopper_email}</div>
                      {o.shopper_name ? <div className="text-[11px] text-stone-400">{o.shopper_name}</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: m.bg, color: m.fg }}>
                        {m.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {itemCount > 1 ? (
                        <span className="inline-flex items-center text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                          {itemCount} items
                        </span>
                      ) : (
                        <span className="tabular-nums text-stone-700">{o.quantity}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {o.collection_mode === 'deposit'
                        ? <><div>{money(o.deposit_cents)}</div><div className="text-[11px] text-stone-400">/ {money(o.total_cents)}</div></>
                        : money(o.total_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.fg }}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">{fmtDate(o.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1">
                        {o.status === 'pending_payment' ? (
                          <button
                            onClick={() => onAction(o, 'mark_paid')}
                            disabled={busy}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50">
                            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Mark paid
                          </button>
                        ) : null}
                        {o.status === 'paid' ? (
                          <button
                            onClick={() => onAction(o, 'mark_fulfilled')}
                            disabled={busy}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50">
                            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackageCheck className="w-3 h-3" />} Mark fulfilled
                          </button>
                        ) : null}
                        {(o.status !== 'cancelled' && o.status !== 'refunded' && o.status !== 'fulfilled') ? (
                          <button
                            onClick={() => onAction(o, 'cancel', 'Cancel this order? The shopper will not be notified automatically.')}
                            disabled={busy}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-50">
                            <XCircle className="w-3 h-3" /> Cancel
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="border-t border-stone-100 bg-stone-50/40" data-testid={`items-${o.id}`}>
                      <td></td>
                      <td colSpan="9" className="px-4 py-3">
                        <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-2">Line items</div>
                        <table className="w-full text-xs">
                          <tbody>
                            {items.map((it) => (
                              <tr key={it.id} className="border-b border-stone-200 last:border-b-0">
                                <td className="py-1.5 pr-3 tabular-nums text-stone-500 w-10">{it.quantity}×</td>
                                <td className="py-1.5 pr-3 text-stone-800">{it.product_name}</td>
                                <td className="py-1.5 pr-3 tabular-nums text-stone-500">{money(it.price_cents)} ea</td>
                                <td className="py-1.5 tabular-nums text-stone-800 text-right">
                                  {money((it.price_cents || 0) * (it.quantity || 0))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {o.venmo_note ? (
                          <div className="mt-3 text-[11px] text-stone-500">
                            Venmo memo: <span className="font-mono text-stone-700">{o.venmo_note}</span>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 bg-stone-50 text-xs text-stone-500">
            <div>Page {page} of {totalPages} · {data.total} orders</div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-stone-200 disabled:opacity-40">
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-stone-200 disabled:opacity-40">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
