'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Nav } from '@/components/dropvine/nav'
import { Footer } from '@/components/dropvine/footer'
import { ArrowRight, ExternalLink, Instagram, Globe, Loader2 } from 'lucide-react'

// Public vendor profile page — /direct/[slug]
//
// Renders a vendor's bio + photo + social links + a grid of their published
// drops (upcoming first, then past). 404s gracefully if the slug doesn't
// match an active vendor.
//
// Data source: GET /api/direct/[slug] (server endpoint backed by direct_vendors
// + launches via the service-role client).

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
