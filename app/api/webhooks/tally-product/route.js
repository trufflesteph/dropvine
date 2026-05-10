// Tally webhook for vendor PRODUCT submissions.
// Identical contract to /api/webhooks/tally-post but stored in product_submissions.

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
      console.warn('[tally-product] signature failed:', verify.reason)
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
    }
    if (verify.placeholder) {
      console.warn('[tally-product] PLACEHOLDER MODE — TALLY_WEBHOOK_SECRET is empty; accepting unsigned webhook')
    }

    let body
    try { body = JSON.parse(rawBody) } catch {
      return NextResponse.json({ error: 'invalid json' }, { status: 400 })
    }

    const fields = body?.data?.fields || []
    const vendorEmail = (getTallyEmail(fields) || '').trim().toLowerCase() || null

    const supa = getSupabaseAdmin()
    if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

    let vendorId = null
    if (vendorEmail) {
      const { data: vendor } = await supa
        .from('vendors').select('id').eq('email', vendorEmail).maybeSingle()
      vendorId = vendor?.id || null
    }

    const { data, error } = await supa.from('product_submissions').insert({
      vendor_id: vendorId,
      vendor_email: vendorEmail,
      raw_payload: body,
      status: 'pending',
    }).select('*').single()

    if (error) {
      console.error('[tally-product] insert failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      submission_id: data.id,
      vendor_id: vendorId,
      placeholder: !!verify.placeholder || !isTallySecretConfigured(),
    })
  } catch (e) {
    console.error('[tally-product] unexpected:', e?.message || e)
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: 'tally-product',
    secret_configured: isTallySecretConfigured(),
  })
}
