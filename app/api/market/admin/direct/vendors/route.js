import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/market/admin/direct/vendors
// Returns all direct_vendors (active + inactive), most-recent first, with a
// joined profile for the linked creator.
export async function GET(request) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const supa = getSupabaseAdmin()
  const { data: vendors, error } = await supa.from('direct_vendors')
    .select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const creatorIds = Array.from(new Set((vendors || []).map((v) => v.creator_id).filter(Boolean)))
  let profileMap = new Map()
  if (creatorIds.length) {
    const { data: profiles } = await supa.from('profiles')
      .select('id, email, display_name, full_name').in('id', creatorIds)
    profileMap = new Map((profiles || []).map((p) => [p.id, p]))
  }
  const enriched = (vendors || []).map((v) => ({ ...v, profile: profileMap.get(v.creator_id) || null }))
  return NextResponse.json({ vendors: enriched })
}

// POST /api/market/admin/direct/vendors
// Body: { business_name, slug, creator_email?, creator_id?, bio?, logo_url?,
//         photo_url?, venmo_handle?, instagram_url?, website_url?, tier?, active? }
export async function POST(request) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const body = await request.json().catch(() => ({}))
  if (!body.business_name || !body.slug) {
    return NextResponse.json({ error: 'business_name and slug are required' }, { status: 400 })
  }
  const supa = getSupabaseAdmin()

  // Resolve creator_id from email if provided
  let creatorId = body.creator_id || null
  if (!creatorId && body.creator_email) {
    const { data: p } = await supa.from('profiles').select('id')
      .eq('email', String(body.creator_email).trim().toLowerCase()).maybeSingle()
    if (p) creatorId = p.id
  }

  const payload = {
    business_name: body.business_name,
    slug: body.slug,
    creator_id: creatorId,
    bio: body.bio ?? null,
    logo_url: body.logo_url ?? null,
    photo_url: body.photo_url ?? null,
    venmo_handle: body.venmo_handle ? String(body.venmo_handle).replace(/^@/, '') : null,
    instagram_url: body.instagram_url ?? null,
    website_url: body.website_url ?? null,
    tier: body.tier || 'free',
    active: body.active !== false,
  }
  const { data, error } = await supa.from('direct_vendors').insert(payload).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vendor: data })
}
