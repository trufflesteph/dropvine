import { NextResponse } from 'next/server'
import { getActiveMarketsForDirectVendor } from '@/lib/markets/direct-vendor-markets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// TEMP DEBUG — remove once the empty-markets issue is resolved. Exposes only
// non-secret facts about the Markets env vars; never the key itself.
function marketsEnvDebug(errorMessage) {
  const url = process.env.NEXT_PUBLIC_MARKETS_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_MARKETS_SUPABASE_ANON_KEY
  let urlHost = null
  try { urlHost = new URL(url).host } catch {}
  let anonKeyRef = null
  try {
    const payload = JSON.parse(Buffer.from(String(key).split('.')[1], 'base64url').toString('utf8'))
    anonKeyRef = typeof payload?.ref === 'string' ? payload.ref : null
  } catch {}
  return {
    urlSet: !!url,
    urlHost,
    anonKeySet: !!key,
    anonKeyLength: key ? key.length : 0,
    anonKeyRef,
    error: errorMessage,
  }
}

export async function GET(request, { params }) {
  const slug = String(params?.slug || '').trim().toLowerCase()
  const debug = new URL(request.url).searchParams.get('debug') === '1'
  if (!slug) return NextResponse.json({ markets: [] })

  let markets = []
  let errorMessage = null
  try {
    markets = await getActiveMarketsForDirectVendor(slug)
  } catch (err) {
    errorMessage = err?.message || String(err)
    console.error('[markets] lookup failed for', slug, errorMessage)
    if (!debug) return NextResponse.json({ markets: [] })
  }

  if (debug) {
    return NextResponse.json({ markets, debug: marketsEnvDebug(errorMessage) }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }
  return NextResponse.json({ markets }, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=900' },
  })
}