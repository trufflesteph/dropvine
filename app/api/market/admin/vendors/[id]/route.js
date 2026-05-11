import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const ALLOWED = ['name','slug','tagline','description','logo_url','cover_url','categories','venmo_handle','email','phone','website','instagram_handle','accepts_preorders','booth_number','is_active']
function pickFields(b) {
  const out = {}
  for (const k of ALLOWED) if (b[k] !== undefined) out[k] = b[k]
  return out
}

// GET /api/market/admin/vendors/[id]  — detail with products + posts
export async function GET(request, { params }) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const supa = getSupabaseAdmin()
  const { data: vendor, error } = await supa.from('vendors').select('*').eq('id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!vendor) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const [productsRes, postsRes] = await Promise.all([
    supa.from('products').select('*').eq('vendor_id', vendor.id).order('display_order'),
    supa.from('vendor_posts').select('*').eq('vendor_id', vendor.id).order('posted_at', { ascending: false }),
  ])
  return NextResponse.json({ vendor, products: productsRes.data || [], posts: postsRes.data || [] })
}

export async function PATCH(request, { params }) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const body = await request.json().catch(() => ({}))
  const updates = pickFields(body)
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  const supa = getSupabaseAdmin()
  const { data, error } = await supa.from('vendors').update(updates).eq('id', params.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vendor: data })
}

export async function DELETE(request, { params }) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const supa = getSupabaseAdmin()
  // Soft-delete (preserves order history)
  const { data, error } = await supa.from('vendors').update({ is_active: false }).eq('id', params.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vendor: data })
}
