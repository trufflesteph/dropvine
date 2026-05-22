// /api/cron/drop-lifecycle
//
// Phase A vendor lifecycle cron. Runs every 10 minutes (vercel.json).
// Scans email_schedules for any rows where `sent_at IS NULL` and
// `scheduled_for <= now()`, fires the matching email batch, then stamps
// `sent_at`. Idempotent via UNIQUE (launch_id, kind) + sent_at NULL guard.
//
// Auth: Authorization: Bearer ${CRON_SECRET}.
// GET + POST both supported.  Query flags:
//   ?dryRun=1   — scan + return counts without sending or stamping sent_at.
//   ?kinds=open,reminder_5d,pre_close_24h,close_summary  — limit to a subset.
//   ?limit=50   — max rows per run (default 100).
//
// Tolerates a missing email_schedules table by returning a soft 200 with
// migration_pending=true so the cron doesn't keep alerting until the Phase A
// SQL is applied.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import {
  sendDropOpenedFanout,
  sendDropStillOpenFanout,
  sendDropClosingSoonFanout,
  sendDropCloseSummary,
} from '@/lib/email/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KIND_HANDLERS = {
  open: handleOpen,
  reminder_5d: handleReminder5d,
  pre_close_24h: handleClosingSoon,
  close_summary: handleCloseSummary,
}

function authorise(request) {
  const want = process.env.CRON_SECRET
  if (!want) return false
  const got = request.headers.get('authorization') || ''
  return got === `Bearer ${want}`
}

function asLabel(iso) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  } catch { return null }
}

async function loadLaunchAndSubscribers(supa, launchId) {
  const [{ data: launch }, { data: subscribers }] = await Promise.all([
    supa.from('launches').select('*').eq('id', launchId).maybeSingle(),
    supa.from('launch_subscribers').select('email, name, phone').eq('launch_id', launchId),
  ])
  return { launch, subscribers: subscribers || [] }
}

async function handleOpen(supa, row) {
  const { launch, subscribers } = await loadLaunchAndSubscribers(supa, row.launch_id)
  if (!launch) return { skipped: 'launch missing' }
  // Don't fan-out for drafts/archived launches.
  if (!['published', 'live'].includes(launch.status)) return { skipped: `status=${launch.status}` }
  const result = await sendDropOpenedFanout({ launch, subscribers })
  return { ...result, recipients: subscribers.length }
}

async function handleReminder5d(supa, row) {
  const { launch, subscribers } = await loadLaunchAndSubscribers(supa, row.launch_id)
  if (!launch) return { skipped: 'launch missing' }
  if (!['published', 'live'].includes(launch.status)) return { skipped: `status=${launch.status}` }
  // Don't bother if the drop has already closed.
  if (launch.closes_at && new Date(launch.closes_at) < new Date()) return { skipped: 'already closed' }
  const result = await sendDropStillOpenFanout({
    launch,
    subscribers,
    closesAtLabel: asLabel(launch.closes_at),
  })
  return { ...result, recipients: subscribers.length }
}

async function handleClosingSoon(supa, row) {
  const { launch, subscribers } = await loadLaunchAndSubscribers(supa, row.launch_id)
  if (!launch) return { skipped: 'launch missing' }
  if (!['published', 'live'].includes(launch.status)) return { skipped: `status=${launch.status}` }
  if (launch.closes_at && new Date(launch.closes_at) < new Date()) return { skipped: 'already closed' }
  const result = await sendDropClosingSoonFanout({
    launch,
    subscribers,
    closesAtLabel: asLabel(launch.closes_at),
  })
  return { ...result, recipients: subscribers.length }
}

async function handleCloseSummary(supa, row) {
  const { data: launch } = await supa.from('launches').select('*').eq('id', row.launch_id).maybeSingle()
  if (!launch) return { skipped: 'launch missing' }
  // Resolve vendor email — prefer profiles.email by creator_id.
  let vendorEmail = null
  if (launch.creator_id) {
    const { data: profile } = await supa.from('profiles').select('email').eq('id', launch.creator_id).maybeSingle()
    vendorEmail = profile?.email || null
  }
  if (!vendorEmail) return { skipped: 'no vendor email' }
  // Totals from drop_orders.
  const { data: orders } = await supa
    .from('drop_orders')
    .select('id, status, total_cents')
    .eq('launch_id', launch.id)
  const totals = (orders || []).reduce((acc, o) => {
    acc.total_orders += 1
    if (['paid', 'fulfilled', 'payment_received'].includes(o.status)) acc.paid_orders += 1
    acc.total_cents += Number(o.total_cents || 0)
    return acc
  }, { total_orders: 0, paid_orders: 0, total_cents: 0 })
  const result = await sendDropCloseSummary({ launch, vendorEmail, totals })
  return { ...result, recipients: 1 }
}

async function runCron(request) {
  if (!authorise(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === '1'
  const kindsParam = url.searchParams.get('kinds')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500)
  const kindsFilter = kindsParam ? kindsParam.split(',').map(s => s.trim()).filter(Boolean) : null

  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  // Scan due rows.
  let q = supa
    .from('email_schedules')
    .select('id, launch_id, kind, scheduled_for')
    .is('sent_at', null)
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(limit)
  if (kindsFilter) q = q.in('kind', kindsFilter)

  const { data: due, error } = await q
  if (error) {
    if (/could not find the table|relation .* does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json({
        ok: true,
        migration_pending: true,
        hint: 'Run supabase/migrations/2026-06-drop-lifecycle.sql',
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const items = []
  const failed = []
  for (const row of due || []) {
    if (dryRun) {
      items.push({ id: row.id, launch_id: row.launch_id, kind: row.kind, dryRun: true })
      continue
    }
    const handler = KIND_HANDLERS[row.kind]
    if (!handler) {
      failed.push({ id: row.id, kind: row.kind, error: 'unknown kind' })
      continue
    }
    try {
      const result = await handler(supa, row)
      // Stamp sent_at regardless of skipped/sent — we don't want to keep
      // retrying a launch whose status moved out from under us. The recipients
      // count is logged so an operator can see what happened.
      await supa
        .from('email_schedules')
        .update({ sent_at: new Date().toISOString(), recipients: result.recipients ?? result.sent ?? 0 })
        .eq('id', row.id)
      items.push({ id: row.id, launch_id: row.launch_id, kind: row.kind, ...result })
    } catch (e) {
      console.error('[drop-lifecycle] handler crashed:', row.kind, e?.message || e)
      await supa
        .from('email_schedules')
        .update({ error: String(e?.message || e).slice(0, 1000) })
        .eq('id', row.id)
      failed.push({ id: row.id, kind: row.kind, error: e?.message || String(e) })
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    scanned: due?.length || 0,
    processed: items.length,
    items,
    failed,
  })
}

export async function GET(request) { return runCron(request) }
export async function POST(request) { return runCron(request) }
