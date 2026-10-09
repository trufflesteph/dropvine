import { NextResponse } from 'next/server'
import { getActiveMarketsForDirectVendor } from '@/lib/markets/direct-vendor-markets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request, { params }) {
  const slug = String(params?.slug || '').trim().toLowerCase()
  if (!slug) return NextResponse.json({ markets: [] })

  try {
    const markets = await getActiveMarketsForDirectVendor(slug)
    // Never cache an empty result, so a transient miss doesn't stick at the CDN.
    return NextResponse.json({ markets }, {
      headers: {
        'Cache-Control': markets.length ? 's-maxage=300, stale-while-revalidate=900' : 'no-store',
      },
    })
  } catch (err) {
    console.error('[markets] lookup failed for', slug, err?.message || err)
    return NextResponse.json({ markets: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
