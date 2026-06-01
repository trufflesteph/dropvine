// Modular notification service. Add new notifications here — each one is a tiny
// function that renders a React Email template + sends via Resend.
// All functions are SAFE to call without awaiting (fire-and-forget) and never throw
// up the call stack — errors are logged and swallowed so the parent request always succeeds.

import { render } from '@react-email/render'
import { getResend, getDefaultFrom, isEmailConfigured } from './client'

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

function publicLaunchUrl(drop, base) {
  const root = base || process.env.NEXT_PUBLIC_BASE_URL || ''
  return `${root.replace(/\/$/, '')}/l/${drop.handle}`
}

async function sendOne({ to, subject, react, replyTo }) {
  if (!to) return { skipped: 'no recipient' }
  const resend = getResend()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set; skipping send to', to)
    return { skipped: 'no api key' }
  }
  try {
    const html = await render(react, { pretty: false })
    const text = await render(react, { plainText: true })
    const { data, error } = await resend.emails.send({
      from: getDefaultFrom(),
      to,
      subject,
      html,
      text,
      reply_to: replyTo,
    })
    if (error) {
      // Resend test-mode restriction or invalid recipient — log + continue
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

// 1. Waitlist confirmation
export async function sendWaitlistConfirmation({ drop, entry, baseUrl }) {
  return sendOne({
    to: entry.email,
    subject: `You’re on the list — ${drop.title}`,
    react: WaitlistConfirmation({ drop, name: entry.name, viewUrl: publicLaunchUrl(drop, baseUrl) }),
  })
}

// 2. Reservation confirmation (called from Stripe webhook after pending→held)
export async function sendReservationConfirmation({ drop, reservation, baseUrl }) {
  return sendOne({
    to: reservation.email,
    subject: `Reservation held — ${drop.title}`,
    react: ReservationConfirmation({ drop, reservation, viewUrl: publicLaunchUrl(drop, baseUrl) }),
  })
}

// 3. Launch reminder (cron — 24h before launch_at)
export async function sendLaunchReminder({ drop, recipients, hoursUntil, baseUrl }) {
  const results = []
  for (const r of recipients) {
    results.push(await sendOne({
      to: r.email,
      subject: `Reminder — ${drop.title} opens soon`,
      react: LaunchReminder({ drop, hoursUntil, viewUrl: publicLaunchUrl(drop, baseUrl) }),
    }))
  }
  return { sent: results.filter(x => x.id).length, total: recipients.length }
}

// 4. Launch live (cron — right at launch_at)
export async function sendLaunchLiveNotification({ drop, recipients, baseUrl }) {
  const results = []
  for (const r of recipients) {
    results.push(await sendOne({
      to: r.email,
      subject: `It’s open — ${drop.title}`,
      react: LaunchLive({ drop, viewUrl: publicLaunchUrl(drop, baseUrl) }),
    }))
  }
  return { sent: results.filter(x => x.id).length, total: recipients.length }
}

// 5. Sold out (to creator)
export async function sendSoldOutNotification({ drop, capacity, creatorEmail, baseUrl }) {
  const dashboardUrl = `${(baseUrl || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '')}/dashboard/reservations`
  return sendOne({
    to: creatorEmail,
    subject: `Sold out — ${drop.title}`,
    react: SoldOut({ drop, capacity, dashboardUrl }),
  })
}

// === Dropvine Markets ===

// 6. Market pre-order confirmation (sent to shopper after order created)
export async function sendMarketOrderConfirmation({ order, vendor, items, venmoUrl, marketName }) {
  return sendOne({
    to: order.shopper_email,
    subject: `Pre-order #${order.short_code} — send Venmo to confirm`,
    react: MarketOrderConfirmation({ order, vendor, items, venmoUrl, marketName }),
  })
}

// 7. Market vendor fulfillment magic link (sent to vendor for each new order)
export async function sendMarketFulfillmentMagicLink({ order, vendor, items, magicUrl, marketName, marketDate }) {
  if (!vendor?.email) return { skipped: 'vendor has no email' }
  return sendOne({
    to: vendor.email,
    subject: `New pre-order #${order.short_code} — ${vendor.name}`,
    react: MarketFulfillmentMagicLink({ order, vendor, items, magicUrl, marketName, marketDate }),
  })
}

// === Dropvine Direct — Tally drop submissions ===

// 8. New draft drop awaiting review (sent to platform owner)
export async function sendDraftDropReview({ drop, vendorName, vendorEmail, previewUrl, to }) {
  if (!to) return { skipped: 'no recipient' }
  return sendOne({
    to,
    subject: `New draft drop ready for review — ${drop.title}`,
    react: DraftDropReview({ drop, vendorName, vendorEmail, previewUrl }),
  })
}

// 9. Drop pre-order / deposit confirmation (sent to shopper after order placed)
export async function sendDropOrderConfirmation({ order, drop, items, to, baseUrl }) {
  if (!to) return { skipped: 'no recipient' }
  const isDeposit = order?.collection_mode === 'deposit'
  return sendOne({
    to,
    subject: isDeposit
      ? `Deposit received — ${drop?.title || 'your drop'} #${order.short_code}`
      : `Pre-order #${order.short_code} — ${drop?.title || 'your drop'}`,
    react: DropOrderConfirmation({ order, drop, items: items || [], baseUrl }),
  })
}

// 10. Drop order payment confirmed (sent when admin marks the order paid)
export async function sendDropOrderPaidConfirmation({ order, drop, items, to }) {
  if (!to) return { skipped: 'no recipient' }
  return sendOne({
    to,
    subject: `Payment confirmed — ${drop?.title || 'your drop'}`,
    react: DropOrderPaid({ order, drop, items: items || [] }),
  })
}

// =============================================================================
// Phase A — Drop Lifecycle cadence (June 2026)
// =============================================================================
// 11b. "Submission received — preview & publish/schedule" — vendor-facing email
// sent immediately after a Tally submission lands. Carries both the preview
// URL (?preview=true) and the one-shot confirm URL (/api/launches/publish/[token]).
export async function sendDropSubmissionConfirmation({ drop, vendorEmail, publishAction, token, baseUrl }) {
  if (!vendorEmail) return { skipped: 'no recipient' }
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
    subject,
    react: DropSubmissionConfirmation({
      drop,
      publishAction: isSchedule ? 'schedule' : 'publish',
      previewUrl,
      confirmUrl,
      launchAtLabel,
      closesAtLabel,
    }),
  })
}

// 11c. "Drop opened" fan-out (cron — fires at launch_at). Loops over the
// per-drop subscriber list (drop_subscribers). One email per subscriber.
export async function sendDropOpenedFanout({ drop, subscribers, baseUrl }) {
  const url = publicLaunchUrl(drop, baseUrl)
  const results = []
  for (const s of subscribers || []) {
    results.push(await sendOne({
      to: s.email,
      subject: `Now open — ${drop.title}`,
      react: DropOpened({ drop, subscriberName: s.name || null, viewUrl: url }),
    }))
  }
  return { sent: results.filter(x => x.id).length, total: subscribers?.length || 0 }
}

// 12. "+5 day" mid-window reminder.
export async function sendDropStillOpenFanout({ drop, subscribers, baseUrl, closesAtLabel }) {
  const url = publicLaunchUrl(drop, baseUrl)
  const results = []
  for (const s of subscribers || []) {
    results.push(await sendOne({
      to: s.email,
      subject: `Still open — ${drop.title}`,
      react: DropStillOpen({ drop, subscriberName: s.name || null, viewUrl: url, closesAtLabel }),
    }))
  }
  return { sent: results.filter(x => x.id).length, total: subscribers?.length || 0 }
}

// 13. 24h-pre-close last call.
export async function sendDropClosingSoonFanout({ drop, subscribers, baseUrl, closesAtLabel }) {
  const url = publicLaunchUrl(drop, baseUrl)
  const results = []
  for (const s of subscribers || []) {
    results.push(await sendOne({
      to: s.email,
      subject: `Closes in 24h — ${drop.title}`,
      react: DropClosingSoon({ drop, subscriberName: s.name || null, viewUrl: url, closesAtLabel }),
    }))
  }
  return { sent: results.filter(x => x.id).length, total: subscribers?.length || 0 }
}

// 14. Vendor close-summary recap.
export async function sendDropCloseSummary({ drop, vendorEmail, totals, baseUrl }) {
  if (!vendorEmail) return { skipped: 'no recipient' }
  const dashboardUrl = `${(baseUrl || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '')}/dashboard`
  return sendOne({
    to: vendorEmail,
    subject: `Drop summary — ${drop.title}`,
    react: DropCloseSummary({
      drop,
      totalOrders: totals?.total_orders || 0,
      paidOrders: totals?.paid_orders || 0,
      totalCents: totals?.total_cents || 0,
      dashboardUrl,
    }),
  })
}
