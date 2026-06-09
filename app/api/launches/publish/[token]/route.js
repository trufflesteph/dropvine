// /api/launches/publish/[token]
//
// One-shot link clicked from the DropSubmissionConfirmation email.
// NOTE: URL path intentionally preserved as `/api/launches/publish/...` so
// that previously-sent vendor emails don't 404. Internally everything talks
// to the renamed `drops` table.
//
// On a valid token:
//   • publish_action='publish'  → drops.status = 'published'
//   • publish_action='schedule' → drops.status = 'scheduled'
// Either way:
//   • release every email_schedules.hold for this drop
//   • stamp publish_tokens.used_at = now()
//   • 302 redirect to /l/[handle]
//
// On an invalid/used/expired token: render a small standalone error page
// with a mailto:hello@dropvine.pro link. We return HTML (not JSON) because
// the vendor reaches this URL from an email client and expects a webpage.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { sendDropOpenedFanout, sendDropPublishConfirmation } from '@/lib/email/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function htmlError(status, { title, message, hint }) {
  // Minimal inline HTML — must work with no JS, no external CSS. Matches the
  // brand neutrals from lib/email/templates/_shared.jsx.
  const body = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — Dropvine</title>
<style>
  body { font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; background:#FAFAF7; color:#0E0E0C; margin:0; padding:0; }
  .wrap { max-width: 560px; margin: 0 auto; padding: 80px 24px; }
  .eyebrow { font-size:11px; letter-spacing:.25em; text-transform:uppercase; color:#6B6863; margin-bottom:16px; }
  h1 { font-family: 'Cormorant Garamond', 'Times New Roman', Georgia, serif; font-weight:300; font-size:42px; line-height:1.05; letter-spacing:-0.025em; margin:0 0 24px; }
  p { line-height: 1.6; color:#3D3B36; margin: 0 0 16px; font-size:15px; }
  a.btn { display:inline-block; margin-top:24px; padding:14px 22px; background:#0E0E0C; color:#FAFAF7; text-decoration:none; font-size:13px; letter-spacing:.05em; }
  a { color:#0E0E0C; }
</style></head><body>
<div class="wrap">
  <div class="eyebrow">${status === 410 ? 'Link expired' : 'Link not valid'}</div>
  <h1>${title}</h1>
  <p>${message}</p>
  ${hint ? `<p>${hint}</p>` : ''}
  <a class="btn" href="mailto:hello@dropvine.pro?subject=Publish%20link%20issue">Email hello@dropvine.pro</a>
</div>
</body></html>`
  return new NextResponse(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

export async function GET(request, { params }) {
  const token = params?.token
  if (!token || typeof token !== 'string') {
    return htmlError(400, {
      title: 'This publish link is missing or malformed.',
      message: 'The URL appears incomplete. Please check the link in your confirmation email or contact support.',
    })
  }

  const supa = getSupabaseAdmin()
  if (!supa) return htmlError(500, { title: 'Server misconfigured', message: 'Supabase admin client unavailable.' })

  // 1) Look up the token.
  const { data: tok, error: tokErr } = await supa
    .from('publish_tokens')
    .select('id, drop_id, publish_action, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()
  if (tokErr) {
    if (/could not find the table|relation .* does not exist|schema cache/i.test(tokErr.message)) {
      return htmlError(503, {
        title: 'Publish flow not yet activated.',
        message: 'The platform owner needs to apply the migration supabase/migrations/2026-06-publish-tokens-and-holds.sql before this link will work.',
      })
    }
    return htmlError(500, { title: 'Could not verify your link.', message: tokErr.message })
  }
  if (!tok) {
    return htmlError(404, {
      title: 'We couldn’t find that publish link.',
      message: 'It may have been copy-pasted incorrectly, or you may be using a draft of an older email.',
      hint: 'Open the most recent “Your drop is ready to preview” email and try again.',
    })
  }
  if (tok.used_at) {
    return htmlError(410, {
      title: 'This link has already been used.',
      message: 'Your drop has already been published or scheduled — no further action needed.',
      hint: 'Visit your dashboard to see the live drop, or email us if something looks wrong.',
    })
  }
  if (tok.expires_at && new Date(tok.expires_at).getTime() < Date.now()) {
    return htmlError(410, {
      title: 'This publish link has expired.',
      message: 'Publish links are valid for 7 days. If your drop is still in draft, please resubmit the Tally form or contact support and we’ll send a fresh link.',
    })
  }

  // 2) Decide the terminal status.
  const action = tok.publish_action === 'schedule' ? 'schedule' : 'publish'
  const newStatus = action === 'schedule' ? 'scheduled' : 'published'

  // 3) Flip the drop + grab the handle for the redirect.
  const { data: drop, error: dropErr } = await supa
    .from('drops')
    .update({ status: newStatus })
    .eq('id', tok.drop_id)
    .select('*')
    .maybeSingle()
  if (dropErr || !drop) {
    return htmlError(500, { title: 'Could not update your drop.', message: dropErr?.message || 'drop not found' })
  }

  // 4) Release every email_schedules hold for this drop. Tolerates the
  //    column not existing (older DBs without the new migration applied).
  try {
    await supa
      .from('email_schedules')
      .update({ hold: false })
      .eq('drop_id', drop.id)
      .eq('hold', true)
  } catch (e) {
    console.warn('[publish] release-holds non-fatal:', e?.message || e)
  }

  // 5) Stamp the token used. Done LAST so a partial failure above doesn't
  //    permanently invalidate the token (vendor can retry the link).
  await supa
    .from('publish_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tok.id)

  // 6) === Fix 10 — immediate announcement fan-out ====================
  //    When the vendor picks PUBLISH (not schedule), broadcast the drop
  //    to every subscriber that landed via the Tally contact CSV. We
  //    also flag the matching email_schedules row as `sent` so the
  //    nightly cron doesn't re-fan-out the same audience.
  //
  //    Skipped for the SCHEDULE flow — the lifecycle cron will fire the
  //    `open` email when launch_at <= now.
  let audienceCount = 0
  if (action === 'publish') {
    try {
      const { data: subscribers } = await supa
        .from('drop_subscribers')
        .select('email, name, phone')
        .eq('drop_id', drop.id)
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin
      if (Array.isArray(subscribers) && subscribers.length) {
        const fan = await sendDropOpenedFanout({ drop, subscribers, baseUrl })
        audienceCount = fan?.sent || 0
      }
      // Mark the `open` email_schedules row sent so the cron skips it.
      try {
        await supa
          .from('email_schedules')
          .update({ sent_at: new Date().toISOString(), recipients: audienceCount })
          .eq('drop_id', drop.id)
          .eq('kind', 'open')
          .is('sent_at', null)
      } catch (e) {
        console.warn('[publish] stamp open-schedule failed:', e?.message || e)
      }
    } catch (e) {
      console.warn('[publish] open fan-out failed (non-fatal):', e?.message || e)
    }
  }

  // 7) === Fix 8 — vendor publish confirmation =======================
  //    Always send a "your drop is live" email to the vendor on a publish
  //    click. (Skipped for schedule — the lifecycle cron will send the
  //    open notification at launch_at; vendors get a separate "scheduled"
  //    confirmation email in the same code path.)
  if (action === 'publish' && drop.creator_id) {
    try {
      const { data: profile } = await supa
        .from('profiles')
        .select('email')
        .eq('id', drop.creator_id)
        .maybeSingle()
      const vendorEmail = profile?.email || null
      if (vendorEmail) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin
        await sendDropPublishConfirmation({ drop, vendorEmail, audienceCount, baseUrl })
      }
    } catch (e) {
      console.warn('[publish] vendor confirmation failed (non-fatal):', e?.message || e)
    }
  }

  // 8) Send the vendor to their now-live (or now-scheduled) drop.
  const url = new URL(`/l/${drop.handle}`, request.url)
  url.searchParams.set('just_published', action)
  return NextResponse.redirect(url, { status: 302 })
}
