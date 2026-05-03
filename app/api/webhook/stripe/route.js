import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { store } from '@/lib/mock-store'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_API_KEY || 'sk_test_emergent', { apiVersion: '2024-06-20' })

async function markReservationStatus(stripeSessionId, status) {
  const sb = getSupabaseAdmin()
  if (sb) {
    // Idempotency: only flip if currently pending
    const { data: existing } = await sb.from('reservations').select('*').eq('stripe_session_id', stripeSessionId).maybeSingle()
    if (!existing) return null
    if (existing.status !== 'pending') return existing
    const { data } = await sb.from('reservations').update({ status }).eq('stripe_session_id', stripeSessionId).select().maybeSingle()
    return data
  }
  const r = store.reservations.find(x => x.stripe_session_id === stripeSessionId)
  if (!r) return null
  if (r.status !== 'pending') return r
  r.status = status
  return r
}

export async function POST(request) {
  const sig = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const rawBody = await request.text()

  let event
  const hasRealSecret = webhookSecret && webhookSecret !== 'whsec_placeholder'
  try {
    if (hasRealSecret) {
      // Production / configured: signature required, no exceptions
      if (!sig) {
        console.warn('[stripe webhook] missing Stripe-Signature header')
        return NextResponse.json({ error: 'Missing Stripe-Signature header' }, { status: 400 })
      }
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    } else {
      // Dev fallback: secret not yet set — accept unsigned to allow local development.
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
      // Only mark held when actually paid
      if (session.payment_status === 'paid') {
        await markReservationStatus(session.id, 'held')
      }
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object
      await markReservationStatus(session.id, 'cancelled')
    } else if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object
      await markReservationStatus(session.id, 'cancelled')
    }
  } catch (err) {
    console.error('[stripe webhook] handler error:', err)
    // Still return 200 so Stripe doesn't retry on our internal bugs
  }

  return NextResponse.json({ received: true })
}
