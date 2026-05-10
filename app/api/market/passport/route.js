import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase/server'

async function requireUser() {
  const sb = getSupabaseServer()
  if (!sb) return { error: 'supabase not configured', status: 500 }
  const { data, error } = await sb.auth.getUser()
  if (error || !data?.user) return { error: 'unauthorized', status: 401 }
  return { user: data.user }
}

// GET /api/market/passport — list of stamps for the signed-in shopper
export async function GET() {
  try {
    const { user, error, status } = await requireUser()
    if (error) return NextResponse.json({ error }, { status })
    const supa = getSupabaseAdmin()
    const { data, error: qErr } = await supa
      .from('passport_stamps')
      .select('id, vendor_id, market_date_id, stamped_at, vendors:vendor_id(id, name, slug, categories, booth_number)')
      .eq('shopper_id', user.id)
      .order('stamped_at', { ascending: false })
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
    return NextResponse.json({ stamps: data || [] })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 })
  }
}

// POST /api/market/passport  body: { vendor_slug }
export async function POST(request) {
  try {
    const { user, error, status } = await requireUser()
    if (error) return NextResponse.json({ error }, { status })
    const body = await request.json().catch(() => ({}))
    const slug = body?.vendor_slug
    if (!slug) return NextResponse.json({ error: 'missing vendor_slug' }, { status: 400 })

    const supa = getSupabaseAdmin()

    // Resolve vendor (active only)
    const { data: vendor, error: vErr } = await supa
      .from('vendors').select('id, name, slug, market_config_id').eq('slug', slug).eq('is_active', true).maybeSingle()
    if (vErr || !vendor) return NextResponse.json({ error: 'vendor not found' }, { status: 404 })

    // Find today's market date if any
    const today = new Date().toISOString().slice(0, 10)
    const { data: md } = await supa.from('market_dates')
      .select('id, date, is_cancelled')
      .eq('market_config_id', vendor.market_config_id)
      .eq('date', today)
      .maybeSingle()
    const marketDateId = md && !md.is_cancelled ? md.id : null

    // Insert stamp — unique constraint guards against duplicate same-day stamps
    const { data: stamp, error: sErr } = await supa
      .from('passport_stamps')
      .insert({ shopper_id: user.id, vendor_id: vendor.id, market_date_id: marketDateId })
      .select('*').single()

    if (sErr) {
      // Duplicate → 23505 unique violation → treat as success-already-stamped
      if (String(sErr.code) === '23505' || /duplicate/i.test(sErr.message || '')) {
        return NextResponse.json({ ok: true, alreadyStamped: true, vendor })
      }
      return NextResponse.json({ error: sErr.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, stamp, vendor })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 500 })
  }
}
