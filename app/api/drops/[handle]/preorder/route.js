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
//     quantity?:  integer (default 1, capped at launches.capacity if set),
//     venmo_note: string (required, the unique <handle>-XXXX note the shopper
//                        sent the payment with),
//   }
//
// Returns 201 with the created order row OR 400/409/422 on validation errors.
// NEVER 500s on email failure — the order row is always saved first.

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

  // Look up the launch.
  const { data: launch, error: gErr } = await supa
    .from('launches').select('*').eq('handle', params.handle).maybeSingle()
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
  if (!launch) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (launch.status !== 'published') {
    return NextResponse.json({ error: 'drop is not accepting orders yet' }, { status: 422 })
  }
  const mode = (launch.collection_mode || '').toLowerCase()
  if (mode !== 'pre-order' && mode !== 'deposit') {
    return NextResponse.json({ error: 'this drop does not accept Venmo orders' }, { status: 422 })
  }
  if (!launch.venmo_handle) {
    return NextResponse.json({ error: 'this drop has no Venmo handle configured' }, { status: 422 })
  }

  // Quantity — default 1, cap to capacity (if set), reject ≤ 0.
  let quantity = parseInt(body.quantity ?? '1', 10)
  if (Number.isNaN(quantity) || quantity < 1) quantity = 1
  if (launch.capacity && launch.capacity > 0) {
    quantity = Math.min(quantity, launch.capacity)
  }

  const unitPrice = parseInt(launch.price_cents || 0, 10)
  const totalCents = unitPrice * quantity
  let depositCents = null
  let balanceCents = null
  if (mode === 'deposit') {
    depositCents = parseInt(launch.reservation_hold_cents || 0, 10) * quantity
    balanceCents = Math.max(0, totalCents - depositCents)
  }

  // Insert the order. Unique (launch_id, venmo_note) guards against accidental
  // double-submits if the shopper hits the confirm button twice.
  const insertPayload = {
    launch_id: launch.id,
    shopper_email: email,
    shopper_name: typeof body.name === 'string' ? body.name.trim().slice(0, 120) : null,
    shopper_phone: typeof body.phone === 'string' ? body.phone.trim().slice(0, 32) : null,
    quantity,
    unit_price_cents: unitPrice,
    total_cents: totalCents,
    deposit_cents: depositCents,
    balance_cents: balanceCents,
    venmo_handle: launch.venmo_handle,
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
        .from('drop_orders')
        .select('*')
        .eq('launch_id', launch.id)
        .eq('venmo_note', venmoNote)
        .maybeSingle()
      if (existing) return NextResponse.json({ ok: true, order: existing, duplicate: true }, { status: 200 })
    }
    // Tolerated when migration not applied — surface a 503 rather than 500 so
    // the UI can show a friendly retry message. Supabase PostgREST emits
    // either "relation … does not exist" (PG) or "Could not find the table … in
    // the schema cache" (PostgREST) — match both.
    if (/relation .* does not exist|could not find the table|schema cache/i.test(iErr.message)) {
      return NextResponse.json({
        error: 'orders table not provisioned yet',
        hint: 'Run supabase/migrations/2026-06-drop-orders.sql',
      }, { status: 503 })
    }
    return NextResponse.json({ error: iErr.message }, { status: 500 })
  }

  // Fire confirmation email — non-blocking failure.
  try {
    await sendDropOrderConfirmation({
      order, launch, to: email,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin,
    })
  } catch (e) {
    console.warn('[drops/preorder] email failed:', e?.message)
  }

  return NextResponse.json({ ok: true, order }, { status: 201 })
}
