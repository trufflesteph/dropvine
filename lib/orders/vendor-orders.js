// Vendor-side management of Dropvine Direct pre-order / deposit orders, used
// by the /api/dashboard/orders routes behind the dashboard Orders page.
//
// Access: the signed-in vendor comes from the Supabase session cookie,
// verified with Supabase (auth.getUser), never from a client-supplied header.
// A vendor can only see or change orders on drops they created
// (drops.creator_id). Someone else's order is reported as "not found".
//
// Status changes are a single conditional UPDATE (... WHERE status IN the
// allowed "from" statuses), so a double click or a stale page can't apply an
// action twice or move an order backwards: only the request that actually
// changed the row sends the email.

import { getSupabaseServer } from '@/lib/supabase/server'
import { sendDropOrderPaidConfirmation, sendReviewRequest, sendOrderCancelled } from '@/lib/email/notifications'

export async function getSignedInUserId() {
  const sb = getSupabaseServer()
  if (!sb) return null
  try {
    const { data } = await sb.auth.getUser()
    return data?.user?.id || null
  } catch {
    return null
  }
}

// action → which statuses it may start from, the status it sets, and the
// timestamp it stamps.
export const ORDER_ACTIONS = {
  mark_paid:      { from: ['pending_payment'],         to: 'paid',      stamp: 'paid_at' },
  mark_picked_up: { from: ['paid'],                    to: 'fulfilled', stamp: 'fulfilled_at' },
  cancel:         { from: ['pending_payment', 'paid'], to: 'cancelled', stamp: null },
}

export const STATUS_LABELS = {
  pending_payment: 'Not paid yet',
  paid: 'Paid',
  fulfilled: 'Picked up',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

// 409 message when an action no longer applies to the order's current status.
const STALE_MESSAGES = {
  pending_payment: 'This order isn’t paid yet.',
  paid: 'This order is already paid.',
  fulfilled: 'This order is already picked up.',
  cancelled: 'This order is already cancelled.',
  refunded: 'This order was refunded.',
}

// Display order within a drop: unpaid, paid, picked up, cancelled.
const STATUS_RANK = { pending_payment: 0, paid: 1, fulfilled: 2, cancelled: 3, refunded: 3 }

// What the shopper pays on Venmo for this order.
const amountDue = (o) => (o.deposit_cents != null ? o.deposit_cents : o.total_cents) || 0

function toVendorOrder(o, items) {
  return {
    id: o.id,
    short_code: o.short_code,
    status: o.status,
    created_at: o.created_at,
    paid_at: o.paid_at || null,
    fulfilled_at: o.fulfilled_at || null,
    shopper_name: o.shopper_name || null,
    shopper_email: o.shopper_email || null,
    shopper_phone: o.shopper_phone || null,
    quantity: o.quantity,
    total_cents: o.total_cents || 0,
    deposit_cents: o.deposit_cents,
    balance_cents: o.balance_cents,
    amount_due_cents: amountDue(o),
    venmo_note: o.venmo_note,
    items: (items || []).map((i) => ({ product_name: i.product_name, quantity: i.quantity, price_cents: i.price_cents })),
  }
}

async function itemsByOrderId(supa, orderIds) {
  const map = {}
  if (!orderIds.length) return map
  const { data } = await supa
    .from('drop_order_items').select('order_id, product_name, quantity, price_cents, created_at')
    .in('order_id', orderIds).order('created_at', { ascending: true })
  for (const i of data || []) (map[i.order_id] ||= []).push(i)
  return map
}

// All of this vendor's orders, grouped by drop (newest drop first). Drops
// with no orders are left out. Totals exclude cancelled / refunded orders.
export async function listVendorOrders(supa, userId) {
  const { data: drops, error: dErr } = await supa
    .from('drops').select('id, title, handle, created_at, collection_mode')
    .eq('creator_id', userId).order('created_at', { ascending: false })
  if (dErr) throw new Error(dErr.message)
  if (!drops?.length) return { drops: [], unpaid_count: 0 }

  const { data: orders, error: oErr } = await supa
    .from('drop_orders').select('*')
    .in('drop_id', drops.map((d) => d.id)).order('created_at', { ascending: false })
  if (oErr) throw new Error(oErr.message)
  const items = await itemsByOrderId(supa, (orders || []).map((o) => o.id))

  let unpaidCount = 0
  const groups = []
  for (const d of drops) {
    const list = (orders || []).filter((o) => o.drop_id === d.id)
    if (!list.length) continue
    list.sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || String(b.created_at).localeCompare(String(a.created_at)))
    const totals = { orders: 0, paid: 0, unpaid: 0, paid_cents: 0, unpaid_cents: 0 }
    for (const o of list) {
      if (o.status === 'pending_payment') { totals.orders++; totals.unpaid++; totals.unpaid_cents += amountDue(o) }
      else if (o.status === 'paid' || o.status === 'fulfilled') { totals.orders++; totals.paid++; totals.paid_cents += amountDue(o) }
    }
    unpaidCount += totals.unpaid
    groups.push({ id: d.id, title: d.title, handle: d.handle, created_at: d.created_at, totals, orders: list.map((o) => toVendorOrder(o, items[o.id])) })
  }
  return { drops: groups, unpaid_count: unpaidCount }
}

export async function countUnpaidOrders(supa, userId) {
  const { data: drops } = await supa.from('drops').select('id').eq('creator_id', userId)
  if (!drops?.length) return 0
  const { data: rows } = await supa
    .from('drop_orders').select('id').in('drop_id', drops.map((d) => d.id)).eq('status', 'pending_payment')
  return (rows || []).length
}

// Apply one action to one order for the signed-in vendor.
// Returns { status, body } for the route to send.
export async function applyVendorOrderAction(supa, { userId, orderId, action }) {
  const spec = ORDER_ACTIONS[action]
  if (!spec) return { status: 400, body: { error: 'unknown action' } }

  const { data: order } = await supa.from('drop_orders').select('*').eq('id', orderId).maybeSingle()
  const drop = order
    ? (await supa.from('drops').select('id, title, handle, creator_id, pickup_details').eq('id', order.drop_id).maybeSingle()).data
    : null
  if (!order || !drop || drop.creator_id !== userId) return { status: 404, body: { error: 'order not found' } }

  const stale = (current) => ({
    status: 409,
    body: { error: STALE_MESSAGES[current.status] || 'This order has changed. Refresh and try again.', order: toVendorOrder(current, []) },
  })
  if (!spec.from.includes(order.status)) return stale(order)

  const patch = { status: spec.to }
  if (spec.stamp) patch[spec.stamp] = new Date().toISOString()
  const { data: updated, error: uErr } = await supa
    .from('drop_orders').update(patch)
    .eq('id', orderId).in('status', spec.from)
    .select('*').maybeSingle()
  if (uErr) return { status: 500, body: { error: uErr.message } }
  if (!updated) {
    // Another request changed it between our read and our update.
    const { data: current } = await supa.from('drop_orders').select('*').eq('id', orderId).maybeSingle()
    return stale(current || order)
  }

  // Only the request that made the transition gets here: one email per action.
  const items = (await itemsByOrderId(supa, [updated.id]))[updated.id] || []
  let email = null
  try {
    if (action === 'mark_paid') {
      email = await sendDropOrderPaidConfirmation({ order: updated, drop, items, to: updated.shopper_email })
    } else if (action === 'mark_picked_up') {
      email = await createPendingReview(supa, updated, drop)
    } else if (action === 'cancel') {
      email = await sendOrderCancelled({ order: updated, drop, to: updated.shopper_email })
    }
  } catch (e) {
    console.warn('[dashboard/orders] email failed:', action, e?.message)
    email = { error: e?.message || 'email failed' }
  }
  return { status: 200, body: { ok: true, order: toVendorOrder(updated, items), email } }
}

// Picked up → pending review row + ReviewRequest email. Same behavior as the
// admin orders endpoint's helper (kept separate so the admin endpoint stays
// untouched): skipped if this shopper already has a review row for the drop.
async function createPendingReview(supa, order, drop) {
  const { data: vendor } = await supa
    .from('direct_vendors').select('id, business_name, tier, active')
    .eq('creator_id', drop.creator_id).maybeSingle()
  if (!vendor) return { skipped: 'no direct_vendors row for drop creator' }

  const { data: existing, error: eErr } = await supa
    .from('vendor_reviews').select('id')
    .eq('drop_id', order.drop_id).ilike('reviewer_email', order.shopper_email).maybeSingle()
  if (eErr && /relation .* does not exist|could not find the table|schema cache/i.test(eErr.message)) {
    return { skipped: 'vendor_reviews table not provisioned' }
  }
  if (existing) return { skipped: 'review already exists', review_id: existing.id }

  const { data: review, error: iErr } = await supa
    .from('vendor_reviews')
    .insert({
      vendor_id: vendor.id,
      drop_id: order.drop_id,
      reviewer_email: order.shopper_email,
      reviewer_name: order.shopper_name || 'Customer',
      rating: 5, // placeholder until the shopper submits (CHECK requires 1–5)
      comment: null,
      is_verified_purchase: true,
      status: 'pending',
    })
    .select('id').maybeSingle()
  if (iErr) {
    if (/relation .* does not exist|could not find the table|schema cache/i.test(iErr.message)) {
      return { skipped: 'vendor_reviews table not provisioned' }
    }
    return { error: iErr.message }
  }

  const base = (process.env.NEXT_PUBLIC_BASE_URL || 'https://dropvine.pro').replace(/\/$/, '')
  const email = await sendReviewRequest({
    drop: { ...drop, vendor_business_name: vendor.business_name },
    to: order.shopper_email,
    reviewerName: order.shopper_name || null,
    reviewUrl: `${base}/review/${review.id}`,
  })
  return { ok: true, review_id: review.id, email }
}
