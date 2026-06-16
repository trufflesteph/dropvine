// POST /api/submission-token
//
// Called by the vendor dashboard "New drop" button. Snapshots the vendor's
// current profile into pending_submissions, generates a short-lived token,
// and returns it so the dashboard can append ?token=... to the Tally URL.
//
// Auth: x-user-id header (service-role client bypasses RLS, same as every
// other dashboard endpoint).

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function bad(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function POST(request) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return bad('missing x-user-id', 401)

  const supa = getSupabaseAdmin()
  if (!supa) return bad('supabase not configured', 500)

  // Fetch the vendor row — we need the id (PK) and profile snapshot.
  const { data: vendor, error: vErr } = await supa
    .from('direct_vendors')
    .select('id, business_name, category, location_city, location_state')
    .eq('creator_id', userId)
    .maybeSingle()

  if (vErr) return bad(vErr.message, 500)
  if (!vendor) return bad('vendor profile not found — complete signup first', 404)

  // Resolve email from the auth user record.
  let email = null
  try {
    const { data: { user } = {} } = await supa.auth.admin.getUserById(userId)
    email = user?.email || null
  } catch {}
  if (!email) return bad('could not resolve vendor email', 500)

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { error: insErr } = await supa
    .from('pending_submissions')
    .insert({
      token,
      vendor_id: vendor.id,
      vendor_email: email,
      business_name: vendor.business_name || null,
      business_category: vendor.category || null,
      location_city: vendor.location_city || null,
      location_state: vendor.location_state || null,
      expires_at: expiresAt,
    })

  if (insErr) return bad(insErr.message, 500)

  return NextResponse.json({ ok: true, token, expires_at: expiresAt })
}
