import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RECOGNIZED_EVENTS = new Set(['message.finalized', 'message.received'])

function verifyTelnyxSignature({ rawBody, signature, timestamp }) {
  const publicKey = process.env.TELNYX_PUBLIC_KEY?.trim().replace(/\\n/g, '\n')
  if (!publicKey) return { ok: false, reason: 'TELNYX_PUBLIC_KEY is not configured' }
  if (!signature) return { ok: false, reason: 'missing telnyx-signature-ed25519 header' }
  if (!timestamp) return { ok: false, reason: 'missing telnyx-timestamp header' }

  try {
    const signedPayload = `${timestamp}|${rawBody}`
    const valid = crypto.verify(
      null,
      Buffer.from(signedPayload, 'utf8'),
      publicKey,
      Buffer.from(signature, 'base64'),
    )
    return valid ? { ok: true } : { ok: false, reason: 'signature mismatch' }
  } catch (error) {
    return { ok: false, reason: `invalid public key or signature: ${error.message}` }
  }
}

function phoneCandidates(phone) {
  const value = String(phone || '').trim()
  const digits = value.replace(/\D/g, '')
  return [...new Set([value, digits ? `+${digits}` : '', digits].filter(Boolean))]
}

async function markContactUnsubscribed(phone) {
  const supabase = getSupabaseAdmin()
  if (!supabase) throw new Error('Supabase is not configured')

  let lastError = null
  for (const candidate of phoneCandidates(phone)) {
    const { data: contacts, error: lookupError } = await supabase
      .from('vendor_contacts')
      .select('id')
      .eq('phone', candidate)

    if (lookupError) {
      lastError = lookupError
      continue
    }
    if (!contacts?.length) continue

    const ids = contacts.map((contact) => contact.id)
    const { error: updateError } = await supabase
      .from('vendor_contacts')
      .update({ unsubscribed: true })
      .in('id', ids)

    if (updateError) throw updateError
    return contacts.length
  }

  if (lastError) throw lastError
  return 0
}

export async function POST(request) {
  const rawBody = await request.text()
  const verification = verifyTelnyxSignature({
    rawBody,
    signature: request.headers.get('telnyx-signature-ed25519'),
    timestamp: request.headers.get('telnyx-timestamp'),
  })
  if (!verification.ok) {
    console.warn('[telnyx webhook] signature verification failed:', verification.reason)
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  let event
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const eventType = event?.data?.event_type || event?.event_type
  if (!RECOGNIZED_EVENTS.has(eventType)) {
    return NextResponse.json({ error: 'unrecognized event' }, { status: 400 })
  }

  const payload = event?.data?.payload || {}
  if (eventType === 'message.finalized') {
    console.log('[telnyx webhook] message.finalized', {
      id: payload.id,
      status: payload.delivery_status || payload.to_be_status,
      direction: payload.direction,
      recipients: payload.to?.map((recipient) => ({
        phone: recipient.phone_number,
        status: recipient.status,
      })),
    })
  } else if (String(payload.text || '').trim().toUpperCase() === 'STOP') {
    const phone = payload.from?.phone_number
    if (phone) {
      try {
        const updated = await markContactUnsubscribed(phone)
        console.log('[telnyx webhook] STOP processed', { phone, updated })
      } catch (error) {
        console.error('[telnyx webhook] STOP update failed:', error.message)
        return NextResponse.json({ error: 'failed to update contact' }, { status: 500 })
      }
    } else {
      console.warn('[telnyx webhook] STOP received without a sender phone number')
    }
  }

  return NextResponse.json({ ok: true })
}