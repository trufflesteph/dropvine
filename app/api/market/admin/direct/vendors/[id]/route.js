import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { normalizeLocationEdit, locationKey } from '@/lib/location'

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
  const supa = getSupabaseAdmin()
  const updates = {}
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED.has(k)) {
      if (k === 'venmo_handle' && typeof v === 'string') updates[k] = v.replace(/^@/, '')
      else updates[k] = v
    }
  }
  // Location, normalized like every other write (lib/location.js). The
  // editor sends the whole row on every save, so it's only validated and
  // written when it differs from what's stored; a missing field keeps its
  // stored value. City and state go together, or both blank to clear.
  if ('location_city' in body || 'location_state' in body) {
    const { data: current, error: readError } = await supa.from('direct_vendors')
      .select('location_city, location_state').eq('id', params.id).maybeSingle()
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
    const location = normalizeLocationEdit(
      'location_city' in body ? body.location_city : current?.location_city,
      'location_state' in body ? body.location_state : current?.location_state,
    )
    const unchanged = current && locationKey(current.location_city, current.location_state) === locationKey(location.city, location.state)
    if (!unchanged) {
      if (location.error) return NextResponse.json({ error: location.error }, { status: 400 })
      updates.location_city = location.city || null
      updates.location_state = location.state || null
    }
  }
  // Allow re-binding by email
  if (body.creator_email) {
    const { data: p } = await supa.from('profiles').select('id')
      .eq('email', String(body.creator_email).trim().toLowerCase()).maybeSingle()
    updates.creator_id = p?.id || null
  }
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'no fields' }, { status: 400 })
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
