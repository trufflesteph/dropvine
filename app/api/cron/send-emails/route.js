// Vercel Cron-compatible endpoint. Vercel sends GET with Authorization: Bearer $CRON_SECRET.
// Also accepts POST for manual / external schedulers (same auth header).
//
// Schedule: every 10 minutes (see vercel.json). Window is forgiving — each drop is
// only ever notified once (per kind) thanks to the reminded_at / live_notified_at
// flag columns on drops.
//
// Body (POST only): { kinds?: string[], dryRun?: boolean }
// Default kinds: ['reminders', 'live']
// (The old 'soldout' kind counted Stripe reservations; it was removed. The
// vendor sold-out email now fires when an order sells a drop out — see
// lib/orders/sold-out.js.)

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import {
  notifyLaunchReminder,
  notifyLaunchLive,
} from '@/lib/notifications'
import { isDemoDrop } from '@/lib/drops/demo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REMINDER_HOURS_BEFORE = 24

function isAuthed(request) {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const auth = request.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) return false
  const token = auth.slice('Bearer '.length).trim()
  return token === expected
}

async function runReminderSweep({ sb, baseUrl, dryRun }) {
  // Launches: published, opening within REMINDER_HOURS_BEFORE +/- 30 min, not yet reminded
  const now = Date.now()
  const lo = new Date(now + REMINDER_HOURS_BEFORE * 3600 * 1000 - 30 * 60 * 1000).toISOString()
  const hi = new Date(now + REMINDER_HOURS_BEFORE * 3600 * 1000 + 30 * 60 * 1000).toISOString()
  const { data: drops } = await sb
    .from('drops')
    .select('*')
    .eq('status', 'published')
    .is('reminded_at', null)
    .gte('launch_at', lo)
    .lte('launch_at', hi)
  let total = 0, sent = 0, suppressed = 0, retrying = 0, demoSkipped = 0
  for (const drop of drops || []) {
    // Demo drops never send anything.
    if (await isDemoDrop(sb, drop)) { demoSkipped += 1; continue }
    const { data: recipients } = await sb.from('waitlist_entries').select('email,name').eq('drop_id', drop.id)
    total += (recipients || []).length
    if (!dryRun) {
      const results = await notifyLaunchReminder({ drop, recipients: recipients || [], hoursUntil: REMINDER_HOURS_BEFORE, baseUrl })
      const r = (results || []).find(x => x.channel === 'email')
      // Suppression lookup failed, nothing sent: leave reminded_at null so the
      // next run (while the drop is still in the window) retries.
      if (r?.lookupFailed) { retrying += 1; continue }
      sent += r?.sent || 0
      suppressed += r?.suppressed || 0
      // Set the flag so we never re-send for this drop
      await sb.from('drops').update({ reminded_at: new Date().toISOString() }).eq('id', drop.id)
    } else {
      sent += (recipients || []).length
    }
  }
  return { drops: (drops || []).length, sent, suppressed, retrying, demo_skipped: demoSkipped, total }
}

async function runLiveSweep({ sb, baseUrl, dryRun }) {
  // Launches: published, launch_at <= now AND > now - 60 min, not yet live-notified
  const now = Date.now()
  const lo = new Date(now - 60 * 60 * 1000).toISOString()
  const hi = new Date(now).toISOString()
  const { data: drops } = await sb
    .from('drops')
    .select('*')
    .eq('status', 'published')
    .is('live_notified_at', null)
    .gte('launch_at', lo)
    .lte('launch_at', hi)
  let total = 0, sent = 0, suppressed = 0, retrying = 0, demoSkipped = 0
  for (const drop of drops || []) {
    // Demo drops never send anything.
    if (await isDemoDrop(sb, drop)) { demoSkipped += 1; continue }
    const { data: recipients } = await sb.from('waitlist_entries').select('email,name').eq('drop_id', drop.id)
    total += (recipients || []).length
    if (!dryRun) {
      const results = await notifyLaunchLive({ drop, recipients: recipients || [], baseUrl })
      const r = (results || []).find(x => x.channel === 'email')
      // Suppression lookup failed, nothing sent: leave live_notified_at null
      // so the next run (while the drop is still in the window) retries.
      if (r?.lookupFailed) { retrying += 1; continue }
      sent += r?.sent || 0
      suppressed += r?.suppressed || 0
      await sb.from('drops').update({ live_notified_at: new Date().toISOString() }).eq('id', drop.id)
    } else {
      sent += (recipients || []).length
    }
  }
  return { drops: (drops || []).length, sent, suppressed, retrying, demo_skipped: demoSkipped, total }
}

async function runAllSweeps(request, { kinds, dryRun }) {
  const sb = getSupabaseAdmin()
  if (!sb) return { error: 'supabase admin not configured', status: 500 }
  const baseUrl = new URL(request.url).origin
  const summary = {}
  if (kinds.includes('reminders')) summary.reminders = await runReminderSweep({ sb, baseUrl, dryRun })
  if (kinds.includes('live'))      summary.live      = await runLiveSweep({ sb, baseUrl, dryRun })
  return { summary }
}

export async function GET(request) {
  if (!isAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === '1'
  const kinds = (url.searchParams.get('kinds') || 'reminders,live').split(',').map(s => s.trim()).filter(Boolean)
  const result = await runAllSweeps(request, { kinds, dryRun })
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 })
  return NextResponse.json({ ok: true, dryRun, summary: result.summary })
}

export async function POST(request) {
  if (!isAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const dryRun = !!body.dryRun
  const kinds = body.kinds || ['reminders', 'live']
  const result = await runAllSweeps(request, { kinds, dryRun })
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 })
  return NextResponse.json({ ok: true, dryRun, summary: result.summary })
}
