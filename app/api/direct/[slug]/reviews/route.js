// GET /api/direct/[slug]/reviews
//
// Public endpoint that returns the published reviews for a Shop-tier
// vendor profile (`/direct/[slug]`).
//
// Constraints baked in:
//   • Only Shop-tier vendors expose reviews. Free / Maker → eligible:false.
//   • Only status='published' rows are returned (pending / rejected hidden).
//   • Reviewer name is anonymised on the wire: "Sarah J." style.
//   • Most recent first, capped at 50 in a single response.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function bad(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

// Anonymise "Sarah Johnson" → "Sarah J." Falls back to "Anonymous" if
// the name is missing for any reason.
function anonymiseName(name) {
  const trimmed = String(name || '').trim()
  if (!trimmed) return 'Anonymous'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0]
  const first = parts[0]
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase()
  return `${first} ${lastInitial}.`
}

export async function GET(_request, { params }) {
  const slug = String(params?.slug || '').trim().toLowerCase()
  if (!slug) return bad('invalid slug')

  const supa = getSupabaseAdmin()
  if (!supa) return bad('supabase not configured', 500)

  const { data: vendor, error: vErr } = await supa
    .from('direct_vendors')
    .select('id, business_name, slug, tier, active')
    .ilike('slug', slug)
    .maybeSingle()
  if (vErr) return bad(vErr.message, 500)
  if (!vendor || vendor.active === false) return bad('vendor not found', 404)

  // Shop-tier-only constraint — return empty payload for other tiers so the
  // UI can simply not render the section.
  if (vendor.tier !== 'shop') {
    return NextResponse.json({ ok: true, eligible: false, count: 0, average: null, reviews: [] })
  }

  const { data: rows, error: rErr } = await supa
    .from('vendor_reviews')
    .select('id, rating, comment, reviewer_name, is_verified_purchase, created_at, drop:drop_id (title, handle)')
    .eq('vendor_id', vendor.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50)
  if (rErr) {
    if (/relation .* does not exist|could not find the table|schema cache/i.test(rErr.message)) {
      return NextResponse.json({ ok: true, eligible: true, count: 0, average: null, reviews: [], note: 'table not provisioned' })
    }
    return bad(rErr.message, 500)
  }

  const reviews = (rows || []).map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    reviewer_name: anonymiseName(r.reviewer_name),
    is_verified_purchase: !!r.is_verified_purchase,
    created_at: r.created_at,
    drop_title: r.drop?.title || null,
  }))

  const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0)
  const average = reviews.length ? Number((sum / reviews.length).toFixed(1)) : null

  return NextResponse.json({
    ok: true,
    eligible: true,
    count: reviews.length,
    average,
    reviews,
  })
}
