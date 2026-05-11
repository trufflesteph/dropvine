import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// GET /api/market/dates
export async function GET() {
  try {
    const supa = getSupabaseAdmin()
    if (!supa) return NextResponse.json({ dates: [] })

    const { data: market } = await supa
      .from('market_config')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    if (!market) return NextResponse.json({ dates: [] })

    const { data, error } = await supa
      .from('market_dates')
      .select('id, date, start_time, end_time, is_cancelled, notes, weather_forecast')
      .eq('market_config_id', market.id)
      .order('date', { ascending: true })

    if (error) return NextResponse.json({ dates: [], error: error.message })
    return NextResponse.json({ dates: data || [] })
  } catch (e) {
    return NextResponse.json({ dates: [], error: e?.message || 'unknown' })
  }
}
