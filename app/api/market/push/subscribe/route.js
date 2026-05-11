import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase/server'

// POST /api/market/push/subscribe
// body: { subscription: { endpoint, keys: { p256dh, auth } }, userAgent }
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const sub = body?.subscription
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return NextResponse.json({ error: 'invalid subscription' }, { status: 400 })
    }
    const supa = getSupabaseAdmin()
    if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

    // Optional shopper auth — if signed in, attach to user
    let shopperId = null
    try {
      const sb = getSupabaseServer()
      const { data } = await sb?.auth?.getUser?.() || { data: null }
      shopperId = data?.user?.id || null
    } catch { /* anonymous */ }

    // Upsert by endpoint
    const { error } = await supa.from('push_subscriptions').upsert({
      shopper_id: shopperId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: body?.userAgent || null,
    }, { onConflict: 'endpoint' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 })
  }
}
