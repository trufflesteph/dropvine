// GET /api/direct/me
// POST /api/direct/me/tier-intent
//
// Tiny "who am I" endpoint for signed-in vendors. Used by the dashboard
// to look up the current vendor's tier (so the "New drop" CTA can route
// to the right Tally form) and by the signup flow to persist tier_intent
// before redirecting the new vendor to Tally.
//
// Auth model: relies on the `x-user-id` header — same convention every
// other dashboard endpoint uses (see /api/drops?creator=me). Service-role
// supabase client bypasses RLS so we get a predictable row regardless of
// policy drift.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function bad(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function GET(request) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return bad('missing x-user-id header', 401)

  const supa = getSupabaseAdmin()
  if (!supa) return bad('supabase not configured', 500)

  // Try selecting tier_intent first; fall back to the legacy columns if the
  // 2026-06 tier-intent migration hasn't been applied to this environment.
  let vendor = null
  let usedFallback = false
  {
    const { data, error } = await supa
      .from('direct_vendors')
      .select('id, slug, business_name, tier, tier_intent, active, category, location_city, location_state')
      .eq('creator_id', userId)
      .maybeSingle()
    if (error && /column .*tier_intent.* does not exist|schema cache/i.test(error.message)) {
      usedFallback = true
    } else if (error) {
      return bad(error.message, 500)
    } else {
      vendor = data || null
    }
  }
  if (usedFallback) {
    const { data, error } = await supa
      .from('direct_vendors')
      .select('id, slug, business_name, tier, active, category, location_city, location_state')
      .eq('creator_id', userId)
      .maybeSingle()
    if (error) return bad(error.message, 500)
    vendor = data ? { ...data, tier_intent: null } : null
  }
  // Also fetch the email so the dashboard can pass it through to Tally as a
  // hidden param. We pull from auth.users via the admin API since profiles
  // may not be in sync immediately after signup.
  let email = null
  try {
    const { data: { user } = {} } = await supa.auth.admin.getUserById(userId)
    email = user?.email || null
  } catch {}

  return NextResponse.json({ ok: true, vendor: vendor || null, email })
}

// POST body: { tier_intent: 'free' | 'maker' | 'shop' | null }
// Used by /signup right after a successful auth.signUp() so the chosen
// pricing tier persists on the row even if the visitor abandons the
// subsequent Tally form. Idempotent — no-op if vendor row not yet provisioned.
export async function POST(request) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return bad('missing x-user-id header', 401)

  let body = {}
  try { body = await request.json() } catch {}

  const intent = body?.tier_intent ? String(body.tier_intent).toLowerCase().trim() : null
  // Whitelist — keep this in lockstep with the pricing slugs the marketing
  // page emits. Anything else is rejected so the column can be relied on.
  const allowed = new Set([null, 'free', 'maker', 'shop'])
  if (!allowed.has(intent)) return bad('invalid tier_intent', 400)

  const supa = getSupabaseAdmin()
  if (!supa) return bad('supabase not configured', 500)

  const patch = { tier_intent: intent }
  const category = body?.category ? String(body.category).trim() : null
  const locationCity = body?.location_city ? String(body.location_city).trim() : null
  const locationState = body?.location_state ? String(body.location_state).trim() : null
  if (category) patch.category = category
  if (locationCity) patch.location_city = locationCity
  if (locationState) patch.location_state = locationState

  const { data, error } = await supa
    .from('direct_vendors')
    .update(patch)
    .eq('creator_id', userId)
    .select('id, tier_intent')
    .maybeSingle()
  if (error) {
    // If tier_intent column missing, surface a hint rather than a 500.
    if (/column .*tier_intent.* does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json({
        ok: false,
        error: 'tier_intent column not provisioned',
        hint: 'ALTER TABLE public.direct_vendors ADD COLUMN IF NOT EXISTS tier_intent TEXT NULL',
      }, { status: 503 })
    }
    return bad(error.message, 500)
  }

  // If no row matched (vendor trigger hasn't fired yet), return ok:false so
  // the caller can decide whether to retry. The signup flow can just move
  // on — tier_intent isn't load-bearing.
  if (!data) return NextResponse.json({ ok: false, error: 'vendor row not yet provisioned', vendor_id: null })

  return NextResponse.json({ ok: true, vendor_id: data.id, tier_intent: data.tier_intent })
}
