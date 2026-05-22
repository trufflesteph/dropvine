'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { ArrowUpRight, Sparkles, Users, CheckCircle2, Clock, Infinity as InfinityIcon, Mail } from 'lucide-react'
import { DropvineLogo } from '@/components/dropvine/logo'

export default function ReservationsPage() {
  const router = useRouter()
  const { user, loading, signOut } = useAuth() || {}
  const [launches, setLaunches] = useState([])
  const [reservations, setReservations] = useState([])
  const [fetchingLaunches, setFetchingLaunches] = useState(true)
  const [fetchingReservations, setFetchingReservations] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  // Load launches once
  useEffect(() => {
    if (!user) return
    const load = async () => {
      setFetchingLaunches(true)
      const r = await fetch('/api/launches?creator=me', { headers: { 'x-user-id': user.id } })
      const d = await r.json()
      const all = d.launches || []
      const eligible = all.filter(l => l.reservation_enabled)
      setLaunches(eligible)
      setSelectedId(eligible[0]?.id || null)
      setFetchingLaunches(false)
    }
    load()
  }, [user]) // eslint-disable-line

  // Load reservations whenever selected launch changes
  useEffect(() => {
    if (!selectedId || !user) { setReservations([]); return }
    const load = async () => {
      setFetchingReservations(true)
      const r = await fetch(`/api/launches/${selectedId}/reservations`, { headers: { 'x-user-id': user.id } })
      const d = await r.json()
      setReservations(d.reservations || [])
      setFetchingReservations(false)
    }
    load()
  }, [selectedId, user])

  const selected = useMemo(() => launches.find(l => l.id === selectedId) || null, [launches, selectedId])

  const stats = useMemo(() => {
    const held = reservations.filter(r => r.status === 'held' || r.status === 'captured').length
    const pending = reservations.filter(r => r.status === 'pending').length
    const cancelled = reservations.filter(r => r.status === 'cancelled' || r.status === 'released').length
    const capacity = selected?.capacity ?? null
    const remaining = capacity == null ? null : Math.max(0, capacity - held)
    return { total: reservations.length, held, pending, cancelled, capacity, remaining }
  }, [reservations, selected])

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border p-8 bg-stone-50">
        <Link href="/" className="inline-flex items-center mb-12" aria-label="Dropvine home"><DropvineLogo height={48} /></Link>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-4">Studio</div>
        <nav className="space-y-1 text-sm">
          <Link href="/dashboard" className="block py-2 px-3 -mx-3 text-muted-foreground hover:text-foreground">Launches</Link>
          <Link href="/dashboard/reservations" className="block py-2 px-3 -mx-3 bg-foreground text-background">Reservations</Link>
          <a className="block py-2 px-3 -mx-3 text-muted-foreground cursor-not-allowed opacity-60">Audience</a>
          <a className="block py-2 px-3 -mx-3 text-muted-foreground cursor-not-allowed opacity-60">Settings</a>
        </nav>
        <div className="mt-auto pt-8 border-t border-border">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Account</div>
          <div className="text-sm truncate">{user.email}</div>
          <button onClick={() => signOut?.()} className="mt-3 text-xs text-muted-foreground hover:text-foreground">Sign out</button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {/* Mobile sidebar / top bar */}
        <div className="md:hidden border-b border-border px-6 py-5 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center" aria-label="Dropvine home"><DropvineLogo height={36} /></Link>
          <Link href="/dashboard" className="text-xs text-muted-foreground">← Launches</Link>
        </div>

        <header className="border-b border-border">
          <div className="px-6 md:px-12 py-8">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Studio</div>
            <h1 className="font-serif font-light text-4xl md:text-5xl tracking-tighter">Reservations</h1>
            <p className="mt-3 text-muted-foreground max-w-xl text-[15px]">Held slots, pending checkouts, and spots remaining — only your launches.</p>
          </div>
        </header>

        {/* Launch picker — scrollable horizontal pills */}
        <section className="px-6 md:px-12 py-6 border-b border-border">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Launch</div>
          {fetchingLaunches ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : launches.length === 0 ? (
            <div className="text-sm text-muted-foreground">No launches with reservations enabled. <Link href="/dashboard/launches/new" className="underline underline-offset-4 text-foreground">Create one →</Link></div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {launches.map(l => (
                <button
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  className={`px-4 py-2 text-sm border transition-colors ${selectedId === l.id ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground'}`}
                >
                  {l.title}
                </button>
              ))}
            </div>
          )}
        </section>

        {selected && (
          <>
            {/* Stats */}
            <section className="px-6 md:px-12 py-10 grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 border-b border-border">
              <Stat
                icon={stats.capacity == null ? <InfinityIcon className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                label="Capacity"
                value={stats.capacity == null ? '∞' : stats.capacity}
                hint={stats.capacity == null ? 'Unlimited' : 'Total spots'}
              />
              <Stat
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Held"
                value={stats.held}
                hint="Confirmed reservations"
                emphasis
              />
              <Stat
                icon={<Clock className="h-4 w-4" />}
                label="Pending"
                value={stats.pending}
                hint="Awaiting payment"
              />
              <Stat
                icon={<Users className="h-4 w-4" />}
                label="Remaining"
                value={stats.remaining == null ? '∞' : stats.remaining}
                hint={stats.capacity == null ? 'No limit' : (stats.remaining === 0 ? 'Sold out' : 'Spots left')}
              />
            </section>

            {/* Capacity bar */}
            {stats.capacity != null && (
              <section className="px-6 md:px-12 pt-8 pb-2">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
                  <span>{stats.held} of {stats.capacity} held</span>
                  <span className="tabular-nums">{Math.round((stats.held / Math.max(1, stats.capacity)) * 100)}%</span>
                </div>
                <div className="h-px bg-border relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-foreground transition-all duration-700"
                    style={{ width: `${Math.min(100, (stats.held / Math.max(1, stats.capacity)) * 100)}%` }}
                  />
                </div>
              </section>
            )}

            {/* Reservations table */}
            <section className="px-6 md:px-12 py-10 md:py-12">
              <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-1">{selected.title}</div>
                  <h2 className="font-serif text-2xl md:text-3xl tracking-tighter">All reservations</h2>
                </div>
                <Link href={`/l/${selected.handle}`} target="_blank" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  Public page <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {fetchingReservations ? (
                <div className="text-sm text-muted-foreground py-12">Loading…</div>
              ) : reservations.length === 0 ? (
                <div className="border border-dashed border-border p-12 md:p-16 text-center">
                  <div className="font-serif text-2xl tracking-tighter">No reservations yet.</div>
                  <p className="mt-2 text-muted-foreground text-sm max-w-md mx-auto">When customers reserve a slot via Stripe, they'll appear here in real time.</p>
                </div>
              ) : (
                <ReservationsTable rows={reservations} />
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function Stat({ icon, label, value, hint, emphasis }) {
  return (
    <div className={`border border-border p-5 md:p-6 ${emphasis ? 'bg-foreground text-background border-foreground' : ''}`}>
      <div className={`flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] ${emphasis ? 'text-background/70' : 'text-muted-foreground'}`}>
        {icon}{label}
      </div>
      <div className={`mt-3 font-serif text-3xl md:text-4xl font-light tracking-tighter tabular-nums`}>{value}</div>
      {hint && <div className={`mt-2 text-xs ${emphasis ? 'text-background/60' : 'text-muted-foreground'}`}>{hint}</div>}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    held:      { label: 'Held',      className: 'bg-foreground text-background border-foreground' },
    captured:  { label: 'Captured',  className: 'bg-foreground text-background border-foreground' },
    pending:   { label: 'Pending',   className: 'border-border text-foreground' },
    cancelled: { label: 'Cancelled', className: 'border-border text-muted-foreground line-through' },
    released:  { label: 'Released',  className: 'border-border text-muted-foreground' },
  }
  const v = map[status] || { label: status, className: 'border-border' }
  return (
    <span className={`inline-block text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 border ${v.className}`}>
      {v.label}
    </span>
  )
}

function PaymentDot({ status }) {
  const dot =
    status === 'held' || status === 'captured' ? 'bg-foreground' :
    status === 'pending' ? 'bg-stone-400 animate-pulse' :
    'bg-stone-300'
  const label =
    status === 'held' ? 'Paid' :
    status === 'captured' ? 'Captured' :
    status === 'pending' ? 'Awaiting' :
    status === 'cancelled' ? 'Failed/Cancelled' :
    status === 'released' ? 'Refunded' : status
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

function fmt(ts) {
  try {
    const d = new Date(ts)
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch { return '—' }
}

function ReservationsTable({ rows }) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="grid grid-cols-12 px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-y border-border">
          <div className="col-span-4">Customer</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Payment</div>
          <div className="col-span-2">Amount</div>
          <div className="col-span-2 text-right">Reserved</div>
        </div>
        <ul className="divide-y divide-border border-b border-border">
          {rows.map(r => (
            <li key={r.id} className="grid grid-cols-12 px-4 py-5 items-center text-sm hover:bg-stone-50/50 transition-colors">
              <div className="col-span-4 truncate flex items-center gap-2.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{r.email}</span>
              </div>
              <div className="col-span-2"><StatusBadge status={r.status} /></div>
              <div className="col-span-2"><PaymentDot status={r.status} /></div>
              <div className="col-span-2 tabular-nums">${(r.amount_cents / 100).toFixed(2)}</div>
              <div className="col-span-2 text-right text-muted-foreground tabular-nums text-xs">{fmt(r.created_at)}</div>
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden divide-y divide-border border-y border-border">
        {rows.map(r => (
          <li key={r.id} className="py-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm truncate flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />{r.email}</div>
                <div className="text-[11px] text-muted-foreground tabular-nums mt-1">{fmt(r.created_at)}</div>
              </div>
              <div className="font-serif text-xl tabular-nums tracking-tighter shrink-0">${(r.amount_cents / 100).toFixed(2)}</div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={r.status} />
              <PaymentDot status={r.status} />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
