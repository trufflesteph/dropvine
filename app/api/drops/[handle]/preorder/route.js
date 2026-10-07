// POST /api/drops/[handle]/preorder
//
// Honor-system checkout. Creates a pre-order / deposit drop_order row with
// status='pending_payment' the moment the shopper submits the form, and emails
// them the Venmo payment details. The vendor confirms payment later (admin
// "Mark paid"). Used by the public /l/[handle] page when collection_mode is
// 'pre-order' or 'deposit'.
//
// The Venmo memo is generated here ("<handle>-XXXXXX"), unique per drop.
//
// Duplicate submissions: the page sends one `client_request_id` per checkout.
// A repeat of the same id for the same drop returns the existing order's
// code, memo, amount and Venmo handle, and never the shopper's name, email or
// phone. Needs drop_orders.client_request_id + its unique index (see the
// 2026-09 SQL); orders created before it have a null id and are never matched.
//
// Stock: the order and its line items are created by the create_drop_order()
// Postgres function (2026-09-drop-order-stock.sql), which locks the drop's
// stock, checks availability for every item and inserts everything in one
// transaction. Short stock → 409 naming the product and how many are left,
// with nothing inserted. An order never exists without its items.
//
// NOTE on `launch_product_id`: this is the actual column name on the
// `drop_order_items` table (created by 2026-06-multi-product.sql). The
// June 2026 launches→drops rename migration deliberately did NOT rename
// this column, so the code below uses `launch_product_id` to match the
// live DB schema. Do not "fix" this without first renaming the column.
//
// Body:
//   {
//     email:             string (required),
//     name:              string (required),
//     phone?:            string,
//     client_request_id: string (one per checkout, e.g. crypto.randomUUID()),
//
//     // Multi-product mode (preferred when the drop has drop_products):
//     items?:     [{ launch_product_id: uuid, quantity: int }],
//
//     // Single-product mode (legacy fallback when no drop_products exist):
//     quantity?:  integer (default 1),
//   }
//
// Returns 201 { order } for a new order or 200 { order, duplicate: true } for
// a repeat, where `order` is only { short_code, venmo_note, venmo_handle,
// amount_cents, is_deposit } — or 400 (incl. $0 orders and demo drops) / 409 (out of stock)
// / 422 / 500 / 503 on errors. NEVER fails on email
// failure — the order is saved first.

import { randomInt } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { sendDropOrderConfirmation } from '@/lib/email/notifications'
import { notifyVendorIfSoldOut } from '@/lib/orders/sold-out'
import { isDemoDrop, DEMO_ORDER_ERROR } from '@/lib/drops/demo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Orders are still accepted this long after closes_at, so a shopper who was
// already on the Venmo step when the drop closed can confirm their payment.
const CLOSE_GRACE_MS = 15 * 60 * 1000

// Venmo memo: "<handle>-" + 6 characters (no 0/O/1/I for readability).
const MEMO_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MEMO_CODE_LENGTH = 6
const MEMO_ATTEMPTS = 5

function normEmail(s) { return typeof s === 'string' ? s.trim().toLowerCase() : '' }
function isValidEmail(s) { return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) }
function normRequestId(s) {
  const v = typeof s === 'string' ? s.trim() : ''
  return /^[A-Za-z0-9-]{8,64}$/.test(v) ? v : null
}
function newVenmoNote(handle) {
  let code = ''
  for (let i = 0; i < MEMO_CODE_LENGTH; i++) code += MEMO_ALPHABET[randomInt(MEMO_ALPHABET.length)]
  return `${handle}-${code}`
}
function isUniqueViolation(err) {
  return String(err?.code) === '23505' || /duplicate key value|unique constraint/i.test(err?.message || '')
}
function isMissingTable(err) {
  return /relation .* does not exist|could not find the table|schema cache/i.test(err?.message || '')
}
// The only order fields ever returned to the browser. No name, email or phone.
function publicOrder(o) {
  return {
    short_code: o.short_code,
    venmo_note: o.venmo_note,
    venmo_handle: o.venmo_handle,
    amount_cents: o.deposit_cents != null ? o.deposit_cents : o.total_cents,
    is_deposit: o.deposit_cents != null,
  }
}
async function findByRequestId(supa, dropId, requestId) {
  const { data } = await supa
    .from('drop_orders')
    .select('short_code, venmo_note, venmo_handle, total_cents, deposit_cents')
    .eq('drop_id', dropId).eq('client_request_id', requestId).maybeSingle()
  return data || null
}

export async function POST(request, { params }) {
  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const email = normEmail(body.email)
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
  const clientRequestId = normRequestId(body.client_request_id)
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!isValidEmail(email)) return NextResponse.json({ error: 'invalid email' }, { status: 400 })

  // Look up the drop.
  const { data: drop, error: gErr } = await supa
    .from('drops').select('*').eq('handle', params.handle).maybeSingle()
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
  if (!drop) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (await isDemoDrop(supa, drop)) return NextResponse.json({ error: DEMO_ORDER_ERROR }, { status: 400 })

  // Repeat of a checkout that already created an order (double-click, retry
  // after a dropped connection): hand back that order's payment details only.
  if (clientRequestId) {
    const existing = await findByRequestId(supa, drop.id, clientRequestId)
    if (existing) return NextResponse.json({ ok: true, order: publicOrder(existing), duplicate: true }, { status: 200 })
  }
  if (drop.status !== 'published') {
    return NextResponse.json({ error: 'drop is not accepting orders yet' }, { status: 422 })
  }
  if (drop.closes_at && new Date(drop.closes_at).getTime() + CLOSE_GRACE_MS <= Date.now()) {
    return NextResponse.json({ error: 'drop is closed' }, { status: 400 })
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
  // each line and snapshot price into order_items. Stock limits are enforced
  // by create_drop_order() below, not here.
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
      const q = parseInt(raw?.quantity ?? '0', 10)
      if (!Number.isFinite(q) || q <= 0) continue
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
      // deposit_percent is the authoritative deposit calculation for
      // deposit-mode drops — applied per line item, then summed. Left null
      // (full total due via Venmo, no balance split) when the vendor hasn't
      // configured a deposit percentage.
      const pct = parseInt(drop.deposit_percent ?? '', 10)
      if (Number.isFinite(pct) && pct > 0) {
        depositCents = orderItemRows.reduce((sum, r) => sum + Math.round(r.price_cents * pct / 100) * r.quantity, 0)
        balanceCents = Math.max(0, totalCents - depositCents)
      }
    }
  } else {
    // Legacy single-product mode.
    let quantity = parseInt(body.quantity ?? '1', 10)
    if (Number.isNaN(quantity) || quantity < 1) quantity = 1
    const unit = parseInt(drop.price_cents || 0, 10)
    totalQty = quantity
    totalCents = unit * quantity
    if (mode === 'deposit') {
      const pct = parseInt(drop.deposit_percent ?? '', 10)
      if (Number.isFinite(pct) && pct > 0) {
        depositCents = Math.round(unit * pct / 100) * quantity
        balanceCents = Math.max(0, totalCents - depositCents)
      }
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

  // Nothing to pay (unpriced drop or products) — same rule as the drop page.
  const amountDueCents = depositCents != null ? depositCents : totalCents
  if (!(amountDueCents > 0)) {
    return NextResponse.json({ error: 'this order has no amount due' }, { status: 400 })
  }

  const insertPayload = {
    drop_id: drop.id,
    shopper_email: email,
    shopper_name: name,
    shopper_phone: typeof body.phone === 'string' ? body.phone.trim().slice(0, 32) : null,
    quantity: totalQty,
    unit_price_cents: unitPrice,
    total_cents: totalCents,
    deposit_cents: depositCents,
    balance_cents: balanceCents,
    venmo_handle: drop.venmo_handle,
    collection_mode: mode,
    status: 'pending_payment',
    client_request_id: clientRequestId,
  }

  // Create the order with a fresh memo via create_drop_order(), which locks
  // the drop's stock, checks every item and inserts the order + its items in
  // one transaction (nothing is inserted if stock is short or anything
  // fails). The (drop_id, venmo_note) unique index is the real memo
  // guarantee; the pre-check just avoids most wasted attempts. A unique
  // violation is either this checkout arriving twice at once (same request
  // id → return that order) or a memo collision (→ try a new memo).
  let order = null
  let insertedItems = []
  for (let attempt = 0; attempt < MEMO_ATTEMPTS && !order; attempt++) {
    const venmoNote = newVenmoNote(drop.handle)
    const { data: taken } = await supa
      .from('drop_orders').select('id').eq('drop_id', drop.id).eq('venmo_note', venmoNote).maybeSingle()
    if (taken) continue
    const { data: result, error: rpcErr } = await supa.rpc('create_drop_order', {
      p_order: { ...insertPayload, venmo_note: venmoNote },
      p_items: orderItemRows,
    })
    if (rpcErr) {
      if (isUniqueViolation(rpcErr)) {
        if (clientRequestId) {
          const existing = await findByRequestId(supa, drop.id, clientRequestId)
          if (existing) return NextResponse.json({ ok: true, order: publicOrder(existing), duplicate: true }, { status: 200 })
        }
        continue
      }
      if (isMissingTable(rpcErr) || /create_drop_order/i.test(rpcErr.message || '')) {
        return NextResponse.json({
          error: 'order checkout not provisioned yet',
          hint: 'Run supabase/migrations/2026-09-drop-order-stock.sql',
        }, { status: 503 })
      }
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }
    if (result?.ok) {
      order = result.order
      insertedItems = result.items || []
      break
    }
    if (result?.error === 'insufficient_stock') {
      const left = Number(result.available) || 0
      const what = result.product_name || 'this item'
      return NextResponse.json({
        error: left > 0 ? `Only ${left} left of ${what}.` : `${what} is sold out.`,
        code: 'insufficient_stock',
        launch_product_id: result.launch_product_id || null,
        available: left,
      }, { status: 409 })
    }
    return NextResponse.json({ error: result?.error || 'could not save your order, please try again' }, { status: 400 })
  }
  if (!order) {
    return NextResponse.json({ error: 'could not create a unique order note, please try again' }, { status: 500 })
  }

  // Fire confirmation email — non-blocking failure.
  try {
    await sendDropOrderConfirmation({
      order, drop, items: insertedItems || [], to: email,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin,
    })
  } catch (e) {
    console.warn('[drops/preorder] email failed:', e?.message)
  }

  // If this order sold the drop out, email the vendor (once per drop).
  // Never fails the order.
  await notifyVendorIfSoldOut(supa, drop)

  return NextResponse.json({ ok: true, order: publicOrder(order) }, { status: 201 })
}
