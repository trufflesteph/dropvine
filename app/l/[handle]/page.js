'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Countdown } from '@/components/dropvine/countdown'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ArrowRight, Lock, Check, Minus, Plus, ExternalLink, Loader2 } from 'lucide-react'

export default function PublicLaunchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>}>
      <PublicLaunchPageInner />
    </Suspense>
  )
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function money(cents) {
  if (cents == null || cents === '') return '—'
  return `$${(Number(cents) / 100).toFixed(2)}`
}

function venmoDeepLink({ handle, amountCents, note }) {
  if (!handle) return null
  const amount = ((amountCents || 0) / 100).toFixed(2)
  const params = new URLSearchParams({ txn: 'pay', amount, note: note || '' })
  return `https://venmo.com/${encodeURIComponent(String(handle).replace(/^@/, ''))}?${params.toString()}`
}

// 4 uppercase alphanumeric chars (no 0/O/1/I for readability).
function randomCode4() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

// Decide which collection mode the page will actually render. Falls back to
// 'waitlist' for venmo-based modes when venmo_handle is missing, and emits a
// console warning so creators / support can spot misconfigured drops.
function resolveMode(launch) {
  const raw = (launch?.collection_mode || 'waitlist').toLowerCase().trim()
  if (raw === 'pre-order' || raw === 'deposit') {
    if (!launch?.venmo_handle) {
      console.warn(`[dropvine] launch "${launch?.handle}" is collection_mode="${raw}" but has no venmo_handle — falling back to waitlist.`)
      return 'waitlist'
    }
    return raw
  }
  if (raw === 'reservation') return 'reservation'
  return 'waitlist'
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

function PublicLaunchPageInner() {
  const { handle } = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [launch, setLaunch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reserving, setReserving] = useState(false)
  const [reservationStatus, setReservationStatus] = useState(null) // 'pending' | 'held' | 'cancelled'

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`/api/launches/by-handle/${handle}`)
        if (!r.ok) { setLaunch(null); return }
        const d = await r.json()
        setLaunch(d.launch)
      } finally { setLoading(false) }
    }
    if (handle) load()
  }, [handle])

  // Handle return from Stripe
  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    const cancelled = searchParams.get('cancelled')
    if (cancelled) {
      toast.error('Reservation cancelled.')
      router.replace(`/l/${handle}`)
      return
    }
    if (!sessionId) return
    setReservationStatus('pending')
    let attempts = 0
    const maxAttempts = 8
    const tick = async () => {
      attempts += 1
      try {
        const r = await fetch(`/api/payments/checkout/status/${sessionId}`)
        const d = await r.json()
        if (d.payment_status === 'paid') {
          setReservationStatus('held')
          toast.success('Reservation confirmed.')
          return
        }
        if (d.status === 'expired') {
          setReservationStatus('cancelled')
          toast.error('Checkout expired.')
          return
        }
      } catch {}
      if (attempts < maxAttempts) setTimeout(tick, 2000)
      else { setReservationStatus('pending'); toast.message('Still processing — check your email shortly.') }
    }
    tick()
  }, [searchParams, handle, router])

  const isLive = useMemo(() => launch ? new Date(launch.launch_at) <= new Date() : false, [launch])
  const mode = useMemo(() => resolveMode(launch), [launch])

  const join = async (e) => {
    e.preventDefault()
    if (!launch) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/launches/${launch.id}/waitlist`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, note: mode === 'reservation' ? 'reservation' : undefined }),
      })
      if (!r.ok) throw new Error('Could not join')
      setJoined(true)
      toast.success(mode === 'reservation'
        ? 'Your spot is reserved. Watch your inbox.'
        : 'You are on the list. Watch your inbox.')
    } catch (e) { toast.error(e.message) } finally { setSubmitting(false) }
  }

  const reserve = async () => {
    if (!launch || !email) return toast.error('Enter your email first.')
    setReserving(true)
    try {
      const r = await fetch(`/api/launches/${launch.id}/reserve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, origin_url: window.location.origin }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed')
      window.location.href = d.url
    } catch (e) {
      toast.error(e.message)
      setReserving(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
  if (!launch) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <div className="font-serif text-3xl tracking-tighter mb-2">Not found</div>
      <p className="text-muted-foreground text-sm">This launch page does not exist or is unpublished.</p>
      <Link href="/" className="mt-8 underline underline-offset-4 text-sm">Back to Dropvine</Link>
    </div>
  )

  // Decide which right-rail panel to render. Reservation mode prefers the
  // Stripe card when reservation_enabled + hold are set; otherwise falls back
  // to a "reserve my spot" form that creates a waitlist entry.
  const reservationStripeAvailable = launch.reservation_enabled && launch.reservation_hold_cents > 0
  let rightRail
  if (joined) {
    rightRail = (
      <div data-testid="confirmed-panel">
        <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Confirmed</div>
        <div className="font-serif text-3xl tracking-tighter">
          {mode === 'reservation' ? 'Your spot is reserved.' : 'You’re on the list.'}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">We’ll let you know the moment the doors open.</p>
      </div>
    )
  } else if (mode === 'pre-order' || mode === 'deposit') {
    rightRail = (
      <PreorderPanel
        launch={launch}
        isDeposit={mode === 'deposit'}
      />
    )
  } else if (mode === 'reservation' && reservationStripeAvailable) {
    rightRail = (
      <ReservationStripePanel
        launch={launch}
        email={email}
        setEmail={setEmail}
        reservationStatus={reservationStatus}
        reserving={reserving}
        onReserve={reserve}
      />
    )
  } else {
    // waitlist mode (or reservation w/o Stripe configured).
    rightRail = (
      <WaitlistPanel
        mode={mode}
        email={email}
        setEmail={setEmail}
        name={name}
        setName={setName}
        submitting={submitting}
        onJoin={join}
      />
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="absolute top-0 inset-x-0 z-30">
        <div className="container flex items-center justify-between py-6">
          <Link href="/" className="font-serif text-lg tracking-tighter">Dropvine</Link>
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Launch — {launch.handle}</div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-36 pb-20 md:pt-48 md:pb-28">
        <div className="container max-w-5xl">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-8" data-testid="mode-eyebrow">
            {isLive ? 'Now open' : 'Upcoming launch'} {mode !== 'waitlist' ? `· ${mode}` : ''}
          </div>
          <h1 className="font-serif font-light text-5xl sm:text-6xl md:text-8xl leading-[0.96] tracking-tightest text-balance">
            {launch.title}
          </h1>
          {launch.tagline && (
            <p className="mt-8 font-serif italic text-2xl md:text-3xl text-muted-foreground max-w-3xl tracking-tight">{launch.tagline}</p>
          )}
        </div>
      </section>

      {/* Countdown / live */}
      <section className="border-y border-border bg-stone-100/60">
        <div className="container py-16 md:py-24">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-6">{isLive ? 'The doors are open' : 'Opens in'}</div>
          {isLive ? (
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
              <div className="font-serif text-5xl md:text-7xl tracking-tightest">It’s time.</div>
              <button className="inline-flex items-center gap-3 bg-foreground text-background px-8 py-4 text-sm hover:opacity-90">
                Enter the drop <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Countdown target={launch.launch_at} size="lg" />
          )}
        </div>
      </section>

      {/* Body */}
      <section className="container py-24 md:py-32 grid md:grid-cols-12 gap-12">
        <div className="md:col-span-7">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">The piece</div>
          <p className="text-lg leading-relaxed text-foreground/90 whitespace-pre-line text-pretty">{launch.description || 'No description provided.'}</p>
          {launch.price_cents > 0 && (
            <div className="mt-12 pt-8 border-t border-border">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Price at release</div>
              <div className="font-serif text-4xl tracking-tighter">{money(launch.price_cents)}</div>
              {launch.capacity ? (
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mt-3">
                  Limited to {launch.capacity}
                </div>
              ) : null}
            </div>
          )}
          {launch.pickup_details ? (
            <div className="mt-10 pt-8 border-t border-border">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Pickup</div>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{launch.pickup_details}</p>
            </div>
          ) : null}
        </div>

        <aside className="md:col-span-5 md:sticky md:top-12 self-start">
          <div className="border border-border p-8 md:p-10 bg-background" data-testid={`mode-panel-${mode}`}>
            {rightRail}
          </div>
          <p className="mt-4 text-[11px] uppercase tracking-[0.25em] text-muted-foreground text-center">Powered by Dropvine</p>
        </aside>
      </section>
    </main>
  )
}

// --------------------------------------------------------------------------
// Right-rail panels
// --------------------------------------------------------------------------

function WaitlistPanel({ mode, email, setEmail, name, setName, submitting, onJoin }) {
  const headline = mode === 'reservation' ? 'Reserve your spot.' : 'Be present at release.'
  const eyebrow = mode === 'reservation' ? 'Reserve your spot' : 'Join the waitlist'
  const cta = mode === 'reservation' ? 'Reserve my spot' : 'Join the list'
  return (
    <>
      <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">{eyebrow}</div>
      <div className="font-serif text-2xl md:text-3xl tracking-tighter">{headline}</div>
      <form onSubmit={onJoin} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" className="h-12 rounded-none border-x-0 border-t-0 border-b border-border focus-visible:ring-0 focus-visible:border-foreground px-0" />
        </div>
        <div className="space-y-2">
          <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Email</Label>
          <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" className="h-12 rounded-none border-x-0 border-t-0 border-b border-border focus-visible:ring-0 focus-visible:border-foreground px-0" />
        </div>
        <button disabled={submitting} className="w-full bg-foreground text-background h-12 text-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2" data-testid="waitlist-submit">
          {submitting ? 'Joining…' : <>{cta} <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
    </>
  )
}

function ReservationStripePanel({ launch, email, setEmail, reservationStatus, reserving, onReserve }) {
  if (reservationStatus === 'held') {
    return (
      <div className="flex items-start gap-3 border border-foreground p-4 bg-foreground text-background" data-testid="reservation-held">
        <Check className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="text-sm leading-relaxed">
          Reservation confirmed — your slot is held for this drop. Check your inbox for the receipt.
        </div>
      </div>
    )
  }
  if (reservationStatus === 'pending') {
    return <div className="border border-border p-4 text-sm text-muted-foreground" data-testid="reservation-pending">Confirming your reservation…</div>
  }
  return (
    <>
      <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Reserve a slot</div>
      <div className="font-serif text-2xl md:text-3xl tracking-tighter">Hold your place with Stripe.</div>
      <p className="text-sm text-muted-foreground mt-4">
        Place a refundable hold of <strong className="text-foreground">{money(launch.reservation_hold_cents)}</strong>{' '}
        via Stripe to secure your spot for this drop.
      </p>
      <div className="mt-6 space-y-2">
        <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Email</Label>
        <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" className="h-12 rounded-none border-x-0 border-t-0 border-b border-border focus-visible:ring-0 focus-visible:border-foreground px-0" />
      </div>
      <button onClick={onReserve} disabled={reserving} className="mt-6 w-full border border-foreground h-12 text-sm hover:bg-foreground hover:text-background transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50" data-testid="reservation-stripe-submit">
        <Lock className="h-3.5 w-3.5" /> {reserving ? 'Redirecting to Stripe…' : 'Reserve via Stripe'}
      </button>
      <p className="text-[11px] text-muted-foreground mt-2">Secure checkout by Stripe.</p>
    </>
  )
}

// Pre-order & Deposit share most of the flow — `isDeposit` toggles which
// amount is the Venmo subject + adds the balance-at-pickup copy.
function PreorderPanel({ launch, isDeposit }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [qty, setQty] = useState(1)
  const [step, setStep] = useState('form')   // 'form' | 'venmo' | 'submitting' | 'confirmed'
  const [note, setNote] = useState('')
  const [order, setOrder] = useState(null)

  const maxQty = useMemo(() => {
    const cap = parseInt(launch?.capacity || '0', 10)
    return cap > 0 ? cap : 99
  }, [launch?.capacity])
  const inc = () => setQty((q) => Math.min(q + 1, maxQty))
  const dec = () => setQty((q) => Math.max(1, q - 1))

  const unitPrice = parseInt(launch?.price_cents || 0, 10)
  const totalCents = unitPrice * qty
  const depositCents = isDeposit ? parseInt(launch?.reservation_hold_cents || 0, 10) * qty : 0
  const balanceCents = isDeposit ? Math.max(0, totalCents - depositCents) : 0
  const venmoAmount = isDeposit ? depositCents : totalCents
  const venmoUrl = venmoDeepLink({ handle: launch?.venmo_handle, amountCents: venmoAmount, note })

  const proceedToVenmo = (e) => {
    e?.preventDefault?.()
    if (!email) { toast.error('Enter your email first.'); return }
    if (isDeposit && depositCents <= 0) {
      toast.error('This drop has no deposit amount configured.')
      return
    }
    if (venmoAmount <= 0) {
      toast.error('This drop has no price configured.')
      return
    }
    setNote(`${launch.handle}-${randomCode4()}`)
    setStep('venmo')
  }

  const confirmPayment = async () => {
    if (!note) return
    setStep('submitting')
    try {
      const r = await fetch(`/api/drops/${launch.handle}/preorder`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, phone, quantity: qty, venmo_note: note }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d?.error || 'Could not save your order')
        setStep('venmo')
        return
      }
      setOrder(d.order)
      setStep('confirmed')
      toast.success(d?.duplicate ? 'Already recorded — see your inbox.' : 'Order recorded — see your inbox.')
    } catch (e) {
      toast.error(e?.message || 'Network error')
      setStep('venmo')
    }
  }

  if (step === 'confirmed' && order) {
    return (
      <div data-testid="preorder-confirmed">
        <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Order #{order.short_code}</div>
        <div className="font-serif text-3xl tracking-tighter">
          {isDeposit ? 'Deposit recorded.' : 'Pre-order recorded.'}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          We&rsquo;ve emailed a receipt to <strong>{order.shopper_email}</strong>. The maker will mark it paid once your Venmo transfer comes through.
        </p>
        <div className="mt-6 pt-6 border-t border-border space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Quantity</span><span>{order.quantity}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{isDeposit ? 'Deposit paid' : 'Total'}</span><span>{money(isDeposit ? order.deposit_cents : order.total_cents)}</span></div>
          {isDeposit ? (
            <div className="flex justify-between"><span className="text-muted-foreground">Balance at pickup</span><span>{money(order.balance_cents)}</span></div>
          ) : null}
          <div className="flex justify-between"><span className="text-muted-foreground">Note</span><span className="font-mono text-xs">{order.venmo_note}</span></div>
        </div>
      </div>
    )
  }

  if (step === 'venmo' || step === 'submitting') {
    const submitting = step === 'submitting'
    return (
      <div data-testid="preorder-venmo">
        <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Send Venmo</div>
        <div className="font-serif text-2xl md:text-3xl tracking-tighter mb-4">
          {isDeposit ? `Send the deposit of ${money(venmoAmount)}.` : `Send ${money(venmoAmount)} via Venmo.`}
        </div>
        <p className="text-sm text-muted-foreground">
          Pay <strong className="text-foreground">@{String(launch.venmo_handle).replace(/^@/, '')}</strong> the exact amount and include the note below in the Venmo memo.
          {isDeposit ? <> Balance of <strong className="text-foreground">{money(balanceCents)}</strong> due at pickup.</> : null}
        </p>
        <div className="mt-6 border border-border p-4 bg-stone-50">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Venmo memo</div>
          <div className="font-mono text-xl tracking-tight mt-1" data-testid="venmo-note">{note}</div>
        </div>
        <a
          href={venmoUrl || '#'}
          target="_blank"
          rel="noreferrer"
          className="mt-4 w-full inline-flex items-center justify-center gap-2 border border-foreground h-12 text-sm hover:bg-foreground hover:text-background transition-colors"
          data-testid="open-venmo"
        >
          Open Venmo <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button
          onClick={confirmPayment}
          disabled={submitting}
          className="mt-3 w-full bg-foreground text-background h-12 text-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          data-testid="confirm-payment"
        >
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <>I&rsquo;ve sent payment — confirm my order <ArrowRight className="h-4 w-4" /></>}
        </button>
        <button
          onClick={() => setStep('form')}
          disabled={submitting}
          className="mt-2 w-full text-xs text-muted-foreground underline disabled:opacity-50"
        >
          ← Back to edit
        </button>
      </div>
    )
  }

  // step === 'form'
  return (
    <>
      <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">
        {isDeposit ? 'Secure with a deposit' : 'Pre-order via Venmo'}
      </div>
      <div className="font-serif text-2xl md:text-3xl tracking-tighter">
        {isDeposit
          ? <>Secure your order with a <strong>{money(parseInt(launch?.reservation_hold_cents || 0, 10))} deposit</strong> via Venmo.</>
          : <>Pre-order via Venmo.</>}
      </div>
      {isDeposit ? (
        <p className="mt-2 text-xs text-muted-foreground">Balance of <strong className="text-foreground">{money(unitPrice - parseInt(launch?.reservation_hold_cents || 0, 10))}</strong> due at pickup.</p>
      ) : null}
      <form onSubmit={proceedToVenmo} className="mt-8 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" className="h-12 rounded-none border-x-0 border-t-0 border-b border-border focus-visible:ring-0 focus-visible:border-foreground px-0" />
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" className="h-12 rounded-none border-x-0 border-t-0 border-b border-border focus-visible:ring-0 focus-visible:border-foreground px-0" />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Email</Label>
          <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" className="h-12 rounded-none border-x-0 border-t-0 border-b border-border focus-visible:ring-0 focus-visible:border-foreground px-0" />
        </div>
        {launch?.capacity ? (
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Quantity (max {maxQty})</Label>
            <div className="inline-flex items-center border border-border">
              <button type="button" onClick={dec} className="px-3 h-10 border-r border-border hover:bg-stone-50" aria-label="Decrease quantity"><Minus className="h-3.5 w-3.5" /></button>
              <div className="px-5 font-mono text-sm tabular-nums" data-testid="qty">{qty}</div>
              <button type="button" onClick={inc} className="px-3 h-10 border-l border-border hover:bg-stone-50" aria-label="Increase quantity"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ) : null}
        <div className="pt-4 border-t border-border space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">{isDeposit ? 'Order total' : 'Total'}</span><span data-testid="order-total">{money(totalCents)}</span></div>
          {isDeposit ? (
            <>
              <div className="flex justify-between"><span className="text-muted-foreground">Deposit due now</span><span className="font-medium" data-testid="deposit-due">{money(depositCents)}</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>Balance at pickup</span><span>{money(balanceCents)}</span></div>
            </>
          ) : null}
        </div>
        <button
          type="submit"
          className="w-full bg-foreground text-background h-12 text-sm hover:opacity-90 inline-flex items-center justify-center gap-2"
          data-testid="preorder-submit"
        >
          {isDeposit ? <>Send {money(depositCents)} deposit via Venmo <ArrowRight className="h-4 w-4" /></>
                     : <>Pre-order via Venmo <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
    </>
  )
}
