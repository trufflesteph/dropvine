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

  // 2) Single batched query for active drops — for each vendor with an
  // active (published + non-expired) drop, we flip has_active_drop=true
  // AND remember the drop's own cover_url so the Fresh Drops cards can
  // prefer the DROP photo (set by the vendor on the Tally form) over the
  // vendor profile photo. Free-tier drops often have no vendor profile
  // photo at all — falling back to the drop cover keeps cards visual.
  const creatorIds = (vendors || []).map((v) => v.creator_id).filter(Boolean)
  const hasActiveByCreator = new Set()
  const dropCoverByCreator = new Map()
  const latestDropAtByCreator = new Map()
  if (creatorIds.length) {
    const nowIso = new Date().toISOString()
    const { data: liveDrops } = await supa
      .from('drops')
      .select('creator_id, closes_at, cover_url, created_at')
      .in('creator_id', creatorIds)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
    for (const d of (liveDrops || [])) {
      // Closes_at NULL = open-ended; future = still live.
      const isOpen = !d.closes_at || new Date(d.closes_at) > new Date(nowIso)
      if (isOpen && d.creator_id) {
        hasActiveByCreator.add(d.creator_id)
        // First seen (most recent) wins — Supabase returned them DESC.
        if (d.cover_url && !dropCoverByCreator.has(d.creator_id)) {
          dropCoverByCreator.set(d.creator_id, d.cover_url)
        }
      }
      // Track most recent published drop date for card sort order (open or closed).
      if (d.creator_id && !latestDropAtByCreator.has(d.creator_id)) {
        latestDropAtByCreator.set(d.creator_id, d.created_at)
      }
    }
  }

  // 3) Flatten to the shape the directory page expects.
  // Fix 14 — Fresh Drops cards now prefer the drop's own cover_url; we keep
  // the vendor profile photo as a secondary fallback and expose both fields
  // so the card can decide how to render.
  const list = (vendors || []).map((v) => {
    const dropCover = dropCoverByCreator.get(v.creator_id) || null
    const vendorPhoto = v.photo_url || v.logo_url || null
    return {
      slug: v.slug,
      business_name: v.business_name,
      tagline: v.tagline || null,
      bio: v.bio || null,
      // Primary card image — prefer the active drop cover, then vendor photo.
      photo_url: dropCover || vendorPhoto,
      drop_cover_url: dropCover,
      vendor_photo_url: vendorPhoto,
      category: v.category || null,
      location_city: v.location_city || null,
      location_state: v.location_state || null,
      tier: v.tier || 'free',
      is_demo: !!v.is_demo,
      has_active_drop: hasActiveByCreator.has(v.creator_id),
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
