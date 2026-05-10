'use client'
import React, { useEffect, useMemo, useState } from 'react'
import AdminShell from '@/components/markets/AdminShell'
import { adminFetch } from '@/lib/markets/admin-client'
import { toast } from 'sonner'
import { ChevronDown, Loader2 } from 'lucide-react'

function money(c) { return `$${((c || 0) / 100).toFixed(2)}` }
function date(s) { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }

const STATUSES = ['all', 'pending_payment', 'payment_received', 'fulfilled', 'cancelled']
const LABEL = {
  pending_payment: 'Pending',
  payment_received: 'Paid',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}
// possible status transitions surfaced as quick action buttons
const NEXT_ACTIONS = {
  pending_payment: [
    { to: 'payment_received', label: 'Mark paid', tone: 'emerald' },
    { to: 'cancelled', label: 'Cancel', tone: 'stone' },
  ],
  payment_received: [
    { to: 'fulfilled', label: 'Mark fulfilled', tone: 'emerald' },
    { to: 'pending_payment', label: 'Revert', tone: 'stone' },
  ],
  fulfilled: [{ to: 'payment_received', label: 'Revert', tone: 'stone' }],
  cancelled: [{ to: 'pending_payment', label: 'Reopen', tone: 'stone' }],
  refunded: [],
}

const TONE_CLASS = {
  emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  stone: 'bg-stone-100 text-stone-700 hover:bg-stone-200',
}

const STATUS_PILL = {
  pending_payment: { color: '#9F2A14', bg: '#FEE7E2' },
  payment_received: { color: '#1f6e1f', bg: '#E2F1DE' },
  fulfilled: { color: '#1f6e1f', bg: '#E2F1DE' },
  cancelled: { color: '#56534D', bg: '#F2F0EA' },
  refunded: { color: '#56534D', bg: '#F2F0EA' },
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = () => adminFetch('/api/market/admin/orders')
    .then((r) => r.json())
    .then((j) => { setOrders(j?.orders || []); setLoading(false) })

  useEffect(() => { load() }, [])

  const filtered = useMemo(
    () => filter === 'all' ? orders : orders.filter((o) => o.status === filter),
    [orders, filter]
  )

  const updateStatus = async (id, status) => {
    setBusyId(id)
    try {
      const r = await adminFetch(`/api/market/admin/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      const j = await r.json()
      if (!r.ok || j?.error) { toast.error(j?.error || 'Failed to update'); return }
      toast.success(`Order ${LABEL[status]?.toLowerCase() || status}`)
      // optimistic local update
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o))
    } catch (e) {
      toast.error(e?.message || 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl text-stone-900 mb-2">Orders</h1>
      <p className="text-sm text-stone-500 mb-6">
        Mark Venmo payments as <strong>received</strong> after the notification arrives, then
        <strong> fulfilled</strong> at booth pickup.
      </p>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {STATUSES.map((s) => {
          const count = s === 'all' ? orders.length : orders.filter((o) => o.status === s).length
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="text-xs uppercase tracking-wide px-3 py-1.5 rounded-full whitespace-nowrap"
              style={filter === s
                ? { background: '#0E0E0C', color: '#FAFAF7' }
                : { background: 'white', color: '#56534D', border: '1px solid #E8E5DE' }}
            >
              {s === 'all' ? 'All' : LABEL[s] || s} <span className="opacity-60 ml-1">{count}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-sm text-stone-500 text-center">
          No orders match this filter.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((o) => {
            const pill = STATUS_PILL[o.status] || STATUS_PILL.pending_payment
            const actions = NEXT_ACTIONS[o.status] || []
            const venmoUrl = o.vendors?.venmo_handle
              ? `https://venmo.com/${o.vendors.venmo_handle}?txn=pay&note=${encodeURIComponent(o.venmo_note || `Order #${o.short_code}`)}&amount=${((o.total_cents || 0) / 100).toFixed(2)}`
              : null
            return (
              <article key={o.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <span className="font-mono text-xs text-stone-500">#{o.short_code}</span>
                  <span className="font-serif text-stone-800">{o.vendors?.name || '—'}</span>
                  <span className="text-xs text-stone-500">·</span>
                  <span className="text-sm text-stone-700">{o.shopper_name || '—'}</span>
                  <span className="text-xs text-stone-500 truncate">{o.shopper_email}</span>
                  <span className="ml-auto font-medium text-stone-900">{money(o.total_cents)}</span>
                  <span
                    className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{ background: pill.bg, color: pill.color }}
                  >
                    {LABEL[o.status] || o.status}
                  </span>
                  <span className="text-[11px] text-stone-400 ml-1">{date(o.created_at)}</span>
                </div>

                <div className="text-[11px] text-stone-500 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    Pay-to: <strong>@{o.vendors?.venmo_handle || '?'}</strong>
                  </span>
                  <span>
                    Note: <code className="bg-stone-100 px-1 rounded">{o.venmo_note || `Order #${o.short_code}`}</code>
                  </span>
                  {venmoUrl ? (
                    <a
                      href={venmoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-stone-600 hover:text-stone-900"
                    >
                      Open in Venmo
                    </a>
                  ) : null}
                </div>

                {actions.length > 0 ? (
                  <div className="flex flex-wrap gap-2 items-center">
                    {actions.map((act) => (
                      <button
                        key={act.to}
                        disabled={busyId === o.id}
                        onClick={() => updateStatus(o.id, act.to)}
                        className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition disabled:opacity-50 ${TONE_CLASS[act.tone] || TONE_CLASS.stone}`}
                      >
                        {busyId === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {act.label}
                      </button>
                    ))}
                    <details className="ml-auto relative">
                      <summary className="list-none cursor-pointer text-[11px] text-stone-500 hover:text-stone-800 inline-flex items-center gap-1">
                        Set status <ChevronDown className="w-3 h-3" />
                      </summary>
                      <div className="absolute right-0 mt-1 z-10 bg-white border border-stone-200 rounded-lg shadow-sm py-1 min-w-[160px]">
                        {STATUSES.filter((s) => s !== 'all').map((s) => (
                          <button
                            key={s}
                            disabled={s === o.status}
                            onClick={() => updateStatus(o.id, s)}
                            className="w-full text-left text-xs px-3 py-1.5 hover:bg-stone-50 disabled:text-stone-300 disabled:bg-transparent"
                          >
                            {LABEL[s]}
                          </button>
                        ))}
                      </div>
                    </details>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </AdminShell>
  )
}
