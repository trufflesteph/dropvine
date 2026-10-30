// Run: node --test tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  MAKERS_PAGE_SIZE,
  buildCategoryOptions,
  buildFilterChips,
  buildLocationOptions,
  buildMakerCard,
  canonicalMakersRedirect,
  filterMakers,
  makerLocationLabel,
  makersHref,
  paginate,
  parseMakersParams,
  sortMakers,
} from '../lib/makers/directory.js'
import { isVendorActive, isVendorPagePublic } from '../lib/vendors/visibility.js'

const NOW = Date.parse('2026-10-29T12:00:00Z')
const HOUR = 3600000
const iso = (ms) => new Date(ms).toISOString()
const openDrop = { status: 'published', launch_at: iso(NOW - HOUR), closes_at: iso(NOW + HOUR), cover_url: 'open.jpg', created_at: iso(NOW - 2 * HOUR) }
const upcomingDrop = { status: 'scheduled', launch_at: iso(NOW + HOUR), closes_at: null, cover_url: null, created_at: iso(NOW - HOUR) }
const closedDrop = { status: 'published', launch_at: iso(NOW - 3 * HOUR), closes_at: iso(NOW - HOUR), cover_url: 'closed.jpg', created_at: iso(NOW - 5 * HOUR) }

const vendor = (over = {}) => ({
  slug: 'acme', business_name: 'Acme', bio: 'We make things.', photo_url: null, logo_url: null,
  category: 'Candles', location_city: 'portland', location_state: 'oregon', tier: 'free', active: true,
  is_demo: false, creator_id: 'c1', email: 'secret@example.com', phone: '(503) 555-1234', venmo_handle: '@acme',
  ...over,
})
const maker = (over = {}) => ({ slug: 'm', business_name: 'M', category: null, city: null, state: null, has_open_drop: false, ...over })

// --- visibility helper ------------------------------------------------------

test('isVendorActive: missing row and active=false are inactive; missing flag is active', () => {
  assert.equal(isVendorActive(null), false)
  assert.equal(isVendorActive({ active: false }), false)
  assert.equal(isVendorActive({ active: true }), true)
  assert.equal(isVendorActive({}), true)
})

test('isVendorPagePublic: shop always, others need open/upcoming drop, inactive never', () => {
  assert.equal(isVendorPagePublic({ tier: 'shop' }, [], NOW), true)
  assert.equal(isVendorPagePublic({ tier: 'SHOP ' }, [], NOW), true)
  assert.equal(isVendorPagePublic({ tier: 'free' }, [], NOW), false)
  assert.equal(isVendorPagePublic({ tier: 'maker' }, [closedDrop], NOW), false)
  assert.equal(isVendorPagePublic({ tier: 'maker' }, [openDrop], NOW), true)
  assert.equal(isVendorPagePublic({ tier: null }, [upcomingDrop], NOW), true)
  assert.equal(isVendorPagePublic({ tier: 'shop', active: false }, [openDrop], NOW), false)
})

// --- card -------------------------------------------------------------------

test('buildMakerCard: hidden vendors return null', () => {
  assert.equal(buildMakerCard(vendor(), [], NOW), null)
  assert.equal(buildMakerCard(vendor({ active: false, tier: 'shop' }), [], NOW), null)
  assert.equal(buildMakerCard(vendor({ tier: 'shop', slug: '' }), [], NOW), null)
})

test('buildMakerCard: only public fields, normalized location, open flag', () => {
  const card = buildMakerCard(vendor(), [openDrop], NOW)
  assert.deepEqual(Object.keys(card).sort(), ['business_name', 'category', 'city', 'description', 'has_open_drop', 'is_demo', 'photo_url', 'slug', 'state'])
  assert.equal(card.city, 'Portland')
  assert.equal(card.state, 'OR')
  assert.equal(card.has_open_drop, true)
  assert.equal(JSON.stringify(card).includes('secret@example.com'), false)
  assert.equal(JSON.stringify(card).includes('555'), false)
})

test('buildMakerCard: shop vendor with only an upcoming drop is listed, not open', () => {
  const card = buildMakerCard(vendor({ tier: 'shop' }), [upcomingDrop], NOW)
  assert.equal(card.has_open_drop, false)
})

test('buildMakerCard: photo order is photo_url, latest published drop cover, logo_url', () => {
  const shop = { tier: 'shop' }
  assert.equal(buildMakerCard(vendor({ ...shop, photo_url: 'p.jpg', logo_url: 'l.jpg' }), [openDrop], NOW).photo_url, 'p.jpg')
  assert.equal(buildMakerCard(vendor({ ...shop, logo_url: 'l.jpg' }), [openDrop, closedDrop], NOW).photo_url, 'open.jpg')
  assert.equal(buildMakerCard(vendor({ ...shop, logo_url: 'l.jpg' }), [], NOW).photo_url, 'l.jpg')
  assert.equal(buildMakerCard(vendor(shop), [], NOW).photo_url, null)
})

test('buildMakerCard: long bio is shortened with an ellipsis; demo flag kept', () => {
  const card = buildMakerCard(vendor({ tier: 'shop', bio: 'word '.repeat(100), is_demo: true }), [], NOW)
  assert.ok(card.description.length <= 241)
  assert.ok(card.description.endsWith('…'))
  assert.equal(card.is_demo, true)
  assert.equal(buildMakerCard(vendor({ tier: 'shop', bio: '   ' }), [], NOW).description, null)
})

test('makerLocationLabel: only when city and state both exist', () => {
  assert.equal(makerLocationLabel(maker({ city: 'West Linn', state: 'OR' })), 'West Linn, OR')
  assert.equal(makerLocationLabel(maker({ city: 'West Linn' })), '')
  assert.equal(makerLocationLabel(maker({ state: 'OR' })), '')
})

// --- params -----------------------------------------------------------------

test('parseMakersParams: defaults', () => {
  assert.deepEqual(parseMakersParams({}), { q: '', category: '', city: '', state: '', page: 1 })
  assert.deepEqual(parseMakersParams(undefined), { q: '', category: '', city: '', state: '', page: 1 })
})

test('parseMakersParams: trims, normalizes location, takes first of repeated keys', () => {
  const f = parseMakersParams({ q: '  hot   sauce ', category: ['Candles', 'Art'], city: 'west linn', state: 'oregon' })
  assert.deepEqual(f, { q: 'hot sauce', category: 'Candles', city: 'West Linn', state: 'OR', page: 1 })
})

test('parseMakersParams: location select value, used only without city/state', () => {
  assert.equal(parseMakersParams({ location: 'West Linn|OR' }).city, 'West Linn')
  assert.equal(parseMakersParams({ location: 'West Linn|OR' }).state, 'OR')
  assert.equal(parseMakersParams({ location: 'Bend, Oregon' }).state, 'OR')
  assert.equal(parseMakersParams({ location: 'Bend|OR', city: 'Salem', state: 'OR' }).city, 'Salem')
})

test('parseMakersParams: page must be a positive integer', () => {
  assert.equal(parseMakersParams({ page: '3' }).page, 3)
  for (const bad of ['0', '-1', 'abc', '2.5', '', '1e3']) assert.equal(parseMakersParams({ page: bad }).page, 1, bad)
  assert.equal(parseMakersParams({ page: '999999999' }).page, 10000)
})

test('makersHref: fixed order, empties and page 1 omitted', () => {
  assert.equal(makersHref({}), '/makers')
  assert.equal(makersHref({ page: 1 }), '/makers')
  assert.equal(makersHref({ state: 'OR', q: 'a b', page: 2 }), '/makers?q=a+b&state=OR&page=2')
})

test('canonicalMakersRedirect: clean URLs stay, messy ones redirect', () => {
  assert.equal(canonicalMakersRedirect({}), null)
  assert.equal(canonicalMakersRedirect({ q: 'x', page: '2' }), null)
  assert.equal(canonicalMakersRedirect({ state: 'OR', city: 'Bend' }), null) // order doesn't matter
  assert.equal(canonicalMakersRedirect({ utm_source: 'ig' }), null)
  assert.equal(canonicalMakersRedirect({ q: '', category: '' }), '/makers')
  assert.equal(canonicalMakersRedirect({ q: 'x', category: '', location: 'Bend|OR' }), '/makers?q=x&city=Bend&state=OR')
  assert.equal(canonicalMakersRedirect({ city: 'bend', state: 'oregon' }), '/makers?city=Bend&state=OR')
  assert.equal(canonicalMakersRedirect({ page: '1' }), '/makers')
  assert.equal(canonicalMakersRedirect({ q: ['a', 'b'] }), '/makers?q=a')
})

test('canonicalMakersRedirect: redirect target is itself canonical (no loops)', () => {
  const inputs = [
    { q: '  x ', location: 'west linn|or', page: '0' },
    { category: 'Candles', city: 'portland', state: 'Oregon', page: '3' },
    { location: 'Toronto, ON' },
  ]
  for (const sp of inputs) {
    const target = canonicalMakersRedirect(sp)
    const params = Object.fromEntries(new URL(target, 'http://x').searchParams)
    assert.equal(canonicalMakersRedirect(params), null, target)
  }
})

// --- filtering, ordering, pagination ---------------------------------------

const list = [
  maker({ slug: 'b', business_name: 'banana Bakes', category: 'Baked Goods', city: 'Portland', state: 'OR' }),
  maker({ slug: 'a', business_name: 'Apple Candles', category: 'Candles', city: 'Bend', state: 'OR', has_open_drop: true }),
  maker({ slug: 'c', business_name: 'cherry Clay', category: 'Ceramics/Pottery', city: 'Seattle', state: 'WA' }),
  maker({ slug: 'z', business_name: 'Zed Candles', category: 'Candles', city: 'Portland', state: 'OR', has_open_drop: true }),
]

test('filterMakers: name search, category, state-only and city+state', () => {
  const slugs = (f) => filterMakers(list, f).map((m) => m.slug).sort()
  assert.deepEqual(slugs({ q: 'CANDLE' }), ['a', 'z'])
  assert.deepEqual(slugs({ category: 'candles' }), ['a', 'z'])
  assert.deepEqual(slugs({ state: 'OR' }), ['a', 'b', 'z'])
  assert.deepEqual(slugs({ city: 'Portland', state: 'OR' }), ['b', 'z'])
  assert.deepEqual(slugs({ q: 'zed', city: 'Bend', state: 'OR' }), [])
  assert.deepEqual(slugs({}), ['a', 'b', 'c', 'z'])
})

test('sortMakers: open drop first, then case-insensitive A–Z, no mutation', () => {
  const before = list.map((m) => m.slug)
  assert.deepEqual(sortMakers(list).map((m) => m.slug), ['a', 'z', 'b', 'c'])
  assert.deepEqual(list.map((m) => m.slug), before)
  const tie = [maker({ slug: 'y', business_name: 'Same' }), maker({ slug: 'x', business_name: 'same' })]
  assert.deepEqual(sortMakers(tie).map((m) => m.slug), ['x', 'y'])
})

test('paginate: 24 per page, clamps out-of-range pages', () => {
  const many = Array.from({ length: 50 }, (_, i) => i)
  assert.equal(MAKERS_PAGE_SIZE, 24)
  let p = paginate(many, 1)
  assert.deepEqual([p.items.length, p.page, p.totalPages, p.total, p.offset], [24, 1, 3, 50, 0])
  p = paginate(many, 3)
  assert.deepEqual([p.items.length, p.items[0], p.page], [2, 48, 3])
  assert.equal(paginate(many, 99).page, 3)
  assert.equal(paginate(many, 0).page, 1)
  p = paginate([], 5)
  assert.deepEqual([p.items.length, p.page, p.totalPages], [0, 1, 1])
  assert.equal(paginate(Array.from({ length: 24 }), 1).totalPages, 1)
})

// --- options and chips ------------------------------------------------------

test('buildCategoryOptions: only present categories, canonical order, unknowns last', () => {
  const opts = buildCategoryOptions([...list, maker({ category: 'Zines' }), maker({ category: null })])
  assert.deepEqual(opts, ['Baked Goods', 'Candles', 'Ceramics/Pottery', 'Zines'])
  assert.deepEqual(buildCategoryOptions([]), [])
})

test('buildLocationOptions: distinct City, ST with both parts, sorted', () => {
  const opts = buildLocationOptions([...list, maker({ city: 'Salem' }), maker({ state: 'OR' })])
  assert.deepEqual(opts.map((o) => o.label), ['Bend, OR', 'Portland, OR', 'Seattle, WA'])
  assert.equal(opts[1].value, 'Portland|OR')
  assert.deepEqual(parseMakersParams({ location: opts[1].value }), { q: '', category: '', city: 'Portland', state: 'OR', page: 1 })
  assert.equal(buildLocationOptions([list[0], list[3]]).length, 1) // both Portland → one option (select hidden)
})

test('buildFilterChips: one removable chip per filter, page reset', () => {
  const f = { q: 'clay', category: 'Candles', city: 'Bend', state: 'OR', page: 3 }
  const chips = buildFilterChips(f)
  assert.deepEqual(chips.map((c) => c.label), ['“clay”', 'Candles', 'Bend, OR'])
  assert.equal(chips[0].href, '/makers?category=Candles&city=Bend&state=OR')
  assert.equal(chips[2].href, '/makers?q=clay&category=Candles')
  assert.deepEqual(buildFilterChips({ q: '', category: '', city: '', state: '', page: 2 }), [])
})
