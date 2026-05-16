// GET /api/market/admin/direct/orders
//
// Paginated list of drop_orders with their parent launch.title joined in.
// Used by the /admin/direct/orders page.
//
// Query params (all optional):
//   status   one of pending_payment | paid | fulfilled | cancelled | refunded | all (default all)
//   q        substring filter against shopper_email | shopper_name | short_code (case-insensitive)
//   page     1-indexed page number (default 1)
//   pageSize default 50, capped at 200
//
// Auth: requireAdminRole() — platform or organiser.

import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_STATUSES = new Set(['pending_payment', 'paid', 'fulfilled', 'cancelled', 'refunded'])

export async function GET(request) {
  const auth = requireAdminRole(request)
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const url = new URL(request.url)
  const status = (url.searchParams.get('status') || 'all').toLowerCase()
  const q = (url.searchParams.get('q') || '').trim()
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get('pageSize') || '50', 10) || 50))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Base query. Selecting the launch via FK join — PostgREST will follow
  // drop_orders.launch_id → launches.id automatically.
  let query = supa
    .from('drop_orders')
    .select('*, launches:launch_id(id, handle, title, pickup_details)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (ALLOWED_STATUSES.has(status)) query = query.eq('status', status)

  if (q) {
    // case-insensitive OR across the three searchable text columns.
    const safe = q.replace(/[%,]/g, '')
    query = query.or(`shopper_email.ilike.%${safe}%,shopper_name.ilike.%${safe}%,short_code.ilike.%${safe}%`)
  }

  const { data, error, count } = await query.range(from, to)
  if (error) {
    if (/could not find the table|relation .* does not exist|schema cache/i.test(error.message)) {
      // Table not provisioned yet — surface as empty list with a hint.
      return NextResponse.json({
        ok: true,
        orders: [],
        total: 0,
        page,
        pageSize,
        migration_pending: true,
        hint: 'Run supabase/migrations/2026-06-drop-orders.sql',
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Flatten launches join + compute counts per status for the filter bar.
  const baseOrders = (data || []).map((r) => ({
    ...r,
    launch_title: r.launches?.title || null,
    launch_handle: r.launches?.handle || null,
    launch_pickup_details: r.launches?.pickup_details || null,
    launches: undefined,
  }))

  // Bulk-fetch drop_order_items for ALL orders on this page in a single query.
  // Group client-side. Tolerates missing table (multi-product migration).
  let itemsByOrder = {}
  let itemsTablePending = false
  if (baseOrders.length) {
    const orderIds = baseOrders.map((o) => o.id)
    const { data: iRows, error: iErr } = await supa
      .from('drop_order_items').select('*').in('order_id', orderIds)
      .order('created_at', { ascending: true })
    if (iErr) {
      if (/could not find the table|relation .* does not exist|schema cache/i.test(iErr.message)) {
        itemsTablePending = true
      } else {
        console.warn('[admin/direct/orders] drop_order_items fetch failed (non-fatal):', iErr.message)
      }
    } else {
      for (const it of (iRows || [])) {
        (itemsByOrder[it.order_id] ||= []).push(it)
      }
    }
  }
  const orders = baseOrders.map((o) => {
    const items = itemsByOrder[o.id] || []
    return { ...o, items, items_count: items.length }
  })

  // Optional cheap counts for the tab bar — separate query, single round-trip.
  // Skipped when filtering by status to keep response small; UI can issue one
  // un-filtered call once on mount and reuse the counts.
  let counts = null
  if (status === 'all' && !q) {
    const { data: cdata } = await supa.from('drop_orders').select('status')
    if (cdata) {
      counts = { all: cdata.length, pending_payment: 0, paid: 0, fulfilled: 0, cancelled: 0, refunded: 0 }
      for (const r of cdata) {
        if (r.status in counts) counts[r.status] += 1
      }
    }
  }

  return NextResponse.json({
    ok: true,
    orders,
    total: count ?? orders.length,
    page,
    pageSize,
    counts,
    items_migration_pending: itemsTablePending,
  })
}
