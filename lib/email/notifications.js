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
