import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase/server'

async function requireUser() {
  const sb = getSupabaseServer()
  if (!sb) return { error: 'supabase not configured', status: 500 }
  const { data, error } = await sb.auth.getUser()
  if (error || !data?.user) return { error: 'unauthorized', status: 401 }
  return { user: data.user }
}

// POST /api/market/pop/redemptions body: { child_id, vendor_id, amount }
// Spends POP tokens at a vendor. Validates balance server-side.
export async function POST(request) {
  const { user, error, status } = await requireUser()
  if (error) return NextResponse.json({ error }, { status })
  const body = await request.json().catch(() => ({}))
  const { child_id, vendor_id } = body
  const amount = parseInt(body?.amount, 10)
  if (!child_id || !vendor_id) return NextResponse.json({ error: 'child_id and vendor_id required' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'amount must be positive integer' }, { status: 400 })

  const supa = getSupabaseAdmin()

  // Verify child ownership
  const { data: child } = await supa.from('child_profiles').select('*').eq('id', child_id).maybeSingle()
  if (!child) return NextResponse.json({ error: 'child not found' }, { status: 404 })
  if (child.parent_shopper_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Vendor must be active
  const { data: vendor } = await supa.from('vendors').select('id, name, slug, market_config_id, is_active').eq('id', vendor_id).maybeSingle()
  if (!vendor || !vendor.is_active) return NextResponse.json({ error: 'vendor not found' }, { status: 404 })

  // Compute current balance (live)
  const [tokensRes, redemptionsRes] = await Promise.all([
    supa.from('pop_tokens').select('amount').eq('child_profile_id', child.id),
    supa.from('pop_redemptions').select('amount').eq('child_profile_id', child.id),
  ])
  const credits = (tokensRes.data || []).reduce((s, t) => s + t.amount, 0)
  const debits = (redemptionsRes.data || []).reduce((s, r) => s + r.amount, 0)
  const balance = credits - debits
  if (amount > balance) return NextResponse.json({ error: `insufficient balance — you have ${balance} POP tokens` }, { status: 400 })

  // Today's market date
  const today = new Date().toISOString().slice(0, 10)
  const { data: md } = await supa.from('market_dates')
    .select('id, is_cancelled').eq('market_config_id', vendor.market_config_id).eq('date', today).maybeSingle()
  const marketDateId = md && !md.is_cancelled ? md.id : null

  const { data: redemption, error: rErr } = await supa.from('pop_redemptions').insert({
    child_profile_id: child.id,
    vendor_id: vendor.id,
    amount,
    market_date_id: marketDateId,
  }).select('*').single()
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })

  // Maintain denormalised total
  await supa.from('child_profiles')
    .update({ total_pop_tokens: balance - amount })
    .eq('id', child.id)

  return NextResponse.json({ ok: true, redemption, vendor, new_balance: balance - amount })
}
