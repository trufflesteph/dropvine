'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Nav } from '@/components/dropvine/nav'
import { Footer } from '@/components/dropvine/footer'
import { Countdown } from '@/components/dropvine/countdown'
import { ArrowRight, ArrowUpRight } from 'lucide-react'

export default function LandingPage() {
  // Demo target: 36 hours from now (stable per render)
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
              <span>Edition 01 — Now in private preview</span>
            </div>
            <h1 className="font-serif font-light text-[44px] sm:text-6xl md:text-7xl lg:text-[104px] leading-[0.96] tracking-tightest text-balance animate-fade-up">
              Release your work
              <br className="hidden md:block" />
              <span className="italic font-extralight">on your own clock.</span>
            </h1>
            <p className="mt-10 max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed text-pretty animate-fade-up" style={{ animationDelay: '120ms' }}>
              Dropvine is a quiet platform for considered launches. Compose a page,
              gather a waitlist, hold reservations — then open the doors at a moment
              of your choosing.
            </p>
            <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center gap-5 animate-fade-up" style={{ animationDelay: '220ms' }}>
              <Link href="/signup" className="group inline-flex items-center gap-3 bg-foreground text-background px-7 py-4 text-sm hover:opacity-90 transition">
                Create a launch
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="#example" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
                See an example launch <ArrowUpRight className="h-3.5 w-3.5" />
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

      {/* HOW IT WORKS */}
      <section id="how" className="container py-24 md:py-40">
        <div className="grid md:grid-cols-12 gap-12 md:gap-16">
          <div className="md:col-span-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">The method</div>
            <h2 className="font-serif font-light text-4xl md:text-5xl leading-tight tracking-tighter text-balance">
              Three steps. <span className="italic">Nothing more.</span>
            </h2>
          </div>
          <div className="md:col-span-8 grid sm:grid-cols-3 gap-10 md:gap-14">
            {[
              { n: '01', t: 'Compose', d: 'A single page with your story, imagery, and the moment it opens.' },
              { n: '02', t: 'Gather', d: 'Collect a waitlist or take held reservations — your audience, ready.' },
              { n: '03', t: 'Release', d: 'When the timer reaches zero, the page becomes live commerce.' },
            ].map(s => (
              <div key={s.n} className="">
                <div className="font-serif italic text-muted-foreground text-sm mb-6">{s.n}</div>
                <div className="font-serif text-2xl mb-3 tracking-tight">{s.t}</div>
                <p className="text-muted-foreground leading-relaxed text-[15px]">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EXAMPLE LAUNCH */}
      <section id="example" className="border-t border-border bg-stone-100/60">
        <div className="container py-24 md:py-40">
          <div className="grid md:grid-cols-12 gap-12">
            <div className="md:col-span-5">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">An example</div>
              <h2 className="font-serif font-light text-4xl md:text-5xl leading-tight tracking-tighter">
                Maison Noir
                <br /><span className="italic">Fall / Winter ’26</span>
              </h2>
              <p className="mt-6 text-muted-foreground leading-relaxed max-w-md">
                A 12-piece capsule, limited to 200. Reservations hold a size for 24
                hours after release. Page opens at the moment shown.
              </p>
              <Link href="/l/maison-noir-fw26" className="mt-8 inline-flex items-center gap-2 text-sm border-b border-foreground pb-1 hover:opacity-70">
                View the launch page <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
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
          </div>
          <div className="md:col-span-8 grid sm:grid-cols-2 gap-6">
            {[
              { name: 'Studio', price: 'Free', note: 'For your first launch.', features: ['1 active launch', 'Waitlist', 'Countdown page', 'Dropvine watermark'] },
              { name: 'Atelier', price: '$24/mo', note: 'For ongoing makers.', features: ['Unlimited launches', 'Reservations (Stripe)', 'Custom domain', 'No watermark'] },
            ].map(p => (
              <div key={p.name} className="border border-border p-8 md:p-10 bg-background hover:border-foreground transition-colors">
                <div className="font-serif text-2xl tracking-tight">{p.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">{p.note}</div>
                <div className="mt-8 font-serif text-5xl font-light tracking-tighter">{p.price}</div>
                <ul className="mt-8 space-y-3 text-sm">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-3"><span className="text-muted-foreground mt-1.5 inline-block h-px w-4 bg-foreground/40" />{f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="container py-24 md:py-40 text-center">
          <h2 className="font-serif font-light text-4xl md:text-7xl leading-[1.02] tracking-tightest max-w-3xl mx-auto text-balance">
            <span className="italic">Compose</span> the moment your work
            arrives in the world.
          </h2>
          <Link href="/signup" className="mt-12 inline-flex items-center gap-3 bg-foreground text-background px-8 py-4 text-sm hover:opacity-90">
            Begin a launch <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  )
}
