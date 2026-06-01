// GET /api/cron/send-drop-notifications
//
// Vercel cron — runs every 10 minutes. Picks up every published drop whose
// scheduled `notify_at` has elapsed but whose `notified_at` is still null, and
// fans out the fan-out (email + tier-gated SMS) to its waitlist.
//
// Auth: same pattern as the other crons — Authorization: Bearer <CRON_SECRET>.
// In Vercel-cron environments the platform sets the header automatically.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { fanoutDropNotifications } from '@/lib/notifications/drop-fanout'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorised(request) {
  const expected = process.env.CRON_SECRET
  if (!expected) return true // Allow when no secret is configured (dev / preview)
  const hdr = request.headers.get('authorization') || ''
  const m = hdr.match(/^Bearer\s+(.+)$/i)
  if (!m) return false
  return m[1] === expected
}

async function run({ dryRun = false } = {}) {
  const supa = getSupabaseAdmin()
  if (!supa) return { ok: false, error: 'supabase admin not configured' }
  const nowIso = new Date().toISOString()

  // Pull every due drop. We tolerate the migration not yet being applied —
  // if the columns don’t exist the query errors and we degrade to no-op.
  const { data: due, error } = await supa
    .from('drops')
    .select('id, handle, title, creator_id, launch_at, notify_at, notified_at, status')
    .eq('status', 'published')
    .lte('notify_at', nowIso)
    .is('notified_at', null)
    .order('notify_at', { ascending: true })
    .limit(50)

  if (error) {
    return {
      ok: false,
      error: error.message,
      hint: /column .* does not exist|schema cache/i.test(error.message)
        ? 'Run supabase/migrations/2026-06-drops-notify-schedule.sql'
        : undefined,
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
  const processed = []
  const failed = []

  for (const drop of due || []) {
    if (dryRun) {
      processed.push({ id: drop.id, handle: drop.handle, dryRun: true })
      continue
    }
    try {
      const r = await fanoutDropNotifications({ supa, drop, baseUrl })
      if (r.ok) {
        processed.push({
          id: drop.id,
          handle: drop.handle,
          plan_tier: r.plan_tier,
          sms_allowed: r.sms_allowed,
          sent: r.sent,
          total: r.total,
          skipped: r.skipped,
        })
      } else {
        failed.push({ id: drop.id, handle: drop.handle, error: r.error })
      }
    } catch (e) {
      failed.push({ id: drop.id, handle: drop.handle, error: e?.message || 'fanout threw' })
    }
  }

  return { ok: true, dryRun, processed: processed.length, failed, items: processed, scanned: (due || []).length }
}

export async function GET(request) {
  if (!isAuthorised(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'
  const result = await run({ dryRun })
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

// Manual trigger (admins): POST with the same Bearer secret OR through an
// authenticated admin proxy. Useful when an organiser wants to flush queued
// drops without waiting for the 10-minute tick.
export async function POST(request) {
  if (!isAuthorised(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const result = await run({ dryRun: !!body.dryRun })
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
