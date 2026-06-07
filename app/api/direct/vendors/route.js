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
  // active (published + non-expired) drop, we flip has_active_drop=true.
  const creatorIds = (vendors || []).map((v) => v.creator_id).filter(Boolean)
  const hasActiveByCreator = new Set()
  if (creatorIds.length) {
    const nowIso = new Date().toISOString()
    const { data: liveDrops } = await supa
      .from('drops')
      .select('creator_id, closes_at')
      .in('creator_id', creatorIds)
      .eq('status', 'published')
    for (const d of (liveDrops || [])) {
      // Closes_at NULL = open-ended; future = still live.
      if (!d.closes_at || new Date(d.closes_at) > new Date(nowIso)) {
        if (d.creator_id) hasActiveByCreator.add(d.creator_id)
      }
    }
  }

  // 3) Flatten to the shape the directory page expects.
  const list = (vendors || []).map((v) => ({
    slug: v.slug,
    business_name: v.business_name,
    tagline: v.tagline || null,
    bio: v.bio || null,
    photo_url: v.photo_url || v.logo_url || null,
    category: v.category || null,
    location_city: v.location_city || null,
    location_state: v.location_state || null,
    tier: v.tier || 'free',
    is_demo: !!v.is_demo,
    has_active_drop: hasActiveByCreator.has(v.creator_id),
  }))

  return NextResponse.json({ vendors: list, count: list.length })
}
