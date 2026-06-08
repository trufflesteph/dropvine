'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Nav } from '@/components/dropvine/nav'
import { Footer } from '@/components/dropvine/footer'
import { ArrowRight, ExternalLink, Instagram, Globe, Loader2, Heart, Check, MapPin, Star } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

// Public vendor profile page — /direct/[slug]
//
// Renders a vendor's bio + photo + social links + a grid of their published
// drops (upcoming first, then past). 404s gracefully if the slug doesn't
// match an active vendor.
//
// Data source: GET /api/direct/[slug] (server endpoint backed by direct_vendors
// + drops via the service-role client).

function fmtCountdown(targetMs) {
  const ms = targetMs - Date.now()
  if (ms <= 0) return null
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  if (days > 1) return `${days}d ${hours}h`
  if (days === 1) return `1d ${hours}h`
  if (hours >= 1) return `${hours}h ${mins}m`
  return `${mins}m`
}

function money(cents) {
  if (cents == null) return null
  const n = Number(cents) / 100
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`
}

export default function VendorProfilePage() {
  const { slug } = useParams()
  const [state, setState] = useState({ loading: true, vendor: null, drops: [], error: null })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/direct/${encodeURIComponent(slug)}`)
        const d = await r.json()
        if (cancelled) return
        if (!r.ok) {
          setState({ loading: false, vendor: null, drops: [], error: d?.error || 'Vendor not found' })
          return
        }
        setState({ loading: false, vendor: d.vendor, drops: d.drops || [], error: null })
      } catch (e) {
        if (!cancelled) setState({ loading: false, vendor: null, drops: [], error: e?.message || 'Network error' })
      }
    })()
    return () => { cancelled = true }
  }, [slug])

  if (state.loading) {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
        <main className="container py-32 flex items-center justify-center text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
        </main>
      </div>
    )
  }

  if (state.error || !state.vendor) {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
        <main className="container py-40 text-center">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">404</div>
          <h1 className="font-serif font-light text-5xl tracking-tightest">Vendor not found.</h1>
          <p className="mt-4 text-muted-foreground">{state.error || `No active vendor at /direct/${slug}.`}</p>
          <Link href="/" className="mt-10 inline-flex items-center gap-2 border border-foreground px-6 py-3 text-sm hover:bg-foreground hover:text-background transition">
            Back to home <ArrowRight className="h-4 w-4" />
          </Link>
        </main>
      </div>
    )
  }

  const v = state.vendor
  const venmoUrl = v.venmo_handle
    ? `https://venmo.com/${encodeURIComponent(String(v.venmo_handle).replace(/^@/, ''))}`
    : null

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      {/* HERO ----------------------------------------------------------- */}
      <section className="container pt-32 md:pt-40 pb-12 md:pb-16">
        <div className="grid md:grid-cols-12 gap-10 md:gap-16 items-start">
          <div className="md:col-span-4">
            {v.photo_url || v.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={v.photo_url || v.logo_url}
                alt={v.business_name}
                className="w-full aspect-square object-cover border border-border"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            ) : (
              <div className="w-full aspect-square bg-stone-100 border border-border flex items-center justify-center">
                <div className="font-serif text-7xl text-stone-300">
                  {(v.business_name || '?').charAt(0).toUpperCase()}
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-8">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">
              Vendor profile
            </div>
            <h1 className="font-serif font-light text-5xl md:text-7xl leading-[0.96] tracking-tightest text-balance">
              {v.business_name}
            </h1>
            {(v.category || v.location_city) ? (
              <div className="mt-4 flex items-center flex-wrap gap-3">
                {v.category ? (
                  <span className="text-[10px] uppercase tracking-[0.22em] px-2 py-1 bg-stone-100 text-foreground border border-border">
                    {v.category}
                  </span>
                ) : null}
                {v.location_city ? (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {[v.location_city, v.location_state].filter(Boolean).join(', ')}
                  </span>
                ) : null}
              </div>
            ) : null}
            {v.bio ? (
              <p className="mt-8 text-base md:text-lg text-muted-foreground leading-relaxed text-pretty max-w-2xl whitespace-pre-line">
                {v.bio}
              </p>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-6 text-sm">
              {v.instagram_url ? (
                <a href={v.instagram_url} target="_blank" rel="noreferrer noopener"
                   className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
                  <Instagram className="h-4 w-4" />
                  Instagram
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
              {v.website_url ? (
                <a href={v.website_url} target="_blank" rel="noreferrer noopener"
                   className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
                  <Globe className="h-4 w-4" />
                  Website
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
              {venmoUrl ? (
                <a href={venmoUrl} target="_blank" rel="noreferrer noopener"
                   className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
                  <span className="font-mono">@{String(v.venmo_handle).replace(/^@/, '')}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>

            {/* Follow button — Shop-tier only. Modal collects email + optional
                phone + SMS opt-in. Powers the cron SMS broadcast on drop open. */}
            {v.tier === 'shop' ? (
              <FollowSection slug={v.slug} vendorName={v.business_name} />
            ) : null}
          </div>
        </div>
      </section>

      <div className="container">
        <div className="h-px bg-border" />
      </div>

      {/* DROPS ---------------------------------------------------------- */}
      <section className="container py-16 md:py-24">
        <div className="flex items-end justify-between gap-6 mb-10 md:mb-14">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">
              Drops
            </div>
            <h2 className="font-serif font-light text-3xl md:text-4xl leading-[0.96] tracking-tightest">
              {(() => {
                // A drop is "current" if its closes_at is in the future OR not
                // set at all (open-ended). Past drops still render below but the
                // headline reflects what's actually live right now.
                const now = Date.now()
                const current = state.drops.filter((d) => !d.closes_at || Date.parse(d.closes_at) > now)
                if (current.length === 0) return 'No Current Drops'
                if (current.length === 1) return 'One drop, live now.'
                return `${current.length} drops.`
              })()}
            </h2>
          </div>
        </div>

        {state.drops.length === 0 ? (
          <div className="border border-dashed border-border p-10 md:p-16 text-center text-muted-foreground">
            <p className="max-w-md mx-auto text-sm">
              When <strong className="text-foreground">{v.business_name}</strong> publishes
              a drop, it&rsquo;ll appear here.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {state.drops.map((d) => (
              <DropCard key={d.id} drop={d} />
            ))}
          </div>
        )}
      </section>

      {/* REVIEWS (Shop-tier only) ------------------------------------------ */}
      {v.tier === 'shop' ? (
        <>
          <div className="container">
            <div className="h-px bg-border" />
          </div>
          <ReviewsSection slug={v.slug} />
        </>
      ) : null}

      <Footer />
    </div>
  )
}

function DropCard({ drop }) {
  // A drop has three lifecycle states:
  //   • upcoming   — launch_at is in the future
  //   • live       — launch_at has passed AND (no closes_at OR closes_at in future)
  //   • past       — closes_at has passed (or it never launched + has no close window)
  //
  // The previous implementation only checked launch_at, which incorrectly
  // flagged any drop seeded with launch_at=now() as "Past drop" the moment the
  // page loaded — even if closes_at was weeks away.
  const now = Date.now()
  const launchMs = drop.launch_at ? Date.parse(drop.launch_at) : 0
  const closesMs = drop.closes_at ? Date.parse(drop.closes_at) : 0
  const upcoming = launchMs && launchMs > now
  const live = !upcoming && (!closesMs || closesMs > now)
  const cd = upcoming ? fmtCountdown(launchMs) : null
  const price = money(drop.price_cents)
  const label = upcoming ? 'Upcoming' : live ? 'Live now' : 'Past drop'

  return (
    <Link
      href={`/l/${drop.handle}`}
      className="group block border border-border bg-background hover:border-foreground transition-colors"
    >
      {drop.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={drop.cover_url} alt="" className="w-full aspect-[4/3] object-cover border-b border-border" />
      ) : (
        <div className="w-full aspect-[4/3] bg-stone-100 border-b border-border" />
      )}
      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between gap-3">
          <div className={`text-[10px] uppercase tracking-[0.25em] ${live ? 'text-foreground' : 'text-muted-foreground'}`}>
            {live ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {label}
              </span>
            ) : label}
          </div>
          {cd ? (
            <div className="text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 bg-foreground text-background tabular-nums">
              In {cd}
            </div>
          ) : null}
        </div>
        <div className="mt-3 font-serif text-xl md:text-2xl tracking-tighter group-hover:underline underline-offset-4 decoration-1">
          {drop.title}
        </div>
        {drop.tagline ? (
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {drop.tagline}
          </p>
        ) : null}
        <div className="mt-6 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{price || '—'}</span>
          <span className="inline-flex items-center gap-1 text-foreground/80 group-hover:text-foreground">
            View drop <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// FollowSection — Shop-tier exclusive. Renders a "Follow this maker" button
// and a modal that collects email + optional phone + SMS opt-in. Posts to
// /api/direct/[slug]/follow which upserts the row in direct_vendor_follows.
// ---------------------------------------------------------------------------

function FollowSection({ slug, vendorName }) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/direct/${encodeURIComponent(slug)}/follow`)
        const d = await r.json()
        if (!cancelled && r.ok && typeof d.count === 'number') setCount(d.count)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [slug])

  async function submit(e) {
    e?.preventDefault?.()
    setError(null)
    setSubmitting(true)
    try {
      const r = await fetch(`/api/direct/${encodeURIComponent(slug)}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, phone, sms_opt_in: smsOptIn }),
      })
      const d = await r.json()
      if (!r.ok || !d.ok) {
        setError(d?.error || 'Something went wrong.')
      } else {
        setDone(true)
        setCount((c) => (typeof c === 'number' ? c + 1 : c))
      }
    } catch (e) {
      setError(e?.message || 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setEmail(''); setName(''); setPhone(''); setSmsOptIn(false); setDone(false); setError(null)
  }

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button
          onClick={() => { reset(); setOpen(true) }}
          className="rounded-none border border-foreground bg-foreground text-background hover:bg-background hover:text-foreground transition gap-2"
        >
          <Heart className="h-4 w-4" />
          Follow {vendorName?.split(' ')[0] || 'this maker'}
        </Button>
        {typeof count === 'number' && count > 0 ? (
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {count} {count === 1 ? 'follower' : 'followers'}
          </div>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
        <DialogContent className="rounded-none border border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif font-light text-3xl tracking-tightest">
              {done ? 'You’re in.' : `Follow ${vendorName || 'this maker'}.`}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed pt-2">
              {done
                ? `We’ll let you know the moment ${vendorName || 'they'} drops something next.${smsOptIn ? ' You’ll also get a text.' : ''}`
                : 'Get notified by email when they open a new drop. Add your number to also get a text (Shop tier perk).'}
            </DialogDescription>
          </DialogHeader>

          {done ? (
            <div className="pt-2">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Check className="h-4 w-4" /> Confirmed for {email}.
              </div>
              <Button
                onClick={() => setOpen(false)}
                className="mt-6 rounded-none border border-foreground bg-foreground text-background hover:bg-background hover:text-foreground w-full"
              >
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="follow-email" className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Email *</Label>
                <Input
                  id="follow-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="rounded-none border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="follow-name" className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Name (optional)</Label>
                <Input
                  id="follow-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="First name"
                  className="rounded-none border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="follow-phone" className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Phone (optional)</Label>
                <Input
                  id="follow-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="rounded-none border-border"
                />
              </div>
              <label className={`flex items-start gap-3 cursor-pointer text-sm ${phone ? 'text-foreground' : 'text-muted-foreground opacity-60 cursor-not-allowed'}`}>
                <Checkbox
                  checked={smsOptIn}
                  disabled={!phone}
                  onCheckedChange={(c) => setSmsOptIn(!!c)}
                  className="mt-0.5 rounded-none"
                />
                <span className="leading-snug">
                  Also text me when {vendorName?.split(' ')[0] || 'they'} drops something.
                  <span className="block text-[11px] text-muted-foreground mt-0.5">Reply STOP anytime to opt out.</span>
                </span>
              </label>
              {error ? (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</div>
              ) : null}
              <Button
                type="submit"
                disabled={submitting || !email}
                className="rounded-none border border-foreground bg-foreground text-background hover:bg-background hover:text-foreground w-full"
              >
                {submitting ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" /> Following…</>) : 'Follow'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}


// ---------------------------------------------------------------------------
// ReviewsSection — Shop-tier exclusive. Renders the average rating + a list
// of approved (status='published') customer reviews. Hidden entirely when
// the vendor has zero reviews (per the spec — no empty state, no zero-count
// drawing attention to the lack of feedback).
// ---------------------------------------------------------------------------

function ReviewsSection({ slug }) {
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState([])
  const [count, setCount] = useState(0)
  const [average, setAverage] = useState(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/direct/${encodeURIComponent(slug)}/reviews`)
        const d = await r.json()
        if (cancelled) return
        if (r.ok && d?.ok && Array.isArray(d.reviews)) {
          setReviews(d.reviews)
          setCount(d.count || d.reviews.length || 0)
          setAverage(d.average)
        }
      } catch {}
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [slug])

  // Hide the entire section when there are zero reviews — the spec is
  // explicit: do not draw attention to the absence of reviews.
  if (loading) return null
  if (!count) return null

  const visible = showAll ? reviews : reviews.slice(0, 5)
  const hasMore = reviews.length > 5

  return (
    <section className="container py-16 md:py-24">
      <div className="flex items-end justify-between gap-6 mb-10 md:mb-14">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">
            What customers say
          </div>
          <h2 className="font-serif font-light text-3xl md:text-4xl leading-[0.96] tracking-tightest flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-2">
              <Star className="h-7 w-7 fill-current" style={{ color: '#2D4A2A' }} />
              {average?.toFixed(1) ?? '—'}
            </span>
            <span className="text-base md:text-lg text-muted-foreground tracking-normal">
              ({count} {count === 1 ? 'review' : 'reviews'})
            </span>
          </h2>
        </div>
      </div>

      <ul className="space-y-6 md:space-y-8">
        {visible.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </ul>

      {hasMore ? (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-sm border border-foreground px-5 py-2 hover:bg-foreground hover:text-background transition"
          >
            {showAll ? `Show fewer reviews` : `Show all ${reviews.length} reviews`}
          </button>
        </div>
      ) : null}
    </section>
  )
}

function ReviewCard({ review }) {
  const rating = Math.max(1, Math.min(5, review.rating || 0))
  return (
    <li className="border border-border p-6 md:p-8 bg-background">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-0.5" aria-label={`${rating} of 5 stars`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`h-4 w-4 ${n <= rating ? 'fill-current' : ''}`}
              style={{ color: n <= rating ? '#2D4A2A' : 'rgba(0,0,0,0.18)' }}
            />
          ))}
        </div>
        {review.is_verified_purchase ? (
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground border border-border px-2 py-0.5">
            Verified purchase
          </span>
        ) : null}
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground ml-auto">
          {formatRelativeDate(review.created_at)}
        </span>
      </div>
      {review.comment ? (
        <p className="mt-4 text-sm md:text-base leading-relaxed text-foreground whitespace-pre-wrap">
          {review.comment}
        </p>
      ) : null}
      <div className="mt-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        {review.reviewer_name || 'Anonymous'}
        {review.drop_title ? <> · <span className="normal-case tracking-normal italic">{review.drop_title}</span></> : null}
      </div>
    </li>
  )
}

// "2 weeks ago" style relative-date helper. Keeps the dependency-free
// approach the rest of this file uses.
function formatRelativeDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.max(0, (now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  if (diff < 86400 * 7) {
    const days = Math.floor(diff / 86400)
    return `${days} ${days === 1 ? 'day' : 'days'} ago`
  }
  if (diff < 86400 * 30) {
    const weeks = Math.floor(diff / (86400 * 7))
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
  }
  if (diff < 86400 * 365) {
    const months = Math.floor(diff / (86400 * 30))
    return `${months} ${months === 1 ? 'month' : 'months'} ago`
  }
  const years = Math.floor(diff / (86400 * 365))
  return `${years} ${years === 1 ? 'year' : 'years'} ago`
}

