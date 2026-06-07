// POST /api/direct/[slug]/follow
//
// Public endpoint that lets a visitor "follow" a Dropvine Direct vendor
// from the /direct/[slug] page. Idempotent — second call with the same
// (vendor_id, follower_email) upserts the row so the visitor can flip
// sms_opt_in on/off without creating duplicates.
//
// Only Shop-tier vendors can be followed (returns 403 otherwise) — this is
// a Shop-tier-exclusive feature.
//
// Body: { email, name?, phone?, sms_opt_in? }
// Returns: { ok, follower: { id, sms_opt_in } }

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function bad(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function POST(request, { params }) {
  const slug = String(params?.slug || '').trim().toLowerCase()
  if (!slug) return bad('invalid slug')

  let body = {}
  try { body = await request.json() } catch { return bad('invalid json body') }

  const email = String(body?.email || '').trim().toLowerCase()
  const name = body?.name ? String(body.name).trim().slice(0, 120) : null
  const phone = body?.phone ? String(body.phone).trim().slice(0, 32) : null
  const smsOptIn = Boolean(body?.sms_opt_in) && !!phone
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('valid email required')

  const supa = getSupabaseAdmin()
  if (!supa) return bad('supabase not configured', 500)

  // Resolve vendor by slug — must be active + Shop tier.
  const { data: vendor, error: vErr } = await supa
    .from('direct_vendors')
    .select('id, business_name, slug, tier, active')
    .ilike('slug', slug)
    .maybeSingle()
  if (vErr) return bad(vErr.message, 500)
  if (!vendor || vendor.active === false) return bad('vendor not found', 404)
  if (vendor.tier !== 'shop') {
    return bad('follow is a Shop-tier feature only', 403)
  }

  // Upsert on (vendor_id, follower_email) so a returning visitor can flip
  // sms_opt_in on/off without dupes. Conflict target matches the unique
  // constraint added by the 2026-06-direct-vendor-follows migration.
  const payload = {
    vendor_id: vendor.id,
    follower_email: email,
    follower_name: name,
    follower_phone: phone,
    sms_opt_in: smsOptIn,
  }
  const { data: upserted, error: uErr } = await supa
    .from('direct_vendor_follows')
    .upsert(payload, { onConflict: 'vendor_id,follower_email' })
    .select('id, sms_opt_in')
    .maybeSingle()
  if (uErr) {
    if (/relation .* does not exist|could not find the table|schema cache/i.test(uErr.message)) {
      return NextResponse.json({
        ok: false,
        error: 'direct_vendor_follows table not provisioned yet',
        hint: 'Run supabase/migrations/2026-06-direct-vendor-follows.sql',
      }, { status: 503 })
    }
    return bad(uErr.message, 500)
  }

  return NextResponse.json({ ok: true, follower: upserted, vendor: { name: vendor.business_name } })
}

// GET /api/direct/[slug]/follow → return follower count (no PII).
// Useful for the "X followers" display on the public profile page.
export async function GET(_request, { params }) {
  const slug = String(params?.slug || '').trim().toLowerCase()
  if (!slug) return bad('invalid slug')
  const supa = getSupabaseAdmin()
  if (!supa) return bad('supabase not configured', 500)

  const { data: vendor } = await supa
    .from('direct_vendors')
    .select('id, tier, active')
    .ilike('slug', slug)
    .maybeSingle()
  if (!vendor || vendor.active === false) return bad('vendor not found', 404)
  if (vendor.tier !== 'shop') {
    return NextResponse.json({ ok: true, count: 0, eligible: false })
  }

  const { count, error } = await supa
    .from('direct_vendor_follows')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', vendor.id)
  if (error && /relation .* does not exist|could not find the table|schema cache/i.test(error.message)) {
    return NextResponse.json({ ok: true, count: 0, eligible: true, note: 'table not yet provisioned' })
  }
  if (error) return bad(error.message, 500)

  return NextResponse.json({ ok: true, count: count || 0, eligible: true })
}
