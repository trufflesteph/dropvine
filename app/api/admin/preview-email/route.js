// Dev/preview helper: render and send any of our 5 templates to a specific
// recipient. Gated by the same cron secret. Useful for QA-ing template designs
// without staging full DB state.
//
// POST /api/admin/preview-email
// Headers: Authorization: Bearer <CRON_SECRET>
// Body: { template: 'waitlist'|'reservation'|'reminder'|'live'|'soldout', to: 'me@example.com' }

import { NextResponse } from 'next/server'
import { render } from '@react-email/render'
import { getResend, getDefaultFrom } from '@/lib/email/client'
import { WaitlistConfirmation } from '@/lib/email/templates/WaitlistConfirmation'
import { ReservationConfirmation } from '@/lib/email/templates/ReservationConfirmation'
import { LaunchReminder } from '@/lib/email/templates/LaunchReminder'
import { LaunchLive } from '@/lib/email/templates/LaunchLive'
import { SoldOut } from '@/lib/email/templates/SoldOut'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SAMPLE = {
  drop: {
    id: 'sample',
    handle: 'edition-three-vessels',
    title: 'Edition Three — Vessels',
    tagline: 'Five vessels. Hand-thrown. Limited release.',
    description: 'Ceramic vessels for the considered home.',
    launch_at: new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(),
    price_cents: 28000,
    reservation_enabled: true,
    reservation_hold_cents: 5000,
    capacity: 50,
  },
  reservation: {
    email: 'preview@example.com',
    amount_cents: 5000,
    stripe_session_id: 'cs_test_a1bm6YiKrTQg4dHFLynmsEEoyHz2osHE1',
    status: 'held',
  },
}

export async function POST(request) {
  const expected = process.env.CRON_SECRET
  const auth = request.headers.get('authorization') || ''
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { template, to } = await request.json().catch(() => ({}))
  if (!template || !to) return NextResponse.json({ error: 'template and to are required' }, { status: 400 })

  const baseUrl = new URL(request.url).origin
  const viewUrl = `${baseUrl}/l/${SAMPLE.drop.handle}`

  const map = {
    waitlist: { subject: `You’re on the list — ${SAMPLE.drop.title}`, react: WaitlistConfirmation({ drop: SAMPLE.drop, name: 'Studio', viewUrl }) },
    reservation: { subject: `Reservation held — ${SAMPLE.drop.title}`, react: ReservationConfirmation({ drop: SAMPLE.drop, reservation: { ...SAMPLE.reservation, email: to }, viewUrl }) },
    reminder: { subject: `Reminder — ${SAMPLE.drop.title} opens soon`, react: LaunchReminder({ drop: SAMPLE.drop, hoursUntil: 24, viewUrl }) },
    live: { subject: `It’s open — ${SAMPLE.drop.title}`, react: LaunchLive({ drop: SAMPLE.drop, viewUrl }) },
    soldout: { subject: `Sold out — ${SAMPLE.drop.title}`, react: SoldOut({ drop: SAMPLE.drop, capacity: SAMPLE.drop.capacity, dashboardUrl: `${baseUrl}/dashboard/reservations` }) },
  }
  const choice = map[template]
  if (!choice) return NextResponse.json({ error: 'unknown template' }, { status: 400 })

  const resend = getResend()
  if (!resend) return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })

  const html = await render(choice.react, { pretty: false })
  const text = await render(choice.react, { plainText: true })
  const { data, error } = await resend.emails.send({
    from: getDefaultFrom(),
    to,
    subject: choice.subject,
    html,
    text,
  })
  if (error) return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  return NextResponse.json({ ok: true, id: data?.id, template, to })
}
