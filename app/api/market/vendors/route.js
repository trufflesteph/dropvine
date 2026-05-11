import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// GET /api/market/vendors
// Returns all active vendors for the active market.
// Optional query: ?category=coffee&q=brook
export async function GET(request) {
  try {
    const supa = getSupabaseAdmin()
    if (!supa) return NextResponse.json({ vendors: [], error: 'supabase_not_configured' })

    const { data: market } = await supa
      .from('market_config')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    if (!market) return NextResponse.json({ vendors: [] })

    const url = new URL(request.url)
    const category = url.searchParams.get('category')
    const q = url.searchParams.get('q')

    let query = supa
      .from('vendors')
      .select('id, name, slug, tagline, description, categories, logo_url, cover_url, booth_number, accepts_preorders, instagram_handle')
      .eq('market_config_id', market.id)
      .eq('is_active', true)
      .order('booth_number', { ascending: true, nullsFirst: false })

    if (category) query = query.contains('categories', [category])
    if (q) query = query.ilike('name', `%${q}%`)

    const { data, error } = await query
    if (error) return NextResponse.json({ vendors: [], error: error.message })
    return NextResponse.json({ vendors: data || [] })
  } catch (e) {
    return NextResponse.json({ vendors: [], error: e?.message || 'unknown' })
  }
}
