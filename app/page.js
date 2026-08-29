'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { Nav } from '@/components/dropvine/nav'
import { Footer } from '@/components/dropvine/footer'
import { Countdown } from '@/components/dropvine/countdown'
import { ArrowRight, ArrowUpRight, MapPin } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase/client'

const PRICING_HEADLINE_FALLBACK = 'No transaction fees, EVER.'
const PRICING_SUBTEXT_FALLBACK = 'Your sales are yours. Dropvine will never charge you a transaction fee.'

// Centralised defaults for every editable copy field on the marketing site.
// The homepage seeds state with these, then overlays any non-empty values
// from `site_config`. If a key is absent from the DB the documented default
// here is what renders. Keep this list in sync with the SECTIONS map in
// app/admin/direct/settings/page.js.
const DEFAULTS = {
  // Hero — fully DB-driven. The headline is split across two lines so the
  // second line can render in italic (matches the original visual). Set
  // `hero_headline_line2` to empty string to suppress the italic line entirely.
  hero_headline_line1:       'Sell more. Text less.',
  hero_headline_line2:       '',
  hero_subtext:              "Stop taking orders through DMs. Dropvine does the work for you.",
  hero_primary_cta:          'Start 30-day free trial',
  hero_primary_cta_href:     '/signup',
  hero_secondary_cta:        'See it in action',
  hero_secondary_cta_href:   '#example',

  // Pricing
  pricing_headline: PRICING_HEADLINE_FALLBACK,
  pricing_subtext: PRICING_SUBTEXT_FALLBACK,

  // How it works
  how_it_works_headline:     'How it works',
  how_it_works_step1_title:  '01 — Fill out one form',
  how_it_works_step1_body:   'Set your products and pricing, pick a deadline. Takes five minutes.',
  how_it_works_step2_title:  '02 — Your page goes live',
  how_it_works_step2_body:   'Dropvine does the work for you — building your sales page, creating the marketing messages and notifying your contact list.',
  how_it_works_step3_title:  '03 — Your sales are yours',
  how_it_works_step3_body:   'No transaction fees, EVER.',

  // Use cases
  use_cases_headline:        'Dropvine sells for you.',
  use_case_1_emoji:          '',
  use_case_1_title:          'Weekly bakery menus',
  use_case_1_body:           'Upload your menu and photos, set a pre-order cutoff, and send your list a link. Customers pre-order, you know exactly what to bake. No guessing, no waste.',
  use_case_2_emoji:          '',
  use_case_2_title:          'Farmers market vendors',
  use_case_2_body:           'Post your weekly harvest or product list before market day. Collect pre-orders so your best stuff is spoken for before you load the van.',
  use_case_3_emoji:          '',
  use_case_3_title:          'Specialty Classes and Workshops',
  use_case_3_body:           'Fill your class twice as fast with the Dropvine anticipation engine working for you.',

  // Example
  example_business_name:     'Good Flour Bakery',
  example_tagline:           'Saturday Pre-Order Window',
  example_description:       'Sourdough, pastries, and seasonal specials. Orders close Thursday at 8pm. Pickup Saturday 9am–noon.',
  example_stat_1_value:      '47',
  example_stat_1_label:      'orders placed',
  example_stat_2_value:      '$0',
  example_stat_2_label:      'wasted',
  example_stat_3_value:      '3 min',
  example_stat_3_label:      'to set up',
  example_stat_4_value:      '0',
  example_stat_4_label:      'DMs to manage',

  // Collection modes
  modes_headline:            'Pick how your customers commit.',
  modes_subtext:             'Not every business runs the same way. Dropvine has four collection modes — use the one that fits your workflow.',
  mode_1_name:               'Pre-order',
  mode_1_body:               'Customers commit and pay through Venmo before you make it. You know exactly what to produce.',
  mode_2_name:               'Deposit',
  mode_2_body:               'A small payment now, the rest at pickup. Lower the barrier to commit while keeping it serious.',
  mode_3_name:               'Waitlist',
  mode_3_body:               'Get people in line before you open. No payment, no friction — just names and excitement piling up.',
  mode_4_name:               'Reservation',
  mode_4_body:               'Lock in the spot, collect payment later. Great for workshops, sessions, and events.',

  // Bottom CTA
  bottom_cta_headline:       'Ready to stop managing orders through DMs?',
  bottom_cta_subtext:        'Set your products and pricing, pick a deadline, and let Dropvine handle the rest.',
  bottom_cta_button:         'Start 30-day free trial',
}

// All keys we read from `site_config`. Pricing tier keys are listed inline
// because they are formatted (cents → "$N", features split, popular flag)
// rather than rendered directly, so they are not in DEFAULTS.
const SITE_CONFIG_KEYS = [
  ...Object.keys(DEFAULTS),
  'free_tier_name',   'free_tier_price_label',   'free_tier_price_cents',   'free_tier_features',   'free_tier_cta',   'free_tier_popular',
  'maker_tier_name',  'maker_tier_price_label',  'maker_tier_price_cents',  'maker_tier_features',  'maker_tier_cta',  'maker_tier_popular',
  'studio_tier_name', 'studio_tier_price_label', 'studio_tier_price_cents', 'studio_tier_features', 'studio_tier_cta', 'studio_tier_popular',
]

function parseFeatures(raw) {
  if (!raw) return []
  // Accept both real newlines and literal "\n" seed artifacts.
  return String(raw).split(/\\n|\r?\n/).map((s) => s.trim()).filter(Boolean)
}

// Strip a trailing arrow (→ and variants) from CTA copy. Some operators paste
// the arrow into site_config; the button JSX already renders an <ArrowRight />,
// so we'd otherwise show two arrows. This collapses to one.
function stripTrailingArrow(s) {
  if (!s) return s
  return String(s).replace(/\s*[→➜➝➞➟➠]+\s*$/u, '').trim()
}

function formatPrice({ label, cents }) {
  if (label && String(label).trim()) return String(label).trim()
  if (cents != null && String(cents).trim() !== '') {
    const n = parseInt(String(cents), 10)
    if (!Number.isNaN(n)) {
      const dollars = n / 100
      return `$${dollars % 1 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)}`
    }
  }
  return '—'
}

function isTruthyFlag(v) {
  if (v == null) return false
  const s = String(v).trim().toLowerCase()
  return s === 'true' || s === '1' || s === 'yes' || s === 'on'
}

function buildPlans(cfg) {
  // Three tier slots in display order. Names come from site_config; if a key is
  // missing we fall back to a neutral capitalised label.
  const tiers = [
    { slug: 'free',   prefix: 'free_tier_',   defaultName: '30-day free trial' },
    { slug: 'maker',  prefix: 'maker_tier_',  defaultName: 'Maker'  },
    { slug: 'studio', prefix: 'studio_tier_', defaultName: 'Shop' },
  ]
  return tiers.map(({ slug, prefix, defaultName }) => {
    const rawPrice = formatPrice({
      label: cfg[`${prefix}price_label`],
      cents: cfg[`${prefix}price_cents`],
    })
    // Append `/month` to paid tiers only when the price label isn't already
    // a sentence like "30-day free trial" or doesn't already contain a slash/period.
    const isPaidNumeric = slug !== 'free' && /^\$[\d.,]+$/.test(rawPrice)
    const price = isPaidNumeric ? `${rawPrice}/month` : rawPrice
    // Map the marketing-page slug ('free' | 'maker' | 'studio') to the
    // signup ?tier= param. 'studio' (the Shop tier marketing label) is
    // emitted as `tier=shop` so the signup redirect logic can treat
    // 'shop' as the canonical tier code everywhere downstream
    // (direct_vendors.tier_intent + tier columns).
    const tierParam = slug === 'free' ? null : (slug === 'studio' ? 'shop' : slug)
    const baseName = cfg[`${prefix}name`]?.trim() || defaultName
    const name = slug === 'free' ? 'Free' : baseName
    const subtitle = slug === 'free'
      ? (baseName && baseName !== 'Free' ? baseName : '30-day free trial')
      : null
    return {
      slug,
      name,
      subtitle,
      price,
      features: parseFeatures(cfg[`${prefix}features`]),
      // strip operator-pasted trailing arrows so we don't render two arrows.
      cta: stripTrailingArrow(cfg[`${prefix}cta`]) || 'Get started',
      href: tierParam ? `/signup?tier=${tierParam}` : '/signup',
      featured: isTruthyFlag(cfg[`${prefix}popular`]),
    }
  })
}


const TICKER_ITEMS = [
  'Bakery drops', 'Ceramic workshops', 'Brand swag releases',
  'Photography sessions', 'Vintage clothing drops', 'Writing cohorts',
  'Design masterclasses', 'Music listening sessions', 'Floral workshops', 'Small-batch product launches',
]

// Short countdown string, e.g. "2h 47m", "3d 4h", "47m". Returns null once
// the target has passed.
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

// Status pill shown on every featured-drop card image — derived from the
// drop's actual launch_at/closes_at/collection_mode, never hardcoded.
function getDropStatus(drop) {
  const now = Date.now()
  const launchMs = drop.launch_at ? Date.parse(drop.launch_at) : 0
  const upcoming = launchMs && launchMs > now
  if (upcoming) {
    const cd = fmtCountdown(launchMs)
    return { label: cd ? `Opens in ${cd}` : 'Opens soon', dotColor: 'bg-amber-400', pulse: false }
  }
  const mode = drop.collection_mode
  if (mode === 'reservation') return { label: 'Reserve now', dotColor: 'bg-blue-400', pulse: true }
  if (mode === 'waitlist') return { label: 'Join waitlist', dotColor: 'bg-amber-400', pulse: true }
  return { label: 'Live drop', dotColor: 'bg-green-400', pulse: true }
}

// Bottom-left detail line on the large featured card, e.g. "2h 47m left" or
// "Opens in 3d". Returns null when there's nothing time-bound to show.
function getDetailText(drop) {
  const now = Date.now()
  const launchMs = drop.launch_at ? Date.parse(drop.launch_at) : 0
  const closesMs = drop.closes_at ? Date.parse(drop.closes_at) : 0
  const upcoming = launchMs && launchMs > now
  if (upcoming) {
    const cd = fmtCountdown(launchMs)
    return cd ? `Opens in ${cd}` : null
  }
  if (closesMs && closesMs > now) {
    const cd = fmtCountdown(closesMs)
    return cd ? `${cd} left` : null
  }
  return null
}

export default function LandingPage() {
  const target = useMemo(() => new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(), [])
  const [mounted, setMounted] = useState(false)
  // Single source of truth for every editable string on the marketing site.
  // Seeded from DEFAULTS so the page always renders sensible copy even if
  // the DB fetch fails or is mid-flight. Non-empty DB values overwrite the
  // defaults on mount. Pricing-tier numbers / feature lists live in the same
  // state object but are read via buildPlans() which has its own formatting.
  const [config, setConfig] = useState(() => ({ ...DEFAULTS }))
  const [featuredDrops, setFeaturedDrops] = useState([])
  useEffect(() => setMounted(true), [])

  // Manually curated homepage drop cards — drops.is_featured_homepage = true,
  // ordered by drops.featured_order. No auto-fill: whatever's marked is what
  // shows, even if that's fewer than 3.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/direct/featured-drops')
        const d = await r.json()
        if (!cancelled && r.ok) setFeaturedDrops(d.drops || [])
      } catch { /* leave featuredDrops empty */ }
    })()
    return () => { cancelled = true }
  }, [])

  // Fetch every editable key from site_config in one go (anon read).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sb = getSupabaseBrowser()
        if (!sb) return
        const { data, error } = await sb
          .from('site_config')
          .select('key, value')
          .in('key', SITE_CONFIG_KEYS)
        if (error || !data || cancelled) return
        const map = {}
        for (const row of data) map[row.key] = row.value
        setConfig((prev) => {
          const next = { ...prev }
          for (const k of SITE_CONFIG_KEYS) {
            if (!(k in map)) continue
            // For documented-default keys, only overwrite when DB value is
            // non-empty (preserves the curated fallback otherwise). For
            // pricing-tier keys, store whatever the DB says verbatim so
            // buildPlans() can decide how to format / fall back.
            if (k in DEFAULTS) {
              if (map[k] != null && String(map[k]).trim() !== '') next[k] = map[k]
            } else {
              next[k] = map[k]
            }
          }
          return next
        })
      } catch { /* fall back silently to DEFAULTS */ }
    })()
    return () => { cancelled = true }
  }, [])

  const plans = useMemo(() => buildPlans(config), [config])

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      {/* HERO */}
      <section className="relative pt-36 md:pt-44 pb-24 md:pb-40 overflow-hidden">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-16 md:items-center">
            <div className="flex flex-col justify-center h-full">
              <h1 className="font-serif font-light text-[44px] sm:text-6xl md:text-7xl leading-[0.96] tracking-tightest text-balance animate-fade-up">
                {config.hero_headline_line1}
                {/* Empty string OR whitespace-only OR missing → skip the
                    second line entirely (no <br>, no italic span). */}
                {config.hero_headline_line2 && String(config.hero_headline_line2).trim() ? (
                  <>
                    <br />
                    <span className="italic font-extralight">{config.hero_headline_line2}</span>
                  </>
                ) : null}
              </h1>
              <p className="mt-10 max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed text-pretty animate-fade-up" style={{ animationDelay: '120ms' }}>
                {config.hero_subtext}
              </p>
              <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center gap-5 animate-fade-up" style={{ animationDelay: '220ms' }}>
              <Link href={config.hero_primary_cta_href || '/signup'} className="group inline-flex items-center gap-3 bg-olive text-background px-7 py-4 text-sm hover:opacity-90 transition">
                  {stripTrailingArrow(config.hero_primary_cta) || 'Get started'}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                {config.hero_secondary_cta && String(config.hero_secondary_cta).trim() ? (
                  <Link href={config.hero_secondary_cta_href || '#example'} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
                    {stripTrailingArrow(config.hero_secondary_cta)} <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>
            </div>

            {/* Featured drop cards — manually curated via
                drops.is_featured_homepage + drops.featured_order (set
                directly in Supabase). No auto-fill: whatever's marked is
                what renders, large card first. */}
            <div className="flex flex-col gap-3">
              {featuredDrops[0] ? <FeaturedDropCard drop={featuredDrops[0]} size="large" mounted={mounted} /> : null}
              {featuredDrops.slice(1, 3).map((d) => (
                <FeaturedDropCard key={d.id} drop={d} size="small" mounted={mounted} />
              ))}
            </div>
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border" />
      </section>

      {/* COUNTDOWN STRIP */}
      <section className="border-y border-border bg-secondary/40">
        <div className="container py-14 md:py-20">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-10">
            <div>
              <h2 className="font-serif font-light text-3xl md:text-5xl leading-[0.96] tracking-tightest">
                The next drop opens in
              </h2>
            </div>
            {mounted ? <Countdown target={target} size="lg" /> : <div className="h-24" />}
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div className="border-b border-border bg-olive text-background overflow-hidden py-4">
        <div className="flex gap-12 animate-ticker whitespace-nowrap">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="font-serif italic text-sm text-white opacity-80 shrink-0">
              {item}
              <span className="ml-12 inline-block w-1 h-1 rounded-full bg-current opacity-40 align-middle" />
            </span>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section id="how" className="container py-24 md:py-40">
        <div className="grid md:grid-cols-12 gap-12 md:gap-16">
          <div className="md:col-span-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">The method</div>
            <h2 className="font-serif font-light text-4xl md:text-5xl leading-[0.96] tracking-tightest text-balance">
              {config.how_it_works_headline}
            </h2>
          </div>
          <div className="md:col-span-8 grid sm:grid-cols-3 gap-10 md:gap-14">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="font-serif text-xl md:text-2xl mb-3 tracking-tight">{config[`how_it_works_step${i}_title`]}</div>
                <p className="text-muted-foreground leading-relaxed text-[15px]">{config[`how_it_works_step${i}_body`]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section id="use-cases" className="border-t border-border bg-secondary/40">
        <div className="container py-24 md:py-40">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">Use cases</div>
          <h2 className="font-serif font-light text-4xl md:text-5xl leading-[0.96] tracking-tightest text-balance mb-16 max-w-3xl">
            {config.use_cases_headline}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border bg-background p-8 md:p-10 flex flex-col">
                <div className="text-4xl mb-6 leading-none">{config[`use_case_${i}_emoji`]}</div>
                <div className="font-serif text-2xl tracking-tight mb-3">{config[`use_case_${i}_title`]}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{config[`use_case_${i}_body`]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

     {/* EXAMPLE */}
<section id="example" className="border-t border-border bg-stone-100/60">
  <div className="container py-24 md:py-40">
    <div className="grid md:grid-cols-12 gap-12">
      <div className="md:col-span-5">
        <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">A Case Study</div>
        <h2 className="font-serif font-light text-4xl md:text-5xl leading-[0.96] tracking-tightest">
          {config.example_business_name}
          <br /><span className="italic">{config.example_tagline}</span>
        </h2>
        <p className="mt-6 text-muted-foreground leading-relaxed max-w-md">
          {config.example_description}
        </p>
        <div className="mt-12 grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-border p-4">
              <div className="font-serif text-3xl tracking-tighter">{config[`example_stat_${i}_value`]}</div>
              <div className="text-xs text-muted-foreground mt-1">{config[`example_stat_${i}_label`]}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="md:col-span-7">
        <div className="relative overflow-hidden w-full h-[400px] md:aspect-[5/6] md:h-auto">
          <Image
            src="https://xelxywjtkffcnkexribv.supabase.co/storage/v1/object/public/vendor-photos/omni-b39154d1-a70e-4b57-a0b5-4f74266c3b3a.png"
            alt="Good Flour Bakery"
            fill
            className="object-cover"
          />
          {/* Demo / example watermark — top-right, sits above the image but below the gradient overlay's text. */}
          <span className="absolute top-4 right-4 z-10 text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 bg-white/85 text-foreground border border-white/40 font-medium">
            Demo · Example
          </span>
          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
          {/* Vendor quote replaces the live countdown — better story for a case study. */}
          <div className="absolute inset-x-0 bottom-0 px-8 py-10 text-white">
            <div className="text-[11px] uppercase tracking-[0.25em] mb-4 text-white/70">In their words</div>
            <blockquote className="font-serif text-xl md:text-2xl leading-snug tracking-tight text-balance">
              “I used to spend hours answering DMs and texts. Now I just bake.”
            </blockquote>
            <div className="mt-4 text-[11px] uppercase tracking-[0.22em] text-white/70">— Sarah</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

      {/* COLLECTION MODES */}
      <section id="collect" className="container py-24 md:py-40">
        <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">Four ways to collect</div>
        <h2 className="font-serif font-light text-4xl md:text-5xl leading-[0.96] tracking-tightest text-balance mb-4">
          {config.modes_headline}
        </h2>
        <p className="text-muted-foreground leading-relaxed max-w-xl mb-16">
          {config.modes_subtext}
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 border border-border">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`p-8 border-border ${i < 4 ? 'border-r' : ''} ${i % 2 === 0 ? 'bg-secondary/40' : ''}`}>
              <div className="font-serif text-2xl tracking-tight mb-3">{config[`mode_${i}_name`]}</div>
              <p className="text-sm text-muted-foreground leading-relaxed">{config[`mode_${i}_body`]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING — heading stacked above a full-width 3-column grid so the
          Studio card never gets clipped at standard desktop widths.
          (Previously: heading took 4/12 + cards squeezed into 8/12, which
          made each card ~240px and clipped the price + "Most popular" badge
          on Studio at 1024–1280px breakpoints.) */}
      <section id="pricing" className="container py-24 md:py-40">
        <div className="max-w-3xl mb-12 md:mb-16">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">Pricing</div>
          <h2 className="font-serif font-light text-4xl md:text-5xl leading-[0.96] tracking-tightest text-balance">
            {config.pricing_headline}
          </h2>
          <p className="mt-6 text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl">
            {config.pricing_subtext}
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div
              key={p.slug}
              className={`relative border p-8 md:p-10 transition-colors flex flex-col min-w-0 ${p.featured ? 'bg-olive text-background border-olive' : 'bg-background border-border hover:border-foreground'}`}
            >
              {p.featured ? (
                <div className="absolute -top-3 left-8 inline-flex items-center px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] bg-background text-olive border border-olive">
                  Most popular
                </div>
              ) : null}
              <div className={`font-serif text-xl tracking-tight pr-2 ${p.featured ? 'text-background' : ''}`}>{p.name}</div>
              {p.subtitle ? (
                <div className={`mt-2 max-w-[11rem] pr-2 text-[11px] uppercase tracking-[0.18em] ${p.featured ? 'text-background/75' : 'text-foreground/60'} break-words leading-tight`}>
                  {p.subtitle}
                </div>
              ) : null}
              <div className={`font-serif text-4xl lg:text-5xl font-light tracking-tighter mt-6 whitespace-nowrap ${p.featured ? 'text-background' : ''}`}>{p.price}</div>
              <ul className="space-y-3 text-sm flex-1 mt-8">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <span className={`mt-1.5 inline-block h-px w-4 shrink-0 ${p.featured ? 'bg-background/30' : 'bg-foreground/40'}`} />
                    <span className={p.featured ? 'text-background/75' : ''}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href={p.href} className={`mt-10 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm transition ${p.featured ? 'bg-background text-foreground hover:opacity-90' : 'border border-border hover:border-foreground'}`}>
                {p.cta} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-olive text-background">
        <div className="container py-24 md:py-40 text-center">
          <div className="text-[11px] uppercase tracking-[0.25em] text-background/40 mb-8">Ready when you are</div>
          <h2 className="font-serif font-light text-4xl md:text-7xl leading-[1.02] tracking-tightest max-w-3xl mx-auto text-balance">
            {config.bottom_cta_headline}
          </h2>
          <p className="mt-6 text-background/50 max-w-sm mx-auto text-sm leading-relaxed">
            {config.bottom_cta_subtext}
          </p>
          <Link href="/signup" className="mt-12 inline-flex items-center gap-3 bg-background text-foreground px-8 py-4 text-sm hover:opacity-90">
            {stripTrailingArrow(config.bottom_cta_button) || 'Start 30-day free trial'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  )
}

// Featured homepage drop card — compact version of the Fresh Drops card
// pattern (image on top with status/demo badges, content below). Same
// component renders the large featured slot and the two smaller slots
// beneath it; `size` controls image height and which content rows show.
// All copy (category, location, business name, description, status) comes
// from the drop's actual data — this is identical whether the drop is a
// demo or a real vendor's drop.
function FeaturedDropCard({ drop, size, mounted }) {
  const status = getDropStatus(drop)
  const detail = mounted ? getDetailText(drop) : null
  const cityState = [drop.location_city, drop.location_state].filter(Boolean).join(', ')
  const isLarge = size === 'large'

  return (
    <Link
      href={`/l/${drop.handle}`}
      className="group block border border-border bg-background hover:border-foreground transition-colors overflow-hidden"
    >
      <div
        className={`relative w-full bg-stone-800 bg-cover bg-center ${isLarge ? 'h-48' : 'h-24'}`}
        style={drop.image_url ? { backgroundImage: `url(${drop.image_url})` } : undefined}
      >
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] px-2 py-1 bg-black/60 text-white">
          <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor} ${status.pulse ? 'animate-pulse' : ''}`} />
          {status.label}
        </span>
        {drop.is_demo ? (
          <span className="absolute top-3 right-3 text-[9px] uppercase tracking-[0.18em] px-2 py-1 bg-black/60 text-white border border-white/30">
            Demo
          </span>
        ) : null}
      </div>

      {isLarge ? (
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-2 flex-wrap">
            {drop.category ? (
              <span className="text-[10px] uppercase tracking-[0.22em] px-2 py-1 bg-stone-100 text-foreground border border-border">
                {drop.category}
              </span>
            ) : null}
            {cityState ? (
              <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {cityState}
              </span>
            ) : null}
          </div>
          <div className="mt-3 font-serif text-2xl md:text-3xl tracking-tight">{drop.business_name}</div>
          {drop.description ? (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-1">{drop.description}</p>
          ) : null}
          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground tabular-nums">{detail || ''}</span>
            <span className="inline-flex items-center gap-1 text-foreground/80 group-hover:text-foreground">
              View drop <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      ) : (
        <div className="px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{drop.business_name}</div>
            {drop.description ? (
              <div className="text-[12px] text-muted-foreground truncate">{drop.description}</div>
            ) : null}
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 text-sm text-foreground/80 group-hover:text-foreground">
            View drop <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      )}
    </Link>
  )
}
