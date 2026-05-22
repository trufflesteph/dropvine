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

function publicLaunchUrl(launch, base) {
  const root = base || process.env.NEXT_PUBLIC_BASE_URL || ''
  return `${root.replace(/\/$/, '')}/l/${launch.handle}`
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
export async function sendWaitlistConfirmation({ launch, entry, baseUrl }) {
  return sendOne({
    to: entry.email,
    subject: `You’re on the list — ${launch.title}`,
    react: WaitlistConfirmation({ launch, name: entry.name, viewUrl: publicLaunchUrl(launch, baseUrl) }),
  })
}

// 2. Reservation confirmation (called from Stripe webhook after pending→held)
export async function sendReservationConfirmation({ launch, reservation, baseUrl }) {
  return sendOne({
    to: reservation.email,
    subject: `Reservation held — ${launch.title}`,
    react: ReservationConfirmation({ launch, reservation, viewUrl: publicLaunchUrl(launch, baseUrl) }),
  })
}

// 3. Launch reminder (cron — 24h before launch_at)
export async function sendLaunchReminder({ launch, recipients, hoursUntil, baseUrl }) {
  const results = []
  for (const r of recipients) {
    results.push(await sendOne({
      to: r.email,
      subject: `Reminder — ${launch.title} opens soon`,
      react: LaunchReminder({ launch, hoursUntil, viewUrl: publicLaunchUrl(launch, baseUrl) }),
    }))
  }
  return { sent: results.filter(x => x.id).length, total: recipients.length }
}

// 4. Launch live (cron — right at launch_at)
export async function sendLaunchLiveNotification({ launch, recipients, baseUrl }) {
  const results = []
  for (const r of recipients) {
    results.push(await sendOne({
      to: r.email,
      subject: `It’s open — ${launch.title}`,
      react: LaunchLive({ launch, viewUrl: publicLaunchUrl(launch, baseUrl) }),
    }))
  }
  return { sent: results.filter(x => x.id).length, total: recipients.length }
}

// 5. Sold out (to creator)
export async function sendSoldOutNotification({ launch, capacity, creatorEmail, baseUrl }) {
  const dashboardUrl = `${(baseUrl || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '')}/dashboard/reservations`
  return sendOne({
    to: creatorEmail,
    subject: `Sold out — ${launch.title}`,
    react: SoldOut({ launch, capacity, dashboardUrl }),
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
export async function sendDraftDropReview({ launch, vendorName, vendorEmail, previewUrl, to }) {
  if (!to) return { skipped: 'no recipient' }
  return sendOne({
    to,
    subject: `New draft drop ready for review — ${launch.title}`,
    react: DraftDropReview({ launch, vendorName, vendorEmail, previewUrl }),
  })
}

// 9. Drop pre-order / deposit confirmation (sent to shopper after order placed)
export async function sendDropOrderConfirmation({ order, launch, items, to, baseUrl }) {
  if (!to) return { skipped: 'no recipient' }
  const isDeposit = order?.collection_mode === 'deposit'
  return sendOne({
    to,
    subject: isDeposit
      ? `Deposit received — ${launch?.title || 'your drop'} #${order.short_code}`
      : `Pre-order #${order.short_code} — ${launch?.title || 'your drop'}`,
    react: DropOrderConfirmation({ order, launch, items: items || [], baseUrl }),
  })
}

// 10. Drop order payment confirmed (sent when admin marks the order paid)
export async function sendDropOrderPaidConfirmation({ order, launch, items, to }) {
  if (!to) return { skipped: 'no recipient' }
  return sendOne({
    to,
    subject: `Payment confirmed — ${launch?.title || 'your drop'}`,
    react: DropOrderPaid({ order, launch, items: items || [] }),
  })
}

// =============================================================================
// Phase A — Drop Lifecycle cadence (June 2026)
// =============================================================================
// 11. "Drop opened" fan-out (cron — fires at launch_at). Loops over the
// per-launch subscriber list (launch_subscribers). One email per subscriber.
export async function sendDropOpenedFanout({ launch, subscribers, baseUrl }) {
  const url = publicLaunchUrl(launch, baseUrl)
  const results = []
  for (const s of subscribers || []) {
    results.push(await sendOne({
      to: s.email,
      subject: `Now open — ${launch.title}`,
      react: DropOpened({ launch, subscriberName: s.name || null, viewUrl: url }),
    }))
  }
  return { sent: results.filter(x => x.id).length, total: subscribers?.length || 0 }
}

// 12. "+5 day" mid-window reminder.
export async function sendDropStillOpenFanout({ launch, subscribers, baseUrl, closesAtLabel }) {
  const url = publicLaunchUrl(launch, baseUrl)
  const results = []
  for (const s of subscribers || []) {
    results.push(await sendOne({
      to: s.email,
      subject: `Still open — ${launch.title}`,
      react: DropStillOpen({ launch, subscriberName: s.name || null, viewUrl: url, closesAtLabel }),
    }))
  }
  return { sent: results.filter(x => x.id).length, total: subscribers?.length || 0 }
}

// 13. 24h-pre-close last call.
export async function sendDropClosingSoonFanout({ launch, subscribers, baseUrl, closesAtLabel }) {
  const url = publicLaunchUrl(launch, baseUrl)
  const results = []
  for (const s of subscribers || []) {
    results.push(await sendOne({
      to: s.email,
      subject: `Closes in 24h — ${launch.title}`,
      react: DropClosingSoon({ launch, subscriberName: s.name || null, viewUrl: url, closesAtLabel }),
    }))
  }
  return { sent: results.filter(x => x.id).length, total: subscribers?.length || 0 }
}

// 14. Vendor close-summary recap.
export async function sendDropCloseSummary({ launch, vendorEmail, totals, baseUrl }) {
  if (!vendorEmail) return { skipped: 'no recipient' }
  const dashboardUrl = `${(baseUrl || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '')}/dashboard`
  return sendOne({
    to: vendorEmail,
    subject: `Drop summary — ${launch.title}`,
    react: DropCloseSummary({
      launch,
      totalOrders: totals?.total_orders || 0,
      paidOrders: totals?.paid_orders || 0,
      totalCents: totals?.total_cents || 0,
      dashboardUrl,
    }),
  })
}
