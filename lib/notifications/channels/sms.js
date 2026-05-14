// Twilio SMS channel — plugged into lib/notifications/index.js orchestrator.
//
// Surface area mirrors the `email` channel so the orchestrator can dispatch
// the same lifecycle events. SMS is intentionally terser than email — it
// includes a short headline + a single magic link.
//
// Compliance:
//   - Recipients must have `sms_opt_in = true` and a valid `phone` saved on
//     their shopper_profiles / vendors row. The orchestrator caller is
//     responsible for filtering — these channel functions do NOT lookup
//     opt-in state themselves; they accept an explicit `to` phone number.
//   - We append "Reply STOP to opt out" to outbound copy (Twilio also
//     auto-handles STOP/HELP at the carrier level for US long codes/toll-free).
//
// Safety:
//   - Never throws upstream. Returns `{ skipped }` when Twilio isn't
//     configured so dev / preview environments don't crash.
//   - Each public function returns `{ sid?, error?, skipped? }`.

import twilio from 'twilio'

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  try { return twilio(sid, token) } catch { return null }
}

export function smsEnabled() {
  return !!(process.env.TWILIO_ACCOUNT_SID
    && process.env.TWILIO_AUTH_TOKEN
    && process.env.TWILIO_FROM_NUMBER)
}

// Normalise to E.164-ish — keep leading + and digits only.
function normalisePhone(raw) {
  if (!raw) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  // If it already starts with '+', keep it. Otherwise assume US and prefix +1
  // (only if it's 10 digits). Anything else: pass through as-is and let
  // Twilio reject if invalid.
  const cleaned = trimmed.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.length === 10) return `+1${cleaned}`
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`
}

const FOOTER = '\n\nReply STOP to opt out.'
const MAX_BODY = 1500 // Twilio splits >1600 chars; stay well under

function clip(s, n) { if (!s) return ''; return s.length <= n ? s : `${s.slice(0, n - 1)}…` }

async function sendOne({ to, body }) {
  const client = getTwilioClient()
  const from = process.env.TWILIO_FROM_NUMBER
  if (!client || !from) return { skipped: 'twilio not configured' }
  const phone = normalisePhone(to)
  if (!phone) return { skipped: 'no phone' }
  const finalBody = clip(`${body || ''}${body?.includes('STOP') ? '' : FOOTER}`, MAX_BODY)
  try {
    const msg = await client.messages.create({ to: phone, from, body: finalBody })
    return { sid: msg.sid }
  } catch (e) {
    return { error: e?.message || String(e), code: e?.code }
  }
}

// -- Lifecycle functions (mirror email channel signatures) -------------------

export async function sendWaitlistConfirmation({ launch, entry }) {
  const to = entry?.phone || entry?.shopper_phone
  if (!to) return { skipped: 'no phone' }
  const name = launch?.title || 'the drop'
  return sendOne({ to, body: `You're on the waitlist for ${name}. We'll text the moment it opens.` })
}

export async function sendReservationConfirmation({ launch, reservation, baseUrl }) {
  const to = reservation?.phone || reservation?.shopper_phone
  if (!to) return { skipped: 'no phone' }
  const name = launch?.title || 'your drop'
  const url = baseUrl ? ` ${String(baseUrl).replace(/\/$/, '')}/launch/${launch?.slug || launch?.id || ''}` : ''
  return sendOne({ to, body: `Reservation confirmed for ${name}.${url}` })
}

export async function sendLaunchReminder({ launch, recipients = [], hoursUntil, baseUrl }) {
  const name = launch?.title || 'your drop'
  const window = hoursUntil ? `${hoursUntil}h` : 'soon'
  const url = baseUrl ? ` ${String(baseUrl).replace(/\/$/, '')}/launch/${launch?.slug || launch?.id || ''}` : ''
  const results = []
  for (const r of recipients) {
    const to = r?.phone || r?.shopper_phone
    if (!to) continue
    // Per-recipient opt-in filter — only send to opted-in shoppers.
    if (r?.sms_opt_in === false) continue
    results.push(await sendOne({ to, body: `${name} drops in ${window}.${url}` }))
  }
  return { results }
}

export async function sendLaunchLiveNotification({ launch, recipients = [], baseUrl }) {
  const name = launch?.title || 'A drop'
  const url = baseUrl ? ` ${String(baseUrl).replace(/\/$/, '')}/launch/${launch?.slug || launch?.id || ''}` : ''
  const results = []
  for (const r of recipients) {
    const to = r?.phone || r?.shopper_phone
    if (!to) continue
    if (r?.sms_opt_in === false) continue
    results.push(await sendOne({ to, body: `${name} is live now.${url}` }))
  }
  return { results }
}

export async function sendSoldOutNotification({ launch, creatorPhone }) {
  if (!creatorPhone) return { skipped: 'no phone' }
  const name = launch?.title || 'Your drop'
  return sendOne({ to: creatorPhone, body: `${name} sold out.` })
}

export async function sendMarketOrderConfirmation({ order, vendor, venmoUrl, marketName }) {
  const to = order?.shopper_phone
  if (!to) return { skipped: 'no shopper phone' }
  const label = marketName || 'the market'
  const code = order?.short_code ? `#${order.short_code} ` : ''
  const pay = venmoUrl ? ` Pay via Venmo: ${venmoUrl}` : ''
  return sendOne({
    to,
    body: `Order ${code}placed with ${vendor?.name || 'the vendor'} for ${label}.${pay}`,
  })
}

export async function sendMarketFulfillmentMagicLink({ order, vendor, magicUrl, marketName }) {
  const to = vendor?.phone
  if (!to) return { skipped: 'no vendor phone' }
  const code = order?.short_code ? `#${order.short_code} ` : ''
  return sendOne({
    to,
    body: `New ${marketName || 'market'} order ${code}— review & mark fulfilled: ${magicUrl}`,
  })
}

// -- Extra lifecycle for the market-day cron --------------------------------

export async function sendMarketDayReminder({ to, marketName, startTime, endTime, url }) {
  if (!to) return { skipped: 'no phone' }
  const window = startTime && endTime ? ` ${startTime}–${endTime}` : ''
  const link = url ? ` ${url}` : ''
  return sendOne({
    to,
    body: `Today at ${marketName || 'the market'}${window}. Browse vendors & pre-order:${link}`,
  })
}

// -- Generic sender (used by admin broadcasts / ad-hoc) ---------------------

export async function sendGeneric({ to, body }) {
  return sendOne({ to, body })
}
