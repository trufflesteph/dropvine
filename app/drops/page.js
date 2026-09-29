'use client'
//
// /drops — Fresh Drops: one card per open or upcoming drop.
//
// Renamed from /creators in June 2026 (next.config.js issues a permanent
// 301 from /creators → /drops).
//
// Lists DROPS, not vendors:
//   • Live fetch from GET /api/direct/vendors, which returns every open and
//     upcoming drop from an active vendor (plus demo drops), already sorted:
//     open drops closing soonest first, open drops with no close time
//     (newest launch first), then upcoming drops launching soonest first.
//   • Each card links straight to the drop page (/l/{handle}) and shows the
//     cover (vendor photo, then letter placeholder as fallbacks), title,
//     vendor name, category, and a "Live now" or "Upcoming · countdown" badge.
//   • Debounced search across drop title and vendor business name.
//   • Horizontally scrollable category pills (vendor's category).
//   • "Open now" toggle hides upcoming drops (URL param stays ?active=1).
//   • All filter state is mirrored into the URL (?q=...&category=...&active=1)
//     so directory views are shareable + back-button friendly.
//   • Empty state when no drop matches.
//
// All filtering is client-side after the initial fetch.

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Nav } from '@/components/dropvine/nav'
import { Footer } from '@/components/dropvine/footer'
import { ArrowRight, Search, X, MapPin, Loader2 } from 'lucide-react'
import { VENDOR_CATEGORIES, ALL_PILL } from '@/lib/vendors/categories'

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

export default function DropsDirectoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <Nav />
        <main className="container py-32 flex items-center justify-center text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
        </main>
      </div>
    }>
      <DropsDirectoryInner />
    </Suspense>
  )
}

function DropsDirectoryInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // -- URL-backed state --
  const initialQ = searchParams.get('q') || ''
  const initialCategory = searchParams.get('category') || ALL_PILL
  const initialActive = searchParams.get('active') === '1'

  const [drops, setDrops] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [rawQuery, setRawQuery] = useState(initialQ)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ)
  const [activeCategory, setActiveCategory] = useState(initialCategory)
  const [activeOnly, setActiveOnly] = useState(initialActive)

  // Debounce the search input by 300ms.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery), 300)
    return () => clearTimeout(t)
  }, [rawQuery])

  // Push filter state to the URL. Replace (not push) so back button still
  // exits the page instead of stepping through filter history.
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    const params = new URLSearchParams()
    if (debouncedQuery) params.set('q', debouncedQuery)
    if (activeCategory && activeCategory !== ALL_PILL) params.set('category', activeCategory)
    if (activeOnly) params.set('active', '1')
    const qs = params.toString()
    router.replace(qs ? `/drops?${qs}` : '/drops', { scroll: false })
  }, [debouncedQuery, activeCategory, activeOnly, router])

  // Initial drops fetch.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/direct/vendors')
        const d = await r.json()
        if (cancelled) return
        if (!r.ok) { setError(d?.error || 'Could not load drops.'); setLoading(false); return }
        setDrops(d.drops || [])
        setLoading(false)
      } catch (e) {
        if (!cancelled) { setError(e?.message || 'Network error.'); setLoading(false) }
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Apply filters in-memory.
  const filtered = useMemo(() => {
    let list = drops
    if (activeCategory && activeCategory !== ALL_PILL) {
      list = list.filter((d) => (d.category || '') === activeCategory)
    }
    if (activeOnly) {
      list = list.filter((d) => d.is_open)
    }
    const q = debouncedQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((d) => {
        const hay = `${d.title || ''} ${d.business_name || ''}`.toLowerCase()
        return hay.includes(q)
      })
    }
    return list
  }, [drops, debouncedQuery, activeCategory, activeOnly])

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      {/* Page header — /drops (renamed from /creators June 2026) */}
      <section className="container pt-32 md:pt-40 pb-10 md:pb-14">
        <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">Fresh Drops</div>
        <h1 className="font-serif font-light text-5xl md:text-7xl leading-[0.96] tracking-tightest text-balance">
          Browse Fresh Drops
        </h1>
        <p className="mt-8 text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
          A growing list of independent makers, farms, and studios running their drops on Dropvine. Filter by category, search by name, or jump straight to a drop.
        </p>
      </section>

      {/* Filter bar */}
      <section className="container pb-6 md:pb-8">
        <div className="border-y border-border py-4 md:py-6 space-y-4">
          {/* Search + active-toggle row */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={rawQuery}
                onChange={(e) => setRawQuery(e.target.value)}
                placeholder="Search drops or makers..."
                className="w-full pl-10 pr-10 py-2.5 bg-background border border-border focus:border-foreground focus:outline-none text-sm transition-colors"
                aria-label="Search drops or makers"
              />
              {rawQuery ? (
                <button
                  type="button"
                  onClick={() => setRawQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <label className="inline-flex items-center gap-2.5 text-sm text-muted-foreground cursor-pointer select-none">
              <span className="relative inline-block w-9 h-5 align-middle">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  className="peer absolute opacity-0 w-0 h-0"
                  aria-label="Open now"
                />
                <span className="absolute inset-0 bg-stone-200 peer-checked:bg-foreground transition-colors rounded-full" />
                <span className="absolute left-0.5 top-0.5 h-4 w-4 bg-background border border-border peer-checked:translate-x-4 transition-transform rounded-full" />
              </span>
              <span className={activeOnly ? 'text-foreground' : ''}>Open now</span>
            </label>
          </div>

          {/* Category pills — horizontally scrollable on narrow viewports */}
          <div className="-mx-1 overflow-x-auto">
            <div className="flex items-center gap-2 px-1 pb-1 min-w-max">
              {[ALL_PILL, ...VENDOR_CATEGORIES].map((cat) => {
                const isActive = activeCategory === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={
                      `whitespace-nowrap px-3.5 py-1.5 text-[12px] tracking-wide border transition-colors ${
                        isActive
                          ? 'bg-foreground text-background border-foreground'
                          : 'bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground'
                      }`
                    }
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="container pb-20 md:pb-28">
        {loading ? (
          <div className="py-24 flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading drops…
          </div>
        ) : error ? (
          <div className="border border-dashed border-border p-10 text-center text-muted-foreground">
            <p className="text-sm">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-border p-10 md:p-16 text-center text-muted-foreground">
            <p className="max-w-md mx-auto text-sm">
              No drops match those filters. Try clearing the search or picking a different category.
            </p>
            <button
              type="button"
              onClick={() => { setRawQuery(''); setActiveCategory(ALL_PILL); setActiveOnly(false) }}
              className="mt-6 inline-flex items-center gap-2 border border-foreground px-5 py-2 text-sm hover:bg-foreground hover:text-background transition"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {filtered.map((d) => (
              <DropCard key={d.id} d={d} />
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  )
}

function DropCard({ d }) {
  const cityState = [d.location_city, d.location_state].filter(Boolean).join(', ')
  const image = d.cover_url || d.vendor_photo_url
  return (
    <Link
      href={`/l/${d.handle}`}
      className="group block border border-border bg-background hover:border-foreground transition-colors"
      data-testid={`drop-card-${d.handle}`}
    >
      <div
        className="relative w-full aspect-[4/3] border-b border-border bg-stone-100 overflow-hidden"
        style={image ? { backgroundImage: `url(${image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {image ? <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" /> : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="font-serif text-7xl text-stone-300">{(d.business_name || d.title || '?').charAt(0).toUpperCase()}</div>
          </div>
        )}
        {d.is_demo ? (
          <span className="absolute top-3 right-3 text-[9px] uppercase tracking-[0.18em] px-2 py-1 bg-white/80 text-foreground border border-white/40">
            Demo
          </span>
        ) : null}
        {d.is_open ? (
          <span className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.2em] px-2 py-1 bg-foreground text-background inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live now
          </span>
        ) : d.is_upcoming ? (
          <span className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.2em] px-2 py-1 bg-foreground text-background inline-flex items-center gap-1.5 tabular-nums">
            Upcoming · {fmtCountdown(Date.parse(d.launch_at)) ?? 'soon'}
          </span>
        ) : null}
      </div>
      <div className="p-6 md:p-8">
        <div className="flex items-center gap-2 flex-wrap">
          {d.category ? <CategoryPill label={d.category} /> : null}
          {cityState ? (
            <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {cityState}
            </span>
          ) : null}
        </div>
        <div className="mt-3 font-serif text-2xl md:text-3xl tracking-tighter group-hover:underline underline-offset-4 decoration-1">
          {d.title}
        </div>
        {d.business_name ? (
          <p className="mt-2 text-sm text-muted-foreground">by {d.business_name}</p>
        ) : null}
        <div className="mt-6 flex items-center justify-end text-sm">
          <span className="inline-flex items-center gap-1 text-foreground/80 group-hover:text-foreground">
            View drop <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}

// Tiny pill used inside drop cards + reused on /direct/[slug] + /l/[handle].
function CategoryPill({ label }) {
  return (
    <span className="text-[10px] uppercase tracking-[0.22em] px-2 py-1 bg-stone-100 text-foreground border border-border">
      {label}
    </span>
  )
}
