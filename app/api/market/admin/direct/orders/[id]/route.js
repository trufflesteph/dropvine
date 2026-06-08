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
import { sendDropOrderPaidConfirmation, sendReviewRequest } from '@/lib/email/notifications'

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

  // Read current row (with the drop joined) so we can guard side-effects.
  const { data: order, error: gErr } = await supa
    .from('drop_orders')
    .select('*, drops:drop_id(id, handle, title, pickup_details)')
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
      .select('*, drops:drop_id(id, handle, title, pickup_details)').single()
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
        order: { ...updated, drops: undefined },
        drop: updated.drops || null,
        items,
        to: updated.shopper_email,
      })
    } catch (e) {
      console.warn('[admin/orders] paid-email failed:', e?.message)
      emailResult = { error: e?.message || 'email failed' }
    }
  }

  // Side-effect (June 2026): when an order transitions INTO 'fulfilled',
  // insert a `vendor_reviews` row (status='pending') and email the shopper
  // a magic link to /review/[id] so they can leave a star rating + comment.
  // Best-effort, fully tolerated if the reviews tables aren't provisioned.
  // Idempotent: skipped if a review already exists for (drop_id, reviewer_email).
  let reviewResult = null
  if (nextStatus === 'fulfilled' && !alreadyAtTarget && updated?.shopper_email && updated?.drop_id) {
    try {
      reviewResult = await createPendingReview(supa, updated)
    } catch (e) {
      console.warn('[admin/orders] review-request hook failed:', e?.message)
      reviewResult = { error: e?.message || 'review hook failed' }
    }
  }

  // Flatten join before returning.
  const flat = {
    ...updated,
    drop_title: updated.drops?.title || null,
    drop_handle: updated.drops?.handle || null,
    drops: undefined,
  }
  return NextResponse.json({ ok: true, order: flat, via: auth.role, alreadyAtTarget, email: emailResult, review: reviewResult })
}

// =============================================================================
// Helper — createPendingReview
// =============================================================================
// On order fulfillment we (1) resolve the direct_vendors row for the drop's
// creator (so vendor_reviews.vendor_id is set), (2) check there isn't
// already a review row for (drop_id, reviewer_email), and (3) insert a new
// pending row + fire the shopper-facing magic-link email.
async function createPendingReview(supa, order) {
  // 1) Resolve the vendor row.
  const drop = order.drops || null
  // We need creator_id; refetch the drop row by id since the existing join
  // doesn't include it.
  let dropRow = null
  try {
    const { data } = await supa
      .from('drops')
      .select('id, title, handle, creator_id')
      .eq('id', order.drop_id)
      .maybeSingle()
    dropRow = data
  } catch {}
  if (!dropRow?.creator_id) return { skipped: 'no creator_id on drop' }

  const { data: vendor } = await supa
    .from('direct_vendors')
    .select('id, business_name, tier, active')
    .eq('creator_id', dropRow.creator_id)
    .maybeSingle()
  if (!vendor) return { skipped: 'no direct_vendors row for drop creator' }

  // 2) Idempotency check.
  let alreadyExists = null
  try {
    const { data: existing } = await supa
      .from('vendor_reviews')
      .select('id, status')
      .eq('drop_id', order.drop_id)
      .ilike('reviewer_email', order.shopper_email)
      .maybeSingle()
    alreadyExists = existing
  } catch (e) {
    if (/relation .* does not exist|could not find the table|schema cache/i.test(e?.message || '')) {
      return { skipped: 'vendor_reviews table not provisioned' }
    }
  }
  if (alreadyExists) return { skipped: 'review already exists', review_id: alreadyExists.id }

  // 3) Insert the pending review row.
  const { data: review, error: iErr } = await supa
    .from('vendor_reviews')
    .insert({
      vendor_id: vendor.id,
      drop_id: order.drop_id,
      reviewer_email: order.shopper_email,
      reviewer_name: order.shopper_name || 'Customer',
      // rating + comment are placeholders until the shopper submits the form.
      // The CHECK constraint requires rating BETWEEN 1 AND 5 so we have to
      // start at 5 (we'll overwrite on submit).
      rating: 5,
      comment: null,
      is_verified_purchase: true,
      status: 'pending',
    })
    .select('id')
    .maybeSingle()
  if (iErr) {
    if (/relation .* does not exist|could not find the table|schema cache/i.test(iErr.message)) {
      return { skipped: 'vendor_reviews table not provisioned' }
    }
    return { error: iErr.message }
  }

  // 4) Send the shopper-facing review-request email.
  const base = (process.env.NEXT_PUBLIC_BASE_URL || 'https://dropvine.pro').replace(/\/$/, '')
  const reviewUrl = `${base}/review/${review.id}`
  const dropForEmail = {
    ...dropRow,
    vendor_business_name: vendor.business_name,
    creator_id: dropRow.creator_id,
  }
  const emailResult = await sendReviewRequest({
    drop: dropForEmail,
    to: order.shopper_email,
    reviewerName: order.shopper_name || null,
    reviewUrl,
  }).catch((e) => ({ error: e?.message || String(e) }))

  return { ok: true, review_id: review.id, email: emailResult }
}
