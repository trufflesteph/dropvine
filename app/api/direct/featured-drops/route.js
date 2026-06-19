// GET /api/direct/featured-drops
//
// Public endpoint backing the homepage's three demo-style drop cards.
// Returns exactly the drops manually pinned via drops.is_featured_homepage =
// true, ordered by drops.featured_order ascending. No auto-fill — if fewer
// than 3 drops are marked, fewer than 3 are returned.
//
// Each drop is joined to its vendor (direct_vendors via creator_id) for
// business_name, category, location, and the is_demo flag (drives whether
// the "Demo" badge renders on the card).

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const { data: drops, error } = await supa
    .from('drops')
    .select('id, handle, title, description, tagline, cover_url, hero_image_url, launch_at, closes_at, collection_mode, creator_id, featured_order')
    .eq('is_featured_homepage', true)
    .order('featured_order', { ascending: true, nullsFirst: false })

  if (error) {
    // Migration not run yet — degrade to an empty list rather than a 500 so
    // the homepage just renders without the featured-drops section.
    if (/column .* does not exist|could not find the .* column|schema cache/i.test(error.message)) {
      console.warn('[featured-drops] is_featured_homepage/featured_order columns missing — run supabase/migrations/2026-06-homepage-featured-drops.sql')
      return NextResponse.json({ drops: [] })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const creatorIds = [...new Set((drops || []).map((d) => d.creator_id).filter(Boolean))]
  const vendorByCreator = new Map()
  if (creatorIds.length) {
    const { data: vendors } = await supa
      .from('direct_vendors')
      .select('creator_id, slug, business_name, category, location_city, location_state, logo_url, photo_url, is_demo')
      .in('creator_id', creatorIds)
    for (const v of (vendors || [])) vendorByCreator.set(v.creator_id, v)
  }

  const list = (drops || []).map((d) => {
    const v = vendorByCreator.get(d.creator_id) || null
    return {
      id: d.id,
      handle: d.handle,
      title: d.title,
      description: d.description || d.tagline || null,
      image_url: d.hero_image_url || d.cover_url || v?.photo_url || v?.logo_url || null,
      launch_at: d.launch_at,
      closes_at: d.closes_at,
      collection_mode: d.collection_mode,
      business_name: v?.business_name || d.title,
      category: v?.category || null,
      location_city: v?.location_city || null,
      location_state: v?.location_state || null,
      vendor_slug: v?.slug || null,
      is_demo: !!v?.is_demo,
    }
  })

  return NextResponse.json({ drops: list })
}
