// Weekly cron — Vercel calls every Wednesday at 8:00 AM (server TZ — set in vercel.json).
//
// Job: send a Web Push notification to every subscribed shopper reminding them
// that today's market is on. Skips if today has no market_date row, OR if
// today's market_date is cancelled.
//
// Auth: `Authorization: Bearer $CRON_SECRET`.
// Manual override: POST body { dryRun?: bool, force?: bool, message?: {title, body, url?} }.
//   - force=true bypasses the "today is a market day" check (for ad-hoc blasts).
//   - dryRun=true counts subscriptions without actually sending.
//   - message overrides the default copy.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { sendPushTo } from '@/lib/markets/web-push-server'
import { notifyMarketDayReminder, channelStatus } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthed(request) {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const auth = request.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) return false
  return auth.slice('Bearer '.length).trim() === expected
}

function todayDateString() {
  // Server-local YYYY-MM-DD (vercel.json schedule is in server TZ — Vercel docs)
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// DST guard: vercel.json schedules this cron at BOTH 15:00 UTC and 16:00 UTC on
// Wednesdays so that exactly one of them lands at 08:00 America/Los_Angeles
// (PST UTC-8 in winter → 16:00 UTC, PDT UTC-7 in summer → 15:00 UTC). We then
// only proceed when the Pacific hour equals 8 — the other run no-ops.
function isEightAmPacific() {
  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false,
    }).format(new Date())
    return parseInt(hour, 10) === 8
  } catch { return true } // if Intl ever fails, don't block the run
}

async function runPush({ dryRun, force, message, baseUrl }) {
  const supa = getSupabaseAdmin()
  if (!supa) return { error: 'supabase admin not configured', status: 500 }

  const { data: market } = await supa.from('market_config')
    .select('id, name').eq('is_active', true).maybeSingle()
  if (!market) return { summary: { skipped: 'no active market' } }

  const today = todayDateString()
  const { data: marketDate } = await supa.from('market_dates')
    .select('id, date, start_time, end_time, is_cancelled, weather_forecast')
    .eq('market_config_id', market.id).eq('date', today).maybeSingle()

  if (!force) {
    if (!isEightAmPacific()) {
      return { summary: { skipped: 'DST guard: not 8am Pacific', date: today } }
    }
    if (!marketDate) return { summary: { skipped: 'no market today', date: today } }
    if (marketDate.is_cancelled) return { summary: { skipped: 'today cancelled', date: today } }
  }

  const startHm = (marketDate?.start_time || '').slice(0, 5)
  const endHm = (marketDate?.end_time || '').slice(0, 5)
  const defaultBody = startHm && endHm
    ? `Open today ${startHm}–${endHm}. Tap to browse vendors and pre-order.`
    : 'Open today. Tap to browse vendors and pre-order.'
  const url = (message?.url) || `${(baseUrl || '').replace(/\/$/, '')}/market`
  const payload = {
    title: message?.title || `Today at ${market.name}`,
    body: message?.body || defaultBody,
    url,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'market-day',
  }

  const { data: subs, error: subErr } = await supa.from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
  if (subErr) return { error: subErr.message, status: 500 }

  const summary = { date: today, total: subs?.length || 0, sent: 0, gone: 0, failed: 0 }
  
  // Only send push notifications if not dryRun and we have subscriptions
  if (!dryRun && subs?.length) {
    const goneIds = []
    for (const sub of subs) {
      const r = await sendPushTo(sub, payload)
      if (r.ok) summary.sent++
      else if (r.gone) { summary.gone++; goneIds.push(sub.id) }
      else summary.failed++
    }
    if (goneIds.length) {
      await supa.from('push_subscriptions').delete().in('id', goneIds)
    }
  }

  // ---- SMS fan-out (additive — opted-in shoppers only) ----
  const status = channelStatus()
  summary.sms = { eligible: 0, sent: 0, failed: 0, skipped: 0 }
  if (status.sms && !dryRun) {
    const { data: smsShoppers } = await supa.from('shopper_profiles')
      .select('id, phone, sms_opt_in')
      .eq('sms_opt_in', true)
      .not('phone', 'is', null)
    summary.sms.eligible = smsShoppers?.length || 0
    if (smsShoppers?.length) {
      const smsUrl = url
      for (const sp of smsShoppers) {
        const res = await notifyMarketDayReminder({
          to: sp.phone,
          marketName: market.name,
          startTime: startHm || null,
          endTime: endHm || null,
          url: smsUrl,
        }, ['sms'])
        const r = (res || [])[0] || {}
        if (r.sid) summary.sms.sent++
        else if (r.skipped) summary.sms.skipped++
        else summary.sms.failed++
      }
    }
  } else if (!status.sms) {
    summary.sms.skipped = 'twilio not configured'
  } else if (dryRun) {
    summary.sms.skipped = 'dryRun'
  }

  return { summary, payload }
}

export async function GET(request) {
  if (!isAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === '1'
  const force = url.searchParams.get('force') === '1'
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || url.origin
  const result = await runPush({ dryRun, force, message: null, baseUrl })
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 })
  return NextResponse.json({ ok: true, dryRun, force, ...result })
}

export async function POST(request) {
  if (!isAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin
  const result = await runPush({
    dryRun: !!body.dryRun, force: !!body.force, message: body.message || null, baseUrl,
  })
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 })
  return NextResponse.json({ ok: true, dryRun: !!body.dryRun, force: !!body.force, ...result })
}
