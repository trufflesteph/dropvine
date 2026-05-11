import { NextResponse } from 'next/server'
import { requireAdminRole, ADMIN_ROLES } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const SETTINGS_FIELDS = [
  'name','subtitle','season','primary_color','accent_color','logo_url','pwa_icon_url','pwa_short_name','pwa_theme_color','pwa_background_color',
  'map_booth_count','map_orientation','map_street_name','map_cross_street_start','map_cross_street_end',
  'venmo_platform_handle','contact_email','social_links','about_md',
]

// GET /api/market/admin/config — active market_config (for the settings page)
export async function GET(request) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const supa = getSupabaseAdmin()
  const { data, error } = await supa.from('market_config').select('*').eq('is_active', true).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data })
}

// PATCH /api/market/admin/config — update market settings (PLATFORM ROLE ONLY)
export async function PATCH(request) {
  const a = requireAdminRole(request, [ADMIN_ROLES.PLATFORM])
  if (!a.ok) return NextResponse.json({ error: a.error || 'platform role required' }, { status: a.status || 403 })
  const body = await request.json().catch(() => ({}))
  const updates = {}
  for (const k of SETTINGS_FIELDS) if (body[k] !== undefined) updates[k] = body[k]
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  const supa = getSupabaseAdmin()
  const { data: market } = await supa.from('market_config').select('id').eq('is_active', true).maybeSingle()
  if (!market) return NextResponse.json({ error: 'no active market' }, { status: 400 })
  const { data, error } = await supa.from('market_config').update(updates).eq('id', market.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data })
}
