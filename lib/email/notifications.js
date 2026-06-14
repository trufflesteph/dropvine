// Modular notification service. Add new notifications here — each one is a tiny
// function that renders a React Email template + sends via Resend.
// All functions are SAFE to call without awaiting (fire-and-forget) and never throw
// up the call stack — errors are logged and swallowed so the parent request always succeeds.
//
// Phase C (June 2026):
//   • Every email gets a `planTier` prop sourced from the vendor's
//     profiles.plan_tier so the EmailShell can toggle the "Powered by
//     Dropvine" watermark (shown for free/maker; hidden for shop).
//   • Shopper fan-out emails (drop opened, still open, closing soon) do NOT
//     CC the vendor — the volume would flood their inbox on large lists.

import { render } from '@react-email/render'
import { getResend, getDefaultFrom, isEmailConfigured } from './client'
import { getSupabaseAdmin } from '@/lib/supabase/server'

import { WaitlistConfirmation } from './templates/WaitlistConfirmation'
import { ReservationConfirmation } from './templates/ReservationConfirmation'
import { LaunchReminder } from './templates/LaunchReminder'
import { LaunchLive } from './templates/LaunchLive'
import { SoldOut } from './templates/SoldOut'
import { MarketOrderConfirmation } from './templates/MarketOrderConfirmation'
import { MarketFulfillmentMagicLink } from './templates/MarketFulfillmentMagicLink'
import { DraftDropReview } from './templates/DraftDropReview'
import { DropOrderConfirmation } from './templates/DropOrderConfirmation'
import { DropOrderPaid } from './templates/DropOrderPaid'
import { DropOpened } from './templates/DropOpened'
import { DropStillOpen } from './templates/DropStillOpen'
import { DropClosingSoon } from './templates/DropClosingSoon'
import { DropCloseSummary } from './templates/DropCloseSummary'
import { DropSubmissionConfirmation } from './templates/DropSubmissionConfirmation'
import { DropPublishConfirmation } from './templates/DropPublishConfirmation'
import { ReviewRequest } from './templates/ReviewRequest'
import { ReviewModerationRequest } from './templates/ReviewModerationRequest'

function publicLaunchUrl(drop, base) {
  const root = base || process.env.NEXT_PUBLIC_BASE_URL || ''
  return `${root.replace(/\/$/, '')}/l/${drop.handle}`
}

// =============================================================================
// Vendor context resolver (Phase C)
// =============================================================================
// Given a drop row, look up the vendor's profile (email + plan_tier). Used to
// pass plan_tier into React Email templates so the watermark can be
// conditionally hidden for Shop-tier customers.
//
// Cached per-request via the in-process map below to avoid hammering Supabase
// when we fan-out to dozens of subscribers.
const _vendorContextCache = new Map()
export async function resolveVendorContext(drop) {
  const empty = { vendorEmail: null, planTier: 'free' }
  if (!drop?.creator_id) return empty
  if (_vendorContextCache.has(drop.creator_id)) {
    return _vendorContextCache.get(drop.creator_id)
  }
  try {
    const supa = getSupabaseAdmin()
    if (!supa) return empty
    const { data } = await supa
      .from('profiles')
      .select('email, plan_tier')
      .eq('id', drop.creator_id)
      .maybeSingle()
    const ctx = {
      vendorEmail: data?.email || null,
      planTier: data?.plan_tier || 'free',
    }
    _vendorContextCache.set(drop.creator_id, ctx)
    return ctx
  } catch (e) {
    console.warn('[notifications] resolveVendorContext failed:', e?.message || e)
    return empty
  }
}

// Drop the cache for a given drop / creator. Useful in tests; in production
// the cache TTL is the lifetime of the lambda invocation so we don't need to.
export function clearVendorContextCache() {
  _vendorContextCache.clear()
}

// =============================================================================
// Low-level sender
// =============================================================================
async function sendOne({ to, cc, subject, react, replyTo }) {
  if (!to) return { skipped: 'no recipient' }
  const resend = getResend()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set; skipping send to', to)
    return { skipped: 'no api key' }
  }
  try {
    const html = await render(react, { pretty: false })
    const text = await render(react, { plainText: true })
    // Drop the CC if it equals the primary recipient (Resend errors on dupes).
    const ccArr = cc
      ? (Array.isArray(cc) ? cc : [cc])
          .filter(Boolean)
          .filter((addr) => String(addr).toLowerCase() !== String(to).toLowerCase())
      : undefined
    const payload = {
      from: getDefaultFrom(),
      to,
      subject,
      html,
      text,
      reply_to: replyTo,
    }
    if (ccArr && ccArr.length) payload.cc = ccArr
    const { data, error } = await resend.emails.send(payload)
    if (error) {
      console.warn('[email] resend error to', to, '—', error.message || error.name || error)
      return { error }
    }
    return { id: data?.id }
  } catch (e) {
    console.error('[email] unexpected failure for', to, e?.message || e)
    return { error: e?.message || String(e) }
  }
}

export function emailEnabled() { return isEmailConfigured() }

// =============================================================================
// 1. Waitlist confirmation (sent to shopper, CC'd to vendor)
// =============================================================================
export async function sendWaitlistConfirmation({ drop, entry, baseUrl }) {
  const { vendorEmail, planTier } = await resolveVendorContext(drop)
  return sendOne({
    to: entry.email,
    cc: vendorEmail,
    subject: `You’re on the list — ${drop.title}`,
    react: WaitlistConfirmation({ launch: drop, name: entry.name, viewUrl: publicLaunchUrl(drop, baseUrl), planTier }),
  })
}

// =============================================================================
// 2. Reservation confirmation (Stripe webhook → pending→held)
// =============================================================================
export async function sendReservationConfirmation({ drop, reservation, baseUrl }) {
  const { vendorEmail, planTier } = await resolveVendorContext(drop)
  return sendOne({
    to: reservation.email,
    cc: vendorEmail,
    subject: `Reservation held — ${drop.title}`,
    react: ReservationConfirmation({ launch: drop, reservation, viewUrl: publicLaunchUrl(drop, baseUrl), planTier }),
  })
}

// =============================================================================
// 3. Launch reminder (cron — 24h before launch_at)
// =============================================================================
export async function sendLaunchReminder({ drop, recipients, hoursUntil, baseUrl }) {
  const { vendorEmail, planTier } = await resolveVendorContext(drop)
  const results = []
  for (const r of recipients) {
    results.push(await sendOne({
      to: r.email,
      cc: vendorEmail,
      subject: `Reminder — ${drop.title} opens soon`,
      react: LaunchReminder({ launch: drop, hoursUntil, viewUrl: publicLaunchUrl(drop, baseUrl), planTier }),
    }))
  }
  return { sent: results.filter(x => x.id).length, total: recipients.length }
}

// =============================================================================
// 4. Launch live (cron — right at launch_at)
// =============================================================================
export async function sendLaunchLiveNotification({ drop, recipients, baseUrl }) {
  const { planTier } = await resolveVendorContext(drop)
  const results = []
  for (const r of recipients) {
    results.push(await sendOne({
      to: r.email,
      subject: `It’s open — ${drop.title}`,
      react: LaunchLive({ launch: drop, viewUrl: publicLaunchUrl(drop, baseUrl), planTier }),
    }))
  }
  return { sent: results.filter(x => x.id).length, total: recipients.length }
}

// =============================================================================
// 5. Sold out (to creator) — no CC needed (already going to vendor)
// =============================================================================
export async function sendSoldOutNotification({ drop, capacity, creatorEmail, baseUrl }) {
  const { planTier } = await resolveVendorContext(drop)
  const dashboardUrl = `${(baseUrl || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '')}/dashboard/reservations`
  return sendOne({
    to: creatorEmail,
    subject: `Sold out — ${drop.title}`,
    react: SoldOut({ launch: drop, capacity, dashboardUrl, planTier }),
  })
}

// =============================================================================
// === Dropvine Markets (separate vendor model — no CC required) ===
// =============================================================================

// 6. Market pre-order confirmation (sent to shopper after order created)
export async function sendMarketOrderConfirmation({ order, vendor, items, venmoUrl, marketName }) {
  return sendOne({
    to: order.shopper_email,
    cc: vendor?.email || undefined,
    subject: `Pre-order #${order.short_code} — send Venmo to confirm`,
    react: MarketOrderConfirmation({ order, vendor, items, venmoUrl, marketName }),
  })
}

// 7. Market vendor fulfillment magic link
export async function sendMarketFulfillmentMagicLink({ order, vendor, items, magicUrl, marketName, marketDate }) {
  if (!vendor?.email) return { skipped: 'vendor has no email' }
  return sendOne({
    to: vendor.email,
    subject: `New pre-order #${order.short_code} — ${vendor.name}`,
    react: MarketFulfillmentMagicLink({ order, vendor, items, magicUrl, marketName, marketDate }),
  })
}

// =============================================================================
// === Dropvine Direct — Tally drop submissions + lifecycle ===
// =============================================================================

// 8. New draft drop awaiting review (sent to platform owner — no CC/watermark)
export async function sendDraftDropReview({ drop, vendorName, vendorEmail, previewUrl, to }) {
  if (!to) return { skipped: 'no recipient' }
  return sendOne({
    to,
    subject: `New draft drop ready for review — ${drop.title}`,
    react: DraftDropReview({ launch: drop, vendorName, vendorEmail, previewUrl }),
  })
}

// 9. Drop pre-order / deposit confirmation (sent to shopper, CC'd to vendor)
export async function sendDropOrderConfirmation({ order, drop, items, to, baseUrl }) {
  if (!to) return { skipped: 'no recipient' }
  const { vendorEmail, planTier } = await resolveVendorContext(drop)
  const isDeposit = order?.collection_mode === 'deposit'
  return sendOne({
    to,
    cc: vendorEmail,
    subject: isDeposit
      ? `Deposit received — ${drop?.title || 'your drop'} #${order.short_code}`
      : `Pre-order #${order.short_code} — ${drop?.title || 'your drop'}`,
    react: DropOrderConfirmation({ order, launch: drop, items: items || [], baseUrl, planTier }),
  })
}

// 10. Drop order payment confirmed (sent to shopper, CC'd to vendor)
export async function sendDropOrderPaidConfirmation({ order, drop, items, to }) {
  if (!to) return { skipped: 'no recipient' }
  const { vendorEmail, planTier } = await resolveVendorContext(drop)
  return sendOne({
    to,
    cc: vendorEmail,
    subject: `Payment confirmed — ${drop?.title || 'your drop'}`,
    react: DropOrderPaid({ order, launch: drop, items: items || [], planTier }),
  })
}

// =============================================================================
// Phase A — Drop Lifecycle cadence (June 2026)
// =============================================================================

// 11b. "Submission received" — vendor-facing only (no CC). Watermark still
// follows tier so vendors on shop see clean emails.
// Round 2 — now also accepts `products` + `description` so the email can
// itemise the drop catalogue + show the description body (Fix 15).
export async function sendDropSubmissionConfirmation({ drop, vendorEmail, publishAction, token, baseUrl, products, description }) {
  if (!vendorEmail) return { skipped: 'no recipient' }
  const { planTier } = await resolveVendorContext(drop)
  const root = (baseUrl || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '')
  const previewUrl = `${root}/l/${drop.handle}?preview=true`
  const confirmUrl = `${root}/api/launches/publish/${token}`
  const launchAtLabel = drop.launch_at
    ? new Date(drop.launch_at).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : null
  const closesAtLabel = drop.closes_at
    ? new Date(drop.closes_at).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : null
  const isSchedule = publishAction === 'schedule'
  const subject = isSchedule
    ? `Your drop is ready to preview — goes live ${launchAtLabel || 'on schedule'}`
    : `Your drop is ready to preview — ${drop.title}`
  return sendOne({
    to: vendorEmail,
    // No CC — Fix 12 R2 (platform → vendor emails must not carry the
    // hardcoded hello@stephaniebaturoni.com CC).
    subject,
    react: DropSubmissionConfirmation({
      launch: drop,
      publishAction: isSchedule ? 'schedule' : 'publish',
      previewUrl,
      confirmUrl,
      launchAtLabel,
      closesAtLabel,
      products: Array.isArray(products) ? products : [],
      description: description || drop.description || null,
      planTier,
    }),
  })
}

// 11d. "Drop published" confirmation — vendor-facing only, sent the moment
// they click "Publish my drop →" in the preview email. Includes a fresh
// audienceCount so they see how many contacts the announcement reached.
export async function sendDropPublishConfirmation({ drop, vendorEmail, audienceCount, baseUrl }) {
  if (!vendorEmail) return { skipped: 'no recipient' }
  const { planTier } = await resolveVendorContext(drop)
  const root = (baseUrl || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '')
  const liveUrl = `${root}/l/${drop.handle}`
  const dashboardUrl = `${root}/dashboard`
  return sendOne({
    to: vendorEmail,
    subject: `Your drop is live — ${drop.title || 'Dropvine'}`,
    react: DropPublishConfirmation({
      launch: drop,
      liveUrl,
      dashboardUrl,
      audienceCount: Number(audienceCount || 0),
      planTier,
    }),
  })
}

// 11c. "Drop opened" fan-out (cron — fires at notify_at). One email per
// subscriber. Round 2 — resolves the vendor's business_name from direct_vendors
// so the shopper-facing footer reads "you follow <business> on Dropvine" (Fix 10).
export async function sendDropOpenedFanout({ drop, subscribers, baseUrl }) {
  const { planTier } = await resolveVendorContext(drop)
  // Resolve vendor business name (best-effort; falls back to "this maker")
  let vendorName = null
  if (drop?.creator_id) {
    try {
      const supa = getSupabaseAdmin()
      if (supa) {
        const { data: dv } = await supa
          .from('direct_vendors')
          .select('business_name')
          .eq('creator_id', drop.creator_id)
          .maybeSingle()
        if (dv?.business_name) vendorName = dv.business_name
      }
    } catch (e) {
      console.warn('[notifications] DropOpened vendorName resolve failed:', e?.message || e)
    }
  }
  const url = publicLaunchUrl(drop, baseUrl)
  const results = []
  for (const s of subscribers || []) {
    results.push(await sendOne({
      to: s.email,
      subject: `Now open — ${drop.title}`,
      react: DropOpened({ launch: drop, subscriberName: s.name || null, viewUrl: url, vendorName, planTier }),
    }))
  }
  return { sent: results.filter(x => x.id).length, total: subscribers?.length || 0 }
}

// 12. "+5 day" mid-window reminder.
export async function sendDropStillOpenFanout({ drop, subscribers, baseUrl, closesAtLabel }) {
  const { planTier } = await resolveVendorContext(drop)
  const url = publicLaunchUrl(drop, baseUrl)
  const results = []
  for (const s of subscribers || []) {
    results.push(await sendOne({
      to: s.email,
      subject: `Still open — ${drop.title}`,
      react: DropStillOpen({ launch: drop, subscriberName: s.name || null, viewUrl: url, closesAtLabel, planTier }),
    }))
  }
  return { sent: results.filter(x => x.id).length, total: subscribers?.length || 0 }
}

// 13. 24h-pre-close last call.
export async function sendDropClosingSoonFanout({ drop, subscribers, baseUrl, closesAtLabel }) {
  const { planTier } = await resolveVendorContext(drop)
  const url = publicLaunchUrl(drop, baseUrl)
  const results = []
  for (const s of subscribers || []) {
    results.push(await sendOne({
      to: s.email,
      subject: `Closes in 24h — ${drop.title}`,
      react: DropClosingSoon({ launch: drop, subscriberName: s.name || null, viewUrl: url, closesAtLabel, planTier }),
    }))
  }
  return { sent: results.filter(x => x.id).length, total: subscribers?.length || 0 }
}

// 14. Vendor close-summary recap (vendor-only — no CC).
export async function sendDropCloseSummary({ drop, vendorEmail, totals, baseUrl }) {
  if (!vendorEmail) return { skipped: 'no recipient' }
  const { planTier } = await resolveVendorContext(drop)
  const dashboardUrl = `${(baseUrl || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '')}/dashboard`
  return sendOne({
    to: vendorEmail,
    subject: `Drop summary — ${drop.title}`,
    react: DropCloseSummary({
      launch: drop,
      totalOrders: totals?.total_orders || 0,
      paidOrders: totals?.paid_orders || 0,
      totalCents: totals?.total_cents || 0,
      dashboardUrl,
      planTier,
    }),
  })
}


// =============================================================================
// 15 + 16 — Customer reviews (June 2026, Shop-tier only)
// =============================================================================

// 15. ReviewRequest — sent to the shopper right after their order is marked
// fulfilled. Links to /review/[review_id] (lightweight web form, since rich
// forms inside emails are unreliable across clients).
export async function sendReviewRequest({ drop, to, reviewerName, reviewUrl }) {
  if (!to || !reviewUrl) return { skipped: 'no recipient or url' }
  const { planTier } = await resolveVendorContext(drop)
  const vendorName = drop?.vendor_business_name || drop?.business_name || 'this maker'
  return sendOne({
    to,
    subject: `How was your order from ${vendorName}?`,
    react: ReviewRequest({
      reviewerName: reviewerName || null,
      vendorName,
      dropTitle: drop?.title || null,
      reviewUrl,
      planTier,
    }),
  })
}

// 16. ReviewModerationRequest — sent to PLATFORM_OWNER_EMAIL right after a
// shopper submits their review. Two prominent CTAs (approve / reject) link
// to the one-shot moderation endpoint at /api/reviews/moderate/[token].
export async function sendReviewModerationRequest({
  vendorName,
  dropTitle,
  reviewerName,
  reviewerEmail,
  rating,
  comment,
  approveUrl,
  rejectUrl,
}) {
  const to = (process.env.PLATFORM_OWNER_EMAIL || '').trim()
  if (!to) return { skipped: 'PLATFORM_OWNER_EMAIL not set' }
  return sendOne({
    to,
    subject: `New review pending — ${vendorName || 'a maker'}`,
    react: ReviewModerationRequest({
      vendorName,
      dropTitle,
      reviewerName,
      reviewerEmail,
      rating,
      comment,
      approveUrl,
      rejectUrl,
    }),
  })
}
