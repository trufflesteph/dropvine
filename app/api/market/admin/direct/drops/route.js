import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/market/admin/direct/drops?status=draft|published|archived|all&q=<title-search>&page=0
// Pagination: 50/page. Status maps directly to launches.status.
export async function GET(request) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })

  const url = new URL(request.url)
  const status = url.searchParams.get('status') || 'all'
  const q = (url.searchParams.get('q') || '').trim()
  const page = Math.max(0, parseInt(url.searchParams.get('page') || '0', 10) || 0)
  const pageSize = 50
  const from = page * pageSize
  const to = from + pageSize - 1

  const supa = getSupabaseAdmin()
  let query = supa.from('launches').select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)
  if (status !== 'all') query = query.eq('status', status)
  if (q) query = query.ilike('title', `%${q}%`)

  const { data: launches, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Vendor name lookup: launches.creator_id → direct_vendors.creator_id
  const creatorIds = Array.from(new Set((launches || []).map((l) => l.creator_id).filter(Boolean)))
  let vendorMap = new Map()
  if (creatorIds.length) {
    const { data: dv } = await supa.from('direct_vendors')
      .select('creator_id, business_name').in('creator_id', creatorIds)
    vendorMap = new Map((dv || []).map((v) => [v.creator_id, v.business_name]))
  }
  const enriched = (launches || []).map((l) => ({
    ...l,
    vendor_name: l.creator_id ? (vendorMap.get(l.creator_id) || 'Platform owner') : 'Platform owner',
  }))

  return NextResponse.json({
    drops: enriched,
    page,
    page_size: pageSize,
    total: count ?? enriched.length,
    has_more: (count ?? 0) > to + 1,
  })
}
