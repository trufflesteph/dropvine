import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase/server'
import {
  notifyMarketOrderPlaced,
  notifyMarketVendorOrderArrived,
} from '@/lib/notifications'

function buildVenmoUrl({ handle, amountCents, note }) {
  if (!handle) return null
  const amount = ((amountCents || 0) / 100).toFixed(2)
  const params = new URLSearchParams({ txn: 'pay', amount, note: note || '' })
  return `https://venmo.com/${encodeURIComponent(String(handle).replace(/^@/, ''))}?${params.toString()}`
}

function generateToken(len = 32) {
  return crypto.randomBytes(len).toString('base64url')
}

// POST /api/market/orders
// Body: { vendor_id, market_date_id?, items: [{product_id, quantity}], shopper: {email, name, phone?}, notes? }
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { vendor_id, market_date_id, items = [], shopper = {}, notes } = body || {}

    if (!vendor_id) return NextResponse.json({ error: 'missing vendor_id' }, { status: 400 })
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'empty cart' }, { status: 400 })
    if (!shopper?.email) return NextResponse.json({ error: 'shopper.email is required' }, { status: 400 })

    const supa = getSupabaseAdmin()
    if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

    // Pull vendor + market for context
    const { data: vendor, error: vErr } = await supa
      .from('vendors').select('*').eq('id', vendor_id).eq('is_active', true).maybeSingle()
    if (vErr || !vendor) return NextResponse.json({ error: 'vendor not found' }, { status: 404 })
    if (!vendor.accepts_preorders) return NextResponse.json({ error: 'vendor does not accept pre-orders' }, { status: 400 })
    if (!vendor.venmo_handle) return NextResponse.json({ error: 'vendor has no Venmo handle' }, { status: 400 })

    const { data: market } = await supa.from('market_config').select('id, name').eq('is_active', true).maybeSingle()

    // Snapshot product prices server-side
    const productIds = items.map((i) => i.product_id)
    const { data: products, error: pErr } = await supa
      .from('products').select('*')
      .in('id', productIds).eq('vendor_id', vendor.id).eq('is_available', true)
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
    if (!products?.length) return NextResponse.json({ error: 'no valid products' }, { status: 400 })

    const productMap = new Map(products.map((p) => [p.id, p]))
    const lines = []
    let subtotal = 0
    for (const it of items) {
      const p = productMap.get(it.product_id)
      if (!p) continue
      const qty = Math.max(1, Math.min(99, parseInt(it.quantity, 10) || 1))
      const lineTotal = (p.price_cents || 0) * qty
      subtotal += lineTotal
      lines.push({
        product_id: p.id,
        product_name_snapshot: p.name,
        quantity: qty,
        unit_price_cents: p.price_cents || 0,
        line_total_cents: lineTotal,
      })
    }
    if (lines.length === 0) return NextResponse.json({ error: 'no valid items' }, { status: 400 })

    // Resolve shopper_id if signed in
    let shopperId = null
    try {
      const sb = getSupabaseServer()
      if (sb) {
        const { data } = await sb.auth.getUser()
        shopperId = data?.user?.id || null
      }
    } catch { /* ignore */ }

    // Insert order row
    const { data: orderRow, error: oErr } = await supa
      .from('orders').insert({
        shopper_id: shopperId,
        vendor_id: vendor.id,
        market_date_id: market_date_id || null,
        subtotal_cents: subtotal,
        total_cents: subtotal,
        status: 'pending_payment',
        shopper_email: shopper.email,
        shopper_name: shopper.name || null,
        shopper_phone: shopper.phone || null,
        notes: notes || null,
      }).select('*').single()
    if (oErr || !orderRow) return NextResponse.json({ error: oErr?.message || 'order insert failed' }, { status: 500 })

    const venmoNote = `Order #${orderRow.short_code}`
    await supa.from('orders').update({ venmo_note: venmoNote }).eq('id', orderRow.id)

    // Insert order items
    const itemRows = lines.map((l) => ({ order_id: orderRow.id, ...l }))
    const { data: insertedItems, error: iErr } = await supa.from('order_items').insert(itemRows).select('*')
    if (iErr) console.warn('[orders] item insert failed', iErr.message)

    // Generate fulfillment magic-link token (30-day expiry)
    const token = generateToken(24)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await supa.from('fulfillment_tokens').insert({
      order_id: orderRow.id, token, expires_at: expiresAt,
    })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
    const venmoUrl = buildVenmoUrl({ handle: vendor.venmo_handle, amountCents: subtotal, note: venmoNote })
    const magicUrl = `${baseUrl.replace(/\/$/, '')}/market/fulfillment/${token}`

    // Fire emails (non-blocking, but await briefly so we surface obvious failures)
    const finalOrder = { ...orderRow, venmo_note: venmoNote }
    Promise.all([
      notifyMarketOrderPlaced({ order: finalOrder, vendor, items: insertedItems || itemRows, venmoUrl, marketName: market?.name }),
      notifyMarketVendorOrderArrived({ order: finalOrder, vendor, items: insertedItems || itemRows, magicUrl, marketName: market?.name, marketDate: null }),
    ]).catch((e) => console.warn('[orders] notify error', e?.message))

    return NextResponse.json({
      ok: true,
      order_id: orderRow.id,
      short_code: orderRow.short_code,
      total_cents: subtotal,
      venmo_url: venmoUrl,
      venmo_note: venmoNote,
    })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 })
  }
}
