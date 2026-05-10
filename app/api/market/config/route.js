import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// Returns the single active market configuration row.
// Public — read-only. Used by MarketConfigProvider on the client.
export async function GET() {
  try {
    const supa = getSupabaseAdmin()
    if (!supa) {
      return NextResponse.json({ config: null, error: 'supabase_not_configured' }, { status: 200 })
    }

    const { data, error } = await supa
      .from('market_config')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (error) {
      // Likely the markets schema hasn't been applied yet — return null gracefully.
      return NextResponse.json({ config: null, error: error.message }, { status: 200 })
    }

    return NextResponse.json({ config: data || null }, {
      status: 200,
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' },
    })
  } catch (e) {
    return NextResponse.json({ config: null, error: e?.message || 'unknown' }, { status: 200 })
  }
}
