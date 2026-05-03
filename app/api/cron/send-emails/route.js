import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { sendLaunchReminder, sendLaunchLiveNotification } from '@/lib/email/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/cron/send-emails
// Auth: Authorization: Bearer <DROPVINE_CRON_SECRET>
// Body: { kinds?: ['reminders','live'], windowMinutes?: number, dryRun?: boolean }
//
// Designed to be invoked every ~5 min by Supabase pg_cron, Vercel cron, or
// any external scheduler. Idempotent via per-launch flags table (reminded_at /
// live_sent_at). Until that flag table exists, we re-send within the window so
// callers should run with windowMinutes = N where N matches their cron cadence.
export async function POST(request) {
  const expected = process.env.DROPVINE_CRON_SECRET
  const auth = request.headers.get('authorization') || ''
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const kinds = body.kinds || ['reminders', 'live']
  const windowMinutes = Number(body.windowMinutes ?? 30)
  const dryRun = !!body.dryRun
  const baseUrl = new URL(request.url).origin

  const sb = getSupabaseAdmin()
  if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const now = Date.now()
  const summary = { reminders: { launches: 0, sent: 0 }, live: { launches: 0, sent: 0 } }

  // ----- 1. Reminders: launches opening in (24h - window/2) … (24h + window/2)
  if (kinds.includes('reminders')) {
    const reminderHoursAhead = 24
    const center = now + reminderHoursAhead * 3600 * 1000
    const lo = new Date(center - (windowMinutes / 2) * 60 * 1000).toISOString()
    const hi = new Date(center + (windowMinutes / 2) * 60 * 1000).toISOString()
    const { data: launches } = await sb
      .from('launches')
      .select('*')
      .eq('status', 'published')
      .gte('launch_at', lo)
      .lte('launch_at', hi)
    for (const launch of launches || []) {
      const { data: recipients } = await sb
        .from('waitlist_entries')
        .select('email,name')
        .eq('launch_id', launch.id)
      summary.reminders.launches += 1
      if (dryRun) { summary.reminders.sent += (recipients || []).length; continue }
      const r = await sendLaunchReminder({ launch, recipients: recipients || [], hoursUntil: reminderHoursAhead, baseUrl })
      summary.reminders.sent += r.sent || 0
    }
  }

  // ----- 2. Live: launches whose launch_at fell within the last `windowMinutes`
  if (kinds.includes('live')) {
    const lo = new Date(now - windowMinutes * 60 * 1000).toISOString()
    const hi = new Date(now).toISOString()
    const { data: launches } = await sb
      .from('launches')
      .select('*')
      .eq('status', 'published')
      .gte('launch_at', lo)
      .lte('launch_at', hi)
    for (const launch of launches || []) {
      const { data: recipients } = await sb
        .from('waitlist_entries')
        .select('email,name')
        .eq('launch_id', launch.id)
      summary.live.launches += 1
      if (dryRun) { summary.live.sent += (recipients || []).length; continue }
      const r = await sendLaunchLiveNotification({ launch, recipients: recipients || [], baseUrl })
      summary.live.sent += r.sent || 0
    }
  }

  return NextResponse.json({ ok: true, dryRun, summary })
}
