import { createClient } from '@supabase/supabase-js'

function getMarketsClient() {
  const url = process.env.NEXT_PUBLIC_MARKETS_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_MARKETS_SUPABASE_ANON_KEY
  if (!url || !key) return null

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function slugFromUrl(value) {
  try {
    const path = new URL(value).pathname
    const match = path.match(/\/direct\/([^/]+)\/?$/i)
    return match ? decodeURIComponent(match[1]).trim().toLowerCase() : null
  } catch {
    return null
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export async function getActiveMarketsForDirectVendor(slug) {
  const supa = getMarketsClient()
  if (!supa || !slug) return []

  const { data: vendors, error: vendorError } = await supa
    .from('vendors')
    .select('id, dropvine_direct_url')
    .not('dropvine_direct_url', 'is', null)
  if (vendorError) throw vendorError

  const normalizedSlug = String(slug).trim().toLowerCase()
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
    .select('market_id, date, is_cancelled')
    .in('market_id', publishedMarkets.map((market) => market.id))
    .gte('date', todayIso())
    .or('is_cancelled.is.null,is_cancelled.eq.false')
  if (dateError) throw dateError

  const activeMarketIds = new Set((dates || []).map((date) => date.market_id))
  return publishedMarkets
    .filter((market) => activeMarketIds.has(market.id) && market.slug)
    .map((market) => ({
      id: market.id,
      name: market.name,
      city: market.city,
      state: market.state,
      url: `https://dropvinemarkets.com/market/${encodeURIComponent(market.slug)}`,
    }))
}