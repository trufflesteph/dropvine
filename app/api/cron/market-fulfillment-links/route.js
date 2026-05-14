// Hourly cron — Vercel sends GET with `Authorization: Bearer $CRON_SECRET`.
//
// Job: ensure every recent open order has a working fulfillment magic-link
// emailed to the vendor. Acts as a recovery net for orders where the
// inline email failed when the order was placed (Resend outage, vendor email
// mistype later corrected, etc).
//
// Logic:
//   For every order created in the last 48h with status in (pending_payment, payment_received):
//     If there is no unexpired fulfillment_token row → create one (7d TTL)
//     and resend the vendor magic-link email.
//
// Idempotent — re-running within the same hour will normally do nothing.

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { notifyMarketVendorOrderArrived } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthed(request) {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const auth = request.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) return false
  return auth.slice('Bearer '.length).trim() === expected
}

function makeToken() { return crypto.randomBytes(32).toString('base64url') }

async function runSweep({ baseUrl, dryRun }) {
  const supa = getSupabaseAdmin()
  if (!supa) return { error: 'supabase admin not configured', status: 500 }

  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
  const { data: orders, error: oErr } = await supa.from('orders')
    .select('id, short_code, status, vendor_id, total_cents, created_at, market_date_id')
    .in('status', ['pending_payment', 'payment_received'])
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(200)
  if (oErr) return { error: oErr.message, status: 500 }

  const summary = { scanned: orders?.length || 0, links_minted: 0, emails_sent: 0, errors: [] }
  if (!orders?.length) return { summary }

  const orderIds = orders.map((o) => o.id)
  const { data: existingTokens } = await supa.from('fulfillment_tokens')
    .select('order_id, expires_at').in('order_id', orderIds)
  const liveByOrder = new Map()
  for (const t of existingTokens || []) {
    if (new Date(t.expires_at) > new Date()) liveByOrder.set(t.order_id, true)
  }

  // Pull market name + vendor info we need for the email body
  const { data: market } = await supa.from('market_config').select('name').eq('is_active', true).maybeSingle()

  for (const order of orders) {
    if (liveByOrder.has(order.id)) continue
    if (dryRun) { summary.links_minted++; continue }

    const token = makeToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    const { error: tErr } = await supa.from('fulfillment_tokens').insert({
      order_id: order.id, token, expires_at: expiresAt,
    })
    if (tErr) { summary.errors.push({ order: order.short_code, error: tErr.message }); continue }
    summary.links_minted++

    const [{ data: vendor }, { data: items }, { data: mDate }] = await Promise.all([
      supa.from('vendors').select('id, name, email, phone, sms_opt_in, venmo_handle, booth_number').eq('id', order.vendor_id).maybeSingle(),
      supa.from('order_items').select('*').eq('order_id', order.id),
      order.market_date_id
        ? supa.from('market_dates').select('date').eq('id', order.market_date_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    if (!vendor?.email) {
      summary.errors.push({ order: order.short_code, error: 'vendor has no email' })
      continue
    }

    const magicUrl = `${(baseUrl || '').replace(/\/$/, '')}/market/fulfillment/${token}`
    const vendorChannels = (vendor?.sms_opt_in === true && vendor?.phone) ? ['email', 'sms'] : ['email']
    const result = await notifyMarketVendorOrderArrived({
      order, vendor, items: items || [], magicUrl,
      marketName: market?.name || 'Market',
      marketDate: mDate?.date || null,
    }, vendorChannels)
    const r = (result || []).find((x) => x.channel === 'email')
    if (r?.id) summary.emails_sent++
    else if (r?.error) summary.errors.push({ order: order.short_code, error: r.error })
  }

  return { summary }
}

export async function GET(request) {
  if (!isAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === '1'
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || url.origin
  const result = await runSweep({ baseUrl, dryRun })
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 })
  return NextResponse.json({ ok: true, dryRun, ...result })
}

export async function POST(request) {
  if (!isAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const dryRun = !!body.dryRun
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin
  const result = await runSweep({ baseUrl, dryRun })
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 })
  return NextResponse.json({ ok: true, dryRun, ...result })
}
