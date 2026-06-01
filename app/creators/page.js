'use client'
//
// /creators — public showcase of vendors using Dropvine.
//
// Phase 1: lists the three demo vendors (Sauce Mamas, Wildflour Cookies,
// Baxter Farmstand) as cards that link to their public /direct/[slug] pages.
// Each card uses the same hero image as the homepage featured card so the
// visual story is consistent.
//
// Phase 2 (future): replace the hard-coded list with a live query against
// `direct_vendors` where `is_demo = false` and the vendor has at least one
// published drop. This page intentionally mirrors that future card layout
// so the swap is just changing the data source.

import Link from 'next/link'
import { Nav } from '@/components/dropvine/nav'
import { Footer } from '@/components/dropvine/footer'
import { ArrowRight } from 'lucide-react'

// Hard-coded for Phase 1 — see TODO above.
const CREATORS = [
  {
    slug: 'sauce-mamas',
    business_name: 'Sauce Mamas',
    tagline: 'Small-batch hot sauces made in Portland',
    hero_image_url: 'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?w=1200&q=80',
    location: 'SE Portland',
    next_drop: { handle: 'sauce-mamas-workshop-june', label: 'Workshop · June 28' },
  },
  {
    slug: 'wildflour-cookies',
    business_name: 'Wildflour Cookies',
    tagline: 'Weekly market pre-orders — pick up Wednesday',
    hero_image_url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=1200&q=80',
    location: 'West Linn',
    next_drop: { handle: 'wildflour-may-21', label: 'This week’s box' },
  },
  {
    slug: 'baxter-farmstand',
    business_name: 'Baxter Farmstand',
    tagline: 'Weekly produce boxes from our Tualatin Valley farm',
    hero_image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200&q=80',
    location: 'Tualatin Valley',
    next_drop: { handle: 'baxter-produce-may-21', label: 'Weekly produce box' },
  },
]

export default function CreatorsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />

      {/* Page header */}
      <section className="container pt-32 md:pt-40 pb-12 md:pb-16">
        <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">Creators</div>
        <h1 className="font-serif font-light text-5xl md:text-7xl leading-[0.96] tracking-tightest text-balance">
          Vendors using Dropvine.
        </h1>
        <p className="mt-8 text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
          A growing list of independent makers, farms, and studios running their drops on Dropvine. Click a creator to see their profile and live drops.
        </p>
      </section>

      <div className="container"><div className="h-px bg-border" /></div>

      {/* Grid */}
      <section className="container py-16 md:py-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {CREATORS.map((c) => (
            <Link
              key={c.slug}
              href={`/direct/${c.slug}`}
              className="group block border border-border bg-background hover:border-foreground transition-colors"
            >
              <div
                className="relative w-full aspect-[4/3] border-b border-border bg-stone-100 overflow-hidden"
                style={{ backgroundImage: `url(${c.hero_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <span className="absolute top-3 right-3 text-[9px] uppercase tracking-[0.18em] px-2 py-1 bg-white/80 text-foreground border border-white/40">
                  Demo
                </span>
              </div>
              <div className="p-6 md:p-8">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{c.location}</div>
                <div className="mt-2 font-serif text-2xl md:text-3xl tracking-tighter group-hover:underline underline-offset-4 decoration-1">
                  {c.business_name}
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-2">{c.tagline}</p>
                <div className="mt-6 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{c.next_drop.label}</span>
                  <span className="inline-flex items-center gap-1 text-foreground/80 group-hover:text-foreground">
                    View <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  )
}
