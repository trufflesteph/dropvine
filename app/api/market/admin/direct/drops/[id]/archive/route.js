import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/market/admin/direct/drops/[id]/archive  body: {}
// Sets status='archived'. Only valid from status='published'.
export async function PATCH(request, { params }) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })

  const supa = getSupabaseAdmin()
  const { data: launch, error: gErr } = await supa.from('launches')
    .select('id, status').eq('id', params.id).maybeSingle()
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
  if (!launch) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (launch.status === 'archived') {
    return NextResponse.json({ ok: true, launch, already: true })
  }
  if (launch.status !== 'published') {
    return NextResponse.json({ error: `cannot archive from status '${launch.status}' — only published launches can be archived` }, { status: 400 })
  }

  const { data, error } = await supa.from('launches')
    .update({ status: 'archived' }).eq('id', params.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, launch: data })
}
