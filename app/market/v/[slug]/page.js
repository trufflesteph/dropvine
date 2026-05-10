'use client'
import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import MarketHeader from '@/components/markets/MarketHeader'
import AddToCartButton from '@/components/markets/AddToCartButton'
import { Instagram, Globe, Phone, Mail, Tag } from 'lucide-react'

function priceFmt(cents) { return `$${((cents || 0) / 100).toFixed(2)}` }

export default function VendorProfilePage() {
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/market/vendors/${slug}`)
      .then((r) => r.json())
      .then((j) => { if (j?.error) setError(j.error); else setData(j) })
      .catch((e) => setError(e?.message || 'failed'))
  }, [slug])

  if (error) {
    return (
      <main>
        <MarketHeader back title="Vendor" />
        <div className="max-w-3xl mx-auto px-5 py-10 text-center text-stone-600">
          <p>Couldn’t load this vendor.</p>
          <p className="text-xs text-stone-400 mt-1">{error}</p>
        </div>
      </main>
    )
  }
  if (!data) {
    return (
      <main>
        <MarketHeader back title="Vendor" />
        <div className="max-w-3xl mx-auto px-5 py-10 text-stone-500">Loading…</div>
      </main>
    )
  }
  const { vendor, products, posts } = data
  return (
    <main>
      <MarketHeader back title={vendor.name} sub={vendor.tagline} />

      {/* Cover */}
      <div className="max-w-3xl mx-auto px-5 pt-4">
        <div className="aspect-[16/7] max-h-[260px] bg-stone-200 relative rounded-2xl overflow-hidden">
          {vendor.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vendor.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-6xl font-serif text-stone-300">
              {vendor.name?.[0] || '?'}
            </div>
          )}
          {vendor.booth_number ? (
            <div className="absolute top-3 right-3 text-[10px] tracking-widest font-mono px-2 py-1 rounded bg-white/95 text-stone-700">
              BOOTH #{vendor.booth_number}
            </div>
          ) : null}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6">
        {vendor.categories?.length ? (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <Tag className="w-3.5 h-3.5 text-stone-400" />
            {vendor.categories.map((c) => (
              <span key={c} className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded bg-stone-100 text-stone-600">{c}</span>
            ))}
          </div>
        ) : null}

        {vendor.description ? (
          <article className="prose prose-stone prose-sm max-w-none mb-6">
            <ReactMarkdown>{vendor.description}</ReactMarkdown>
          </article>
        ) : null}

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-600 border-t border-b border-stone-100 py-3 mb-8">
          {vendor.instagram_handle ? (
            <a href={`https://instagram.com/${vendor.instagram_handle.replace(/^@/, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-stone-900">
              <Instagram className="w-4 h-4" />{vendor.instagram_handle}
            </a>
          ) : null}
          {vendor.website ? (
            <a href={vendor.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-stone-900">
              <Globe className="w-4 h-4" />Website
            </a>
          ) : null}
          {vendor.email ? (
            <a href={`mailto:${vendor.email}`} className="inline-flex items-center gap-1.5 hover:text-stone-900">
              <Mail className="w-4 h-4" />{vendor.email}
            </a>
          ) : null}
          {vendor.phone ? (
            <a href={`tel:${vendor.phone}`} className="inline-flex items-center gap-1.5 hover:text-stone-900">
              <Phone className="w-4 h-4" />{vendor.phone}
            </a>
          ) : null}
        </div>

        {/* Products */}
        {products?.length ? (
          <section className="mb-8">
            <h2 className="font-serif text-lg text-stone-800 mb-3">At the booth</h2>
            <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
              {products.map((p) => (
                <div key={p.id} className="p-4 flex items-start gap-4">
                  <div className="flex-1">
                    <div className="font-medium text-stone-800">{p.name}</div>
                    {p.description ? <p className="text-sm text-stone-600 mt-0.5">{p.description}</p> : null}
                    {p.category ? <div className="text-[10px] uppercase tracking-wide text-stone-400 mt-1">{p.category}</div> : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="font-serif text-base text-stone-800 whitespace-nowrap">{priceFmt(p.price_cents)}</div>
                    {vendor.accepts_preorders ? (
                      <AddToCartButton vendor={vendor} product={p} />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {vendor.accepts_preorders ? (
              <p className="text-xs text-stone-500 mt-2">
                {vendor.venmo_handle
                  ? <>This vendor accepts pre-orders — pay via Venmo to <strong>@{vendor.venmo_handle}</strong> on checkout.</>
                  : 'This vendor accepts pre-orders.'}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Posts */}
        {posts?.length ? (
          <section className="mb-10">
            <h2 className="font-serif text-lg text-stone-800 mb-3">Latest from {vendor.name}</h2>
            <div className="space-y-3">
              {posts.map((p) => (
                <article key={p.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                  {p.title ? <h3 className="font-serif text-base text-stone-800">{p.title}</h3> : null}
                  <p className="text-sm text-stone-600 mt-1 whitespace-pre-line">{p.body}</p>
                  <p className="text-[10px] uppercase tracking-widest text-stone-400 mt-2">
                    {new Date(p.posted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
