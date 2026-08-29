'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Countdown } from '@/components/dropvine/countdown'
import { DropvineLogo } from '@/components/dropvine/logo'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ArrowRight, Lock, Check, Minus, Plus, ExternalLink, Loader2, MapPin } from 'lucide-react'

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

// Dropvine brand green for primary CTAs (Round-2 Fix 21 — bright #4CAF50 to
// match the platform standard). Hex value used via inline `style` because
// Tailwind has no built-in palette token at this exact shade.
const DROPVINE_GREEN = '#4CAF50'
const DROPVINE_GREEN_HOVER = '#43A047'

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

// Decide which drop mode the page will actually render. Falls back to
// 'waitlist' for venmo-based modes when venmo_handle is missing, and emits a
// console warning so creators / support can spot misconfigured drops.
function resolveMode(drop) {
  const raw = (drop?.collection_mode || 'waitlist').toLowerCase().trim()
  if (raw === 'announcement') return 'announcement'
  if (raw === 'pre-order' || raw === 'deposit') {
    if (!drop?.venmo_handle) {
      console.warn(`[dropvine] drop "${drop?.handle}" is collection_mode="${raw}" but has no venmo_handle — falling back to waitlist.`)
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
  const isPreview = searchParams.get('preview') === 'true'
  const [drop, setDrop] = useState(null)
  const [products, setProducts] = useState([])
  const [publishToken, setPublishToken] = useState(null) // { token, publish_action } when draft + preview
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
        // Pass through ?preview=true so the API can return drafts + token.
        const qs = isPreview ? '?preview=true' : ''
        const r = await fetch(`/api/drops/by-handle/${handle}${qs}`)
        if (!r.ok) { setDrop(null); return }
        const d = await r.json()
        setDrop(d.drop)
        setProducts(Array.isArray(d.products) ? d.products : [])
        setPublishToken(d.publish_token || null)
      } finally { setLoading(false) }
    }
    if (handle) load()
  }, [handle, isPreview])

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

  const isLive = useMemo(() => drop ? new Date(drop.launch_at) <= new Date() : false, [drop])
  const mode = useMemo(() => resolveMode(drop), [drop])

  const join = async (e) => {
    e.preventDefault()
    if (!drop) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/drops/${drop.id}/waitlist`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, note: mode === 'reservation' ? 'reservation' : undefined }),
      })
      if (!r.ok) throw new Error('Could not join')
      setJoined(true)
      toast.success(mode === 'reservation'
        ? 'Your spot is reserved. Watch your inbox.'
        : mode === 'announcement'
          ? 'You’re subscribed for updates.'
          : 'You are on the list. Watch your inbox.')
    } catch (e) { toast.error(e.message) } finally { setSubmitting(false) }
  }

  const reserve = async () => {
    if (!drop || !email) return toast.error('Enter your email first.')
    setReserving(true)
    try {
      const r = await fetch(`/api/drops/${drop.id}/reserve`, {
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
  if (!drop) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <div className="font-serif text-3xl tracking-tighter mb-2">Not found</div>
      <p className="text-muted-foreground text-sm">This drop page does not exist or is unpublished.</p>
      <Link href="/" className="mt-8 underline underline-offset-4 text-sm">Back to Dropvine</Link>
    </div>
  )

  // Decide which right-rail panel to render. Reservation mode prefers the
  // Stripe card when reservation_enabled + hold are set; otherwise falls back
  // to a "reserve my spot" form that creates a waitlist entry.
  const reservationStripeAvailable = drop.reservation_enabled && drop.reservation_hold_cents > 0
  let rightRail
  if (joined) {
    rightRail = (
      <div data-testid="confirmed-panel">
        <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Confirmed</div>
        <div className="font-serif text-3xl tracking-tighter">
          {mode === 'reservation' ? 'Your spot is reserved.' : mode === 'announcement' ? 'You’re subscribed.' : 'You’re on the list.'}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {mode === 'announcement' ? 'You’ll get the next update as soon as it goes out.' : 'We’ll let you know the moment the doors open.'}
        </p>
      </div>
    )
  } else if (mode === 'announcement') {
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
  } else if (mode === 'pre-order' || mode === 'deposit') {
    rightRail = (
      <PreorderPanel
        drop={drop}
        products={products}
        isDeposit={mode === 'deposit'}
      />
    )
  } else if (mode === 'reservation' && reservationStripeAvailable) {
    rightRail = (
      <ReservationStripePanel
        drop={drop}
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

  // Draft / preview gating.
  // The API hides drafts from anyone without ?preview=true, but defense in
  // depth: also render NotFound here if the drop came back as a draft and
  // the URL is missing the preview gate. (This branch typically only fires
  // for stale fetches or someone editing the response client-side.)
  const isDraft = drop.status === 'draft'
  if (isDraft && !isPreview) {
    return (
      <NotFound
        handle={handle}
        title={drop.title}
        joined={joined}
        email={email}
        setEmail={setEmail}
        name={name}
        setName={setName}
        submitting={submitting}
        onJoin={join}
      />
    )
  }

  // Banner copy + button derive from publish_action. We default the action to
  // 'publish' so the banner still works on databases that haven't applied the
  // publish_tokens migration yet (token will be null in that case).
  const publishAction = publishToken?.publish_action || 'publish'
  const isScheduleFlow = publishAction === 'schedule'
  const launchAtLabel = drop.launch_at
    ? new Date(drop.launch_at).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : null
  // Stack the banners: draft banner above demo banner if both apply. Header
  // top offset is computed below.
  const bannerCount = (isDraft ? 1 : 0) + (drop.is_demo ? 1 : 0)
  const headerTopClass = bannerCount === 2 ? 'top-[72px]' : bannerCount === 1 ? 'top-9' : 'top-0'

  return (
    <main className="min-h-screen bg-background text-foreground">
      {isDraft && (
        // Draft preview banner — sits at the very top so it's the first thing
        // the vendor sees when they click "Preview your drop" in their
        // confirmation email. Slate / neutral palette so it doesn't compete
        // visually with the demo banner (warm amber) when both render.
        <div className="relative z-50 bg-slate-900 text-white border-b border-slate-800 text-[13px] leading-snug py-3 px-4">
          <div className="container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex-1">
              {isScheduleFlow ? (
                <>
                  This is a preview of your drop — it’s not live yet. Review everything carefully, then schedule it to go live on
                  {' '}<strong className="text-white">{launchAtLabel || 'your drop time'}</strong>.
                </>
              ) : (
                <>This is a preview of your drop — it’s not live yet. Review everything carefully, then publish to make it live immediately.</>
              )}
            </div>
            {publishToken?.token ? (
              <a
                href={`/api/launches/publish/${publishToken.token}`}
                className="inline-flex items-center gap-2 text-white px-4 py-2 text-sm font-medium whitespace-nowrap"
                style={{ backgroundColor: DROPVINE_GREEN }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = DROPVINE_GREEN_HOVER)}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = DROPVINE_GREEN)}
              >
                {isScheduleFlow ? 'Schedule my drop' : 'Publish my drop'} <ArrowRight className="h-4 w-4" />
              </a>
            ) : (
              <span className="text-[11px] text-white/60">Token expired — resubmit the Tally form for a fresh link.</span>
            )}
          </div>
        </div>
      )}
      {drop.is_demo && (
        // Non-dismissible "demo page" banner. Renders only when drops.is_demo
        // is true. Warm amber / muted — intentionally distinct from real
        // success/error UI. Pushes the floating header down by ~36px (see
        // `top-9` override on the header below).
        <div className="relative z-40 bg-amber-100/80 text-amber-900 border-b border-amber-200/60 text-[12px] leading-snug text-center py-2 px-4">
          This is a demo page — no real orders will be processed.
        </div>
      )}
      <header className={`absolute inset-x-0 z-30 ${headerTopClass}`}>
        <div className="container flex items-center justify-between py-6">
          <Link href="/" className="inline-flex items-center" aria-label="Dropvine home">
            <DropvineLogo height={drop.is_demo ? 60 : 44} />
          </Link>
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Drop — {drop.handle}</div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-36 pb-20 md:pt-48 md:pb-28">
        <div className="container max-w-5xl">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-8" data-testid="mode-eyebrow">
            {isLive ? 'Now open' : 'Upcoming drop'} {mode !== 'waitlist' ? `· ${mode}` : ''}
          </div>
          <h1 className="font-serif font-light text-5xl sm:text-6xl md:text-8xl leading-[0.96] tracking-tightest text-balance">
            {drop.title}
          </h1>
          {/* Vendor identity row — category pill + city/state + link back to
              the maker's full profile. Surfaces the maker behind the drop
              without competing with the headline. */}
          {(drop.vendor_category || drop.vendor_location_city || drop.vendor_slug) ? (
            <div className="mt-6 flex items-center flex-wrap gap-3">
              {drop.vendor_category ? (
                <span className="text-[10px] uppercase tracking-[0.22em] px-2 py-1 bg-stone-100 text-foreground border border-border">
                  {drop.vendor_category}
                </span>
              ) : null}
              {drop.vendor_location_city ? (
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {[drop.vendor_location_city, drop.vendor_location_state].filter(Boolean).join(', ')}
                </span>
              ) : null}
              {drop.vendor_slug && drop.vendor_business_name ? (
                <Link
                  href={`/direct/${drop.vendor_slug}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1 underline underline-offset-4 decoration-1"
                >
                  by {drop.vendor_business_name}
                </Link>
              ) : null}
            </div>
          ) : null}
          {drop.tagline && (
            <p className="mt-8 font-serif italic text-2xl md:text-3xl text-muted-foreground max-w-3xl tracking-tight">{drop.tagline}</p>
          )}
          {/* Vendor-supplied hero photo. Falls back to first gallery image when
              cover_url is absent so the hero never shows blank when images exist. */}
          {(drop.cover_url || (Array.isArray(drop.photo_urls) && drop.photo_urls[0])) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={drop.cover_url || drop.photo_urls[0]}
              alt={drop.title}
              className="mt-12 md:mt-16 w-full aspect-[16/9] object-cover border border-border"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          )}
          {drop.description && (
            <p className="mt-8 text-lg leading-relaxed text-foreground/90 whitespace-pre-line text-pretty max-w-3xl">{drop.description}</p>
          )}
        </div>
      </section>

      {/* Countdown — hidden on demo pages and once the drop is live. The
          live-state CTA ("It's time" / "Enter the drop") was removed in
          June 2026 as outdated copy (Fix 17). The countdown panel remains
          for upcoming drops so shoppers can see exactly when the doors open. */}
      {!drop.is_demo && !isLive && (
      <section className="border-y border-border bg-stone-100/60">
        <div className="container py-16 md:py-24">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-6">Opens in</div>
          <Countdown target={drop.launch_at} size="lg" />
        </div>
      </section>
      )}

      {/* Body */}
      <section className="container py-24 md:py-32">
        {drop.pickup_details ? (
          <div className="max-w-2xl mb-12">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Pickup</div>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{drop.pickup_details}</p>
          </div>
        ) : null}
        <div
          className={`border border-border p-8 md:p-10 bg-background ${isDraft ? 'pointer-events-none opacity-60 select-none' : ''}`}
          data-testid={`mode-panel-${mode}`}
          aria-disabled={isDraft || undefined}
        >
          {!isLive && !isDraft ? (
            <div data-testid="not-open-panel">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Upcoming</div>
              <div className="font-serif text-2xl md:text-3xl tracking-tighter">
                Opens {launchAtLabel || 'soon'}.
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Orders open when the drop launches. Check back then.
              </p>
            </div>
          ) : rightRail}
        </div>
        {drop?.creator_plan_tier !== 'shop' ? (
          <p className="mt-4 text-[11px] uppercase tracking-[0.25em] text-muted-foreground text-center">
            Powered by{' '}
            <a
              href="https://dropvine.pro"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Dropvine
            </a>
          </p>
        ) : null}
      </section>
    </main>
  )
}

// --------------------------------------------------------------------------
// Right-rail panels
// --------------------------------------------------------------------------

function WaitlistPanel({ mode, email, setEmail, name, setName, submitting, onJoin }) {
  // Fix 19 — "Be present at release" copy was removed; headline now mirrors
  // the action ("Join the waitlist" / "Reserve your spot") cleanly.
  const headline = mode === 'reservation'
    ? 'Reserve your spot.'
    : mode === 'announcement'
      ? 'Get the update.'
      : 'Join the waitlist.'
  const eyebrow = mode === 'reservation'
    ? 'Reserve your spot'
    : mode === 'announcement'
      ? 'Announcement'
      : 'Join the waitlist'
  const cta = mode === 'reservation' ? 'Reserve my spot' : mode === 'announcement' ? 'Get updates' : 'Join the list'
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
        <button disabled={submitting} className="w-full text-white h-12 text-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2" style={{ backgroundColor: DROPVINE_GREEN }} data-testid="waitlist-submit">
          {submitting ? 'Joining…' : <>{cta} <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
    </>
  )
}

function ReservationStripePanel({ drop, email, setEmail, reservationStatus, reserving, onReserve }) {
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
        Place a refundable hold of <strong className="text-foreground">{money(drop.reservation_hold_cents)}</strong>{' '}
        via Stripe to secure your spot for this drop.
      </p>
      <div className="mt-6 space-y-2">
        <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Email</Label>
        <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" className="h-12 rounded-none border-x-0 border-t-0 border-b border-border focus-visible:ring-0 focus-visible:border-foreground px-0" />
      </div>
      <button onClick={onReserve} disabled={reserving} className="mt-6 w-full h-12 text-sm text-white hover:opacity-90 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: DROPVINE_GREEN }} data-testid="reservation-stripe-submit">
        <Lock className="h-3.5 w-3.5" /> {reserving ? 'Redirecting to Stripe…' : 'Reserve via Stripe'}
      </button>
      <p className="text-[11px] text-muted-foreground mt-2">Secure checkout by Stripe.</p>
    </>
  )
}

// Pre-order & Deposit share most of the flow — `isDeposit` toggles which
// amount is the Venmo subject + adds the balance-at-pickup copy.
//
// When `products` is non-empty, renders a catalogue grid with per-product
// quantity steppers (hard-capped by `drop_products.quantity`). When empty,
// falls back to the legacy single-SKU flow driven by `drop.price_cents`.
function PreorderPanel({ drop, products, isDeposit }) {
  const hasProducts = Array.isArray(products) && products.length > 0
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  // Legacy single-SKU qty.
  const [qty, setQty] = useState(1)
  // Multi-SKU per-product qty map keyed by product id.
  const [productQty, setProductQty] = useState(() => {
    const m = {}
    for (const p of (products || [])) m[p.id] = 0
    return m
  })
  const [step, setStep] = useState('form')   // 'form' | 'venmo' | 'submitting' | 'confirmed'
  const [note, setNote] = useState('')
  const [order, setOrder] = useState(null)

  // deposit_percent is the authoritative deposit calculation for deposit-mode
  // drops. When it's not configured, the drop falls back to behaving like a
  // regular pre-order — full price due, no deposit/balance split shown.
  const depositPercentNum = parseInt(drop?.deposit_percent ?? '', 10)
  const hasDepositPercent = isDeposit && Number.isFinite(depositPercentNum) && depositPercentNum > 0

  // -- Single-SKU helpers (legacy fallback) ---------------------------------
  const maxQty = useMemo(() => {
    const cap = parseInt(drop?.capacity || '0', 10)
    return cap > 0 ? cap : 99
  }, [drop?.capacity])
  const inc = () => setQty((q) => Math.min(q + 1, maxQty))
  const dec = () => setQty((q) => Math.max(1, q - 1))

  // -- Multi-SKU helpers ----------------------------------------------------
  const stepProductQty = (productId, delta) => {
    setProductQty((m) => {
      const cap = (() => {
        const prod = products.find((p) => p.id === productId)
        const q = parseInt(prod?.quantity ?? '0', 10)
        return q > 0 ? q : 99
      })()
      const next = Math.max(0, Math.min((m[productId] || 0) + delta, cap))
      return { ...m, [productId]: next }
    })
  }

  // -- Totals --------------------------------------------------------------
  const totals = useMemo(() => {
    if (hasProducts) {
      let totalCents = 0
      let totalQty = 0
      let depositCents = 0
      for (const p of products) {
        const q = productQty[p.id] || 0
        if (q <= 0) continue
        const priceUnit = parseInt(p.price_cents || 0, 10)
        totalCents += priceUnit * q
        totalQty += q
        if (hasDepositPercent) depositCents += Math.round(priceUnit * depositPercentNum / 100) * q
      }
      const balanceCents = hasDepositPercent ? Math.max(0, totalCents - depositCents) : 0
      const venmoAmount = hasDepositPercent ? depositCents : totalCents
      return { totalCents, totalQty, depositCents: hasDepositPercent ? depositCents : 0, balanceCents, venmoAmount }
    }
    // Legacy path
    const unit = parseInt(drop?.price_cents || 0, 10)
    const totalCents = unit * qty
    const depositCents = hasDepositPercent ? Math.round(unit * depositPercentNum / 100) * qty : 0
    const balanceCents = hasDepositPercent ? Math.max(0, totalCents - depositCents) : 0
    const venmoAmount = hasDepositPercent ? depositCents : totalCents
    return { totalCents, totalQty: qty, depositCents, balanceCents, venmoAmount }
  }, [hasProducts, products, productQty, qty, hasDepositPercent, depositPercentNum, drop?.price_cents])

  const venmoUrl = venmoDeepLink({ handle: drop?.venmo_handle, amountCents: totals.venmoAmount, note })

  const proceedToVenmo = (e) => {
    e?.preventDefault?.()
    if (!email) { toast.error('Enter your email first.'); return }
    if (hasProducts && totals.totalQty <= 0) {
      toast.error('Pick at least one item to continue.')
      return
    }
    if (hasDepositPercent && totals.depositCents <= 0) {
      toast.error('This drop has no deposit amount configured.')
      return
    }
    if (totals.venmoAmount <= 0) {
      toast.error('This drop has no price configured.')
      return
    }
    setNote(`${drop.handle}-${randomCode4()}`)
    setStep('venmo')
  }

  const confirmPayment = async () => {
    if (!note) return
    setStep('submitting')
    try {
      // Build the request payload — multi-mode sends items[], legacy sends quantity.
      const payload = { email, name, phone, venmo_note: note }
      if (hasProducts) {
        payload.items = products
          .filter((p) => (productQty[p.id] || 0) > 0)
          .map((p) => ({ launch_product_id: p.id, quantity: productQty[p.id] }))
      } else {
        payload.quantity = qty
      }
      const r = await fetch(`/api/drops/${drop.handle}/preorder`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d?.error || 'Could not save your order')
        setStep('venmo')
        return
      }
      setOrder({ ...d.order, items: d.items || [] })
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
          {order.deposit_cents != null ? 'Deposit recorded.' : 'Pre-order recorded.'}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          We&rsquo;ve emailed a receipt to <strong>{order.shopper_email}</strong>. The maker will mark it paid once your Venmo transfer comes through.
        </p>
        {Array.isArray(order.items) && order.items.length > 1 ? (
          <div className="mt-6 pt-6 border-t border-border space-y-1 text-sm">
            {order.items.map((it) => (
              <div key={it.id} className="flex justify-between">
                <span className="text-muted-foreground">{it.quantity}× {it.product_name}</span>
                <span>{money((it.price_cents || 0) * (it.quantity || 0))}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-6 pt-6 border-t border-border space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Quantity</span><span>{order.quantity}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{order.deposit_cents != null ? 'Deposit paid' : 'Total'}</span><span>{money(order.deposit_cents != null ? order.deposit_cents : order.total_cents)}</span></div>
          {order.deposit_cents != null ? (
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
          {hasDepositPercent ? `Send the deposit of ${money(totals.venmoAmount)}.` : `Send ${money(totals.venmoAmount)} via Venmo.`}
        </div>
        <p className="text-sm text-muted-foreground">
          Pay <strong className="text-foreground">@{String(drop.venmo_handle).replace(/^@/, '')}</strong> the exact amount and include the note below in the Venmo memo.
          {hasDepositPercent ? <> Balance of <strong className="text-foreground">{money(totals.balanceCents)}</strong> due at pickup.</> : null}
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
          className="mt-3 w-full text-white h-12 text-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          style={{ backgroundColor: DROPVINE_GREEN }}
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
        {hasDepositPercent ? 'Secure with a deposit' : 'Pre-order via Venmo'}
      </div>
      <div className="font-serif text-2xl md:text-3xl tracking-tighter">
        {hasDepositPercent
          ? <>Secure your order with a <strong>{money(totals.depositCents)} deposit</strong> via Venmo.</>
          : <>Pre-order via Venmo.</>}
      </div>
      {hasDepositPercent && !hasProducts ? (
        <p className="mt-2 text-xs text-muted-foreground">Balance of <strong className="text-foreground">{money(totals.balanceCents)}</strong> due at pickup.</p>
      ) : null}

      {/* Catalogue grid (multi-product mode) */}
      {hasProducts ? (
        <div className="mt-6 space-y-3" data-testid="product-catalogue">
          {products.map((p) => {
            const q = productQty[p.id] || 0
            const cap = parseInt(p.quantity ?? '0', 10)
            const remaining = cap > 0 ? cap : null
            return (
              <div key={p.id} className="border border-border p-4 flex gap-4" data-testid={`product-row-${p.id}`}>
                {p.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo_url} alt="" className="w-16 h-16 object-cover border border-border shrink-0" />
                ) : (
                  <div className="w-16 h-16 bg-stone-100 border border-border shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-serif text-base text-foreground truncate">{p.name}</div>
                    <div className="text-sm tabular-nums shrink-0">
                      {hasDepositPercent
                        ? `Reserve with ${money(Math.round((p.price_cents || 0) * depositPercentNum / 100))} deposit · ${money(p.price_cents)} total`
                        : money(p.price_cents)}
                    </div>
                  </div>
                  {p.description ? (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">{p.description}</p>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex items-center border border-border">
                      <button type="button"
                              onClick={() => stepProductQty(p.id, -1)}
                              disabled={q <= 0}
                              className="px-2.5 h-8 border-r border-border hover:bg-stone-50 disabled:opacity-30"
                              aria-label={`Decrease ${p.name}`}>
                        <Minus className="h-3 w-3" />
                      </button>
                      <div className="px-4 font-mono text-xs tabular-nums" data-testid={`qty-${p.id}`}>{q}</div>
                      <button type="button"
                              onClick={() => stepProductQty(p.id, 1)}
                              disabled={remaining != null && q >= remaining}
                              className="px-2.5 h-8 border-l border-border hover:bg-stone-50 disabled:opacity-30"
                              aria-label={`Increase ${p.name}`}>
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    {remaining != null ? (
                      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {remaining - q} left
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
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
        {/* Legacy single-SKU quantity stepper — only when there's no product catalogue. */}
        {!hasProducts && drop?.capacity ? (
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
          <div className="flex justify-between"><span className="text-muted-foreground">{hasDepositPercent ? 'Order total' : 'Total'}</span><span data-testid="order-total">{money(totals.totalCents)}</span></div>
          {hasDepositPercent ? (
            <>
              <div className="flex justify-between"><span className="text-muted-foreground">Deposit due now</span><span className="font-medium" data-testid="deposit-due">{money(totals.depositCents)}</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>Balance at pickup</span><span>{money(totals.balanceCents)}</span></div>
            </>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={hasProducts && totals.totalQty <= 0}
          className="w-full text-white h-12 text-sm hover:opacity-90 disabled:opacity-40 inline-flex items-center justify-center gap-2"
          style={{ backgroundColor: DROPVINE_GREEN }}
          data-testid="preorder-submit"
        >
          {hasDepositPercent ? <>Send {money(totals.depositCents)} deposit via Venmo <ArrowRight className="h-4 w-4" /></>
                     : <>Pre-order via Venmo <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
    </>
  )
}
