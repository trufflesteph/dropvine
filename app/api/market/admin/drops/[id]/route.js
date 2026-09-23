// GET + DELETE for a single draft drop, used by /admin/drops/[id]/preview.
//
// Auth: Markets admin role (sessionStorage HMAC) — same as the rest of the
// /api/market/admin/* surface. The publish endpoint is split into a separate
// file because it also accepts a Supabase-creator-user session (so the
// dashboard "Publish" button works without bothering with admin auth).

import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })

  const supa = getSupabaseAdmin()
  const { data: drop, error } = await supa
    .from('drops').select('*').eq('id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!drop) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Resolve creator profile so the admin can see who submitted
  let creator = null
  if (drop.creator_id) {
    const { data } = await supa.from('profiles')
      .select('id, email, display_name, full_name').eq('id', drop.creator_id).maybeSingle()
    creator = data || null
  }

  return NextResponse.json({ drop, creator })
}

export async function PATCH(request, { params }) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })

  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const { data: existing, error: loadError } = await supa
    .from('drops').select('id, status').eq('id', params.id).maybeSingle()
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'only preview drops can be edited here' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) || null : null
  const closesAt = body.closes_at == null || body.closes_at === '' ? null : new Date(body.closes_at)
  if (closesAt && Number.isNaN(closesAt.getTime())) {
    return NextResponse.json({ error: 'closes_at must be a valid date and time' }, { status: 400 })
  }

  const updates = {
    title: text(body.title, 200),
    tagline: text(body.tagline, 500),
    description: text(body.description, 10000),
    closes_at: closesAt ? closesAt.toISOString() : null,
    pickup_details: text(body.pickup_details, 5000),
    venmo_handle: (text(body.venmo_handle, 100) || '').replace(/^@/, '') || null,
  }
  if (!updates.title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const { data: drop, error } = await supa
    .from('drops').update(updates).eq('id', params.id).eq('status', 'draft').select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!drop) return NextResponse.json({ error: 'drop is no longer in preview' }, { status: 409 })
  return NextResponse.json({ ok: true, drop })
}

export async function DELETE(request, { params }) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })

  const supa = getSupabaseAdmin()
  // Safety: only allow hard-delete of DRAFTS. Published rows must use the
  // existing soft-archive flow (out of scope here).
  const { data: existing } = await supa.from('drops').select('id, status').eq('id', params.id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'only draft drops can be deleted here' }, { status: 400 })
  }

  const { error } = await supa.from('drops').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
