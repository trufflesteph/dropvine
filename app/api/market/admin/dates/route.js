import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(request) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const supa = getSupabaseAdmin()
  const { data: market } = await supa.from('market_config').select('id').eq('is_active', true).maybeSingle()
  if (!market) return NextResponse.json({ dates: [] })
  const { data, error } = await supa.from('market_dates').select('*')
    .eq('market_config_id', market.id).order('date', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dates: data || [] })
}
