// GET /api/direct/me
// POST /api/direct/me/tier-intent
//
// Tiny "who am I" endpoint for signed-in vendors. Used by the dashboard
// to look up the current vendor's tier (so the "New drop" CTA can route
// to the right Tally form; trial_ends_at for the trial line). GET creates
// the vendor's direct_vendors row if it's missing (lib/vendors/provision.js),
// and copies the category and location saved in auth metadata at signup
// onto the row, the first time the vendor is seen with a session.
//
// Auth: the signed-in user from the Supabase session (lib/auth/server-user.js);
// 401 without one. Service-role supabase client bypasses RLS so we get a
// predictable row regardless of policy drift.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getSignedInUserId } from '@/lib/auth/server-user'
import { normalizeLocation, normalizeLocationEdit, US_STATES } from '@/lib/location'
import { PROFILE_FIELDS, isMissingPhoneColumn } from '@/lib/vendors/profile'
import { createVendorRow } from '@/lib/vendors/provision'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Profile columns the settings page reads and gets back after a save. phone
// is handled separately: it doesn't exist until
// supabase/migrations/2026-10-direct-vendors-phone.sql is applied.
const PROFILE_COLUMNS = 'bio, photo_url, logo_url, instagram_url, website_url, venmo_handle'
const VENDOR_COLUMNS = `id, slug, business_name, tier, tier_intent, trial_ends_at, active, category, location_city, location_state, ${PROFILE_COLUMNS}`

function bad(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function GET(request) {
  const userId = await getSignedInUserId(request)
  if (!userId) return bad('not signed in', 401)

  const supa = getSupabaseAdmin()
  if (!supa) return bad('supabase not configured', 500)

  // Try selecting tier_intent and trial_ends_at first; fall back to the legacy
  // columns if either migration hasn't been applied to this environment.
  let vendor = null
  let usedFallback = false
  {
    const { data, error } = await supa
      .from('direct_vendors')
      .select(VENDOR_COLUMNS)
      .eq('creator_id', userId)
      .maybeSingle()
    if (error && /column .*(tier_intent|trial_ends_at).* does not exist|schema cache/i.test(error.message)) {
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
      .select(`id, slug, business_name, tier, active, category, location_city, location_state, ${PROFILE_COLUMNS}`)
      .eq('creator_id', userId)
      .maybeSingle()
    if (error) return bad(error.message, 500)
    vendor = data ? { ...data, tier_intent: null, trial_ends_at: null } : null
  }
  // Also fetch the email so the dashboard can pass it through to Tally as a
  // hidden param. We pull from auth.users via the admin API since profiles
  // may not be in sync immediately after signup.
  let authUser = null
  let authError = null
  try {
    const { data: { user } = {}, error } = await supa.auth.admin.getUserById(userId)
    authUser = user || null
    authError = error?.message || null
  } catch (e) {
    authError = e?.message || String(e)
  }
  const email = authUser?.email || null

  // No row: create it now, so the dashboard and settings work.
  if (!vendor) {
    const { vendor: created, error } = authUser
      ? await createVendorRow(supa, authUser, VENDOR_COLUMNS)
      : { vendor: null, error: `could not load the signed-in user: ${authError || 'not found'}` }
    if (error) {
      console.error('[direct/me] vendor row not created', { user_id: userId, error })
      return bad(`We couldn’t set up your vendor profile: ${error}`, 500)
    }
    vendor = created
  }
  // Read on its own so a database without the phone column still returns
  // the rest of the row.
  {
    const { data, error } = await supa.from('direct_vendors').select('phone').eq('id', vendor.id).maybeSingle()
    vendor = { ...vendor, phone: error ? null : (data?.phone ?? null) }
  }

  if (authUser) vendor = await copySignupProfile(supa, authUser, vendor)

  return NextResponse.json({ ok: true, vendor: vendor || null, email })
}

// /signup stores category and location in the auth user's metadata at
// signUp, because a browser write to direct_vendors right after signUp can
// run before there's a session (401) and get lost. Copy them onto the vendor
// row once: fill only empty columns, then stamp app_metadata (which users
// can't edit) so a later change to the row is never overwritten.
async function copySignupProfile(supa, user, vendor) {
  if (user.app_metadata?.signup_profile_copied_at) return vendor
  const meta = user.user_metadata || {}
  // Canonical form ("West Linn" / "OR") — see lib/location.js.
  const location = normalizeLocation(meta.location_city, meta.location_state)
  const category = meta.category ? String(meta.category).trim() : ''
  if (!location.city && !location.state && !category) return vendor

  if (!vendor) {
    // Still safe in metadata; copied on a later load once the row exists.
    console.error('[direct/me] signup location not saved', { vendor_id: null, user_id: user.id, error: 'no direct_vendors row for user' })
    return vendor
  }

  const patch = {}
  if (!vendor.location_city && location.city) patch.location_city = location.city
  if (!vendor.location_state && location.state) patch.location_state = location.state
  if (!vendor.category && category) patch.category = category

  try {
    if (Object.keys(patch).length) {
      const { error } = await supa.from('direct_vendors').update(patch).eq('id', vendor.id)
      if (error) {
        console.error('[direct/me] signup location not saved', { vendor_id: vendor.id, user_id: user.id, error: error.message })
        return vendor
      }
    }
    // Spread the existing app_metadata so nothing in it is replaced.
    const { error: stampError } = await supa.auth.admin.updateUserById(user.id, {
      app_metadata: { ...(user.app_metadata || {}), signup_profile_copied_at: new Date().toISOString() },
    })
    // Not data loss — the next load just finds the columns filled and skips them.
    if (stampError) console.warn('[direct/me] could not mark signup profile copied', { vendor_id: vendor.id, user_id: user.id, error: stampError.message })
  } catch (e) {
    console.error('[direct/me] signup location not saved', { vendor_id: vendor.id, user_id: user.id, error: e?.message || String(e) })
    return vendor
  }

  return { ...vendor, ...patch }
}

// POST body: { tier_intent?: 'free' | 'maker' | 'shop' | null, category?,
//              location_city?, location_state?, bio?, phone?, instagram_url?,
//              website_url?, venmo_handle? }
// /dashboard/settings saves the profile and "Where you're based" here. When
// either location field is sent, both are written: city and state must be
// set together (US state code), or both blank to clear. Profile fields are
// normalized by lib/vendors/profile.js; only the ones sent are written, and
// '' clears one. /signup no longer calls this (it saves category and
// location in auth metadata; see copySignupProfile). Only the signed-in
// user's own row is updated. Idempotent — no-op if vendor row not yet
// provisioned.
export async function POST(request) {
  const userId = await getSignedInUserId(request)
  if (!userId) return bad('not signed in', 401)

  let body = {}
  try { body = await request.json() } catch {}

  const intent = body?.tier_intent ? String(body.tier_intent).toLowerCase().trim() : null
  // Whitelist — keep this in lockstep with the pricing slugs the marketing
  // page emits. Anything else is rejected so the column can be relied on.
  const allowed = new Set([null, 'free', 'maker', 'shop'])
  if (!allowed.has(intent)) return bad('invalid tier_intent', 400)

  const supa = getSupabaseAdmin()
  if (!supa) return bad('supabase not configured', 500)

  // Signup no longer sends tier_intent; only write it when the caller does.
  const patch = {}
  if ('tier_intent' in body) patch.tier_intent = intent
  const category = body?.category ? String(body.category).trim() : null
  if (category) patch.category = category
  const hasLocation = 'location_city' in body || 'location_state' in body
  if (hasLocation) {
    // Canonical form ("West Linn" / "OR") — see lib/location.js.
    const location = normalizeLocationEdit(body.location_city, body.location_state)
    if (location.error) return bad(location.error, 400)
    if (location.state && !US_STATES[location.state]) return bad('Choose a US state.', 400)
    patch.location_city = location.city || null
    patch.location_state = location.state || null
  }
  const fieldErrors = {}
  for (const [field, normalize] of Object.entries(PROFILE_FIELDS)) {
    if (!(field in body)) continue
    const { value, error } = normalize(body[field])
    if (error) fieldErrors[field] = error
    else patch[field] = value
  }
  if (Object.keys(fieldErrors).length) {
    return NextResponse.json({ ok: false, error: Object.values(fieldErrors)[0], errors: fieldErrors }, { status: 400 })
  }
  if (!Object.keys(patch).length) return NextResponse.json({ ok: true, vendor_id: null, skipped: 'nothing to update' })

  const update = (p) => supa
    .from('direct_vendors')
    .update(p)
    .eq('creator_id', userId)
    .select(`id, tier_intent, location_city, location_state, ${PROFILE_COLUMNS}${'phone' in p ? ', phone' : ''}`)
    .maybeSingle()
  let { data, error } = await update(patch)
  // No phone column yet: save everything else and report phone on its own.
  let phoneError = null
  if (error && 'phone' in patch && isMissingPhoneColumn(error)) {
    console.error('[direct/me] phone not saved', { user_id: userId, error: error.message })
    phoneError = 'Phone numbers can’t be saved yet. Please try again later.'
    const { phone, ...rest } = patch
    if (!Object.keys(rest).length) {
      return NextResponse.json({ ok: false, error: phoneError, errors: { phone: phoneError } }, { status: 503 })
    }
    ;({ data, error } = await update(rest))
  }
  if (error && hasLocation) {
    console.error('[direct/me] location not saved', { vendor_id: null, user_id: userId, error: error.message })
  }
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
  if (!data) {
    if (hasLocation) {
      console.error('[direct/me] location not saved', { vendor_id: null, user_id: userId, error: 'vendor row not yet provisioned' })
    }
    return NextResponse.json({ ok: false, error: 'vendor row not yet provisioned', vendor_id: null })
  }

  // `vendor` carries the saved, normalized values for the settings page.
  if (phoneError) {
    return NextResponse.json({
      ok: false, partial: true, error: `${phoneError} Your other changes were saved.`,
      errors: { phone: phoneError }, vendor_id: data.id, vendor: data,
    })
  }
  return NextResponse.json({
    ok: true, vendor_id: data.id, tier_intent: data.tier_intent,
    location_city: data.location_city, location_state: data.location_state,
    vendor: data,
  })
}
