// PATCH /api/market/admin/drops/[id]/publish — promote a draft launch to 'published'.
//
// Auth (either is enough):
//   1. Markets admin token (Authorization: Bearer <token> or X-Admin-Token)
//      — used by /admin/drops/[id]/preview page
//   2. Supabase user where user.id == launch.creator_id
//      — used by /dashboard "Publish" button on draft rows
//
// Body (optional): { launch_at?: string }  // if omitted and the stored
//   launch_at is in the past, we set it to now() at publish time so the public
//   page goes live immediately.

import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Mirror of /dashboard/page.js  — it forwards user.id via the x-user-id header.
function creatorIdFromRequest(request) {
  return request.headers.get('x-user-id') || null
}

async function authorize(request, launch) {
  // (1) Markets admin token
  const a = requireAdminRole(request)
  if (a.ok) return { ok: true, via: `admin:${a.role}` }

  // (2) Supabase creator-user via x-user-id header (same pattern as other dashboard APIs)
  const userId = creatorIdFromRequest(request)
  if (userId && launch?.creator_id && userId === launch.creator_id) {
    return { ok: true, via: 'creator' }
  }

  return { ok: false, status: 401, error: 'unauthorized' }
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
    const d = new Date(body.launch_at)
    if (!isNaN(d.getTime())) updates.launch_at = d.toISOString()
  } else if (launch.launch_at && new Date(launch.launch_at) < now) {
    // Stored launch_at has already passed (typical for open_mode="now" drafts
    // that have been sitting in review). Set it to now() so the page goes live.
    updates.launch_at = now.toISOString()
  }

  const { data: updated, error: uErr } = await supa
    .from('launches').update(updates).eq('id', params.id).select('*').single()
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, launch: updated, via: auth.via })
}
