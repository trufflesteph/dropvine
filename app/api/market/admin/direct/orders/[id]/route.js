// PATCH /api/market/admin/direct/orders/[id]
//
// Mutate a drop_orders row's status. Body:
//   { action: 'mark_paid' | 'mark_fulfilled' | 'cancel' }
// or:
//   { status: 'paid' | 'fulfilled' | 'cancelled' | 'refunded' }   (raw form)
//
// Side effects:
//   mark_paid       → status='paid',       paid_at=now(),       sends payment-confirmation email
//   mark_fulfilled  → status='fulfilled',  fulfilled_at=now()
//   cancel          → status='cancelled'
//   refunded        → status='refunded'
//
// Idempotent: marking a paid order paid again is a no-op (no second email).
//
// Auth: requireAdminRole() — platform or organiser.

import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { sendDropOrderPaidConfirmation } from '@/lib/email/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ACTION_MAP = {
  mark_paid:      { status: 'paid',       timestampField: 'paid_at' },
  mark_fulfilled: { status: 'fulfilled',  timestampField: 'fulfilled_at' },
  cancel:         { status: 'cancelled',  timestampField: null },
  refund:         { status: 'refunded',   timestampField: null },
}
const RAW_STATUSES = new Set(['pending_payment','paid','fulfilled','cancelled','refunded'])

export async function PATCH(request, { params }) {
  const auth = requireAdminRole(request)
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const body = await request.json().catch(() => ({}))

  // Resolve the desired status + timestamp from either action OR raw status.
  let nextStatus = null
  let timestampField = null
  if (typeof body.action === 'string' && ACTION_MAP[body.action]) {
    nextStatus = ACTION_MAP[body.action].status
    timestampField = ACTION_MAP[body.action].timestampField
  } else if (typeof body.status === 'string' && RAW_STATUSES.has(body.status)) {
    nextStatus = body.status
    if (nextStatus === 'paid') timestampField = 'paid_at'
    else if (nextStatus === 'fulfilled') timestampField = 'fulfilled_at'
  } else {
    return NextResponse.json({ error: 'invalid action / status' }, { status: 400 })
  }

  // Read current row (with the launch joined) so we can guard side-effects.
  const { data: order, error: gErr } = await supa
    .from('drop_orders')
    .select('*, launches:launch_id(id, handle, title, pickup_details)')
    .eq('id', params.id)
    .maybeSingle()
  if (gErr) {
    if (/could not find the table|relation .* does not exist|schema cache/i.test(gErr.message)) {
      return NextResponse.json({ error: 'orders table not provisioned yet' }, { status: 503 })
    }
    return NextResponse.json({ error: gErr.message }, { status: 500 })
  }
  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const alreadyAtTarget = order.status === nextStatus
  const updates = { status: nextStatus }
  if (timestampField && !order[timestampField]) {
    updates[timestampField] = new Date().toISOString()
  }

  let updated = order
  if (!alreadyAtTarget || updates[timestampField]) {
    const { data, error: uErr } = await supa
      .from('drop_orders').update(updates).eq('id', params.id)
      .select('*, launches:launch_id(id, handle, title, pickup_details)').single()
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
    updated = data
  }

  // Side-effect: send the payment-confirmation email when we just transitioned
  // an order INTO 'paid' (skip if it was already paid — idempotent).
  let emailResult = null
  if (nextStatus === 'paid' && !alreadyAtTarget && updated?.shopper_email) {
    try {
      // Fetch drop_order_items so the email can itemise multi-product orders.
      // Best-effort: ignore missing table.
      let items = []
      try {
        const { data: iRows, error: iErr } = await supa
          .from('drop_order_items').select('*').eq('order_id', params.id)
          .order('created_at', { ascending: true })
        if (!iErr && Array.isArray(iRows)) items = iRows
      } catch {}
      emailResult = await sendDropOrderPaidConfirmation({
        order: { ...updated, launches: undefined },
        launch: updated.launches || null,
        items,
        to: updated.shopper_email,
      })
    } catch (e) {
      console.warn('[admin/orders] paid-email failed:', e?.message)
      emailResult = { error: e?.message || 'email failed' }
    }
  }

  // Flatten join before returning.
  const flat = {
    ...updated,
    launch_title: updated.launches?.title || null,
    launch_handle: updated.launches?.handle || null,
    launches: undefined,
  }
  return NextResponse.json({ ok: true, order: flat, via: auth.role, alreadyAtTarget, email: emailResult })
}
