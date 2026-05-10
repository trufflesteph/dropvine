import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// GET /api/market/pop/stamp-types — active stamp types for the active market
export async function GET() {
  try {
    const supa = getSupabaseAdmin()
    if (!supa) return NextResponse.json({ types: [] })
    const { data: market } = await supa.from('market_config').select('id').eq('is_active', true).maybeSingle()
    if (!market) return NextResponse.json({ types: [] })
    const { data, error } = await supa.from('pop_stamp_types')
      .select('*').eq('market_config_id', market.id).eq('is_active', true)
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ types: data || [] })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 })
  }
}
