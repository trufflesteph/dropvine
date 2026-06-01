// POST /api/drops/[handle]/preorder
//
// Creates a pre-order / deposit drop_order row with status='pending_payment'
// and emails the shopper a Venmo-payment receipt. Used by the public
// /l/[handle] page when collection_mode is 'pre-order' or 'deposit'.
//
// Body:
//   {
//     email:      string (required),
//     name?:      string,
//     phone?:     string,
//     venmo_note: string (required, the unique <handle>-XXXX note the shopper
//                        sent the payment with),
//
//     // Multi-product mode (preferred when the drop has drop_products):
//     items?:     [{ launch_product_id: uuid, quantity: int }],
//
//     // Single-product mode (legacy fallback when no drop_products exist):
//     quantity?:  integer (default 1),
//   }
//
// Returns 201 with the created order + its order_items, OR 400/409/422 on
// validation errors. NEVER 500s on email failure — order row is saved first.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { sendDropOrderConfirmation } from '@/lib/email/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normEmail(s) { return typeof s === 'string' ? s.trim().toLowerCase() : '' }
function isValidEmail(s) { return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) }
function normNote(s) { return typeof s === 'string' ? s.trim().slice(0, 64) : '' }

export async function POST(request, { params }) {
  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const email = normEmail(body.email)
  const venmoNote = normNote(body.venmo_note)
  if (!isValidEmail(email)) return NextResponse.json({ error: 'invalid email' }, { status: 400 })
  if (!venmoNote) return NextResponse.json({ error: 'missing venmo_note' }, { status: 400 })

  // Look up the drop.
  const { data: drop, error: gErr } = await supa
    .from('drops').select('*').eq('handle', params.handle).maybeSingle()
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
  if (!drop) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (drop.status !== 'published') {
    return NextResponse.json({ error: 'drop is not accepting orders yet' }, { status: 422 })
  }
  const mode = (drop.collection_mode || '').toLowerCase()
  if (mode !== 'pre-order' && mode !== 'deposit') {
    return NextResponse.json({ error: 'this drop does not accept Venmo orders' }, { status: 422 })
  }
  if (!drop.venmo_handle) {
    return NextResponse.json({ error: 'this drop has no Venmo handle configured' }, { status: 422 })
  }

  // Load multi-product catalogue (may be empty → legacy single-product path).
  let products = []
  try {
    const { data: prods, error: pErr } = await supa
      .from('drop_products').select('*')
      .eq('drop_id', drop.id).order('sort_order', { ascending: true })
    if (!pErr && Array.isArray(prods)) products = prods
  } catch {}

  // --- Resolve the line items + totals --------------------------------------
  // If the drop has products AND the client sent an items[] array, validate
  // each line, enforce per-product hard caps from drop_products.quantity,
  // and snapshot price into order_items.
  // Else (no products OR items[] empty/missing), fall back to single-SKU mode
  // using drops.price_cents + a top-level quantity.

  let totalCents = 0
  let totalQty = 0
  let depositCents = null
  let balanceCents = null
  let orderItemRows = [] // { launch_product_id, product_name, price_cents, quantity }

  const incomingItems = Array.isArray(body.items) ? body.items : []
  const multiMode = products.length > 0 && incomingItems.length > 0

  if (multiMode) {
    const byId = new Map(products.map((p) => [p.id, p]))
    for (const raw of incomingItems) {
      const pid = typeof raw?.launch_product_id === 'string' ? raw.launch_product_id : null
      const prod = pid ? byId.get(pid) : null
      if (!prod) continue
      let q = parseInt(raw?.quantity ?? '0', 10)
      if (!Number.isFinite(q) || q <= 0) continue
      // Hard cap per product. Quantity null = unlimited.
      if (prod.quantity != null && prod.quantity > 0) q = Math.min(q, prod.quantity)
      orderItemRows.push({
        launch_product_id: prod.id,
        product_name: prod.name,
        price_cents: parseInt(prod.price_cents || 0, 10),
        quantity: q,
      })
      totalQty += q
      totalCents += (parseInt(prod.price_cents || 0, 10) * q)
    }
    if (!orderItemRows.length) {
      return NextResponse.json({ error: 'no valid items selected' }, { status: 400 })
    }
    if (mode === 'deposit') {
      // Per-unit deposit applies to the whole basket count.
      depositCents = parseInt(drop.reservation_hold_cents || 0, 10) * totalQty
      balanceCents = Math.max(0, totalCents - depositCents)
    }
  } else {
    // Legacy single-product mode.
    let quantity = parseInt(body.quantity ?? '1', 10)
    if (Number.isNaN(quantity) || quantity < 1) quantity = 1
    if (drop.capacity && drop.capacity > 0) quantity = Math.min(quantity, drop.capacity)
    const unit = parseInt(drop.price_cents || 0, 10)
    totalQty = quantity
    totalCents = unit * quantity
    if (mode === 'deposit') {
      depositCents = parseInt(drop.reservation_hold_cents || 0, 10) * quantity
      balanceCents = Math.max(0, totalCents - depositCents)
    }
    // Snapshot a single synthetic line item using the drop title — so the
    // email + admin UI can still itemise consistently even in legacy mode.
    orderItemRows.push({
      launch_product_id: null,
      product_name: drop.title || 'Drop',
      price_cents: unit,
      quantity,
    })
  }

  // Unit price column on drop_orders: keep the OLD semantic (per-unit cost
  // of one item) for legacy compatibility. In multi-mode it's a weighted avg
  // when totalQty > 0, otherwise 0.
  const unitPrice = totalQty > 0 ? Math.round(totalCents / totalQty) : 0

  const insertPayload = {
    drop_id: drop.id,
    shopper_email: email,
    shopper_name: typeof body.name === 'string' ? body.name.trim().slice(0, 120) : null,
    shopper_phone: typeof body.phone === 'string' ? body.phone.trim().slice(0, 32) : null,
    quantity: totalQty,
    unit_price_cents: unitPrice,
    total_cents: totalCents,
    deposit_cents: depositCents,
    balance_cents: balanceCents,
    venmo_handle: drop.venmo_handle,
    venmo_note: venmoNote,
    collection_mode: mode,
    status: 'pending_payment',
  }

  const { data: order, error: iErr } = await supa
    .from('drop_orders').insert(insertPayload).select('*').single()
  if (iErr) {
    // Unique violation — client probably double-clicked. Surface the existing row.
    if (/duplicate key value|unique constraint/i.test(iErr.message)) {
      const { data: existing } = await supa
        .from('drop_orders').select('*')
        .eq('drop_id', drop.id).eq('venmo_note', venmoNote).maybeSingle()
      if (existing) {
        // Best-effort: return existing line items too.
        const { data: existItems } = await supa
          .from('order_items').select('*').eq('order_id', existing.id)
          .order('created_at', { ascending: true })
        return NextResponse.json({ ok: true, order: existing, items: existItems || [], duplicate: true }, { status: 200 })
      }
    }
    if (/relation .* does not exist|could not find the table|schema cache/i.test(iErr.message)) {
      return NextResponse.json({
        error: 'orders table not provisioned yet',
        hint: 'Run supabase/migrations/2026-06-drop-orders.sql',
      }, { status: 503 })
    }
    return NextResponse.json({ error: iErr.message }, { status: 500 })
  }

  // Insert line items (best-effort — never blocks the order). If drop_order_items
  // table is missing, log + continue so the legacy single-row UI keeps working.
  let insertedItems = []
  try {
    const itemsPayload = orderItemRows.map((r) => ({ order_id: order.id, ...r }))
    const { data: items, error: itErr } = await supa
      .from('drop_order_items').insert(itemsPayload).select('*')
    if (itErr) {
      if (/could not find the table|relation .* does not exist|schema cache/i.test(itErr.message)) {
        console.warn('[drops/preorder] drop_order_items table missing — run supabase/migrations/2026-06-multi-product.sql')
      } else {
        console.warn('[drops/preorder] drop_order_items insert failed (non-fatal):', itErr.message)
      }
    } else insertedItems = items || []
  } catch (e) {
    console.warn('[drops/preorder] drop_order_items unexpected:', e?.message)
  }

  // Fire confirmation email — non-blocking failure.
  try {
    await sendDropOrderConfirmation({
      order, drop, items: insertedItems, to: email,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin,
    })
  } catch (e) {
    console.warn('[drops/preorder] email failed:', e?.message)
  }

  return NextResponse.json({ ok: true, order, items: insertedItems }, { status: 201 })
}
