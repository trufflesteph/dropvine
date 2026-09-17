import { NextResponse } from 'next/server'
import { getActiveMarketsForDirectVendor } from '@/lib/markets/direct-vendor-markets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request, { params }) {
  const slug = String(params?.slug || '').trim().toLowerCase()
  if (!slug) return NextResponse.json({ markets: [] })

  try {
    const markets = await getActiveMarketsForDirectVendor(slug)
    return NextResponse.json({ markets }, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=900' },
    })
  } catch {
    return NextResponse.json({ markets: [] })
  }
}