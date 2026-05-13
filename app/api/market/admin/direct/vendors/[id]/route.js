import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = new Set([
  'business_name','slug','bio','logo_url','photo_url',
  'venmo_handle','instagram_url','website_url','tier','active','creator_id',
])

export async function GET(request, { params }) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const supa = getSupabaseAdmin()
  const { data: vendor, error } = await supa.from('direct_vendors')
    .select('*').eq('id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!vendor) return NextResponse.json({ error: 'not found' }, { status: 404 })
  let profile = null
  if (vendor.creator_id) {
    const { data } = await supa.from('profiles')
      .select('id, email, display_name, full_name').eq('id', vendor.creator_id).maybeSingle()
    profile = data || null
  }
  return NextResponse.json({ vendor, profile })
}

export async function PATCH(request, { params }) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const body = await request.json().catch(() => ({}))
  const updates = {}
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED.has(k)) {
      if (k === 'venmo_handle' && typeof v === 'string') updates[k] = v.replace(/^@/, '')
      else updates[k] = v
    }
  }
  // Allow re-binding by email
  if (body.creator_email) {
    const supa = getSupabaseAdmin()
    const { data: p } = await supa.from('profiles').select('id')
      .eq('email', String(body.creator_email).trim().toLowerCase()).maybeSingle()
    updates.creator_id = p?.id || null
  }
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'no fields' }, { status: 400 })
  const supa = getSupabaseAdmin()
  const { data, error } = await supa.from('direct_vendors')
    .update(updates).eq('id', params.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vendor: data })
}

// DELETE = soft-delete (active=false)
export async function DELETE(request, { params }) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const supa = getSupabaseAdmin()
  const { data, error } = await supa.from('direct_vendors')
    .update({ active: false }).eq('id', params.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vendor: data })
}
