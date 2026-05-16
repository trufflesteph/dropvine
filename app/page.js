'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Nav } from '@/components/dropvine/nav'
import { Footer } from '@/components/dropvine/footer'
import { Countdown } from '@/components/dropvine/countdown'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase/client'

const PRICING_HEADLINE_FALLBACK = "Start free. Grow when you're ready."
const PRICING_SUBTEXT_FALLBACK = 'No credit card. No lock-in. Every tier includes all four collection modes — waitlist, pre-order, reservation, and deposit.'

// Centralised defaults for every editable copy field on the marketing site.
// The homepage seeds state with these, then overlays any non-empty values
// from `site_config`. If a key is absent from the DB the documented default
// here is what renders. Keep this list in sync with the SECTIONS map in
// app/admin/direct/settings/page.js.
const DEFAULTS = {
  // Hero — fully DB-driven. The headline is split across two lines so the
  // second line can render in italic (matches the original visual). Set
  // `hero_headline_line2` to empty string to suppress the italic line entirely.
  hero_headline_line1:       'Your next drop',
  hero_headline_line2:       '',
  hero_subtext:              'Build a timed page, collect waitlists, pre-orders, reservations, or deposits — then open the doors at exactly the right second.',
  hero_microcopy:            'Used for drops, workshops, and limited releases.',
  hero_primary_cta:          'Build your drop page',
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
  how_it_works_step2_title:  '02 — Your page goes live instantly',
  how_it_works_step2_body:   'Dropvine builds your page automatically. Your customer list gets an SMS and email with the link — no extra steps on your end.',
  how_it_works_step3_title:  '03 — Orders come in, you stay organized',
  how_it_works_step3_body:   'Every order is logged in your dashboard. Customers pay you directly via Venmo. You mark orders paid and fulfilled as they come in — all in one place.',

  // Use cases
  use_cases_headline:        'Built for businesses that make things on a schedule.',
  use_case_1_emoji:          '🥐',
  use_case_1_title:          'Weekly bakery menus',
  use_case_1_body:           'Upload your menu and photos, set a pre-order cutoff, and send your list a link. Customers pre-order, you know exactly what to bake. No guessing, no waste.',
  use_case_2_emoji:          '🌿',
  use_case_2_title:          'Farmers market vendors',
  use_case_2_body:           'Post your weekly harvest or product list before market day. Collect pre-orders so your best stuff is spoken for before you load the van.',
  use_case_3_emoji:          '🎨',
  use_case_3_title:          'Limited-run makers',
  use_case_3_body:           'Releasing something in small quantities? Set a pre-order window, cap the orders, and open it to your list. First come, first served — automatically.',

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
  mode_1_name:               'Waitlist',
  mode_1_body:               'Get people in line before you open. No payment, no friction — just names and excitement piling up.',
  mode_2_name:               'Pre-order',
  mode_2_body:               'Customers commit and pay through Venmo before you make it. You know exactly what to produce.',
  mode_3_name:               'Reservation',
  mode_3_body:               'Lock in the spot, collect payment later. Great for workshops, sessions, and events.',
  mode_4_name:               'Deposit',
  mode_4_body:               'A small payment now, the rest at pickup. Lower the barrier to commit while keeping it serious.',

  // Bottom CTA
  bottom_cta_headline:       'Ready to stop managing orders through DMs?',
  bottom_cta_subtext:        'Set your products and pricing, pick a deadline, and let Dropvine handle the rest.',
  bottom_cta_button:         'Try it free',
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
    { slug: 'free',   prefix: 'free_tier_',   defaultName: 'Free'   },
    { slug: 'maker',  prefix: 'maker_tier_',  defaultName: 'Maker'  },
    { slug: 'studio', prefix: 'studio_tier_', defaultName: 'Studio' },
  ]
  return tiers.map(({ slug, prefix, defaultName }) => {
    const rawPrice = formatPrice({
      label: cfg[`${prefix}price_label`],
      cents: cfg[`${prefix}price_cents`],
    })
    // Append `/month` to paid tiers only when the price label isn't already
    // a sentence like "Always free" or doesn't already contain a slash/period.
    const isPaidNumeric = slug !== 'free' && /^\$[\d.,]+$/.test(rawPrice)
    const price = isPaidNumeric ? `${rawPrice}/month` : rawPrice
    return {
      slug,
      name: cfg[`${prefix}name`]?.trim() || defaultName,
      price,
      features: parseFeatures(cfg[`${prefix}features`]),
      // strip operator-pasted trailing arrows so we don't render two arrows.
      cta: stripTrailingArrow(cfg[`${prefix}cta`]) || 'Get started',
      href: slug === 'free' ? '/signup' : `/signup?plan=${slug}`,
      featured: isTruthyFlag(cfg[`${prefix}popular`]),
    }
  })
}


const TICKER_ITEMS = [
  'Ceramic workshops', 'Tattoo flash drops', 'Limited print releases',
  'Photography sessions', 'Vintage clothing drops', 'Writing cohorts',
  'Design masterclasses', 'Music listening sessions', 'Floral workshops', 'Small-batch product launches',
]

export default function LandingPage() {
  const target = useMemo(() => new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(), [])
  const [mounted, setMounted] = useState(false)
  // Single source of truth for every editable string on the marketing site.
  // Seeded from DEFAULTS so the page always renders sensible copy even if
  // the DB fetch fails or is mid-flight. Non-empty DB values overwrite the
  // defaults on mount. Pricing-tier numbers / feature lists live in the same
  // state object but are read via buildPlans() which has its own formatting.
  const [config, setConfig] = useState(() => ({ ...DEFAULTS }))
  useEffect(() => setMounted(true), [])

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
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
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
              {/* Hidden entirely when value is empty / whitespace. */}
              {config.hero_microcopy && String(config.hero_microcopy).trim() ? (
                <p className="mt-3 font-serif italic text-foreground/60 text-base animate-fade-up" style={{ animationDelay: '160ms' }}>
                  {config.hero_microcopy}
                </p>
              ) : null}
              <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center gap-5 animate-fade-up" style={{ animationDelay: '220ms' }}>
                <Link href={config.hero_primary_cta_href || '/signup'} className="group inline-flex items-center gap-3 bg-foreground text-background px-7 py-4 text-sm hover:opacity-90 transition">
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

            {/* Demo drop cards */}
            <div className="flex flex-col gap-3">
              {/* Clay Collective — featured live card */}
              <div className="relative overflow-hidden p-8 text-white" style={{ background: '#7d726a' }}>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-white/40 mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Live right now
                </div>
                <div className="font-serif text-2xl font-light tracking-tight mb-1">The Clay Collective</div>
                <div className="text-sm text-white/50 mb-6">Workshop — 8 seats remaining</div>
                {mounted && (
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {[['02','hrs'],['47','min'],['33','sec'],['8','seats']].map(([n, l]) => (
                      <div key={l} className="text-center">
                        <div className="font-serif text-3xl font-light tracking-tighter">{n}</div>
                        <div className="text-[9px] uppercase tracking-[0.12em] text-white/30 mt-1">{l}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs text-white/40">
                  <span>246 on waitlist</span>
                  <span className="border border-white/20 px-3 py-1 text-white/60 font-mono tracking-wide text-[10px]">RESERVE SPOT</span>
                </div>
              </div>

              {/* Flash Tattoo Drop */}
              <div className="flex items-center justify-between px-5 py-4 text-white" style={{ background: '#2a2420' }}>
                <div>
                  <div className="text-sm font-medium text-white/90">Flash Tattoo Drop — June</div>
                  <div className="text-[11px] text-white/40 uppercase tracking-wider mt-0.5">Flash Drop</div>
                </div>
                <span className="text-[10px] font-mono tracking-wide px-2.5 py-1 bg-yellow-900/40 text-yellow-300">Opens in 3d</span>
              </div>

              {/* Batch 004 */}
              <div className="flex items-center justify-between px-5 py-4 text-white" style={{ background: '#8b2218' }}>
                <div>
                  <div className="text-sm font-medium text-white/90">Batch 004</div>
                  <div className="text-[11px] text-white/40 uppercase tracking-wider mt-0.5">Small-batch</div>
                </div>
                <span className="text-[10px] font-mono tracking-wide px-2.5 py-1 bg-green-900/40 text-green-300">Live now</span>
              </div>
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
      <div className="border-b border-border bg-foreground text-background overflow-hidden py-4">
        <div className="flex gap-12 animate-ticker whitespace-nowrap">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="font-serif italic text-sm opacity-60 shrink-0">
              {item}
              <span className="ml-12 inline-block w-1 h-1 rounded-full bg-current opacity-40 align-middle" />
            </span>
          ))}
        </div>
      </div>

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

      {/* EXAMPLE */}
      <section id="example" className="border-t border-border bg-stone-100/60">
        <div className="container py-24 md:py-40">
          <div className="grid md:grid-cols-12 gap-12">
            <div className="md:col-span-5">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">An example</div>
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
              <div className="aspect-[4/5] md:aspect-[5/6] bg-gradient-to-b from-stone-200 to-stone-300 relative overflow-hidden">
                <div className="absolute inset-0 grain opacity-60" />
                <div className="absolute inset-0 flex items-end p-8 md:p-12">
                  <div className="text-stone-900">
                    <div className="text-[11px] uppercase tracking-[0.25em] mb-3">Opens in</div>
                    {mounted && <Countdown target={target} size="md" />}
                  </div>
                </div>
              </div>
            </div>
          </div>
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
              className={`relative border p-8 md:p-10 transition-colors flex flex-col min-w-0 ${p.featured ? 'bg-foreground text-background border-foreground' : 'bg-background border-border hover:border-foreground'}`}
            >
              {p.featured ? (
                <div className="absolute -top-3 left-8 inline-flex items-center px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] bg-background text-foreground border border-foreground">
                  Most popular
                </div>
              ) : null}
              <div className={`text-[10px] uppercase tracking-[0.2em] mb-6 ${p.featured ? 'text-background/50' : 'text-muted-foreground'}`}>{p.name}</div>
              <div className={`font-serif text-xl tracking-tight ${p.featured ? 'text-background' : ''}`}>{p.name}</div>
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
      <section className="border-t border-border bg-foreground text-background">
        <div className="container py-24 md:py-40 text-center">
          <div className="text-[11px] uppercase tracking-[0.25em] text-background/40 mb-8">Ready when you are</div>
          <h2 className="font-serif font-light text-4xl md:text-7xl leading-[1.02] tracking-tightest max-w-3xl mx-auto text-balance">
            {config.bottom_cta_headline}
          </h2>
          <p className="mt-6 text-background/50 max-w-sm mx-auto text-sm leading-relaxed">
            {config.bottom_cta_subtext}
          </p>
          <Link href="/signup" className="mt-12 inline-flex items-center gap-3 bg-background text-foreground px-8 py-4 text-sm hover:opacity-90">
            {stripTrailingArrow(config.bottom_cta_button) || 'Try it free'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  )
}
