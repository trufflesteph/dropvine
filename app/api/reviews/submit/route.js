// GET /api/reviews/[id]         → resolve a pending review (for the form page)
// POST /api/reviews/submit      → shopper submits their review form
//
// Both endpoints are unauthenticated — they're brokered by the per-review
// magic-link UUID in the URL. The id alone is enough to read/write the row,
// which is fine because the id is only ever known to the shopper that
// received the review-request email.
//
// On submit:
//   • update vendor_reviews with rating/comment/reviewer_name
//   • generate two review_tokens rows (action='approve' + action='reject')
//   • send ReviewModerationRequest email to PLATFORM_OWNER_EMAIL
// The review STAYS at status='pending' until the platform owner clicks
// approve. Only 'published' rows show on the vendor profile.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { sendReviewModerationRequest } from '@/lib/email/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function bad(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

// POST /api/reviews/submit
// Body: { review_id, rating, comment?, reviewer_name? }
export async function POST(request) {
  let body = {}
  try { body = await request.json() } catch { return bad('invalid json body') }

  const reviewId = String(body?.review_id || '').trim()
  const rating = Math.round(Number(body?.rating || 0))
  const comment = body?.comment ? String(body.comment).trim().slice(0, 2000) : null
  const reviewerName = body?.reviewer_name ? String(body.reviewer_name).trim().slice(0, 120) : null

  if (!reviewId || !/^[0-9a-f-]{36}$/i.test(reviewId)) return bad('invalid review_id')
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return bad('rating must be 1-5')

  const supa = getSupabaseAdmin()
  if (!supa) return bad('supabase not configured', 500)

  // Resolve the pending review (need vendor + drop joins for the moderation email).
  const { data: review, error: rErr } = await supa
    .from('vendor_reviews')
    .select(`
      id, vendor_id, drop_id, status, reviewer_email, reviewer_name,
      vendor:vendor_id (business_name, slug, tier),
      drop:drop_id (title, handle)
    `)
    .eq('id', reviewId)
    .maybeSingle()
  if (rErr) {
    if (/relation .* does not exist|could not find the table|schema cache/i.test(rErr.message)) {
      return bad('vendor_reviews table not provisioned', 503)
    }
    return bad(rErr.message, 500)
  }
  if (!review) return bad('review not found', 404)
  if (review.status !== 'pending') return bad('review already submitted', 409)

  // Persist the shopper's input.
  const finalName = reviewerName || review.reviewer_name || null
  const { error: uErr } = await supa
    .from('vendor_reviews')
    .update({ rating, comment, reviewer_name: finalName })
    .eq('id', reviewId)
  if (uErr) return bad(uErr.message, 500)

  // Generate moderation tokens (random hex strings via gen_random_bytes
  // defaults on the table). Two rows: approve + reject.
  const { data: tokRows, error: tErr } = await supa
    .from('review_tokens')
    .insert([
      { review_id: reviewId, action: 'approve' },
      { review_id: reviewId, action: 'reject' },
    ])
    .select('id, action, token')
  if (tErr) return bad(tErr.message, 500)

  const approveTok = tokRows?.find((t) => t.action === 'approve')?.token
  const rejectTok = tokRows?.find((t) => t.action === 'reject')?.token

  // Send the moderation-request email to the platform owner. Fire-and-
  // forget — never block the shopper response on it.
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://dropvine.pro').replace(/\/$/, '')
  const approveUrl = approveTok ? `${baseUrl}/api/reviews/moderate/${approveTok}` : null
  const rejectUrl = rejectTok ? `${baseUrl}/api/reviews/moderate/${rejectTok}` : null
  sendReviewModerationRequest({
    vendorName: review.vendor?.business_name || null,
    dropTitle: review.drop?.title || null,
    reviewerName: finalName,
    reviewerEmail: review.reviewer_email,
    rating,
    comment,
    approveUrl,
    rejectUrl,
  }).catch((e) => console.warn('[reviews/submit] moderation email failed:', e?.message || e))

  return NextResponse.json({
    ok: true,
    review: { id: reviewId, status: 'pending', vendor_name: review.vendor?.business_name || null },
  })
}
