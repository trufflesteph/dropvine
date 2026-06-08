// GET /api/reviews/moderate/[token]
//
// One-shot link clicked from the ReviewModerationRequest email. Resolves
// the token via review_tokens, flips vendor_reviews.status accordingly,
// and stamps moderated_at + used_at. Redirects to a small HTML confirmation
// page so the moderator gets visual feedback in their browser.
//
// Mirrors the design of /api/launches/publish/[token] (one-shot magic link
// for vendor draft publish/schedule).

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function htmlPage({ title, message, ok = true, vendorSlug }) {
  const accent = ok ? '#2D4A2A' : '#7A1F1F'
  const cta = vendorSlug
    ? `<a href="/direct/${vendorSlug}" style="display:inline-block;margin-top:24px;padding:12px 22px;background:${accent};color:#FAFAF7;text-decoration:none;font-size:14px;letter-spacing:0.02em;">View the maker's profile →</a>`
    : `<a href="/" style="display:inline-block;margin-top:24px;padding:12px 22px;background:${accent};color:#FAFAF7;text-decoration:none;font-size:14px;letter-spacing:0.02em;">← Dropvine</a>`
  return new NextResponse(
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title} — Dropvine</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#FAFAF7;color:#1F1F1B;margin:0;padding:64px 24px;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .card{max-width:480px;width:100%;border:1px solid #E5E2DA;padding:48px 36px;background:#fff;text-align:left}
  h1{font-family:Georgia,"Times New Roman",serif;font-weight:300;font-size:32px;letter-spacing:-0.02em;margin:0 0 16px}
  p{color:#666;line-height:1.6;font-size:15px;margin:0 0 12px}
  .eyebrow{font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#999;margin-bottom:12px}
</style></head>
<body><div class="card">
  <div class="eyebrow">Review moderation</div>
  <h1>${title}</h1>
  <p>${message}</p>
  ${cta}
</div></body></html>`,
    { status: ok ? 200 : 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(_request, { params }) {
  const token = String(params?.token || '').trim()
  if (!token || token.length < 16) {
    return htmlPage({ title: "We couldn't find that link.", message: 'The moderation link is malformed.', ok: false })
  }

  const supa = getSupabaseAdmin()
  if (!supa) return htmlPage({ title: 'Server misconfigured', message: 'Supabase is not available.', ok: false })

  // 1) Resolve token.
  const { data: tok, error: tErr } = await supa
    .from('review_tokens')
    .select('id, review_id, action, used_at, expires_at')
    .eq('token', token)
    .maybeSingle()
  if (tErr) {
    if (/relation .* does not exist|could not find the table|schema cache/i.test(tErr.message)) {
      return htmlPage({ title: 'Not provisioned yet', message: 'The reviews tables are not provisioned in this environment.', ok: false })
    }
    return htmlPage({ title: 'Something went wrong', message: tErr.message, ok: false })
  }
  if (!tok) {
    return htmlPage({ title: "We couldn't find that link.", message: 'It may have already been used.', ok: false })
  }
  if (tok.used_at) {
    return htmlPage({ title: 'Already actioned', message: 'This moderation link has already been used.', ok: false })
  }
  if (tok.expires_at && new Date(tok.expires_at) < new Date()) {
    return htmlPage({ title: 'Link expired', message: 'Moderation links expire 30 days after the review is submitted.', ok: false })
  }
  if (!['approve', 'reject'].includes(tok.action)) {
    return htmlPage({ title: 'Invalid action', message: 'Unrecognised moderation action.', ok: false })
  }

  // 2) Apply the action on the review row. We also want the vendor slug
  // back so the confirmation page can offer "View the maker's profile →".
  const newStatus = tok.action === 'approve' ? 'published' : 'rejected'
  const nowIso = new Date().toISOString()
  const { data: review, error: uErr } = await supa
    .from('vendor_reviews')
    .update({ status: newStatus, moderated_at: nowIso })
    .eq('id', tok.review_id)
    .select('id, status, vendor:vendor_id (slug, business_name)')
    .maybeSingle()
  if (uErr || !review) {
    return htmlPage({ title: 'Could not update review', message: uErr?.message || 'Review not found.', ok: false })
  }

  // 3) Stamp token used (after the review update so a partial failure above
  // doesn't permanently burn the link — moderator can retry).
  await supa.from('review_tokens').update({ used_at: nowIso }).eq('id', tok.id)

  const vendorName = review.vendor?.business_name || 'this maker'
  const vendorSlug = review.vendor?.slug || null

  if (tok.action === 'approve') {
    return htmlPage({
      title: 'Review approved',
      message: `It's now live on ${vendorName}'s profile.`,
      vendorSlug,
    })
  }
  return htmlPage({
    title: 'Review rejected',
    message: `It will not be shown publicly on ${vendorName}'s profile.`,
    vendorSlug,
  })
}
