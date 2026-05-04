'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Nav } from '@/components/dropvine/nav'
import { Footer } from '@/components/dropvine/footer'
import { Countdown } from '@/components/dropvine/countdown'
import { ArrowRight, ArrowUpRight } from 'lucide-react'

const NICHES = [
  { icon: '🏺', name: 'Ceramic workshops',     example: '8 seats, gone in 4 minutes' },
  { icon: '🖋', name: 'Tattoo flash drops',    example: '12 designs, first come first served' },
  { icon: '🖨', name: 'Limited print releases', example: 'Edition of 50, numbered' },
  { icon: '📷', name: 'Photography sessions',   example: 'Spring portrait slots opening' },
  { icon: '👗', name: 'Vintage clothing drops', example: '60-piece haul, Sunday at noon' },
  { icon: '✍️', name: 'Writing cohorts',        example: '12 writers, 6 weeks, 1 opening' },
  { icon: '🎨', name: 'Design masterclasses',   example: 'Live session, limited attendance' },
  { icon: '🎵', name: 'Music listening sessions', example: 'Album premiere, RSVP only' },
  { icon: '🌸', name: 'Floral workshops',       example: 'Seasonal arrangement class' },
  { icon: '📦', name: 'Small-batch products',   example: 'Batch 003 — 40 units only' },
]

const COLLECT_MODES = [
  { tier: 'Free', name: 'Waitlist',    desc: 'Build anticipation before you open. Collect interest with zero friction — no payment required, just an email and intent.', eg: '→ Ceramic workshops, cohorts, flash drops' },
  { tier: 'Paid · via Stripe', name: 'Pre-order',  desc: 'Sell before you ship. Customers pay in full now for something that isn\'t available yet — charged at the moment the drop opens.', eg: '→ Limited prints, small-batch products' },
  { tier: 'Held · via Stripe', name: 'Reservation', desc: 'Hold a spot without charging yet. Stripe authorises the card at sign-up; the charge only goes through when the drop opens.', eg: '→ Fashion drops, vintage, tattoo slots' },
  { tier: 'Partial · via Stripe', name: 'Deposit', desc: 'Secure a spot with a partial payment. Lower the barrier to commit while guaranteeing serious interest — balance due at pickup or delivery.', eg: '→ Workshops, commissions, sessions' },
]

const PLANS = [
  {
    name: 'Studio',
    price: 'Free',
    note: 'For your first drop.',
    period: 'Always, no credit card',
    features: ['1 active drop', 'Waitlist collection', 'Countdown page', 'Dropvine watermark'],
    href: '/signup',
    cta: 'Start for free',
    featured: false,
  },
  {
    name: 'Maker',
    price: '$10',
    note: 'For serious independents.',
    period: 'per month, cancel anytime',
    features: ['3 active drops', 'Pre-orders, reservations & deposits', 'Countdown page', 'No watermark'],
    href: '/signup?plan=maker',
    cta: 'Get Maker',
    featured: false,
  },
  {
    name: 'Atelier',
    price: '$24',
    note: 'For ongoing makers.',
    period: 'per month, cancel anytime',
    features: ['Unlimited drops', 'Pre-orders, reservations & deposits', 'Custom domain', 'No watermark'],
    href: '/signup?plan=atelier',
    cta: 'Get Atelier',
    featured: true,
  },
]

const TICKER_ITEMS = [
  'Ceramic workshops', 'Tattoo flash drops', 'Limited print releases',
  'Photography sessions', 'Vintage clothing drops', 'Writing cohorts',
  'Design masterclasses', 'Music listening sessions', 'Floral workshops',
  'Small-batch product launches',
]

export default function LandingPage() {
  const target = useMemo(() => new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(), [])
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      {/* HERO */}
      <section className="relative pt-36 md:pt-44 pb-24 md:pb-40 overflow-hidden">
        <div className="container">
          <div className="max-w-5xl">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-10 animate-fade-in">
              <span className="h-px w-8 bg-foreground/30" />
              <span>The anticipation engine — Edition 01</span>
            </div>
            <h1 className="font-serif font-light text-[44px] sm:text-6xl md:text-7xl lg:text-[104px] leading-[0.96] tracking-tightest text-balance animate-fade-up">
              Your next drop
              <br className="hidden md:block" />
              <span className="italic font-extralight">deserves a moment.</span>
            </h1>
            <p className="mt-10 max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed text-pretty animate-fade-up" style={{ animationDelay: '120ms' }}>
              Build a timed page, collect waitlists, pre-orders, reservations, or
              deposits — then open the doors at exactly the right second. Whether
              you're dropping ceramics, flash tattoos, or your next writing cohort.
            </p>
            <p className="mt-3 font-serif italic text-foreground/70 animate-fade-up" style={{ animationDelay: '160ms' }}>
              Used for drops, workshops, and limited releases.
            </p>
            <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center gap-5 animate-fade-up" style={{ animationDelay: '220ms' }}>
              <Link href="/signup" className="group inline-flex items-center gap-3 bg-foreground text-background px-7 py-4 text-sm hover:opacity-90 transition">
                Build your drop page
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="#example" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
                See it in action <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
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
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Live demonstration</div>
              <h2 className="font-serif font-light text-3xl md:text-5xl leading-tight tracking-tighter">
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

      {/* FOUR WAYS TO COLLECT */}
      <section id="collect" className="container py-24 md:py-40">
        <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">Four ways to collect</div>
        <h2 className="font-serif font-light text-4xl md:text-5xl leading-tight tracking-tighter text-balance mb-4">
          Choose how your audience commits <span className="italic">before the doors open.</span>
        </h2>
        <p className="text-muted-foreground leading-relaxed max-w-xl mb-16">
          Every drop is different. Dropvine gives you the right collection mode for
          the moment — from a free spot on a list to a paid deposit that holds a place.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 border border-border">
          {COLLECT_MODES.map((m, i) => (
            <div key={m.name} className={`p-8 border-border ${i < 3 ? 'border-r' : ''} ${i % 2 === 1 ? 'bg-secondary/40' : ''}`}>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">{m.tier}</div>
              <div className="font-serif text-2xl tracking-tight mb-3">{m.name}</div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{m.desc}</p>
              <p className="text-[11px] text-muted-foreground/60 font-mono tracking-wide">{m.eg}</p>
            </div>
          ))}
        </div>
      </section>

      {/* USED BY CREATORS */}
      <section id="creators" className="border-t border-border bg-secondary/40">
        <div className="container py-24 md:py-40">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">Used by creators dropping…</div>
          <h2 className="font-serif font-light text-4xl md:text-5xl leading-tight tracking-tighter text-balance mb-4">
            Wherever there's <span className="italic">limited work</span> and a waiting audience.
          </h2>
          <p className="text-muted-foreground leading-relaxed max-w-xl mb-16">
            Dropvine is the anticipation engine for creators who release in moments, not catalogs. One page, one window, one drop.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border border-border">
            {NICHES.map((n, i) => (
              <div key={n.name} className="p-6 border-r border-b border-border hover:bg-background transition-colors">
                <div className="text-2xl mb-4">{n.icon}</div>
                <div className="font-serif text-base tracking-tight mb-1">{n.name}</div>
                <div className="text-[12px] text-muted-foreground italic">{n.example}</div>
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
            <h2 className="font-serif font-light text-4xl md:text-5xl leading-tight tracking-tighter text-balance">
              Three steps. <span className="italic">Nothing more.</span>
            </h2>
            <p className="mt-6 text-muted-foreground text-sm leading-relaxed">
              Set up in an afternoon. Release on your own clock.
            </p>
          </div>
          <div className="md:col-span-8 grid sm:grid-cols-3 gap-10 md:gap-14">
            {[
              { n: '01', t: 'Compose', d: 'Write your story. Upload imagery. Set the exact moment your page opens to the world.' },
              { n: '02', t: 'Gather',  d: 'Collect a free waitlist, take pre-orders, hold reservations, or require a deposit — your audience shows up committed, not just curious.' },
              { n: '03', t: 'Release', d: 'When the timer hits zero, the page opens. Commerce starts. The moment lands.' },
            ].map(s => (
              <div key={s.n}>
                <div className="font-serif italic text-muted-foreground text-sm mb-6">{s.n}</div>
                <div className="font-serif text-2xl mb-3 tracking-tight">{s.t}</div>
                <p className="text-muted-foreground leading-relaxed text-[15px]">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EXAMPLE DROP */}
      <section id="example" className="border-t border-border bg-stone-100/60">
        <div className="container py-24 md:py-40">
          <div className="grid md:grid-cols-12 gap-12">
            <div className="md:col-span-5">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">An example</div>
              <h2 className="font-serif font-light text-4xl md:text-5xl leading-tight tracking-tighter">
                Maison Noir
                <br /><span className="italic">Fall / Winter '26</span>
              </h2>
              <p className="mt-6 text-muted-foreground leading-relaxed max-w-md">
                A 12-piece capsule, limited to 200. Reservations hold a size for 24
                hours after release. Page opens at the moment shown.
              </p>
              <Link href="/l/maison-noir-fw26" className="mt-8 inline-flex items-center gap-2 text-sm border-b border-foreground pb-1 hover:opacity-70">
                View the drop page <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <div className="mt-12 grid grid-cols-2 gap-4">
                {[
                  { n: '847', l: 'people on the waitlist' },
                  { n: '11m', l: 'to sell out the collection' },
                  { n: '200', l: 'units — all reserved' },
                  { n: '0',   l: 'support emails afterward' },
                ].map(s => (
                  <div key={s.l} className="border border-border p-4">
                    <div className="font-serif text-3xl tracking-tighter">{s.n}</div>
                    <div className="text-xs text-muted-foreground mt-1">{s.l}</div>
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

      {/* PRICING */}
      <section id="pricing" className="container py-24 md:py-40">
        <div className="grid md:grid-cols-12 gap-10 md:gap-16">
          <div className="md:col-span-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">Pricing</div>
            <h2 className="font-serif font-light text-4xl md:text-5xl leading-tight tracking-tighter">
              Honest. <span className="italic">Pay when it ships.</span>
            </h2>
            <p className="mt-6 text-sm text-muted-foreground leading-relaxed">
              Start free. Upgrade when you need more. No lock-in.
            </p>
          </div>
          <div className="md:col-span-8 grid sm:grid-cols-3 gap-6">
            {PLANS.map(p => (
              <div key={p.name} className={`border p-8 md:p-10 transition-colors flex flex-col ${p.featured ? 'bg-foreground text-background border-foreground' : 'bg-background border-border hover:border-foreground'}`}>
                <div className={`text-[10px] uppercase tracking-[0.2em] mb-6 ${p.featured ? 'text-background/50' : 'text-muted-foreground'}`}>{p.name}</div>
                <div className={`font-serif text-xl tracking-tight ${p.featured ? 'text-background' : ''}`}>{p.name}</div>
                <div className={`text-sm mt-1 mb-8 ${p.featured ? 'text-background/50' : 'text-muted-foreground'}`}>{p.note}</div>
                <div className={`font-serif text-5xl font-light tracking-tighter ${p.featured ? 'text-background' : ''}`}>{p.price}</div>
                <div className={`text-xs mt-1 mb-8 ${p.featured ? 'text-background/40' : 'text-muted-foreground'}`}>{p.period}</div>
                <ul className="space-y-3 text-sm flex-1">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-3">
                      <span className={`mt-1.5 inline-block h-px w-4 shrink-0 ${p.featured ? 'bg-background/30' : 'bg-foreground/40'}`} />
                      <span className={p.featured ? 'text-background/75' : ''}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.href}
                  className={`mt-10 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm transition ${p.featured ? 'bg-background text-foreground hover:opacity-90' : 'border border-border hover:border-foreground'}`}
                >
                  {p.cta} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-foreground text-background">
        <div className="container py-24 md:py-40 text-center">
          <div className="text-[11px] uppercase tracking-[0.25em] text-background/40 mb-8">Ready when you are</div>
          <h2 className="font-serif font-light text-4xl md:text-7xl leading-[1.02] tracking-tightest max-w-3xl mx-auto text-balance">
            <span className="italic">Compose</span> the moment your work
            arrives in the world.
          </h2>
          <p className="mt-6 text-background/50 max-w-sm mx-auto text-sm leading-relaxed">
            Your next drop deserves a page as considered as the thing itself.
          </p>
          <Link href="/signup" className="mt-12 inline-flex items-center gap-3 bg-background text-foreground px-8 py-4 text-sm hover:opacity-90">
            Begin your drop <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  )
}
