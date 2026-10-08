// POST /api/premium-waitlist
// Body: { first_name, email, business_name?, website? }
// `website` is a honeypot: any value → { ok: true } with nothing saved or sent.
// A blank business_name is stored as null.
//
// Public sign-up for the Premium Shop Annual waitlist (the form on the
// homepage Premium card). Writes premium_annual_waitlist with the service-role
// client; the table has RLS on and no policies, so nothing else can.
//
// A repeat email is not an error: it adds no row, sends no email, and returns
// the same { ok: true } as a new sign-up (so the response doesn't reveal who
// is already on the list). A new sign-up gets one confirmation email.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { sendPremiumWaitlistConfirmation } from '@/lib/email/notifications'
import { HOME_COPY_DEFAULTS } from '@/lib/site-config/home-copy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function bad(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

// Same price the homepage card shows: site_config.home_tier_premium_price,
// falling back to the homepage default ("$455").
async function getPremiumPrice(supa) {
  try {
    const { data } = await supa.from('site_config').select('value').eq('key', 'home_tier_premium_price').maybeSingle()
    return (data?.value || '').trim() || HOME_COPY_DEFAULTS.home_tier_premium_price
  } catch {
    return HOME_COPY_DEFAULTS.home_tier_premium_price
  }
}

export async function POST(request) {
  let body = {}
  try { body = await request.json() } catch {}

  // Honeypot: the form's hidden "website" field is only ever filled by bots.
  // Look like success, save nothing, send nothing.
  if (body?.website) return NextResponse.json({ ok: true })

  const firstName = String(body?.first_name || '').trim()
  const email = String(body?.email || '').trim().toLowerCase()
  const businessName = String(body?.business_name || '').trim() || null
  if (!firstName || firstName.length > 100) return bad('Please enter your first name.')
  if (!EMAIL_RE.test(email) || email.length > 254) return bad('Please enter a valid email.')
  if (businessName && businessName.length > 200) return bad('Business name is too long.')

  const supa = getSupabaseAdmin()
  if (!supa) return bad('Sign-ups are unavailable right now.', 503)

  // ignoreDuplicates: a repeat email inserts nothing and returns no row.
  const { data, error } = await supa
    .from('premium_annual_waitlist')
    .upsert({ email, first_name: firstName, business_name: businessName }, { onConflict: 'email', ignoreDuplicates: true })
    .select('id')
  if (error) {
    console.error('[premium-waitlist] insert failed:', error.message)
    return bad('Something went wrong. Please try again.', 500)
  }

  const isNew = Array.isArray(data) && data.length > 0
  if (isNew) {
    // Awaited so the send finishes before the function returns; a failed
    // send is logged by sendOne and never fails the sign-up.
    const price = await getPremiumPrice(supa)
    await sendPremiumWaitlistConfirmation({ to: email, firstName, price })
  }

  return NextResponse.json({ ok: true })
}
