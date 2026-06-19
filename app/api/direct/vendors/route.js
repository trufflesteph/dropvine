// GET /api/direct/vendors
//
// Public endpoint that lists every active Dropvine Direct vendor for the
// /creators directory page. Returns lightweight rows: just enough for the
// card grid + the client-side search / category / has-active-drop filters.
//
// `has_active_drop` is computed server-side via a single batched lookup
// against `drops` (status='published' AND (closes_at IS NULL OR closes_at > now())),
// so the client can do all subsequent filtering in memory.
//
// Anonymous read. Service-role client used to bypass RLS so the response
// shape is deterministic regardless of policy drift.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  // 1) Fetch every active vendor.
  const { data: vendors, error: vErr } = await supa
    .from('direct_vendors')
    .select('id, slug, business_name, tagline, bio, photo_url, logo_url, category, location_city, location_state, tier, creator_id, is_demo, created_at')
    .eq('active', true)
    .order('created_at', { ascending: false })
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })

  // 2) Single batched query for published + scheduled drops — flip
  // has_active_drop=true for vendors with a live published drop, and
  // has_upcoming_drop=true for vendors with only a scheduled (future) drop.
  // Also capture the soonest upcoming launch_at for the countdown badge.
  const creatorIds = (vendors || []).map((v) => v.creator_id).filter(Boolean)
  const hasActiveByCreator = new Set()
  const hasUpcomingByCreator = new Set()
  const dropCoverByCreator = new Map()
  const latestDropAtByCreator = new Map()
  const upcomingLaunchAtByCreator = new Map()
  if (creatorIds.length) {
    const nowIso = new Date().toISOString()
    const { data: allDrops } = await supa
      .from('drops')
      .select('creator_id, status, launch_at, closes_at, cover_url, created_at')
      .in('creator_id', creatorIds)
      .in('status', ['published', 'scheduled'])
      .order('created_at', { ascending: false })
    for (const d of (allDrops || [])) {
      if (!d.creator_id) continue
      const isUpcoming = d.launch_at && new Date(d.launch_at) > new Date(nowIso)
      const isOpen = !d.closes_at || new Date(d.closes_at) > new Date(nowIso)
      if (!isUpcoming && d.status === 'published' && isOpen) {
        // Live published drop.
        hasActiveByCreator.add(d.creator_id)
      } else if (isUpcoming) {
        // Scheduled / future drop.
        hasUpcomingByCreator.add(d.creator_id)
        // Keep the soonest upcoming launch_at per vendor for the countdown badge.
        const existing = upcomingLaunchAtByCreator.get(d.creator_id)
        if (!existing || new Date(d.launch_at) < new Date(existing)) {
          upcomingLaunchAtByCreator.set(d.creator_id, d.launch_at)
        }
      }
      // Image fallback — most recent PUBLISHED drop's cover_url, regardless
      // of whether it's currently live, upcoming, or closed. Rows are
      // already ordered by created_at desc, so the first published row
      // per creator we see is the most recent one.
      if (d.status === 'published' && d.cover_url && !dropCoverByCreator.has(d.creator_id)) {
        dropCoverByCreator.set(d.creator_id, d.cover_url)
      }
      // Track most recent drop date for card sort order.
      if (!latestDropAtByCreator.has(d.creator_id)) {
        latestDropAtByCreator.set(d.creator_id, d.created_at)
      }
    }
  }

  // 3) Flatten to the shape the directory page expects.
  // Image priority: vendor's own photo_url, then their most recent published
  // drop's cover_url, then their logo_url, then the card falls back to an
  // initial-letter placeholder. This avoids showing the placeholder for
  // vendors who have live drops with real photos but never uploaded a
  // dedicated profile photo.
  const list = (vendors || []).map((v) => {
    const dropCover = dropCoverByCreator.get(v.creator_id) || null
    return {
      slug: v.slug,
      business_name: v.business_name,
      tagline: v.tagline || null,
      bio: v.bio || null,
      photo_url: v.photo_url || dropCover || v.logo_url || null,
      drop_cover_url: dropCover,
      vendor_photo_url: v.photo_url || null,
      category: v.category || null,
      location_city: v.location_city || null,
      location_state: v.location_state || null,
      tier: v.tier || 'free',
      is_demo: !!v.is_demo,
      has_active_drop: hasActiveByCreator.has(v.creator_id),
      has_upcoming_drop: !hasActiveByCreator.has(v.creator_id) && hasUpcomingByCreator.has(v.creator_id),
      upcoming_launch_at: upcomingLaunchAtByCreator.get(v.creator_id) || null,
      latest_drop_at: latestDropAtByCreator.get(v.creator_id) || null,
    }
  })

  // Sort by most recent published drop first; vendors with no drops fall to the end.
  list.sort((a, b) => {
    if (a.latest_drop_at && b.latest_drop_at) return new Date(b.latest_drop_at) - new Date(a.latest_drop_at)
    if (a.latest_drop_at) return -1
    if (b.latest_drop_at) return 1
    return 0
  })

  return NextResponse.json({ vendors: list, count: list.length })
}
