import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { store } from '@/lib/mock-store'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { notifyReservationConfirmed, notifySoldOut } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_API_KEY || 'sk_test_emergent', { apiVersion: '2024-06-20' })

// Returns the updated reservation row (or null) AND the launch + creator info needed for emails.
async function markReservationStatus(stripeSessionId, status) {
  const sb = getSupabaseAdmin()
  if (sb) {
    const { data: existing } = await sb.from('reservations').select('*').eq('stripe_session_id', stripeSessionId).maybeSingle()
    if (!existing) return { reservation: null }
    if (existing.status !== 'pending') return { reservation: existing, alreadyProcessed: true }
    const { data: updated } = await sb.from('reservations').update({ status }).eq('stripe_session_id', stripeSessionId).select().maybeSingle()
    // Pull launch + creator email for downstream emails
    const { data: launch } = await sb.from('launches').select('*').eq('id', existing.launch_id).maybeSingle()
    let creatorEmail = null
    if (launch) {
      const { data: profile } = await sb.from('profiles').select('email').eq('id', launch.creator_id).maybeSingle()
      creatorEmail = profile?.email || null
    }
    return { reservation: updated, launch, creatorEmail }
  }
  const r = store.reservations.find(x => x.stripe_session_id === stripeSessionId)
  if (!r) return { reservation: null }
  if (r.status !== 'pending') return { reservation: r, alreadyProcessed: true }
  r.status = status
  const launch = store.launches.get(r.launch_id) || null
  return { reservation: r, launch, creatorEmail: null }
}

async function maybeSendSoldOut({ launch, baseUrl, creatorEmail }) {
  if (!launch?.capacity || !creatorEmail) return
  const sb = getSupabaseAdmin()
  if (!sb) return
  // Count held reservations for this launch
  const { count } = await sb
    .from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('launch_id', launch.id)
    .in('status', ['held', 'captured'])
  if (count === launch.capacity) {
    notifySoldOut({ launch, capacity: launch.capacity, creatorEmail, baseUrl }).catch(() => {})
  }
}

export async function POST(request) {
  const sig = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const rawBody = await request.text()
  const baseUrl = new URL(request.url).origin

  let event
  const hasRealSecret = webhookSecret && webhookSecret !== 'whsec_placeholder'
  try {
    if (hasRealSecret) {
      if (!sig) {
        console.warn('[stripe webhook] missing Stripe-Signature header')
        return NextResponse.json({ error: 'Missing Stripe-Signature header' }, { status: 400 })
      }
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    } else {
      event = JSON.parse(rawBody)
      console.warn('[stripe webhook] WEBHOOK_SECRET not configured; signature NOT verified')
    }
  } catch (err) {
    console.error('[stripe webhook] signature verification failed:', err.message)
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      if (session.payment_status === 'paid') {
        const result = await markReservationStatus(session.id, 'held')
        // Fire-and-forget emails — only on first processing (idempotency)
        if (result.reservation && !result.alreadyProcessed && result.launch) {
          notifyReservationConfirmed({ launch: result.launch, reservation: result.reservation, baseUrl }).catch(() => {})
          maybeSendSoldOut({ launch: result.launch, baseUrl, creatorEmail: result.creatorEmail }).catch(() => {})
        }
      }
    } else if (event.type === 'checkout.session.expired') {
      await markReservationStatus(event.data.object.id, 'cancelled')
    } else if (event.type === 'checkout.session.async_payment_failed') {
      await markReservationStatus(event.data.object.id, 'cancelled')
    }
  } catch (err) {
    console.error('[stripe webhook] handler error:', err)
  }

  return NextResponse.json({ received: true })
}
