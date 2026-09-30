// PATCH /api/dashboard/orders/[id]
//
// Body: { action: 'mark_paid' | 'mark_picked_up' | 'cancel' }
//
//   mark_paid       pending_payment → paid       paid_at set, DropOrderPaid email
//   mark_picked_up  paid → fulfilled             fulfilled_at set, ReviewRequest email
//   cancel          pending_payment|paid → cancelled   OrderCancelled email
//
// The order's drop must belong to the signed-in vendor (drops.creator_id);
// otherwise 404. An action whose starting status no longer matches (double
// click, stale page) returns 409 with the current order and sends nothing.
//
// Auth: Supabase session cookie, verified server-side (see
// lib/auth/server-user.js). Not the admin password.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getSignedInUserId } from '@/lib/auth/server-user'
import { applyVendorOrderAction } from '@/lib/orders/vendor-orders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request, { params }) {
  const userId = await getSignedInUserId(request)
  if (!userId) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const { status, body: out } = await applyVendorOrderAction(supa, {
    userId,
    orderId: params.id,
    action: typeof body.action === 'string' ? body.action : null,
  })
  return NextResponse.json(out, { status })
}
