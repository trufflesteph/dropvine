// GET /api/direct/[slug]
//
// Public endpoint that resolves the vendor by slug and returns the vendor row
// (active-only) plus every published drop they've created, oldest-pending
// first then most-recent.
//
// Anonymous read — relies on the "Public can view active direct vendors" RLS
// policy on direct_vendors. Returns 404 if vendor is missing or inactive.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const slug = String(params?.slug || '').trim().toLowerCase()
  if (!slug) return NextResponse.json({ error: 'invalid slug' }, { status: 400 })

  // Service-role read — bypasses RLS for a clean 404 vs 403 distinction.
  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const { data: vendor, error: vErr } = await supa
    .from('direct_vendors').select('*')
    .ilike('slug', slug).maybeSingle()
  if (vErr) {
    // Table missing? Surface 503 + migration hint.
    if (/could not find the table|relation .* does not exist|schema cache/i.test(vErr.message)) {
      return NextResponse.json({
        error: 'direct_vendors table not provisioned yet',
        hint: 'Run supabase/migrations/2026-06-direct-vendors.sql',
      }, { status: 503 })
    }
    return NextResponse.json({ error: vErr.message }, { status: 500 })
  }
  if (!vendor || vendor.active === false) {
    return NextResponse.json({ error: 'vendor not found' }, { status: 404 })
  }

  // Resolve their published drops. Sort: upcoming (launch_at >= now) ascending
  // by launch_at so the next-up drop is first; then past drops descending.
  let drops = []
  let upcoming = []
  let past = []
  if (vendor.creator_id) {
    // Inner alias `rows` avoids shadowing the outer accumulator `drops` —
    // line 58 below reassigns the outer one with [...upcoming, ...past].
    const { data: rows } = await supa
      .from('drops').select('*')
      .eq('creator_id', vendor.creator_id)
      .in('status', ['published', 'scheduled'])
      .order('launch_at', { ascending: true })
    const now = Date.now()
    for (const l of (rows || [])) {
      const t = l.launch_at ? Date.parse(l.launch_at) : 0
      if (t && t >= now) upcoming.push(l); else past.push(l)
    }
    past.sort((a, b) => Date.parse(b.launch_at || 0) - Date.parse(a.launch_at || 0))
    drops = [...upcoming, ...past]
  }

  return NextResponse.json({
    vendor: {
      id: vendor.id,
      business_name: vendor.business_name,
      slug: vendor.slug,
      bio: vendor.bio,
      logo_url: vendor.logo_url,
      photo_url: vendor.photo_url,
      venmo_handle: vendor.venmo_handle,
      instagram_url: vendor.instagram_url,
      website_url: vendor.website_url,
      tier: vendor.tier,
      category: vendor.category || null,
      location_city: vendor.location_city || null,
      location_state: vendor.location_state || null,
    },
    drops,
    counts: { total: drops.length, upcoming: upcoming.length, past: past.length },
  })
}
