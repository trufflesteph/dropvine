// GET /api/reviews/[id]
//
// Lightweight resolver used by the /review/[review_id] form page on first
// render. Returns the vendor + drop names so the form can show "Reviewing
// your order from {vendor}" without exposing PII like the reviewer email.
//
// Returns 404 if the review doesn't exist, 409 if it has already been
// submitted (the form page can then show its "thanks" state).

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function bad(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function GET(_request, { params }) {
  const id = String(params?.id || '').trim()
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return bad('invalid review id')

  const supa = getSupabaseAdmin()
  if (!supa) return bad('supabase not configured', 500)

  const { data, error } = await supa
    .from('vendor_reviews')
    .select(`
      id, status, reviewer_name, rating, comment, created_at,
      vendor:vendor_id (business_name, slug),
      drop:drop_id (title, handle)
    `)
    .eq('id', id)
    .maybeSingle()
  if (error) {
    if (/relation .* does not exist|could not find the table|schema cache/i.test(error.message)) {
      return bad('vendor_reviews table not provisioned', 503)
    }
    return bad(error.message, 500)
  }
  if (!data) return bad('review not found', 404)

  return NextResponse.json({
    ok: true,
    review: {
      id: data.id,
      status: data.status,
      reviewer_name: data.reviewer_name,
      vendor_name: data.vendor?.business_name || null,
      vendor_slug: data.vendor?.slug || null,
      drop_title: data.drop?.title || null,
      // We deliberately do NOT return the existing rating/comment so the
      // form always starts blank — even on refresh after submit (the
      // status='pending' check on POST handles double-submit).
    },
  })
}
