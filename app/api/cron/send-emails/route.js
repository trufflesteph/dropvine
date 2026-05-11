// Vercel Cron-compatible endpoint. Vercel sends GET with Authorization: Bearer $CRON_SECRET.
// Also accepts POST for manual / external schedulers (same auth header).
//
// Schedule: every 10 minutes (see vercel.json). Window is forgiving — each launch is
// only ever notified once (per kind) thanks to the reminded_at / live_notified_at /
// sold_out_notified_at flag columns on launches.
//
// Body (POST only): { kinds?: string[], dryRun?: boolean }
// Default kinds: ['reminders', 'live', 'soldout']

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import {
  notifyLaunchReminder,
  notifyLaunchLive,
  notifySoldOut,
} from '@/lib/notifications'

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

async function getCreatorEmail(sb, creatorId) {
  if (!creatorId) return null
  const { data } = await sb.from('profiles').select('email').eq('id', creatorId).maybeSingle()
  return data?.email || null
}

async function runReminderSweep({ sb, baseUrl, dryRun }) {
  // Launches: published, opening within REMINDER_HOURS_BEFORE +/- 30 min, not yet reminded
  const now = Date.now()
  const lo = new Date(now + REMINDER_HOURS_BEFORE * 3600 * 1000 - 30 * 60 * 1000).toISOString()
  const hi = new Date(now + REMINDER_HOURS_BEFORE * 3600 * 1000 + 30 * 60 * 1000).toISOString()
  const { data: launches } = await sb
    .from('launches')
    .select('*')
    .eq('status', 'published')
    .is('reminded_at', null)
    .gte('launch_at', lo)
    .lte('launch_at', hi)
  let total = 0, sent = 0
  for (const launch of launches || []) {
    const { data: recipients } = await sb.from('waitlist_entries').select('email,name').eq('launch_id', launch.id)
    if (!dryRun) {
      const results = await notifyLaunchReminder({ launch, recipients: recipients || [], hoursUntil: REMINDER_HOURS_BEFORE, baseUrl })
      const r = (results || []).find(x => x.channel === 'email')
      sent += r?.sent || 0
      // Set the flag so we never re-send for this launch
      await sb.from('launches').update({ reminded_at: new Date().toISOString() }).eq('id', launch.id)
    } else {
      sent += (recipients || []).length
    }
    total += (recipients || []).length
  }
  return { launches: (launches || []).length, sent, total }
}

async function runLiveSweep({ sb, baseUrl, dryRun }) {
  // Launches: published, launch_at <= now AND > now - 60 min, not yet live-notified
  const now = Date.now()
  const lo = new Date(now - 60 * 60 * 1000).toISOString()
  const hi = new Date(now).toISOString()
  const { data: launches } = await sb
    .from('launches')
    .select('*')
    .eq('status', 'published')
    .is('live_notified_at', null)
    .gte('launch_at', lo)
    .lte('launch_at', hi)
  let total = 0, sent = 0
  for (const launch of launches || []) {
    const { data: recipients } = await sb.from('waitlist_entries').select('email,name').eq('launch_id', launch.id)
    if (!dryRun) {
      const results = await notifyLaunchLive({ launch, recipients: recipients || [], baseUrl })
      const r = (results || []).find(x => x.channel === 'email')
      sent += r?.sent || 0
      await sb.from('launches').update({ live_notified_at: new Date().toISOString() }).eq('id', launch.id)
    } else {
      sent += (recipients || []).length
    }
    total += (recipients || []).length
  }
  return { launches: (launches || []).length, sent, total }
}

async function runSoldOutSweep({ sb, baseUrl, dryRun }) {
  // Launches with capacity set, sold_out_notified_at IS NULL — check held count vs capacity
  const { data: launches } = await sb
    .from('launches')
    .select('*')
    .eq('status', 'published')
    .not('capacity', 'is', null)
    .is('sold_out_notified_at', null)
  let notified = 0
  for (const launch of launches || []) {
    const { count } = await sb
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('launch_id', launch.id)
      .in('status', ['held', 'captured'])
    if ((count || 0) < launch.capacity) continue
    const creatorEmail = await getCreatorEmail(sb, launch.creator_id)
    if (!creatorEmail) continue
    if (!dryRun) {
      await notifySoldOut({ launch, capacity: launch.capacity, creatorEmail, baseUrl })
      await sb.from('launches').update({ sold_out_notified_at: new Date().toISOString() }).eq('id', launch.id)
    }
    notified += 1
  }
  return { launches: (launches || []).length, notified }
}

async function runAllSweeps(request, { kinds, dryRun }) {
  const sb = getSupabaseAdmin()
  if (!sb) return { error: 'supabase admin not configured', status: 500 }
  const baseUrl = new URL(request.url).origin
  const summary = {}
  if (kinds.includes('reminders')) summary.reminders = await runReminderSweep({ sb, baseUrl, dryRun })
  if (kinds.includes('live'))      summary.live      = await runLiveSweep({ sb, baseUrl, dryRun })
  if (kinds.includes('soldout'))   summary.soldout   = await runSoldOutSweep({ sb, baseUrl, dryRun })
  return { summary }
}

export async function GET(request) {
  if (!isAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === '1'
  const kinds = (url.searchParams.get('kinds') || 'reminders,live,soldout').split(',').map(s => s.trim()).filter(Boolean)
  const result = await runAllSweeps(request, { kinds, dryRun })
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 })
  return NextResponse.json({ ok: true, dryRun, summary: result.summary })
}

export async function POST(request) {
  if (!isAuthed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const dryRun = !!body.dryRun
  const kinds = body.kinds || ['reminders', 'live', 'soldout']
  const result = await runAllSweeps(request, { kinds, dryRun })
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 })
  return NextResponse.json({ ok: true, dryRun, summary: result.summary })
}
