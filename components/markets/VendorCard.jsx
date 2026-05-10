'use client'
import React from 'react'
import Link from 'next/link'

function primaryCategory(v) {
  return (v?.categories || [])[0] || ''
}

export default function VendorCard({ vendor }) {
  const cat = primaryCategory(vendor)
  return (
    <Link href={`/market/v/${vendor.slug}`}
          className="group block rounded-2xl border border-stone-200 bg-white overflow-hidden hover:border-stone-300 transition">
      <div className="aspect-[5/3] bg-stone-100 relative">
        {vendor.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vendor.cover_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-3xl font-serif text-stone-300">
            {vendor.name?.[0] || '?'}
          </div>
        )}
        {vendor.booth_number ? (
          <div className="absolute top-2 right-2 text-[10px] tracking-widest font-mono px-2 py-1 rounded bg-white/90 text-stone-700">
            BOOTH #{vendor.booth_number}
          </div>
        ) : null}
      </div>
      <div className="p-4">
        {cat ? <div className="text-[10px] tracking-widest uppercase text-stone-500 mb-1">{cat}</div> : null}
        <div className="font-serif text-base text-stone-800 group-hover:text-stone-900">{vendor.name}</div>
        {vendor.tagline ? <div className="text-sm text-stone-600 mt-0.5 line-clamp-2">{vendor.tagline}</div> : null}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {(vendor.categories || []).slice(0, 3).map((c) => (
            <span key={c} className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-stone-100 text-stone-600">{c}</span>
          ))}
          {vendor.accepts_preorders ? (
            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded"
                  style={{ background: 'color-mix(in srgb, var(--market-accent, #E2A93C) 20%, white)', color: 'var(--market-primary, #2F5233)' }}>
              Pre-order
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
