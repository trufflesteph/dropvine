// /makers — Browse makers: one card per vendor whose /direct/[slug] page is
// public (Shop tier, or any tier with an open or upcoming drop; active only;
// rule in lib/vendors/visibility.js).
//
// Server-rendered, unlike /drops. Filters live in the URL (q, category, city,
// state, page; same names as /drops) and the filter form is a plain GET form,
// so every view is a shareable, crawlable link and works without JavaScript.
// Non-canonical params (empty fields, the Location select's `location`,
// page=1) redirect to the clean URL.
//
// Order: makers with an open drop first, then A–Z. 24 per page.
// Demo vendors are listed with a "Demo" label, as /drops labels demo drops.
//
// Data: lib/makers/data.js (cached 5 minutes). Logic: lib/makers/directory.js.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight, MapPin, Search, X } from 'lucide-react'
import { Nav } from '@/components/dropvine/nav'
import { Footer } from '@/components/dropvine/footer'
import { getVisibleMakers } from '@/lib/makers/data'
import {
  MAKERS_PATH,
  buildCategoryOptions,
  buildFilterChips,
  buildLocationOptions,
  canonicalMakersRedirect,
  filterMakers,
  hasActiveFilters,
  makerLocationLabel,
  makersHref,
  paginate,
  parseMakersParams,
  sortMakers,
} from '@/lib/makers/directory'
import { formatLocation, locationKey } from '@/lib/location'
import { getSiteUrl } from '@/lib/site-url'

const TITLE = 'Browse makers — Dropvine'
const DESCRIPTION =
  'Meet the small businesses selling on Dropvine. Browse makers by category or location and visit their pages to see what’s open now and what’s coming up.'

// Canonical: unfiltered pages are self-canonical (/makers, /makers?page=2) so
// every maker stays reachable for crawlers. Any filtered view (search,
// category, location) points at /makers.
export async function generateMetadata({ searchParams }) {
  const filters = parseMakersParams(searchParams)
  let page = filters.page
  if (page > 1) {
    try {
      page = paginate(filterMakers(await getVisibleMakers(), filters), page).page
    } catch { /* keep the requested page */ }
  }
  const title = page > 1 ? `${TITLE} — Page ${page}` : TITLE
  const site = getSiteUrl()
  const url = `${site}${hasActiveFilters(filters) ? MAKERS_PATH : makersHref({ page })}`
  // A page-level openGraph doesn't pick up app/opengraph-image.jsx, so point
  // at the same generated image explicitly (size/alt as exported there).
  const image = { url: `${site}/opengraph-image`, width: 1200, height: 630, alt: 'You bake. Dropvine handles the selling.' }
  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: url },
    openGraph: { title, description: DESCRIPTION, url, type: 'website', images: [image] },
    twitter: { card: 'summary_large_image', title, description: DESCRIPTION, images: [image] },
  }
}

export default async function MakersPage({ searchParams }) {
  const redirectTo = canonicalMakersRedirect(searchParams)
  if (redirectTo) redirect(redirectTo)

  const filters = parseMakersParams(searchParams)
  let all = []
  let loadError = false
  try {
    all = await getVisibleMakers()
  } catch (e) {
    console.error(e?.message || e)
    loadError = true
  }

  const filtered = filterMakers(sortMakers(all), filters)
  const { items, page, totalPages, total, offset } = paginate(filtered, filters.page)
  const filtering = hasActiveFilters(filters)

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      <section className="container pt-16 md:pt-24 lg:pt-10 pb-10 md:pb-14">
        <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">Makers</div>
        <h1 className="font-serif font-light text-5xl md:text-7xl leading-[0.96] tracking-tightest text-balance">
          Browse makers
        </h1>
        <p className="mt-8 text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
          Meet the small businesses selling on Dropvine. Visit a maker&rsquo;s page to see what&rsquo;s open now and what&rsquo;s coming up.
        </p>
      </section>

      {loadError ? (
        <section className="container pb-20 md:pb-28">
          <div className="border border-dashed border-border p-10 text-center text-muted-foreground">
            <p className="text-sm">Couldn&rsquo;t load makers right now. Please try again in a moment.</p>
          </div>
        </section>
      ) : all.length === 0 ? (
        <section className="container pb-20 md:pb-28">
          <div className="border border-dashed border-border p-10 md:p-16 text-center text-muted-foreground" data-testid="makers-empty">
            <p className="max-w-md mx-auto text-sm">No makers to show yet. Check back soon.</p>
            <Link
              href="/drops"
              className="mt-6 inline-flex items-center gap-2 border border-foreground px-5 py-2 text-sm text-foreground hover:bg-foreground hover:text-background transition"
            >
              Browse Fresh Drops <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : (
        <>
          <FilterBar filters={filters} makers={all} />

          <section className="container pb-20 md:pb-28">
            {items.length === 0 ? (
              <div className="border border-dashed border-border p-10 md:p-16 text-center text-muted-foreground" data-testid="makers-no-match">
                <p className="max-w-md mx-auto text-sm">No makers match these filters.</p>
                <Link
                  href={MAKERS_PATH}
                  className="mt-6 inline-flex items-center gap-2 border border-foreground px-5 py-2 text-sm text-foreground hover:bg-foreground hover:text-background transition"
                >
                  Clear all filters
                </Link>
              </div>
            ) : (
              <>
                <p className="mb-6 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {total === 1 ? '1 maker' : totalPages > 1 ? `${offset + 1}–${offset + items.length} of ${total} makers` : `${total} makers`}
                </p>
                <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {items.map((m) => (
                    <li key={m.slug}>
                      <MakerCard m={m} />
                    </li>
                  ))}
                </ul>
                <Pagination filters={filters} page={page} totalPages={totalPages} />
                {!filtering ? <ItemListJsonLd items={items} offset={offset} /> : null}
              </>
            )}
          </section>
        </>
      )}

      <Footer />
    </div>
  )
}

// Plain GET form: works without JavaScript. Location is one select, so it
// submits `location=City|ST` and the page redirects to ?city=&state=.
function FilterBar({ filters, makers }) {
  const categories = buildCategoryOptions(makers)
  if (filters.category && !categories.includes(filters.category)) categories.unshift(filters.category)

  const locations = buildLocationOptions(makers)
  const showLocation = locations.length >= 2
  const hasLocation = !!(filters.city || filters.state)
  const activeKey = hasLocation ? locationKey(filters.city, filters.state) : ''
  if (showLocation && hasLocation && !locations.some((o) => o.key === activeKey)) {
    // Active URL filter that isn't an option (e.g. ?state=OR alone): list it
    // so the select never misreports what's applied.
    locations.unshift({ key: activeKey, value: `${filters.city}|${filters.state}`, label: formatLocation(filters.city, filters.state) })
  }
  const activeValue = locations.find((o) => o.key === activeKey)?.value || ''
  const chips = buildFilterChips(filters)

  const selectClass = 'w-full md:w-auto min-h-[44px] py-2 pl-2 pr-8 bg-background border border-border focus:border-foreground focus:outline-none text-sm text-foreground'

  return (
    <section className="container pb-6 md:pb-8">
      <div className="border-y border-border py-4 md:py-6 space-y-4">
        <form action={MAKERS_PATH} method="get" role="search" className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Search makers by name..."
              maxLength={100}
              className="w-full min-h-[44px] pl-10 pr-3 py-2.5 bg-background border border-border focus:border-foreground focus:outline-none text-sm transition-colors"
              aria-label="Search makers by name"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="sr-only">Category</span>
            <select name="category" defaultValue={filters.category} className={selectClass} aria-label="Filter by category">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          {showLocation ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="sr-only">Location</span>
              <select name="location" defaultValue={activeValue} className={selectClass} aria-label="Filter by location">
                <option value="">All locations</option>
                {locations.map((o) => (
                  <option key={o.key} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          ) : hasLocation ? (
            // No select to carry it, so keep an active URL location filter.
            <>
              {filters.city ? <input type="hidden" name="city" value={filters.city} /> : null}
              {filters.state ? <input type="hidden" name="state" value={filters.state} /> : null}
            </>
          ) : null}
          <button
            type="submit"
            className="min-h-[44px] border border-foreground px-5 text-sm hover:bg-foreground hover:text-background transition"
          >
            Apply
          </button>
        </form>

        {chips.length ? (
          <div className="flex flex-wrap items-center gap-2" data-testid="makers-active-filters">
            <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mr-1">Showing:</span>
            {chips.map((c) => (
              <Link
                key={c.key}
                href={c.href}
                className="inline-flex items-center gap-2 min-h-[32px] px-3 py-1.5 text-[12px] tracking-wide border border-foreground bg-foreground text-background hover:opacity-90 transition"
                aria-label={`Remove filter ${c.label}`}
              >
                {c.key === 'location' ? <MapPin className="h-3 w-3" /> : null}
                {c.label}
                <X className="h-3.5 w-3.5" />
              </Link>
            ))}
            <Link href={MAKERS_PATH} className="ml-1 text-[12px] text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Clear all
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function MakerCard({ m }) {
  const location = makerLocationLabel(m)
  const initial = (Array.from(m.business_name)[0] || '?').toUpperCase()
  return (
    <Link
      href={`/direct/${encodeURIComponent(m.slug)}`}
      className="group relative flex h-full flex-col border border-border bg-background hover:border-foreground transition-colors"
      data-testid={`maker-card-${m.slug}`}
    >
      <div className="relative w-full aspect-[4/3] border-b border-border bg-stone-100 overflow-hidden">
        {m.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.photo_url} alt={m.business_name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <span className="font-serif text-7xl text-stone-300">{initial}</span>
          </div>
        )}
        {m.has_open_drop ? (
          <span className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.2em] px-2 py-1 bg-foreground text-background inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" aria-hidden="true" />
            Open drop
          </span>
        ) : null}
        {m.is_demo ? (
          <span className="absolute top-3 right-3 text-[9px] uppercase tracking-[0.18em] px-2 py-1 bg-white/80 text-foreground border border-white/40">
            Demo
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-6 md:p-8">
        {m.category || location ? (
          <div className="flex items-center gap-2 flex-wrap">
            {m.category ? (
              <span className="text-[10px] uppercase tracking-[0.22em] px-2 py-1 bg-stone-100 text-foreground border border-border">
                {m.category}
              </span>
            ) : null}
            {location ? (
              <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {location}
              </span>
            ) : null}
          </div>
        ) : null}
        <h2 className="mt-3 font-serif text-2xl md:text-3xl tracking-tighter group-hover:underline underline-offset-4 decoration-1">
          {m.business_name}
        </h2>
        {m.description ? (
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-2">{m.description}</p>
        ) : null}
        <div className="mt-auto pt-6 flex items-center justify-end text-sm">
          <span className="inline-flex items-center gap-1 text-foreground/80 group-hover:text-foreground">
            Visit page <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}

// Real links (rel prev/next), not script buttons.
function Pagination({ filters, page, totalPages }) {
  if (totalPages <= 1) return null
  const base = { q: filters.q, category: filters.category, city: filters.city, state: filters.state }
  const linkClass = 'inline-flex items-center gap-2 min-h-[44px] border border-foreground px-5 text-sm hover:bg-foreground hover:text-background transition'
  const offClass = 'inline-flex items-center gap-2 min-h-[44px] border border-border px-5 text-sm text-muted-foreground opacity-50'
  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={makersHref({ ...base, page: page - 1 })} rel="prev" className={linkClass}>
          <ArrowLeft className="h-4 w-4" /> Previous
        </Link>
      ) : (
        <span className={offClass} aria-disabled="true"><ArrowLeft className="h-4 w-4" /> Previous</span>
      )}
      <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={makersHref({ ...base, page: page + 1 })} rel="next" className={linkClass}>
          Next <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={offClass} aria-disabled="true">Next <ArrowRight className="h-4 w-4" /></span>
      )}
    </nav>
  )
}

// schema.org ItemList of the makers on this (unfiltered) page. `<` is
// escaped so vendor text can't close the script tag.
function ItemListJsonLd({ items, offset }) {
  const site = getSiteUrl()
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((m, i) => ({
      '@type': 'ListItem',
      position: offset + i + 1,
      url: `${site}/direct/${encodeURIComponent(m.slug)}`,
      name: m.business_name,
    })),
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
