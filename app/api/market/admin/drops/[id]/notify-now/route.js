// POST /api/market/admin/drops/[id]/notify-now
//
// Force-send the fan-out for a published drop right now, regardless of
// notify_at. Clears notify_at and stamps notified_at on success.
//
// Auth: admin token (platform/organiser) OR the drop’s creator.

import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { fanoutDropNotifications } from '@/lib/notifications/drop-fanout'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function creatorIdFromRequest(request) {
  return request.headers.get('x-user-id') || null
}

async function authorize(request, drop) {
  const a = requireAdminRole(request)
  if (a.ok) return { ok: true, via: `admin:${a.role}` }
  const uid = creatorIdFromRequest(request)
  if (uid && drop?.creator_id && uid === drop.creator_id) return { ok: true, via: 'creator' }
  return { ok: false, status: 401, error: 'unauthorized' }
}

export async function POST(request, { params }) {
  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const { data: drop, error: gErr } = await supa
    .from('drops').select('*').eq('id', params.id).maybeSingle()
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
  if (!drop) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const auth = await authorize(request, drop)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (drop.status !== 'published') {
    return NextResponse.json({ error: 'drop is not published yet' }, { status: 400 })
  }

  // Clear notify_at so the scheduled cron doesn’t race us.
  try {
    await supa.from('drops').update({ notify_at: null }).eq('id', drop.id)
  } catch { /* tolerated when column missing — fanout will still run */ }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin
  const result = await fanoutDropNotifications({
    supa, drop, baseUrl,
    force: !drop.notified_at,  // re-run if user explicitly clicked while already sent? no — keep idempotent
  })
  return NextResponse.json({ ok: true, via: auth.via, ...result })
}
