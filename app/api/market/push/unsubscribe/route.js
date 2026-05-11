import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function POST(request) {
  try {
    const { endpoint } = await request.json().catch(() => ({}))
    if (!endpoint) return NextResponse.json({ error: 'missing endpoint' }, { status: 400 })
    const supa = getSupabaseAdmin()
    if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })
    const { error } = await supa.from('push_subscriptions').delete().eq('endpoint', endpoint)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 })
  }
}
