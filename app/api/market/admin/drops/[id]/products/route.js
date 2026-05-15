// GET + PUT for a launch's product catalogue.
//
//   GET  /api/market/admin/drops/[id]/products      → { products: [...] }
//   PUT  /api/market/admin/drops/[id]/products      → replace the entire list
//        body: { products: [{ id?, name, description?, price_cents, quantity?, photo_url?, sort_order? }, ...] }
//
// Behaviour:
//   • Diffs the incoming list against the DB rows by id.
//   • UPDATEs existing rows, INSERTs new ones (no id), DELETEs anything in the
//     DB but not in the incoming list.
//   • Re-stamps sort_order based on incoming array index unless explicitly set.
//   • Returns the canonical list after save so the UI can replace its state.
//
// Auth: requireAdminRole — platform/organiser.

import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/markets/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sanitiseProduct(p, idx) {
  const name = typeof p?.name === 'string' ? p.name.trim().slice(0, 200) : ''
  if (!name) return null
  const description = typeof p?.description === 'string' && p.description.trim()
    ? p.description.trim().slice(0, 2000) : null
  const photo_url = typeof p?.photo_url === 'string' && p.photo_url.trim()
    ? p.photo_url.trim().slice(0, 1000) : null
  // price_cents: accept either cents or dollars-with-decimal; coerce to int cents.
  let price_cents = 0
  if (typeof p?.price_cents === 'number' && Number.isFinite(p.price_cents)) {
    price_cents = Math.max(0, Math.round(p.price_cents))
  } else if (typeof p?.price === 'number' && Number.isFinite(p.price)) {
    price_cents = Math.max(0, Math.round(p.price * 100))
  } else if (typeof p?.price_cents === 'string' && p.price_cents.trim()) {
    const n = Number(p.price_cents)
    if (Number.isFinite(n)) price_cents = Math.max(0, Math.round(n))
  }
  // quantity: null means unlimited.
  let quantity = null
  if (p?.quantity != null && p.quantity !== '') {
    const n = parseInt(p.quantity, 10)
    if (Number.isFinite(n) && n >= 0) quantity = n
  }
  const sort_order = (typeof p?.sort_order === 'number' && Number.isFinite(p.sort_order))
    ? p.sort_order : idx
  return { name, description, photo_url, price_cents, quantity, sort_order }
}

export async function GET(request, { params }) {
  const auth = requireAdminRole(request)
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const { data, error } = await supa
    .from('launch_products').select('*')
    .eq('launch_id', params.id).order('sort_order', { ascending: true })
  if (error) {
    if (/could not find the table|relation .* does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json({ products: [], migration_pending: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ products: data || [] })
}

export async function PUT(request, { params }) {
  const auth = requireAdminRole(request)
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supa = getSupabaseAdmin()
  if (!supa) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const incoming = Array.isArray(body?.products) ? body.products : null
  if (!incoming) return NextResponse.json({ error: 'products array required' }, { status: 400 })

  // Confirm the parent launch exists (also catches typo IDs early).
  const { data: launch, error: lErr } = await supa
    .from('launches').select('id').eq('id', params.id).maybeSingle()
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
  if (!launch) return NextResponse.json({ error: 'launch not found' }, { status: 404 })

  // Existing rows.
  const { data: existing, error: gErr } = await supa
    .from('launch_products').select('id').eq('launch_id', params.id)
  if (gErr) {
    if (/could not find the table|relation .* does not exist|schema cache/i.test(gErr.message)) {
      return NextResponse.json({
        error: 'launch_products table not provisioned yet',
        hint: 'Run supabase/migrations/2026-06-multi-product.sql',
      }, { status: 503 })
    }
    return NextResponse.json({ error: gErr.message }, { status: 500 })
  }

  const existingIds = new Set((existing || []).map((r) => r.id))
  const incomingIds = new Set()
  const toUpdate = []
  const toInsert = []
  incoming.forEach((p, i) => {
    const clean = sanitiseProduct(p, i)
    if (!clean) return
    if (p?.id && existingIds.has(p.id)) {
      incomingIds.add(p.id)
      toUpdate.push({ id: p.id, ...clean })
    } else {
      toInsert.push({ launch_id: params.id, ...clean })
    }
  })
  const toDelete = [...existingIds].filter((id) => !incomingIds.has(id))

  // Run mutations sequentially — small N, no need for a transaction.
  if (toDelete.length) {
    const { error } = await supa.from('launch_products').delete().in('id', toDelete)
    if (error) return NextResponse.json({ error: error.message, phase: 'delete' }, { status: 500 })
  }
  for (const row of toUpdate) {
    const { id, ...rest } = row
    const { error } = await supa.from('launch_products').update(rest).eq('id', id)
    if (error) return NextResponse.json({ error: error.message, phase: 'update', id }, { status: 500 })
  }
  if (toInsert.length) {
    const { error } = await supa.from('launch_products').insert(toInsert)
    if (error) return NextResponse.json({ error: error.message, phase: 'insert' }, { status: 500 })
  }

  // Re-fetch canonical list to return.
  const { data: fresh } = await supa
    .from('launch_products').select('*')
    .eq('launch_id', params.id).order('sort_order', { ascending: true })

  return NextResponse.json({
    ok: true,
    products: fresh || [],
    counts: { updated: toUpdate.length, inserted: toInsert.length, deleted: toDelete.length },
  })
}
