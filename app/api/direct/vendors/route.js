// GET /api/direct/vendors
//
// Public endpoint behind the Fresh Drops page (/drops). Despite the path it
// returns one row per DROP, not per vendor: every open and upcoming drop
// from an active Dropvine Direct vendor, plus demo drops.
//
//   • Open / upcoming are defined in lib/vendors/visibility.js (published +
//     launched + not past closes_at / published or scheduled + future launch).
//   • Drafts, archived drops and drops past closes_at are excluded. Demo
//     drops (drops.is_demo or a demo vendor) are always included, as the
//     directory has always shown demo vendors.
//   • Sort: open drops by closes_at soonest first, then open drops with no
//     closes_at by newest launch; then upcoming drops by soonest launch; then
//     any remaining (closed) demo drops by newest launch.
//
// Each row carries the drop fields the card needs plus the vendor's name,
// category, location and photo (cover-image fallback). The client does all
// filtering (category, search, "Open now") in memory.
//
// Anonymous read. Service-role client used to bypass RLS so the response
// shape is deterministic regardless of policy drift.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { isOpenDrop, isUpcomingDrop } from '@/lib/vendors/visibility'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  // 1) Every active vendor, keyed by creator_id.
  const { data: vendors, error: vErr } = await supa
    .from('direct_vendors')
    .select('slug, business_name, photo_url, logo_url, category, location_city, location_state, creator_id, is_demo')
    .eq('active', true)
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })
  const vendorByCreator = new Map((vendors || []).filter((v) => v.creator_id).map((v) => [v.creator_id, v]))

  // 2) Their published + scheduled drops in one batched query.
  let rows = []
  if (vendorByCreator.size) {
    const { data, error: dErr } = await supa
      .from('drops')
      .select('id, handle, title, cover_url, launch_at, closes_at, status, is_demo, creator_id')
      .in('creator_id', [...vendorByCreator.keys()])
      .in('status', ['published', 'scheduled'])
    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })
    rows = data || []
  }

  // 3) Keep open, upcoming and demo drops; flatten to the card shape.
  const now = Date.now()
  const list = []
  for (const d of rows) {
    const v = vendorByCreator.get(d.creator_id)
    const isOpen = isOpenDrop(d, now)
    const isUpcoming = isUpcomingDrop(d, now)
    const isDemo = !!(d.is_demo || v.is_demo)
    if (!isOpen && !isUpcoming && !isDemo) continue
    list.push({
      id: d.id,
      handle: d.handle,
      title: d.title,
      cover_url: d.cover_url || null,
      vendor_photo_url: v.photo_url || v.logo_url || null,
      launch_at: d.launch_at,
      closes_at: d.closes_at || null,
      is_open: isOpen,
      is_upcoming: isUpcoming,
      is_demo: isDemo,
      vendor_slug: v.slug,
      business_name: v.business_name,
      category: v.category || null,
      location_city: v.location_city || null,
      location_state: v.location_state || null,
    })
  }

  // 4) Sort (see header).
  const group = (d) => (d.is_open ? (d.closes_at ? 0 : 1) : d.is_upcoming ? 2 : 3)
  const ms = (iso) => Date.parse(iso) || 0
  list.sort((a, b) => {
    const g = group(a) - group(b)
    if (g) return g
    switch (group(a)) {
      case 0: return ms(a.closes_at) - ms(b.closes_at)   // closing soonest first
      case 2: return ms(a.launch_at) - ms(b.launch_at)   // launching soonest first
      default: return ms(b.launch_at) - ms(a.launch_at)  // newest launch first
    }
  })

  return NextResponse.json({ drops: list, count: list.length })
}
