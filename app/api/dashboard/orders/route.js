// GET /api/dashboard/orders
//
// The signed-in vendor's pre-order / deposit orders, grouped by drop (newest
// drop first) with per-drop totals. Only drops the vendor created
// (drops.creator_id) are included.
//
//   ?summary=1  → { ok, unpaid_count } only (dashboard nav badge)
//
// Auth: Supabase session cookie, verified server-side (see
// lib/orders/vendor-orders.js). Not the admin password.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getSignedInUserId, listVendorOrders, countUnpaidOrders } from '@/lib/orders/vendor-orders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  const userId = await getSignedInUserId()
  if (!userId) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  try {
    if (new URL(request.url).searchParams.get('summary') === '1') {
      return NextResponse.json({ ok: true, unpaid_count: await countUnpaidOrders(supa, userId) })
    }
    return NextResponse.json({ ok: true, ...(await listVendorOrders(supa, userId)) })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'could not load orders' }, { status: 500 })
  }
}
