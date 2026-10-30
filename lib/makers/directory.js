// Pure logic behind /makers (Browse makers): URL params, the public card
// shape, filtering, ordering, pagination and the filter options. No I/O, so
// it's unit-tested directly (tests/makers-directory.test.mjs).
//
// Relative imports (with extensions) so `node --test` can load this file
// without the `@/` alias.

import { VENDOR_CATEGORIES } from '../vendors/categories.js'
import { isOpenDrop, isVendorPagePublic } from '../vendors/visibility.js'
import { normalizeLocation, locationKey, formatLocation } from '../location.js'

export const MAKERS_PATH = '/makers'
export const MAKERS_PAGE_SIZE = 24
const MAX_PAGE = 10000
const DESCRIPTION_MAX = 240

function first(v) {
  return Array.isArray(v) ? v[0] : v
}

function clean(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim()
}

// Next.js `searchParams` (plain object, values string | string[]) → filters.
// Same param names as /drops: q, category, city, state; plus page. `location`
// is what the no-JS Location select submits ("City|ST"); it's only read when
// city/state are absent, and the page redirects it to city + state.
export function parseMakersParams(searchParams = {}) {
  const q = clean(first(searchParams.q)).slice(0, 100)
  const category = clean(first(searchParams.category)).slice(0, 60)

  const rawCity = first(searchParams.city)
  const rawState = first(searchParams.state)
  let loc
  if (clean(rawCity) || clean(rawState)) {
    loc = normalizeLocation(rawCity, rawState)
  } else {
    const raw = String(first(searchParams.location) ?? '')
    const bar = raw.lastIndexOf('|')
    loc = bar >= 0 ? normalizeLocation(raw.slice(0, bar), raw.slice(bar + 1)) : normalizeLocation(raw, '')
  }

  const rawPage = clean(first(searchParams.page))
  const n = /^\d+$/.test(rawPage) ? parseInt(rawPage, 10) : 1
  const page = n >= 1 ? Math.min(n, MAX_PAGE) : 1

  return { q, category, city: loc.city, state: loc.state, page }
}

export function hasActiveFilters(f) {
  return !!(f.q || f.category || f.city || f.state)
}

// "/makers?q=...&category=...&city=...&state=...&page=N". Page 1 and empty
// filters are omitted, so every view has exactly one URL.
export function makersHref({ q = '', category = '', city = '', state = '', page = 1 } = {}) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (category) params.set('category', category)
  if (city) params.set('city', city)
  if (state) params.set('state', state)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `${MAKERS_PATH}?${qs}` : MAKERS_PATH
}

const RAW_KEYS = ['q', 'category', 'city', 'state', 'page', 'location']

// The clean URL to redirect to when the request's filter params aren't in
// canonical form (empty fields from the GET form, `location`, un-normalized
// city/state, page=1, repeated keys), else null. Other params (utm_*, etc.)
// are ignored.
export function canonicalMakersRedirect(searchParams = {}) {
  const target = makersHref(parseMakersParams(searchParams))
  const raw = new URLSearchParams()
  for (const key of RAW_KEYS) {
    const v = searchParams[key]
    if (v === undefined) continue
    for (const x of [].concat(v)) raw.append(key, x)
  }
  const qs = raw.toString()
  const current = qs ? `${MAKERS_PATH}?${qs}` : MAKERS_PATH
  return current === target ? null : target
}

function shortDescription(bio) {
  const s = clean(bio)
  if (s.length <= DESCRIPTION_MAX) return s
  const cut = s.slice(0, DESCRIPTION_MAX)
  const space = cut.lastIndexOf(' ')
  return `${(space > DESCRIPTION_MAX * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, '')}…`
}

// One vendor row + that vendor's published/scheduled drops → the public card,
// or null when the vendor's page isn't public (shared rule in
// lib/vendors/visibility.js). Only public fields leave this function.
//
// Photo order matches the vendor page: photo_url, then the cover of their
// most recent published drop, then logo_url.
export function buildMakerCard(vendor, drops = [], now = Date.now()) {
  if (!vendor || !isVendorPagePublic(vendor, drops, now)) return null
  const slug = clean(vendor.slug)
  const name = clean(vendor.business_name)
  if (!slug || !name) return null

  const dropCover = drops
    .filter((d) => d.status === 'published' && d.cover_url)
    .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))[0]?.cover_url

  const loc = normalizeLocation(vendor.location_city, vendor.location_state)
  return {
    slug,
    business_name: name,
    photo_url: vendor.photo_url || dropCover || vendor.logo_url || null,
    description: shortDescription(vendor.bio) || null,
    category: clean(vendor.category) || null,
    city: loc.city || null,
    state: loc.state || null,
    has_open_drop: drops.some((d) => isOpenDrop(d, now)),
    is_demo: !!vendor.is_demo,
  }
}

// "West Linn, OR" only when both parts exist.
export function makerLocationLabel(m) {
  return m.city && m.state ? formatLocation(m.city, m.state) : ''
}

// q: business name contains (case-insensitive). category: exact match
// (case-insensitive). Location as on /drops: state alone filters by state,
// city + state must both match.
export function filterMakers(makers, { q = '', category = '', city = '', state = '' } = {}) {
  const wantQ = q.toLowerCase()
  const wantCategory = category.toLowerCase()
  const wantCity = city.toLowerCase()
  const wantState = state.toLowerCase()
  return makers.filter((m) => {
    if (wantQ && !m.business_name.toLowerCase().includes(wantQ)) return false
    if (wantCategory && (m.category || '').toLowerCase() !== wantCategory) return false
    if (wantCity && (m.city || '').toLowerCase() !== wantCity) return false
    if (wantState && (m.state || '').toLowerCase() !== wantState) return false
    return true
  })
}

// Open drop first, then business name A–Z (case-insensitive), slug as a
// stable tiebreak. Returns a new array.
export function sortMakers(makers) {
  return [...makers].sort((a, b) => {
    if (a.has_open_drop !== b.has_open_drop) return a.has_open_drop ? -1 : 1
    const an = a.business_name.toLowerCase()
    const bn = b.business_name.toLowerCase()
    if (an !== bn) return an < bn ? -1 : 1
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0
  })
}

// Out-of-range pages clamp to the nearest real page.
export function paginate(list, page = 1, size = MAKERS_PAGE_SIZE) {
  const total = list.length
  const totalPages = Math.max(1, Math.ceil(total / size))
  const current = Math.min(Math.max(1, page), totalPages)
  const offset = (current - 1) * size
  return { items: list.slice(offset, offset + size), page: current, totalPages, total, offset }
}

// Categories with at least one visible maker: VENDOR_CATEGORIES order first,
// then any others A–Z.
export function buildCategoryOptions(makers) {
  const present = new Set(makers.map((m) => m.category).filter(Boolean))
  const known = VENDOR_CATEGORIES.filter((c) => present.has(c))
  const other = [...present].filter((c) => !VENDOR_CATEGORIES.includes(c)).sort((a, b) => a.localeCompare(b))
  return [...known, ...other]
}

// Distinct "City, ST" among visible makers (both parts required), A–Z.
// `value` is what the Location select submits.
export function buildLocationOptions(makers) {
  const byKey = new Map()
  for (const m of makers) {
    if (!m.city || !m.state) continue
    const key = locationKey(m.city, m.state)
    if (!byKey.has(key)) {
      byKey.set(key, { key, city: m.city, state: m.state, value: `${m.city}|${m.state}`, label: formatLocation(m.city, m.state) })
    }
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label))
}

// "Showing:" chips. Each chip's href is the current view minus that filter
// (back to page 1).
export function buildFilterChips(f) {
  const chips = []
  const base = { q: f.q, category: f.category, city: f.city, state: f.state }
  if (f.q) chips.push({ key: 'q', label: `“${f.q}”`, href: makersHref({ ...base, q: '' }) })
  if (f.category) chips.push({ key: 'category', label: f.category, href: makersHref({ ...base, category: '' }) })
  if (f.city || f.state) {
    chips.push({ key: 'location', label: formatLocation(f.city, f.state), href: makersHref({ ...base, city: '', state: '' }) })
  }
  return chips
}
