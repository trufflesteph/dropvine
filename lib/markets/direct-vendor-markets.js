import { createClient } from '@supabase/supabase-js'

function getMarketsClient() {
  const url = process.env.NEXT_PUBLIC_MARKETS_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_MARKETS_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('[markets] Markets client not created; missing env var(s):',
      [!url && 'NEXT_PUBLIC_MARKETS_SUPABASE_URL', !key && 'NEXT_PUBLIC_MARKETS_SUPABASE_ANON_KEY'].filter(Boolean).join(', '))
    return null
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Extracts the vendor slug from a dropvine.pro/direct/<slug> URL. Tolerates a
// missing scheme ("dropvine.pro/direct/foo"), since Markets admins type these in.
function slugFromUrl(value) {
  try {
    const raw = String(value || '').trim()
    const path = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`).pathname
    const match = path.match(/\/direct\/([^/]+)\/?$/i)
    return match ? decodeURIComponent(match[1]).trim().toLowerCase() : null
  } catch {
    return null
  }
}

// Today's date (YYYY-MM-DD) in Pacific time. market_dates.date is a local
// calendar date, so comparing against the UTC date would drop a market on its
// final day from ~5pm Pacific onward.
function todayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

// TEMP DEBUG — remove once the empty-markets break point is found.
const dbg = (step, value) => console.log(`[markets-debug] ${step}:`, JSON.stringify(value))

export async function getActiveMarketsForDirectVendor(slug) {
  const supa = getMarketsClient()
  dbg('0 client', {
    hasUrl: !!process.env.NEXT_PUBLIC_MARKETS_SUPABASE_URL,
    urlHost: (() => { try { return new URL(process.env.NEXT_PUBLIC_MARKETS_SUPABASE_URL).host } catch { return null } })(),
    hasAnonKey: !!process.env.NEXT_PUBLIC_MARKETS_SUPABASE_ANON_KEY,
    clientCreated: !!supa,
    slug,
  })
  if (!supa || !slug) return []

  const normalizedSlug = String(slug).trim().toLowerCase()
  // Narrow server-side with a substring match, then confirm an exact slug match
  // below so "/direct/foo" never matches "/direct/foo-bar".
  const likeSlug = normalizedSlug.replace(/[\\%_]/g, (c) => `\\${c}`)
  dbg('1a vendors ilike pattern', `%/direct/${likeSlug}%`)
  const { data: vendors, error: vendorError } = await supa
    .from('vendors')
    .select('id, dropvine_direct_url')
    .ilike('dropvine_direct_url', `%/direct/${likeSlug}%`)
  dbg('1b vendors rows (raw dropvine_direct_url)', { error: vendorError, rows: vendors })
  if (vendorError) throw vendorError

  dbg('2 slug extraction', (vendors || []).map((row) => ({
    id: row.id,
    raw: row.dropvine_direct_url,
    extracted: slugFromUrl(row.dropvine_direct_url),
    comparedTo: normalizedSlug,
    equal: slugFromUrl(row.dropvine_direct_url) === normalizedSlug,
  })))
  const vendor = (vendors || []).find((row) => slugFromUrl(row.dropvine_direct_url) === normalizedSlug)
  dbg('3 vendor match', vendor ? { matched: true, vendor } : { matched: false })
  if (!vendor) return []

  const { data: links, error: linkError } = await supa
    .from('market_vendor_links')
    .select('market_id')
    .eq('vendor_id', vendor.id)
  dbg('4 market_vendor_links', { vendorId: vendor.id, error: linkError, rows: links })
  if (linkError) throw linkError

  const marketIds = Array.from(new Set((links || []).map((link) => link.market_id).filter(Boolean)))
  if (!marketIds.length) return []

  const { data: markets, error: marketError } = await supa
    .from('markets')
    .select('id, slug, name, city, state, status')
    .in('id', marketIds)
    .eq('status', 'published')
  dbg('5 markets (status=published)', { marketIds, error: marketError, rows: markets })
  if (marketError) throw marketError

  const publishedMarkets = markets || []
  if (!publishedMarkets.length) return []

  const today = todayIso()
  const { data: dates, error: dateError } = await supa
    .from('market_dates')
    .select('market_id, date, is_canceled')
    .in('market_id', publishedMarkets.map((market) => market.id))
    .gte('date', today)
    .or('is_canceled.is.null,is_canceled.eq.false')
  dbg('6 market_dates (upcoming, not canceled)', { today, error: dateError, rows: dates })
  if (dateError) throw dateError

  const activeMarketIds = new Set((dates || []).map((date) => date.market_id))
  dbg('7 final', publishedMarkets.filter((m) => activeMarketIds.has(m.id)).map((m) => ({ id: m.id, slug: m.slug })))
  return publishedMarkets
    .filter((market) => activeMarketIds.has(market.id) && market.slug)
    .map((market) => ({
      id: market.id,
      name: market.name,
      city: market.city,
      state: market.state,
      url: `https://www.dropvinemarkets.com/markets/${encodeURIComponent(market.slug)}`,
    }))
}