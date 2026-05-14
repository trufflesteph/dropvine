// PATCH /api/market/admin/drops/[id]/publish — promote a draft launch to 'published'.
//
// Body (optional):
//   { launch_at?: string,   // when the public page goes live
//     notify_at?: string|null }  // when to send the fan-out
//                                //   omitted/null  → send immediately
//                                //   ISO timestamp → cron will pick it up later
//
// Auth (either is enough):
//   1. Markets admin token (Authorization: Bearer <token> or X-Admin-Token)
//      — used by /admin/drops/[id]/preview page
//   2. Supabase user where user.id == launch.creator_id
//      — used by /dashboard "Publish" button on draft rows
//
// On publish, after status becomes 'published':
//   • notify_at is null OR ≤ now()  → run fanoutDropNotifications + stamp notified_at
//   • notify_at is in the future    → store notify_at, leave notified_at null
//     The /api/cron/send-drop-notifications cron will fan-out at that time.

import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { fanoutDropNotifications } from '@/lib/notifications/drop-fanout'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function creatorIdFromRequest(request) {
  return request.headers.get('x-user-id') || null
}

async function authorize(request, launch) {
  const a = requireAdminRole(request)
  if (a.ok) return { ok: true, via: `admin:${a.role}` }

  const userId = creatorIdFromRequest(request)
  if (userId && launch?.creator_id && userId === launch.creator_id) {
    return { ok: true, via: 'creator' }
  }
  return { ok: false, status: 401, error: 'unauthorized' }
}

function parseDate(v) {
  if (v == null || v === '') return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return undefined  // bad input
  return d
}

export async function PATCH(request, { params }) {
  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const { data: launch, error: gErr } = await supa
    .from('launches').select('*').eq('id', params.id).maybeSingle()
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
  if (!launch) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const auth = await authorize(request, launch)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (launch.status === 'published') {
    return NextResponse.json({ ok: true, launch, already: true })
  }
  if (launch.status !== 'draft') {
    return NextResponse.json({ error: `cannot publish from status '${launch.status}'` }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const now = new Date()
  const updates = { status: 'published' }

  if (body?.launch_at) {
    const d = parseDate(body.launch_at)
    if (d === undefined) return NextResponse.json({ error: 'invalid launch_at' }, { status: 400 })
    if (d) updates.launch_at = d.toISOString()
  } else if (launch.launch_at && new Date(launch.launch_at) < now) {
    updates.launch_at = now.toISOString()
  }

  // notify_at: only set the column if the caller explicitly sent the key. Null
  // is a valid value meaning "fan out now". `undefined` means "leave whatever
  // value is currently stored". Bad parse → 400.
  let notifyAtForFanout = launch.notify_at ? new Date(launch.notify_at) : null
  if ('notify_at' in (body || {})) {
    const d = parseDate(body.notify_at)
    if (d === undefined) return NextResponse.json({ error: 'invalid notify_at' }, { status: 400 })
    updates.notify_at = d ? d.toISOString() : null
    notifyAtForFanout = d || null
  }

  // First write — degrade gracefully if migration not yet applied.
  let updated
  {
    const { data, error: uErr } = await supa
      .from('launches').update(updates).eq('id', params.id).select('*').single()
    if (uErr) {
      // If notify_at column doesn't exist yet, retry without it so publish still works.
      if (/notify_at/.test(uErr.message) && /does not exist|schema cache|could not find/i.test(uErr.message)) {
        const minimal = { ...updates }
        delete minimal.notify_at
        const retry = await supa.from('launches').update(minimal).eq('id', params.id).select('*').single()
        if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 })
        updated = retry.data
        console.warn('[publish] notify_at column missing — run supabase/migrations/2026-06-launches-notify-schedule.sql')
      } else {
        return NextResponse.json({ error: uErr.message }, { status: 500 })
      }
    } else {
      updated = data
    }
  }

  // Fan-out decision.
  const dueNow = !notifyAtForFanout || notifyAtForFanout <= now
  let fanout = null
  if (dueNow) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin
    try {
      fanout = await fanoutDropNotifications({ supa, launch: updated, baseUrl })
    } catch (e) {
      fanout = { ok: false, error: e?.message || 'fanout threw' }
    }
    // Re-read to surface the stamped notified_at to the client.
    const { data: refreshed } = await supa.from('launches').select('*').eq('id', params.id).maybeSingle()
    if (refreshed) updated = refreshed
  }

  return NextResponse.json({
    ok: true,
    launch: updated,
    via: auth.via,
    fanout,
    scheduled: !dueNow && !!notifyAtForFanout,
    scheduled_for: !dueNow && notifyAtForFanout ? notifyAtForFanout.toISOString() : null,
  })
}
