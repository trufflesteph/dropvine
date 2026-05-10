import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const ALLOWED = ['date','start_time','end_time','weather_forecast','is_cancelled','notes']
function pick(b) {
  const out = {}
  for (const k of ALLOWED) if (b[k] !== undefined) out[k] = b[k]
  return out
}

export async function PATCH(request, { params }) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const body = await request.json().catch(() => ({}))
  const updates = pick(body)
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  const supa = getSupabaseAdmin()
  const { data, error } = await supa.from('market_dates').update(updates).eq('id', params.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ date: data })
}
