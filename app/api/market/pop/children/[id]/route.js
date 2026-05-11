import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase/server'

async function requireUserAndChild(supa, childId) {
  const sb = getSupabaseServer()
  if (!sb) return { error: 'supabase not configured', status: 500 }
  const { data, error } = await sb.auth.getUser()
  if (error || !data?.user) return { error: 'unauthorized', status: 401 }
  const { data: child, error: cErr } = await supa
    .from('child_profiles').select('*').eq('id', childId).maybeSingle()
  if (cErr) return { error: cErr.message, status: 500 }
  if (!child) return { error: 'not_found', status: 404 }
  if (child.parent_shopper_id !== data.user.id) return { error: 'forbidden', status: 403 }
  return { user: data.user, child }
}

// GET /api/market/pop/children/[id] — child detail with recent stamps, tokens, redemptions
export async function GET(_request, { params }) {
  const supa = getSupabaseAdmin()
  const { child, error, status } = await requireUserAndChild(supa, params?.id)
  if (error) return NextResponse.json({ error }, { status })

  const [stampsRes, tokensRes, redemptionsRes] = await Promise.all([
    supa.from('pop_stamps_earned')
      .select('id, earned_at, market_date_id, pop_stamp_types:pop_stamp_type_id(id, name, icon, token_reward)')
      .eq('child_profile_id', child.id).order('earned_at', { ascending: false }).limit(50),
    supa.from('pop_tokens')
      .select('id, amount, source, notes, created_at')
      .eq('child_profile_id', child.id).order('created_at', { ascending: false }).limit(50),
    supa.from('pop_redemptions')
      .select('id, amount, redeemed_at, vendors:vendor_id(id, name, slug)')
      .eq('child_profile_id', child.id).order('redeemed_at', { ascending: false }).limit(50),
  ])

  // Compute live balance — cheaper than trusting denormalised total
  const credits = (tokensRes.data || []).reduce((s, t) => s + t.amount, 0)
  const debits = (redemptionsRes.data || []).reduce((s, r) => s + r.amount, 0)
  const balance = credits - debits

  return NextResponse.json({
    child: { ...child, total_pop_tokens: balance },
    stamps: stampsRes.data || [],
    tokens: tokensRes.data || [],
    redemptions: redemptionsRes.data || [],
  })
}

// PATCH /api/market/pop/children/[id] body: { name?, age?, avatar_url? }
export async function PATCH(request, { params }) {
  const supa = getSupabaseAdmin()
  const { child, error, status } = await requireUserAndChild(supa, params?.id)
  if (error) return NextResponse.json({ error }, { status })
  const body = await request.json().catch(() => ({}))
  const updates = {}
  if (body?.name != null) updates.name = String(body.name).trim()
  if (body?.age != null) updates.age = Math.max(0, Math.min(18, parseInt(body.age, 10) || 0))
  if (body?.avatar_url !== undefined) updates.avatar_url = body.avatar_url || null
  if (Object.keys(updates).length === 0) return NextResponse.json({ child })
  const { data, error: uErr } = await supa.from('child_profiles').update(updates).eq('id', child.id).select('*').single()
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
  return NextResponse.json({ child: data })
}

// DELETE /api/market/pop/children/[id]
export async function DELETE(_request, { params }) {
  const supa = getSupabaseAdmin()
  const { child, error, status } = await requireUserAndChild(supa, params?.id)
  if (error) return NextResponse.json({ error }, { status })
  const { error: dErr } = await supa.from('child_profiles').delete().eq('id', child.id)
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
