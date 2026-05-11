import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase/server'

async function requireUser() {
  const sb = getSupabaseServer()
  if (!sb) return { error: 'supabase not configured', status: 500 }
  const { data, error } = await sb.auth.getUser()
  if (error || !data?.user) return { error: 'unauthorized', status: 401 }
  return { user: data.user }
}

// POST /api/market/pop/stamps body: { child_id, stamp_type_id }
// Records a stamp for the child AND credits the matching POP tokens.
export async function POST(request) {
  const { user, error, status } = await requireUser()
  if (error) return NextResponse.json({ error }, { status })
  const { child_id, stamp_type_id } = await request.json().catch(() => ({}))
  if (!child_id || !stamp_type_id) return NextResponse.json({ error: 'child_id and stamp_type_id required' }, { status: 400 })

  const supa = getSupabaseAdmin()

  // Verify ownership of child
  const { data: child, error: cErr } = await supa
    .from('child_profiles').select('*').eq('id', child_id).maybeSingle()
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
  if (!child) return NextResponse.json({ error: 'child not found' }, { status: 404 })
  if (child.parent_shopper_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Resolve stamp type (must belong to active market)
  const { data: market } = await supa.from('market_config').select('id, name').eq('is_active', true).maybeSingle()
  if (!market) return NextResponse.json({ error: 'no active market' }, { status: 400 })
  const { data: stampType, error: stErr } = await supa
    .from('pop_stamp_types').select('*')
    .eq('id', stamp_type_id).eq('market_config_id', market.id).eq('is_active', true).maybeSingle()
  if (stErr) return NextResponse.json({ error: stErr.message }, { status: 500 })
  if (!stampType) return NextResponse.json({ error: 'stamp type not found' }, { status: 404 })

  // Today's market date if any
  const today = new Date().toISOString().slice(0, 10)
  const { data: md } = await supa.from('market_dates')
    .select('id, is_cancelled').eq('market_config_id', market.id).eq('date', today).maybeSingle()
  const marketDateId = md && !md.is_cancelled ? md.id : null

  // Insert stamp
  const { data: stamp, error: ssErr } = await supa.from('pop_stamps_earned').insert({
    child_profile_id: child.id,
    pop_stamp_type_id: stampType.id,
    market_date_id: marketDateId,
  }).select('*').single()
  if (ssErr) return NextResponse.json({ error: ssErr.message }, { status: 500 })

  // Credit tokens
  let tokenRow = null
  const reward = stampType.token_reward || 0
  if (reward > 0) {
    const { data, error: tErr } = await supa.from('pop_tokens').insert({
      child_profile_id: child.id,
      amount: reward,
      source: 'reward',
      market_date_id: marketDateId,
      notes: `${stampType.name}`,
    }).select('*').single()
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
    tokenRow = data

    // Maintain denormalised total for fast reads
    await supa.rpc ? null : null // (no rpc; do plain update)
    await supa.from('child_profiles')
      .update({ total_pop_tokens: (child.total_pop_tokens || 0) + reward })
      .eq('id', child.id)
  }

  return NextResponse.json({ ok: true, stamp, token: tokenRow, reward, stamp_type: stampType })
}
