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
  const { data: launch, error } = await supa
    .from('launches').select('*').eq('id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!launch) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Resolve creator profile so the admin can see who submitted
  let creator = null
  if (launch.creator_id) {
    const { data } = await supa.from('profiles')
      .select('id, email, display_name, full_name').eq('id', launch.creator_id).maybeSingle()
    creator = data || null
  }

  return NextResponse.json({ launch, creator })
}

export async function DELETE(request, { params }) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })

  const supa = getSupabaseAdmin()
  // Safety: only allow hard-delete of DRAFTS. Published rows must use the
  // existing soft-archive flow (out of scope here).
  const { data: existing } = await supa.from('launches').select('id, status').eq('id', params.id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'only draft launches can be deleted here' }, { status: 400 })
  }

  const { error } = await supa.from('launches').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
