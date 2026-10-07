// Vendor "sold out" email for pre-order / deposit drops.
//
// Sold out uses the same stock rules as create_drop_order()
// (2026-09-drop-order-stock.sql): committed = what pending_payment, paid and
// fulfilled orders hold, from drop_committed_quantities().
//   • Drops with products: every product has a quantity and none has any
//     left. Any unlimited product (quantity NULL) → never sold out.
//   • Single-product drops (no drop_products rows): capacity is set and
//     fully committed.
//
// Sent once per drop: drops.sold_out_notified_at is claimed with an UPDATE
// that only matches while it is still NULL, and it is never cleared — so a
// later cancellation that frees stock doesn't lead to a second email.

import { sendSoldOutNotification } from '@/lib/email/notifications'
import { isDemoDrop } from '@/lib/drops/demo'

export async function isDropSoldOut(supa, drop) {
  const { data: products, error: pErr } = await supa
    .from('drop_products').select('id, quantity').eq('drop_id', drop.id)
  if (pErr) throw new Error(pErr.message)

  const { data: rows, error: cErr } = await supa.rpc('drop_committed_quantities', { p_drop_id: drop.id })
  if (cErr) throw new Error(cErr.message)
  const committedByProduct = new Map()
  let committedTotal = 0
  for (const r of rows || []) {
    if (r.launch_product_id) committedByProduct.set(r.launch_product_id, Number(r.committed) || 0)
    else committedTotal = Number(r.committed) || 0
  }

  if (products?.length) {
    if (products.some((p) => p.quantity == null)) return false
    return products.every((p) => Number(p.quantity) - (committedByProduct.get(p.id) || 0) <= 0)
  }
  if (drop.capacity == null) return false
  return Number(drop.capacity) - committedTotal <= 0
}

// Same counting as the Orders page totals: cancelled / refunded excluded.
async function orderTotals(supa, dropId) {
  const { data } = await supa.from('drop_orders').select('status').eq('drop_id', dropId)
  const totals = { orders: 0, paid: 0, unpaid: 0 }
  for (const o of data || []) {
    if (o.status === 'pending_payment') { totals.orders++; totals.unpaid++ }
    else if (o.status === 'paid' || o.status === 'fulfilled') { totals.orders++; totals.paid++ }
  }
  return totals
}

// Call after an order was created. Never throws.
export async function notifyVendorIfSoldOut(supa, drop) {
  try {
    // Demo drops never send anything.
    if (await isDemoDrop(supa, drop)) return { skipped: 'demo drop' }
    if (!(await isDropSoldOut(supa, drop))) return { skipped: 'not sold out' }

    // Claim the one send for this drop.
    const { data: claimed, error } = await supa
      .from('drops').update({ sold_out_notified_at: new Date().toISOString() })
      .eq('id', drop.id).is('sold_out_notified_at', null)
      .select('id').maybeSingle()
    if (error) {
      console.warn('[sold-out] could not set sold_out_notified_at:', error.message)
      return { error: error.message }
    }
    if (!claimed) return { skipped: 'already notified' }

    const totals = await orderTotals(supa, drop.id)
    return await sendSoldOutNotification({ drop, totals })
  } catch (e) {
    console.warn('[sold-out] check failed:', e?.message)
    return { error: e?.message || 'sold-out check failed' }
  }
}
