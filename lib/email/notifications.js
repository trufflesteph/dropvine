// Modular notification service. Add new notifications here — each one is a tiny
// function that renders a React Email template + sends via Resend.
// All functions are SAFE to call without awaiting (fire-and-forget) and never throw
// up the call stack — errors are logged and swallowed so the parent request always succeeds.
//
// Phase C (June 2026):
//   • Every email gets a `planTier` prop sourced from the vendor's
//     direct_vendors.tier so the EmailShell can toggle the "Powered by
//     Dropvine" watermark (shown for free/maker; hidden for shop).
//   • Shopper fan-out emails (drop opened, still open, closing soon) do NOT
//     CC the vendor — the volume would flood their inbox on large lists.

import { render } from '@react-email/render'
import { getResend, getDefaultFrom, getShopperFrom, isEmailConfigured } from './client'
import { formatEmailDateTime } from './format'
import { unsubscribeLinks, unsubscribeHeaders } from './unsubscribe'
import { filterSuppressed } from './suppressions'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { normalizeTier } from '@/lib/vendors/visibility'

import { WaitlistConfirmation } from './templates/WaitlistConfirmation'
import { ReservationConfirmation } from './templates/ReservationConfirmation'
import { LaunchReminder } from './templates/LaunchReminder'
import { LaunchLive } from './templates/LaunchLive'
import { SoldOut } from './templates/SoldOut'
import { DraftDropReview } from './templates/DraftDropReview'
import { DropOrderConfirmation } from './templates/DropOrderConfirmation'
import { DropOrderPaid } from './templates/DropOrderPaid'
import { OrderCancelled } from './templates/OrderCancelled'
import { DropOpened } from './templates/DropOpened'
import { DropStillOpen } from './templates/DropStillOpen'
import { DropClosingSoon } from './templates/DropClosingSoon'
import { DropCloseSummary } from './templates/DropCloseSummary'
import { DropSubmissionConfirmation } from './templates/DropSubmissionConfirmation'
import { DropPublishConfirmation } from './templates/DropPublishConfirmation'
import { ReviewRequest } from './templates/ReviewRequest'
import { ReviewModerationRequest } from './templates/ReviewModerationRequest'
import { PremiumWaitlistConfirmation } from './templates/PremiumWaitlistConfirmation'

const PRODUCTION_BASE = 'https://dropvine.pro'

function getBaseUrl(base) {
  return (base || process.env.NEXT_PUBLIC_BASE_URL || PRODUCTION_BASE).replace(/\/$/, '')
}

function publicLaunchUrl(drop, base) {
  return `${getBaseUrl(base)}/l/${drop.handle}`
}

// =============================================================================
// Vendor context resolver (Phase C)
// =============================================================================
// Given a drop row, look up the vendor's email (profiles), tier
// (direct_vendors.tier, normalized; no direct_vendors row = free) and
// business name. The tier goes into React Email templates so the watermark
// can be hidden for Shop-tier customers; the business name is the shopper
// email sender name ("{business} via Dropvine").
//
// Cached per-request via the in-process map below to avoid hammering Supabase
// when we fan-out to dozens of subscribers.
const _vendorContextCache = new Map()
export async function resolveVendorContext(drop) {
  const empty = { vendorEmail: null, planTier: 'free', businessName: null }
  if (!drop?.creator_id) return empty
  if (_vendorContextCache.has(drop.creator_id)) {
    return _vendorContextCache.get(drop.creator_id)
  }
  try {
    const supa = getSupabaseAdmin()
    if (!supa) return empty
    const [{ data: profile }, { data: vendor }] = await Promise.all([
      supa.from('profiles').select('email').eq('id', drop.creator_id).maybeSingle(),
      supa.from('direct_vendors').select('tier, business_name').eq('creator_id', drop.creator_id).maybeSingle(),
    ])
    const ctx = {
      vendorEmail: profile?.email || null,
      planTier: normalizeTier(vendor?.tier),
      businessName: vendor?.business_name || null,
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
// `from` defaults to the Dropvine address (vendor/owner emails); shopper
// emails pass getShopperFrom(businessName). Reply-To is only set if given.
// `headers` adds extra message headers (List-Unsubscribe on marketing).
async function sendOne({ to, cc, bcc, subject, react, replyTo, from, headers }) {
  if (!to) return { skipped: 'no recipient' }
  const resend = getResend()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set; skipping send to', to)
    return { skipped: 'no api key' }
  }
  try {
    const html = await render(react, { pretty: false })
    const text = await render(react, { plainText: true })
    // Drop cc/bcc addresses that equal the primary recipient (Resend errors on dupes).
    const dedupeAgainstTo = (addr) => addr
      ? (Array.isArray(addr) ? addr : [addr])
          .filter(Boolean)
          .filter((a) => String(a).toLowerCase() !== String(to).toLowerCase())
      : undefined
    const ccArr = dedupeAgainstTo(cc)
    const bccArr = dedupeAgainstTo(bcc)
    const payload = {
      from: from || getDefaultFrom(),
      to,
      subject,
      html,
      text,
    }
    if (replyTo) payload.reply_to = replyTo
    if (ccArr && ccArr.length) payload.cc = ccArr
    if (bccArr && bccArr.length) payload.bcc = bccArr
    if (headers) payload.headers = headers
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
// Marketing sender
// =============================================================================
// Every fan-out marketing email (DropOpened, DropStillOpen, DropClosingSoon,
// LaunchLive, LaunchReminder) goes through here; sendReviewRequest does the
// same steps for its single recipient:
//   1. Recipients suppressed for this vendor (drop.creator_id) or for all
//      Dropvine email are dropped; the count is logged and returned.
//   2. Each remaining recipient gets their own signed unsubscribe link (for
//      the footer) and List-Unsubscribe / List-Unsubscribe-Post headers.
// `build(recipient, unsubscribeUrl)` returns the sendOne() args. Never add a
// cc/bcc here: the copy would carry the recipient's unsubscribe link.
// If the suppression lookup fails, nothing is sent and the result carries
// `lookupFailed: true`. Callers must then leave the send unmarked so the
// next cron run retries it.
async function sendMarketing({ kind, drop, recipients, build }) {
  const list = recipients || []
  const vendorId = drop?.creator_id || null
  const { allowed, suppressed, error } = await filterSuppressed(list, vendorId)
  if (error) {
    console.error(`[email] ${kind} for drop ${drop?.id}: ${error}; sent nothing, will retry`)
    return { sent: 0, total: list.length, suppressed: 0, error, lookupFailed: true }
  }
  if (suppressed) {
    console.log(`[email] ${kind} for drop ${drop?.id}: skipped ${suppressed} suppressed recipient(s)`)
  }
  const results = []
  for (const r of allowed) {
    const links = unsubscribeLinks({ email: r.email, vendorId })
    results.push(await sendOne({
      ...build(r, links?.pageUrl || null),
      headers: unsubscribeHeaders(links),
    }))
  }
  return { sent: results.filter(x => x.id).length, total: list.length, suppressed }
}

// =============================================================================
// 1. Waitlist confirmation (sent to shopper, BCC'd to vendor)
// =============================================================================
export async function sendWaitlistConfirmation({ drop, entry, baseUrl }) {
  const { vendorEmail, planTier, businessName } = await resolveVendorContext(drop)
  return sendOne({
    from: getShopperFrom(businessName),
    to: entry.email,
    bcc: vendorEmail,
    subject: `You’re on the list — ${drop.title}`,
    react: WaitlistConfirmation({ launch: drop, name: entry.name, viewUrl: publicLaunchUrl(drop, baseUrl), planTier }),
  })
}

// =============================================================================
// 2. Reservation confirmation (Stripe webhook → pending→held)
// =============================================================================
export async function sendReservationConfirmation({ drop, reservation, baseUrl }) {
  const { vendorEmail, planTier, businessName } = await resolveVendorContext(drop)
  return sendOne({
    from: getShopperFrom(businessName),
    to: reservation.email,
    bcc: vendorEmail,
    subject: `Reservation held — ${drop.title}`,
    react: ReservationConfirmation({ launch: drop, reservation, viewUrl: publicLaunchUrl(drop, baseUrl), planTier }),
  })
}

// =============================================================================
// 3. Launch reminder (cron — 24h before launch_at). Marketing.
// No vendor BCC: each copy carries the shopper's own unsubscribe link.
// =============================================================================
export async function sendLaunchReminder({ drop, recipients, hoursUntil, baseUrl }) {
  const { planTier, businessName } = await resolveVendorContext(drop)
  return sendMarketing({
    kind: 'LaunchReminder',
    drop,
    recipients,
    build: (r, unsubscribeUrl) => ({
      from: getShopperFrom(businessName),
      to: r.email,
      subject: `Reminder — ${drop.title} opens soon`,
      react: LaunchReminder({ launch: drop, hoursUntil, viewUrl: publicLaunchUrl(drop, baseUrl), planTier, vendorName: businessName, unsubscribeUrl }),
    }),
  })
}

// =============================================================================
// 4. Launch live (cron — right at launch_at). Marketing.
// =============================================================================
export async function sendLaunchLiveNotification({ drop, recipients, baseUrl }) {
  const { planTier, businessName } = await resolveVendorContext(drop)
  return sendMarketing({
    kind: 'LaunchLive',
    drop,
    recipients,
    build: (r, unsubscribeUrl) => ({
      from: getShopperFrom(businessName),
      to: r.email,
      subject: `It’s open — ${drop.title}`,
      react: LaunchLive({ launch: drop, viewUrl: publicLaunchUrl(drop, baseUrl), planTier, vendorName: businessName, unsubscribeUrl }),
    }),
  })
}

// =============================================================================
// 5. Sold out (to vendor) — pre-order / deposit drop sold out. Sent from the
// Dropvine vendor address (getDefaultFrom), not the shopper no-reply sender.
// `totals` = { orders, paid, unpaid }. Called once per drop by
// lib/orders/sold-out.js.
// =============================================================================
export const SOLD_OUT_DASHBOARD_URL = 'https://www.dropvine.pro/dashboard/orders'

export async function sendSoldOutNotification({ drop, totals }) {
  const { vendorEmail, planTier } = await resolveVendorContext(drop)
  if (!vendorEmail) return { skipped: 'no vendor email' }
  return sendOne({
    to: vendorEmail,
    subject: `Sold out: ${drop.title}`,
    react: SoldOut({
      launch: drop,
      orders: totals?.orders || 0,
      paid: totals?.paid || 0,
      unpaid: totals?.unpaid || 0,
      dashboardUrl: SOLD_OUT_DASHBOARD_URL,
      planTier,
    }),
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

// 9. Drop pre-order / deposit confirmation (sent to shopper, BCC'd to vendor)
export async function sendDropOrderConfirmation({ order, drop, items, to, baseUrl }) {
  if (!to) return { skipped: 'no recipient' }
  const { vendorEmail, planTier, businessName: vendorName } = await resolveVendorContext(drop)
  return sendOne({
    from: getShopperFrom(vendorName),
    to,
    bcc: vendorEmail,
    subject: `Order #${order.short_code}: ${drop?.title || 'your drop'}`,
    react: DropOrderConfirmation({ order, launch: drop, items: items || [], baseUrl, planTier, vendorName }),
  })
}

// 10. Drop order payment confirmed (sent to shopper, BCC'd to vendor)
export async function sendDropOrderPaidConfirmation({ order, drop, items, to }) {
  if (!to) return { skipped: 'no recipient' }
  const { vendorEmail, planTier, businessName } = await resolveVendorContext(drop)
  return sendOne({
    from: getShopperFrom(businessName),
    to,
    bcc: vendorEmail,
    subject: `Payment confirmed — ${drop?.title || 'your drop'}`,
    react: DropOrderPaid({ order, launch: drop, items: items || [], planTier, vendorName: businessName }),
  })
}

// 10b. Order cancelled by the vendor (dashboard Orders page) — shopper only.
export async function sendOrderCancelled({ order, drop, to }) {
  if (!to) return { skipped: 'no recipient' }
  const { planTier, businessName } = await resolveVendorContext(drop)
  return sendOne({
    from: getShopperFrom(businessName),
    to,
    subject: `Order #${order.short_code} cancelled: ${drop?.title || 'your drop'}`,
    react: OrderCancelled({ order, launch: drop, vendorName: businessName, planTier }),
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
  const root = getBaseUrl(baseUrl)
  const previewUrl = `${root}/l/${drop.handle}?preview=true`
  const confirmUrl = `${root}/api/launches/publish/${token}`
  const launchAtLabel = formatEmailDateTime(drop.launch_at)
  const closesAtLabel = formatEmailDateTime(drop.closes_at)
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
  const root = getBaseUrl(baseUrl)
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
// subscriber. Marketing. Round 2 — resolves the vendor's business_name from
// direct_vendors for the shopper-facing copy and footer (Fix 10).
export async function sendDropOpenedFanout({ drop, subscribers, baseUrl }) {
  // Vendor business name (best-effort; the template falls back to "this maker").
  const { planTier, businessName: vendorName } = await resolveVendorContext(drop)
  const url = publicLaunchUrl(drop, baseUrl)
  return sendMarketing({
    kind: 'DropOpened',
    drop,
    recipients: subscribers,
    build: (s, unsubscribeUrl) => ({
      from: getShopperFrom(vendorName),
      to: s.email,
      subject: `Now open: ${drop.title}`,
      react: DropOpened({ launch: drop, subscriberName: s.name || null, viewUrl: url, vendorName, planTier, unsubscribeUrl }),
    }),
  })
}

// 12. "+5 day" mid-window reminder. Marketing. The close time is formatted
// here with the shared Pacific-time helper; callers' own `closesAtLabel` is
// ignored.
export async function sendDropStillOpenFanout({ drop, subscribers, baseUrl }) {
  const { planTier, businessName } = await resolveVendorContext(drop)
  const closesAtLabel = formatEmailDateTime(drop?.closes_at)
  const url = publicLaunchUrl(drop, baseUrl)
  return sendMarketing({
    kind: 'DropStillOpen',
    drop,
    recipients: subscribers,
    build: (s, unsubscribeUrl) => ({
      from: getShopperFrom(businessName),
      to: s.email,
      subject: `Still open — ${drop.title}`,
      react: DropStillOpen({ launch: drop, subscriberName: s.name || null, viewUrl: url, closesAtLabel, vendorName: businessName, planTier, unsubscribeUrl }),
    }),
  })
}

// 13. 24h-pre-close last call. Marketing. Close time formatted here (see #12).
export async function sendDropClosingSoonFanout({ drop, subscribers, baseUrl }) {
  const { planTier, businessName } = await resolveVendorContext(drop)
  const closesAtLabel = formatEmailDateTime(drop?.closes_at)
  const url = publicLaunchUrl(drop, baseUrl)
  return sendMarketing({
    kind: 'DropClosingSoon',
    drop,
    recipients: subscribers,
    build: (s, unsubscribeUrl) => ({
      from: getShopperFrom(businessName),
      to: s.email,
      subject: `Closes in 24h — ${drop.title}`,
      react: DropClosingSoon({ launch: drop, subscriberName: s.name || null, viewUrl: url, closesAtLabel, vendorName: businessName, planTier, unsubscribeUrl }),
    }),
  })
}

// 14. Vendor close-summary recap (vendor-only — no CC).
export async function sendDropCloseSummary({ drop, vendorEmail, totals, baseUrl }) {
  if (!vendorEmail) return { skipped: 'no recipient' }
  const { planTier } = await resolveVendorContext(drop)
  const dashboardUrl = `${getBaseUrl(baseUrl)}/dashboard`
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
// forms inside emails are unreliable across clients). Marketing: returns
// { skipped: 'suppressed' } if the shopper unsubscribed.
export async function sendReviewRequest({ drop, to, reviewerName, reviewUrl }) {
  if (!to || !reviewUrl) return { skipped: 'no recipient or url' }
  const { planTier, businessName } = await resolveVendorContext(drop)
  const senderName = drop?.vendor_business_name || drop?.business_name || businessName
  const vendorName = senderName || 'this maker'
  // Single recipient, so this does sendMarketing's steps inline to keep
  // sendOne's { id } / { error } result for callers.
  const vendorId = drop?.creator_id || null
  const { suppressed, error } = await filterSuppressed([{ email: to }], vendorId)
  if (error) {
    console.error(`[email] ReviewRequest for drop ${drop?.id}: ${error}; sent nothing`)
    return { error }
  }
  if (suppressed) {
    console.log(`[email] ReviewRequest for drop ${drop?.id}: skipped 1 suppressed recipient`)
    return { skipped: 'suppressed' }
  }
  const links = unsubscribeLinks({ email: to, vendorId })
  return sendOne({
    from: getShopperFrom(senderName),
    to,
    subject: `How was your order from ${vendorName}?`,
    headers: unsubscribeHeaders(links),
    react: ReviewRequest({
      reviewerName: reviewerName || null,
      vendorName,
      dropTitle: drop?.title || null,
      reviewUrl,
      planTier,
      unsubscribeUrl: links?.pageUrl || null,
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

// 17. PremiumWaitlistConfirmation — sent from the Dropvine address to someone
// who joins the Premium Shop Annual waitlist on the homepage. Called by
// POST /api/premium-waitlist for new sign-ups only. Transactional: no
// unsubscribe link or headers. `price` is the homepage's
// home_tier_premium_price (e.g. "$455").
export async function sendPremiumWaitlistConfirmation({ to, firstName, price }) {
  if (!to) return { skipped: 'no recipient' }
  return sendOne({
    to,
    subject: "You're on the Premium Shop Annual waitlist",
    react: PremiumWaitlistConfirmation({ firstName, price }),
  })
}
