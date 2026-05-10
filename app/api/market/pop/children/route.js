import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase/server'

async function requireUser() {
  const sb = getSupabaseServer()
  if (!sb) return { error: 'supabase not configured', status: 500 }
  const { data, error } = await sb.auth.getUser()
  if (error || !data?.user) return { error: 'unauthorized', status: 401 }
  return { user: data.user }
}

// GET /api/market/pop/children — list children for the signed-in shopper, with computed token balance
export async function GET() {
  const { user, error, status } = await requireUser()
  if (error) return NextResponse.json({ error }, { status })
  const supa = getSupabaseAdmin()
  const { data: children, error: cErr } = await supa
    .from('child_profiles').select('*').eq('parent_shopper_id', user.id).order('created_at', { ascending: true })
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
  return NextResponse.json({ children: children || [] })
}

// POST /api/market/pop/children body: { name, age?, avatar_url? }
export async function POST(request) {
  const { user, error, status } = await requireUser()
  if (error) return NextResponse.json({ error }, { status })
  const body = await request.json().catch(() => ({}))
  const name = String(body?.name || '').trim()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const age = body?.age == null ? null : Math.max(0, Math.min(18, parseInt(body.age, 10) || 0))
  const avatar_url = body?.avatar_url || null
  const supa = getSupabaseAdmin()
  const { data, error: iErr } = await supa.from('child_profiles')
    .insert({ parent_shopper_id: user.id, name, age, avatar_url })
    .select('*').single()
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })
  return NextResponse.json({ child: data })
}
