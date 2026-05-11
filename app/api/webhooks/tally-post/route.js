// Tally webhook for vendor POST submissions (a.k.a. "this week's update from the farm").
// Vendors fill out a Tally form, Tally POSTs JSON here, we store it in
// post_submissions with status='pending' for an organiser to approve.
//
// Header: tally-signature  → HMAC-SHA256(rawBody, TALLY_WEBHOOK_SECRET) base64
// If TALLY_WEBHOOK_SECRET is empty (placeholder), the route still accepts.
//
// Body shape (Tally standard):
//   { eventId, eventType: 'FORM_RESPONSE', data: { responseId, fields: [{label,value,type}, ...] } }
//
// We do NOT trust the form to map vendor_id directly — we look up vendor by
// email match against vendors.email, falling back to creating a row with
// vendor_id=null + vendor_email captured for organiser triage.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import {
  isTallySecretConfigured,
  verifyTallySignature,
  getTallyEmail,
} from '@/lib/markets/tally'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('tally-signature')
    const verify = verifyTallySignature({ rawBody, signature })
    if (!verify.ok) {
      console.warn('[tally-post] signature failed:', verify.reason)
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
    }
    if (verify.placeholder) {
      console.warn('[tally-post] PLACEHOLDER MODE — TALLY_WEBHOOK_SECRET is empty; accepting unsigned webhook')
    }

    let body
    try { body = JSON.parse(rawBody) } catch {
      return NextResponse.json({ error: 'invalid json' }, { status: 400 })
    }

    const fields = body?.data?.fields || []
    const vendorEmail = (getTallyEmail(fields) || '').trim().toLowerCase() || null

    const supa = getSupabaseAdmin()
    if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

    // Best-effort vendor match by email
    let vendorId = null
    if (vendorEmail) {
      const { data: vendor } = await supa
        .from('vendors').select('id').eq('email', vendorEmail).maybeSingle()
      vendorId = vendor?.id || null
    }

    const { data, error } = await supa.from('post_submissions').insert({
      vendor_id: vendorId,
      vendor_email: vendorEmail,
      raw_payload: body,
      status: 'pending',
    }).select('*').single()

    if (error) {
      console.error('[tally-post] insert failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      submission_id: data.id,
      vendor_id: vendorId,
      placeholder: !!verify.placeholder || !isTallySecretConfigured(),
    })
  } catch (e) {
    console.error('[tally-post] unexpected:', e?.message || e)
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 })
  }
}

// Lightweight health check (no auth required). Useful for Tally's webhook
// connection-test step.
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: 'tally-post',
    secret_configured: isTallySecretConfigured(),
  })
}
