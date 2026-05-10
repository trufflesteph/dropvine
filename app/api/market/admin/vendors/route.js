import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// GET /api/market/admin/vendors — list ALL vendors (active + inactive)
export async function GET(request) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const supa = getSupabaseAdmin()
  const { data: market } = await supa.from('market_config').select('id').eq('is_active', true).maybeSingle()
  if (!market) return NextResponse.json({ vendors: [] })
  const { data, error } = await supa.from('vendors').select('*')
    .eq('market_config_id', market.id)
    .order('booth_number', { ascending: true, nullsFirst: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vendors: data || [] })
}

// POST /api/market/admin/vendors — create a vendor
export async function POST(request) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const body = await request.json().catch(() => ({}))
  if (!body?.name || !body?.slug) return NextResponse.json({ error: 'name and slug required' }, { status: 400 })
  const supa = getSupabaseAdmin()
  const { data: market } = await supa.from('market_config').select('id').eq('is_active', true).maybeSingle()
  if (!market) return NextResponse.json({ error: 'no active market' }, { status: 400 })
  const insertable = pickVendorFields(body)
  insertable.market_config_id = market.id
  const { data, error } = await supa.from('vendors').insert(insertable).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vendor: data })
}

function pickVendorFields(b) {
  const out = {}
  const allowed = ['name','slug','tagline','description','logo_url','cover_url','categories','venmo_handle','email','phone','website','instagram_handle','accepts_preorders','booth_number','is_active']
  for (const k of allowed) if (b[k] !== undefined) out[k] = b[k]
  return out
}
export { pickVendorFields }
