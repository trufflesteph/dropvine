import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// GET /api/market/orders/[shortCode]
// Public lookup by the order's short_code so the shopper can refresh the
// confirmation page and re-open the Venmo deep link. Returns the safe subset
// of fields (never exposes shopper PII for other users — the URL itself acts
// as the access token; if the user shares their short_code that's their call).
export async function GET(_request, { params }) {
  try {
    const code = params?.shortCode
    if (!code) return NextResponse.json({ error: 'missing code' }, { status: 400 })
    const supa = getSupabaseAdmin()
    if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

    const { data: order, error } = await supa
      .from('orders')
      .select('id, short_code, vendor_id, total_cents, status, venmo_note, payment_received_at, fulfilled_at, created_at, shopper_email, shopper_name, pickup_window')
      .eq('short_code', code)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const [{ data: vendor }, { data: items }] = await Promise.all([
      supa.from('vendors').select('id, name, slug, venmo_handle, booth_number, instagram_handle').eq('id', order.vendor_id).maybeSingle(),
      supa.from('order_items').select('*').eq('order_id', order.id),
    ])

    const amount = ((order.total_cents || 0) / 100).toFixed(2)
    const venmoUrl = vendor?.venmo_handle
      ? `https://venmo.com/${encodeURIComponent(vendor.venmo_handle.replace(/^@/, ''))}?txn=pay&amount=${amount}&note=${encodeURIComponent(order.venmo_note || `Order #${order.short_code}`)}`
      : null

    return NextResponse.json({ order, vendor, items: items || [], venmo_url: venmoUrl })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 })
  }
}
