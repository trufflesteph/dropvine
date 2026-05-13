import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/market/admin/direct/site-config
// Returns all rows as a flat { key: value } map for convenience.
export async function GET(request) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  const supa = getSupabaseAdmin()
  const { data, error } = await supa.from('site_config').select('key, value')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const map = {}
  for (const row of data || []) map[row.key] = row.value
  return NextResponse.json({ config: map, raw: data || [] })
}

// PATCH /api/market/admin/direct/site-config
// Body: { updates: { key1: value1, key2: value2, ... } }
// Upserts each key into site_config. Platform-role-only.
export async function PATCH(request) {
  const a = requireAdminRole(request)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  if (a.role !== 'platform') {
    return NextResponse.json({ error: 'platform role required' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const updates = body?.updates || {}
  const entries = Object.entries(updates)
  if (!entries.length) return NextResponse.json({ error: 'no updates' }, { status: 400 })

  const supa = getSupabaseAdmin()
  // Upsert each row. We do this one at a time so we get per-key error info.
  const results = []
  for (const [key, value] of entries) {
    const v = value == null ? null : String(value)
    const { data, error } = await supa.from('site_config')
      .upsert({ key, value: v, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .select('key, value').maybeSingle()
    if (error) results.push({ key, error: error.message })
    else results.push({ key, value: data?.value ?? null })
  }
  const failed = results.filter((r) => r.error)
  if (failed.length) return NextResponse.json({ ok: false, results, failed }, { status: 500 })
  return NextResponse.json({ ok: true, results })
}
