import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { notifyMarketVendorOrderArrived } from '@/lib/notifications'

// POST /api/market/admin/vendors/[id]/regenerate-fulfillment-links
//
// Re-issues fulfillment magic-link tokens for every open order belonging to
// this vendor in the last 30 days (status IN pending_payment, payment_received).
// Existing live tokens are marked used_at=now() so the old links stop working.
// Then re-emails the vendor with the fresh links via
// notifyMarketVendorOrderArrived (one email per order).
//
// Body: {} (no parameters needed).
// Returns: { ok, vendor, summary: { orders_processed, emails_sent, errors: [] } }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function makeToken() { return crypto.randomBytes(32).toString('base64url') }

export async function POST(request, { params }) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })

  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const { data: vendor, error: vErr } = await supa
    .from('vendors').select('*').eq('id', params.id).maybeSingle()
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })
  if (!vendor) return NextResponse.json({ error: 'vendor not found' }, { status: 404 })
  if (!vendor.email) {
    return NextResponse.json({ error: 'vendor has no email on file — add one in Contact before resending links.' }, { status: 400 })
  }

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const { data: orders, error: oErr } = await supa.from('orders')
    .select('*')
    .eq('vendor_id', vendor.id)
    .in('status', ['pending_payment', 'payment_received'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin
  const { data: market } = await supa.from('market_config').select('name').eq('is_active', true).maybeSingle()

  const summary = { orders_processed: 0, emails_sent: 0, errors: [] }

  for (const order of orders || []) {
    // Invalidate any live tokens for this order
    await supa.from('fulfillment_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('order_id', order.id).is('used_at', null)

    const token = makeToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    const { error: tErr } = await supa.from('fulfillment_tokens').insert({
      order_id: order.id, token, expires_at: expiresAt,
    })
    if (tErr) { summary.errors.push({ order: order.short_code, error: tErr.message }); continue }
    summary.orders_processed++

    const { data: items } = await supa.from('order_items').select('*').eq('order_id', order.id)
    const { data: mDate } = order.market_date_id
      ? await supa.from('market_dates').select('date').eq('id', order.market_date_id).maybeSingle()
      : { data: null }

    const magicUrl = `${(baseUrl || '').replace(/\/$/, '')}/market/fulfillment/${token}`
    const result = await notifyMarketVendorOrderArrived({
      order, vendor, items: items || [], magicUrl,
      marketName: market?.name || 'Market',
      marketDate: mDate?.date || null,
    })
    const r = (result || []).find((x) => x.channel === 'email')
    if (r?.id) summary.emails_sent++
    else if (r?.error) summary.errors.push({ order: order.short_code, error: r.error })
  }

  return NextResponse.json({
    ok: true,
    vendor: { id: vendor.id, name: vendor.name, email: vendor.email },
    summary,
  })
}
