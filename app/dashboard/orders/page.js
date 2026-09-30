'use client'
// /dashboard/orders — the vendor's pre-order and deposit orders, grouped by
// drop. Built for a phone at pickup: one column, big tap targets, the Venmo
// note large enough to match against the vendor's Venmo feed.
//
// Data + actions: /api/dashboard/orders (session-cookie auth; only this
// vendor's drops). Every action is re-checked on the server, so a double tap
// or a stale page can't apply it twice.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, mockUserHeaders } from '@/lib/auth-context'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { formatEmailDateTime } from '@/lib/email/format'
import { DashboardSidebar, DashboardMobileNav } from '@/components/dropvine/dashboard-nav'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const GREEN = '#2D4A2A'

const STATUS = {
  pending_payment: { label: 'Not paid yet', bg: '#FEF3C7', fg: '#92400E' },
  paid:            { label: 'Paid',         bg: '#DCFCE7', fg: '#166534' },
  fulfilled:       { label: 'Picked up',    bg: '#E0E7FF', fg: '#3730A3' },
  cancelled:       { label: 'Cancelled',    bg: '#F2F0EA', fg: '#56534D' },
  refunded:        { label: 'Refunded',     bg: '#F2F0EA', fg: '#56534D' },
}

function money(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`
}
const firstName = (name) => (String(name || '').trim().split(/\s+/)[0] || 'The shopper')

export default function DashboardOrdersPage() {
  const router = useRouter()
  const { user, loading, signOut, configured } = useAuth() || {}
  // Session cookie identifies the vendor; x-user-id only in local mock mode.
  const idHeaders = mockUserHeaders(user, configured)
  const [data, setData] = useState({ drops: [], unpaid_count: 0, vendor_tier: 'free' })
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [confirm, setConfirm] = useState(null) // { kind: 'mark_paid' | 'cancel', order }

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  const idHeader = idHeaders['x-user-id']
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/dashboard/orders', { headers: idHeader ? { 'x-user-id': idHeader } : {} })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Could not load orders')
      setData({ drops: d.drops || [], unpaid_count: d.unpaid_count || 0, vendor_tier: d.vendor_tier || 'free' })
      setError(null)
    } catch (e) {
      setError(e?.message || 'Could not load orders')
    } finally {
      setFetching(false)
    }
  }, [idHeader])

  useEffect(() => { if (user) load() }, [user, load])

  const runAction = async (order, action) => {
    setBusyId(order.id)
    try {
      const r = await fetch(`/api/dashboard/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...idHeaders },
        body: JSON.stringify({ action }),
      })
      const d = await r.json()
      if (!r.ok) toast.error(d?.error || 'That didn’t work. Please try again.')
      else if (action === 'mark_paid') toast.success(`Order #${order.short_code} marked paid.`)
      else if (action === 'mark_picked_up') toast.success(`Order #${order.short_code} marked picked up.`)
      else if (action === 'cancel') toast.success(`Order #${order.short_code} cancelled.`)
    } catch (e) {
      toast.error(e?.message || 'Network error')
    } finally {
      setBusyId(null)
      await load() // always re-sync: totals, ordering, and any change made elsewhere
    }
  }

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
  }

  return (
    <div className="min-h-screen flex bg-background">
      <DashboardSidebar active="orders" user={user} signOut={signOut} unpaidCount={data.unpaid_count} />

      <main className="flex-1 min-w-0">
        <DashboardMobileNav active="orders" unpaidCount={data.unpaid_count} />

        {/* Always visible while scrolling. */}
        <div className="sticky top-0 z-20 border-b border-border px-4 md:px-12 py-3 text-sm leading-snug text-foreground" style={{ backgroundColor: '#F4F1EA' }} data-testid="money-note">
          Dropvine never touches your money. Shoppers pay you directly on Venmo. Check your Venmo, find the note that matches the order, then mark it paid.
        </div>

        <header className="px-4 md:px-12 pt-6 pb-2">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Your vine</div>
          <h1 className="font-serif font-light text-3xl md:text-5xl tracking-tighter">Orders</h1>
        </header>

        <section className="px-4 md:px-12 py-6 space-y-10 max-w-3xl">
          {fetching ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : error ? (
            <div className="text-sm text-red-700">{error}</div>
          ) : data.drops.length === 0 ? (
            <div className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No orders yet. Pre-orders and deposits from your drops will show up here.
            </div>
          ) : (
            data.drops.map((drop) => (
              <DropGroup key={drop.id} drop={drop} vendorTier={data.vendor_tier} busyId={busyId} onAction={runAction} onConfirm={setConfirm} />
            ))
          )}
        </section>
      </main>

      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null) }}>
        <AlertDialogContent className="rounded-none max-w-[calc(100vw-2rem)] sm:max-w-md">
          {confirm?.kind === 'mark_paid' ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Mark order #{confirm.order.short_code} as paid?</AlertDialogTitle>
                <AlertDialogDescription>
                  {`Confirm you received ${money(confirm.order.amount_due_cents)} on Venmo with the note "${confirm.order.venmo_note}". ${firstName(confirm.order.shopper_name)} will get an email saying their payment is confirmed.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-none h-11">Not yet</AlertDialogCancel>
                <AlertDialogAction className="rounded-none h-11 text-white" style={{ backgroundColor: GREEN }} onClick={() => runAction(confirm.order, 'mark_paid')} data-testid="confirm-mark-paid">
                  Mark paid
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : confirm?.kind === 'cancel' ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel order #{confirm.order.short_code}?</AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-none h-11">Keep order</AlertDialogCancel>
                <AlertDialogAction className="rounded-none h-11 bg-red-700 hover:bg-red-800 text-white" onClick={() => runAction(confirm.order, 'cancel')} data-testid="confirm-cancel">
                  Cancel order
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function DropGroup({ drop, vendorTier, busyId, onAction, onConfirm }) {
  const t = drop.totals
  return (
    <div data-testid={`drop-group-${drop.handle}`}>
      <div className="border-b border-foreground pb-3 mb-4">
        <h2 className="font-serif text-2xl tracking-tight">{drop.title}</h2>
        <div className="mt-2 grid grid-cols-3 gap-2 text-sm" data-testid="drop-totals">
          <Total label="Orders" value={t.orders} />
          <Total label="Paid" value={t.paid} sub={money(t.paid_cents)} />
          <Total label="Unpaid" value={t.unpaid} sub={money(t.unpaid_cents)} />
        </div>
      </div>
      <ul className="space-y-4">
        {drop.orders.map((o) => (
          <OrderCard key={o.id} order={o} vendorTier={vendorTier} busy={busyId === o.id} onAction={onAction} onConfirm={onConfirm} />
        ))}
      </ul>
    </div>
  )
}

function Total({ label, value, sub }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="tabular-nums text-foreground">
        <span className="text-lg">{value}</span>
        {sub ? <span className="ml-1 text-muted-foreground">· {sub}</span> : null}
      </div>
    </div>
  )
}

function OrderCard({ order: o, vendorTier, busy, onAction, onConfirm }) {
  const s = STATUS[o.status] || { label: o.status, bg: '#F2F0EA', fg: '#56534D' }
  const unpaid = o.status === 'pending_payment'
  const paid = o.status === 'paid'
  const isDeposit = o.deposit_cents != null
  return (
    <li className="border border-border p-4 sm:p-5 bg-background" data-testid={`order-${o.short_code}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-base text-foreground">#{o.short_code}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{formatEmailDateTime(o.created_at)}</div>
        </div>
        <span className="shrink-0 text-[11px] uppercase tracking-[0.15em] px-2 py-1 rounded-full" style={{ background: s.bg, color: s.fg }} data-testid="status-label">
          {s.label}
        </span>
      </div>

      <div className="mt-3 text-sm space-y-0.5">
        <div className="font-medium text-foreground">{o.shopper_name || 'No name'}</div>
        {o.shopper_email ? <a href={`mailto:${o.shopper_email}`} className="block text-muted-foreground underline underline-offset-2 break-all">{o.shopper_email}</a> : null}
        {o.shopper_phone ? <a href={`tel:${o.shopper_phone}`} className="block text-muted-foreground underline underline-offset-2">{o.shopper_phone}</a> : null}
      </div>

      <ul className="mt-3 text-sm text-foreground">
        {o.items.map((it, i) => <li key={i}>{it.quantity}× {it.product_name}</li>)}
      </ul>

      <div className="mt-3 text-sm text-foreground">
        {isDeposit
          ? <>Deposit due <strong>{money(o.deposit_cents)}</strong> · Order total {money(o.total_cents)}</>
          : <>Amount <strong>{money(o.total_cents)}</strong></>}
      </div>

      <div className="mt-3 border border-border bg-stone-50 px-3 py-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Venmo note</div>
        <div className="font-mono text-lg text-foreground break-all select-all" data-testid="venmo-note">{o.venmo_note}</div>
      </div>

      {unpaid ? (
        <p className="mt-3 text-sm text-foreground bg-amber-50 border border-amber-200 px-3 py-2" data-testid="unpaid-note">
          Not paid yet. This order is holding stock. If you believe the customer abandoned this order, you can cancel it to free those items up.
        </p>
      ) : null}

      {unpaid || paid ? (
        <div className="mt-4 space-y-4">
          {unpaid ? (
            <ActionRow
              label="Mark paid" primary busy={busy}
              onClick={() => onConfirm({ kind: 'mark_paid', order: o })}
              help={'Only mark paid after you see the payment in Venmo. The shopper gets a "payment confirmed" email right away, and it can\'t be unsent.'}
              testId="mark-paid"
            />
          ) : null}
          {paid ? (
            <ActionRow
              label="Mark picked up" primary busy={busy}
              onClick={() => onAction(o, 'mark_picked_up')}
              help={vendorTier === 'shop'
                ? 'Marks the order complete and sends the shopper a thank-you note asking for a review.'
                : 'Marks the order complete.'}
              testId="mark-picked-up"
            />
          ) : null}
          <ActionRow
            label="Cancel" busy={busy}
            onClick={() => onConfirm({ kind: 'cancel', order: o })}
            help="Cancelling emails the shopper and frees up their items for someone else. If they already paid, refund them in Venmo yourself. Dropvine can't send money back."
            testId="cancel"
          />
        </div>
      ) : null}
    </li>
  )
}

function ActionRow({ label, help, onClick, busy, primary, testId }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={`shrink-0 inline-flex items-center justify-center gap-2 h-11 px-5 text-sm w-full sm:w-auto disabled:opacity-50 ${primary ? 'text-white' : 'border border-foreground text-foreground bg-background'}`}
        style={primary ? { backgroundColor: GREEN } : undefined}
        data-testid={testId}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {label}
      </button>
      <p className="text-xs text-muted-foreground leading-relaxed">{help}</p>
    </div>
  )
}
