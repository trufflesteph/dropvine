// /api/cron/drop-lifecycle
//
// Phase A vendor lifecycle cron. Runs every 10 minutes (vercel.json).
// Scans email_schedules for any rows where `sent_at IS NULL` and
// `scheduled_for <= now()`, fires the matching email batch, then stamps
// `sent_at`. Idempotent via UNIQUE (drop_id, kind) + sent_at NULL guard.
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
import { sendGeneric as sendSms, smsEnabled } from '@/lib/notifications/channels/sms'

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
  const [{ data: drop }, { data: subscribers }] = await Promise.all([
    supa.from('drops').select('*').eq('id', launchId).maybeSingle(),
    supa.from('drop_subscribers').select('email, name, phone').eq('drop_id', launchId),
  ])
  return { drop, subscribers: subscribers || [] }
}

async function handleOpen(supa, row) {
  const { drop, subscribers } = await loadLaunchAndSubscribers(supa, row.drop_id)
  if (!drop) return { skipped: 'drop missing' }
  // Don't fan-out for drafts/archived drops.
  if (!['published', 'live'].includes(drop.status)) return { skipped: `status=${drop.status}` }
  const result = await sendDropOpenedFanout({ drop, subscribers })
  // Phase D: SMS broadcast to followers, Shop-tier vendors only.
  const smsResult = await maybeBroadcastSmsOnOpen(supa, drop)
  return { ...result, recipients: subscribers.length, sms: smsResult }
}

// Phase D — SMS broadcast on drop open for Shop-tier vendors.
// Looks up the direct_vendors row by drop.creator_id, then if tier='shop'
// fetches every direct_vendor_follows row with sms_opt_in=true AND a phone,
// and sends a short Twilio SMS via lib/notifications/channels/sms.
// Tolerates missing table / SMS not configured by returning { skipped }.
async function maybeBroadcastSmsOnOpen(supa, drop) {
  if (!smsEnabled()) return { skipped: 'sms not configured' }
  if (!drop?.creator_id) return { skipped: 'no creator_id' }
  try {
    // Resolve vendor (need tier + business_name + slug).
    const { data: vendor } = await supa
      .from('direct_vendors')
      .select('id, slug, business_name, tier, active')
      .eq('creator_id', drop.creator_id)
      .maybeSingle()
    if (!vendor) return { skipped: 'no direct_vendor row' }
    if (vendor.tier !== 'shop') return { skipped: `tier=${vendor.tier} (shop only)` }
    if (vendor.active === false) return { skipped: 'vendor inactive' }

    // Find followers with SMS opt-in and a phone on file.
    const { data: followers, error: fErr } = await supa
      .from('direct_vendor_follows')
      .select('follower_phone, follower_name')
      .eq('vendor_id', vendor.id)
      .eq('sms_opt_in', true)
      .not('follower_phone', 'is', null)
    if (fErr) {
      if (/relation .* does not exist|could not find the table|schema cache/i.test(fErr.message)) {
        return { skipped: 'direct_vendor_follows table not provisioned' }
      }
      return { error: fErr.message }
    }
    if (!followers?.length) return { sent: 0, total: 0 }

    const base = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '')
    const url = base ? `${base}/l/${drop.handle}` : `/l/${drop.handle}`
    const body = `${vendor.business_name} just opened a drop: ${drop.title}. ${url}`

    let sent = 0
    for (const f of followers) {
      const res = await sendSms({ to: f.follower_phone, body })
      if (res?.sid) sent += 1
    }
    return { sent, total: followers.length, vendor: vendor.slug }
  } catch (e) {
    console.warn('[drop-lifecycle] sms broadcast failed (non-fatal):', e?.message || e)
    return { error: e?.message || String(e) }
  }
}

async function handleReminder5d(supa, row) {
  const { drop, subscribers } = await loadLaunchAndSubscribers(supa, row.drop_id)
  if (!drop) return { skipped: 'drop missing' }
  if (!['published', 'live'].includes(drop.status)) return { skipped: `status=${drop.status}` }
  // Don't bother if the drop has already closed.
  if (drop.closes_at && new Date(drop.closes_at) < new Date()) return { skipped: 'already closed' }
  const result = await sendDropStillOpenFanout({
    drop,
    subscribers,
    closesAtLabel: asLabel(drop.closes_at),
  })
  return { ...result, recipients: subscribers.length }
}

async function handleClosingSoon(supa, row) {
  const { drop, subscribers } = await loadLaunchAndSubscribers(supa, row.drop_id)
  if (!drop) return { skipped: 'drop missing' }
  if (!['published', 'live'].includes(drop.status)) return { skipped: `status=${drop.status}` }
  if (drop.closes_at && new Date(drop.closes_at) < new Date()) return { skipped: 'already closed' }
  const result = await sendDropClosingSoonFanout({
    drop,
    subscribers,
    closesAtLabel: asLabel(drop.closes_at),
  })
  return { ...result, recipients: subscribers.length }
}

async function handleCloseSummary(supa, row) {
  const { data: drop } = await supa.from('drops').select('*').eq('id', row.drop_id).maybeSingle()
  if (!drop) return { skipped: 'drop missing' }
  // Resolve vendor email — prefer profiles.email by creator_id.
  let vendorEmail = null
  if (drop.creator_id) {
    const { data: profile } = await supa.from('profiles').select('email').eq('id', drop.creator_id).maybeSingle()
    vendorEmail = profile?.email || null
  }
  if (!vendorEmail) return { skipped: 'no vendor email' }
  // Totals from drop_orders.
  const { data: orders } = await supa
    .from('drop_orders')
    .select('id, status, total_cents')
    .eq('drop_id', drop.id)
  const totals = (orders || []).reduce((acc, o) => {
    acc.total_orders += 1
    if (['paid', 'fulfilled', 'payment_received'].includes(o.status)) acc.paid_orders += 1
    acc.total_cents += Number(o.total_cents || 0)
    return acc
  }, { total_orders: 0, paid_orders: 0, total_cents: 0 })
  const result = await sendDropCloseSummary({ drop, vendorEmail, totals })
  return { ...result, recipients: 1 }
}

async function runCron(request) {
  if (!authorise(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // TEMPORARY — confirms which Twilio env vars are present in this
  // deployment. Logs booleans only, never values. Remove after confirming.
  // AUTH_TOKEN is the var actually used by lib/notifications/channels/sms.js
  // (getTwilioClient() + smsEnabled()) — ACCOUNT_SID + AUTH_TOKEN + FROM_NUMBER
  // is what really determines whether SMS sends. API_KEY/API_SECRET are
  // checked here too only because they were the original suspects.
  console.log('[twilio-check] SID present:', !!process.env.TWILIO_ACCOUNT_SID, 'KEY present:', !!process.env.TWILIO_API_KEY, 'SECRET present:', !!process.env.TWILIO_API_SECRET, 'AUTH_TOKEN present:', !!process.env.TWILIO_AUTH_TOKEN, 'FROM present:', !!process.env.TWILIO_FROM_NUMBER)

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === '1'
  const kindsParam = url.searchParams.get('kinds')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500)
  const kindsFilter = kindsParam ? kindsParam.split(',').map(s => s.trim()).filter(Boolean) : null

  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  // === Step 0: auto-publish any scheduled drops whose launch_at has arrived.
  // `scheduled` is set by /api/launches/publish/[token] when the vendor picks
  // "Schedule" instead of immediate publish. Cron flips them to `published`
  // and the next pass (below) picks up their `open` email_schedules row.
  // Tolerates the schema being out of date by swallowing column-missing errors.
  let autoPublished = 0
  try {
    const { data: ready } = await supa
      .from('drops')
      .select('id, handle')
      .eq('status', 'scheduled')
      .lte('launch_at', new Date().toISOString())
      .limit(50)
    if (dryRun) {
      autoPublished = (ready || []).length
    } else {
      for (const l of ready || []) {
        const { error: uErr } = await supa
          .from('drops')
          .update({ status: 'published' })
          .eq('id', l.id)
          .eq('status', 'scheduled') // guard against races
        if (!uErr) autoPublished += 1
      }
    }
  } catch (e) {
    console.warn('[drop-lifecycle] auto-publish step failed (non-fatal):', e?.message || e)
  }

  // === Step 0b (Phase C): auto-archive published FREE-tier drops 5 days
  // after closes_at. Drops on maker/shop tiers stay public indefinitely.
  // The /api/drops/by-handle/[handle] endpoint returns 404 once status flips
  // to 'archived' (vendors can still see archived drops via preview).
  //
  // Implementation note: we can't filter directly on profiles.plan_tier in
  // a single Supabase query without a foreign-table join syntax, so we
  // fetch candidate drops (closes_at < now-5d, status=published) and then
  // batch-look-up their creator plan tiers.
  let autoArchived = 0
  const ARCHIVE_DELAY_MS = 5 * 24 * 60 * 60 * 1000 // 5 days
  try {
    const cutoff = new Date(Date.now() - ARCHIVE_DELAY_MS).toISOString()
    const { data: candidates } = await supa
      .from('drops')
      .select('id, creator_id, closes_at')
      .eq('status', 'published')
      .not('closes_at', 'is', null)
      .lt('closes_at', cutoff)
      .limit(100)
    if (candidates && candidates.length) {
      const creatorIds = [...new Set(candidates.map((d) => d.creator_id).filter(Boolean))]
      const tierByCreator = {}
      if (creatorIds.length) {
        const { data: profs } = await supa
          .from('profiles')
          .select('id, plan_tier')
          .in('id', creatorIds)
        for (const p of profs || []) tierByCreator[p.id] = p.plan_tier || 'free'
      }
      for (const d of candidates) {
        const tier = tierByCreator[d.creator_id] || 'free'
        if (tier !== 'free') continue
        if (dryRun) { autoArchived += 1; continue }
        const { error: aErr } = await supa
          .from('drops')
          .update({ status: 'archived' })
          .eq('id', d.id)
          .eq('status', 'published') // guard race
        if (!aErr) autoArchived += 1
      }
    }
  } catch (e) {
    console.warn('[drop-lifecycle] auto-archive step failed (non-fatal):', e?.message || e)
  }

  // === Step 1: scan due rows.
  // `hold = true` rows belong to drafts that haven't been published yet —
  // skip them entirely. Use .or() to also keep older rows where the column
  // doesn't exist or was inserted before the hold migration ran.
  let q = supa
    .from('email_schedules')
    .select('id, drop_id, kind, scheduled_for, hold')
    .is('sent_at', null)
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(limit)
  // hold filter — if the column is missing the supabase client just returns
  // a normal error which we catch below and retry without the filter.
  q = q.not('hold', 'is', true)
  if (kindsFilter) q = q.in('kind', kindsFilter)

  let { data: due, error } = await q
  if (error && /could not find the .*column.*hold|hold.*does not exist/i.test(error.message)) {
    // Old DB without the publish-tokens-and-holds migration applied — drop
    // the hold filter and try again.
    let q2 = supa
      .from('email_schedules')
      .select('id, drop_id, kind, scheduled_for')
      .is('sent_at', null)
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(limit)
    if (kindsFilter) q2 = q2.in('kind', kindsFilter)
    const retry = await q2
    due = retry.data; error = retry.error
  }
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
      items.push({ id: row.id, drop_id: row.drop_id, kind: row.kind, dryRun: true })
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
      // retrying a drop whose status moved out from under us. The recipients
      // count is logged so an operator can see what happened.
      await supa
        .from('email_schedules')
        .update({ sent_at: new Date().toISOString(), recipients: result.recipients ?? result.sent ?? 0 })
        .eq('id', row.id)
      items.push({ id: row.id, drop_id: row.drop_id, kind: row.kind, ...result })
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
    auto_published: autoPublished,
    auto_archived: autoArchived,
    items,
    failed,
  })
}

export async function GET(request) { return runCron(request) }
export async function POST(request) { return runCron(request) }
