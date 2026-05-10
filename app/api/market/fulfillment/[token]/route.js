import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// Helper — verify magic-link token
async function verifyToken(supa, token) {
  if (!token) return { error: 'missing token', status: 400 }
  const { data: row, error } = await supa
    .from('fulfillment_tokens').select('*').eq('token', token).maybeSingle()
  if (error) return { error: error.message, status: 500 }
  if (!row) return { error: 'invalid token', status: 404 }
  if (new Date(row.expires_at) < new Date()) return { error: 'expired', status: 410 }
  return { row }
}

// GET /api/market/fulfillment/[token]  → returns order + items + vendor
export async function GET(_request, { params }) {
  try {
    const token = params?.token
    const supa = getSupabaseAdmin()
    if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })
    const { row, error, status } = await verifyToken(supa, token)
    if (error) return NextResponse.json({ error }, { status })

    const { data: order } = await supa.from('orders').select('*').eq('id', row.order_id).maybeSingle()
    if (!order) return NextResponse.json({ error: 'order not found' }, { status: 404 })
    const [{ data: vendor }, { data: items }] = await Promise.all([
      supa.from('vendors').select('id, name, venmo_handle, booth_number').eq('id', order.vendor_id).maybeSingle(),
      supa.from('order_items').select('*').eq('order_id', order.id),
    ])
    return NextResponse.json({ order, vendor, items: items || [] })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 })
  }
}

// POST /api/market/fulfillment/[token] body: { action: 'payment_received' | 'fulfilled' | 'cancelled' }
export async function POST(request, { params }) {
  try {
    const token = params?.token
    const { action } = await request.json().catch(() => ({}))
    const supa = getSupabaseAdmin()
    if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })
    const { row, error, status } = await verifyToken(supa, token)
    if (error) return NextResponse.json({ error }, { status })

    const updates = {}
    if (action === 'payment_received') {
      updates.status = 'payment_received'
      updates.payment_received_at = new Date().toISOString()
    } else if (action === 'fulfilled') {
      updates.status = 'fulfilled'
      updates.fulfilled_at = new Date().toISOString()
    } else if (action === 'cancelled') {
      updates.status = 'cancelled'
    } else {
      return NextResponse.json({ error: 'invalid action' }, { status: 400 })
    }

    const { data: order, error: uErr } = await supa.from('orders').update(updates).eq('id', row.order_id).select('*').single()
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, order })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 })
  }
}
