import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const ALLOWED_STATUS = ['pending_payment', 'payment_received', 'fulfilled', 'cancelled', 'refunded']

// GET /api/market/admin/orders/[id] — full order with items
export async function GET(request, { params }) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const supa = getSupabaseAdmin()
  const { data, error } = await supa.from('orders')
    .select('*, vendors:vendor_id(name, slug, venmo_handle, booth_number), order_items(*)')
    .eq('id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ order: data })
}

// PATCH /api/market/admin/orders/[id]  body: { status, admin_note? }
export async function PATCH(request, { params }) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const body = await request.json().catch(() => ({}))
  const updates = {}
  if (body.status !== undefined) {
    if (!ALLOWED_STATUS.includes(body.status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    }
    updates.status = body.status
    // Stamp transition timestamps when columns exist (best-effort, ignored if absent)
    if (body.status === 'payment_received') updates.paid_at = new Date().toISOString()
    if (body.status === 'fulfilled') updates.fulfilled_at = new Date().toISOString()
    if (body.status === 'cancelled') updates.cancelled_at = new Date().toISOString()
  }
  if (body.admin_note !== undefined) updates.admin_note = body.admin_note
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }
  const supa = getSupabaseAdmin()
  // Try with all updates; if it fails because of an unknown column (e.g. paid_at not in schema),
  // retry with only `status` so the panel still works against older schemas.
  let { data, error } = await supa.from('orders').update(updates).eq('id', params.id).select('*').single()
  if (error && /(column .* does not exist|could not find.*column)/i.test(error.message)) {
    const minimal = { status: updates.status }
    const retry = await supa.from('orders').update(minimal).eq('id', params.id).select('*').single()
    data = retry.data; error = retry.error
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ order: data })
}
