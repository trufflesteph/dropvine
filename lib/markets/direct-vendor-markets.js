import { createClient } from '@supabase/supabase-js'

function getMarketsClient() {
  const url = process.env.NEXT_PUBLIC_MARKETS_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_MARKETS_SUPABASE_ANON_KEY
  if (!url || !key) return null

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

export async function getActiveMarketsForDirectVendor(slug) {
  const supa = getMarketsClient()
  if (!supa || !slug) return []

  const normalizedSlug = String(slug).trim().toLowerCase()
  // Narrow server-side with a substring match, then confirm an exact slug match
  // below so "/direct/foo" never matches "/direct/foo-bar".
  const likeSlug = normalizedSlug.replace(/[\\%_]/g, (c) => `\\${c}`)
  const { data: vendors, error: vendorError } = await supa
    .from('vendors')
    .select('id, dropvine_direct_url')
    .ilike('dropvine_direct_url', `%/direct/${likeSlug}%`)
  if (vendorError) throw vendorError

  const vendor = (vendors || []).find((row) => slugFromUrl(row.dropvine_direct_url) === normalizedSlug)
  if (!vendor) return []

  const { data: links, error: linkError } = await supa
    .from('market_vendor_links')
    .select('market_id')
    .eq('vendor_id', vendor.id)
  if (linkError) throw linkError

  const marketIds = Array.from(new Set((links || []).map((link) => link.market_id).filter(Boolean)))
  if (!marketIds.length) return []

  const { data: markets, error: marketError } = await supa
    .from('markets')
    .select('id, slug, name, city, state, status')
    .in('id', marketIds)
    .eq('status', 'published')
  if (marketError) throw marketError

  const publishedMarkets = markets || []
  if (!publishedMarkets.length) return []

  const { data: dates, error: dateError } = await supa
    .from('market_dates')
    .select('market_id, date, is_canceled')
    .in('market_id', publishedMarkets.map((market) => market.id))
    .gte('date', todayIso())
    .or('is_canceled.is.null,is_canceled.eq.false')
  if (dateError) throw dateError

  const activeMarketIds = new Set((dates || []).map((date) => date.market_id))
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