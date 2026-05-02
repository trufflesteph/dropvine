import { NextResponse } from 'next/server'
import { store, uuidv4 } from '@/lib/mock-store'
import { getSupabaseServer, getServerSupabaseConfig } from '@/lib/supabase/server'

const json = (data, init = {}) => NextResponse.json(data, init)
const err = (msg, status = 400) => NextResponse.json({ error: msg }, { status })

function getUserIdFromHeaders(req) {
  // For mock mode: client passes X-User-Id header (we don't enforce real auth in mock)
  return req.headers.get('x-user-id') || null
}

async function getCurrentUserId(req) {
  const { configured } = getServerSupabaseConfig()
  if (configured) {
    const sb = getSupabaseServer()
    if (sb) {
      const { data } = await sb.auth.getUser()
      return data?.user?.id || null
    }
  }
  return getUserIdFromHeaders(req)
}

export async function GET(request, { params }) {
  const path = (params?.path || []).join('/')
  const url = new URL(request.url)

  // GET /api/launches?creator=me  -> list current user's launches
  if (path === 'launches') {
    const creatorMe = url.searchParams.get('creator') === 'me'
    const userId = await getCurrentUserId(request)
    const sb = getSupabaseServer()
    if (sb) {
      let q = sb.from('launches').select('*').order('created_at', { ascending: false })
      if (creatorMe && userId) q = q.eq('creator_id', userId)
      const { data, error } = await q
      if (error) return err(error.message, 500)
      return json({ launches: data || [] })
    }
    const all = Array.from(store.launches.values()).sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    const filtered = creatorMe && userId ? all.filter(l => l.creator_id === userId) : all
    return json({ launches: filtered })
  }

  // GET /api/launches/by-handle/[handle]
  if (path.startsWith('launches/by-handle/')) {
    const handle = path.replace('launches/by-handle/', '')
    const sb = getSupabaseServer()
    if (sb) {
      const { data, error } = await sb.from('launches').select('*').eq('handle', handle).maybeSingle()
      if (error) return err(error.message, 500)
      if (!data) return err('not found', 404)
      return json({ launch: data })
    }
    const found = Array.from(store.launches.values()).find(l => l.handle === handle)
    if (!found) return err('not found', 404)
    return json({ launch: found })
  }

  // GET /api/launches/[id]/waitlist
  if (path.match(/^launches\/[^/]+\/waitlist$/)) {
    const id = path.split('/')[1]
    const sb = getSupabaseServer()
    if (sb) {
      const { data, error } = await sb.from('waitlist_entries').select('*').eq('launch_id', id).order('created_at', { ascending: false })
      if (error) return err(error.message, 500)
      return json({ entries: data || [], count: (data || []).length })
    }
    const entries = store.waitlist.filter(w => w.launch_id === id)
    return json({ entries, count: entries.length })
  }

  return err('not found', 404)
}

export async function POST(request, { params }) {
  const path = (params?.path || []).join('/')
  const body = await request.json().catch(() => ({}))

  // Mock auth (only used when Supabase isn't configured)
  if (path === 'auth/mock-signup') {
    const { email, password, display_name } = body
    if (!email || !password) return err('email & password required')
    if (store.users.has(email)) return err('email already registered', 409)
    const u = { id: uuidv4(), email, password, display_name: display_name || email.split('@')[0] }
    store.users.set(email, u)
    return json({ id: u.id, email: u.email, display_name: u.display_name })
  }
  if (path === 'auth/mock-signin') {
    const { email, password } = body
    const u = store.users.get(email)
    if (!u || u.password !== password) return err('invalid credentials', 401)
    return json({ id: u.id, email: u.email, display_name: u.display_name })
  }

  // POST /api/launches  -> create launch
  if (path === 'launches') {
    const userId = await getCurrentUserId(request)
    if (!userId) return err('not authenticated', 401)
    const required = ['handle', 'title', 'launch_at']
    for (const f of required) if (!body[f]) return err(`${f} required`)
    const sb = getSupabaseServer()
    const launch = {
      creator_id: userId,
      handle: String(body.handle).toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      title: body.title,
      tagline: body.tagline || '',
      description: body.description || '',
      cover_url: body.cover_url || '',
      launch_at: body.launch_at,
      price_cents: Number(body.price_cents) || 0,
      reservation_enabled: !!body.reservation_enabled,
      reservation_hold_cents: Number(body.reservation_hold_cents) || 0,
      status: body.status || 'published',
    }
    if (sb) {
      const { data, error } = await sb.from('launches').insert(launch).select().single()
      if (error) return err(error.message, 500)
      return json({ launch: data })
    }
    const id = uuidv4()
    const created_at = new Date().toISOString()
    const full = { id, created_at, ...launch }
    if (Array.from(store.launches.values()).some(l => l.handle === launch.handle)) return err('handle taken', 409)
    store.launches.set(id, full)
    return json({ launch: full })
  }

  // POST /api/launches/[id]/waitlist  -> join waitlist
  if (path.match(/^launches\/[^/]+\/waitlist$/)) {
    const id = path.split('/')[1]
    const { email, name } = body
    if (!email) return err('email required')
    const sb = getSupabaseServer()
    if (sb) {
      const { data, error } = await sb.from('waitlist_entries').insert({ launch_id: id, email, name }).select().single()
      if (error) {
        if (String(error.code) === '23505') return json({ ok: true, dedup: true })
        return err(error.message, 500)
      }
      return json({ entry: data })
    }
    if (store.waitlist.find(w => w.launch_id === id && w.email === email)) return json({ ok: true, dedup: true })
    const entry = { id: uuidv4(), launch_id: id, email, name: name || '', created_at: new Date().toISOString() }
    store.waitlist.push(entry)
    return json({ entry })
  }

  // POST /api/launches/[id]/reserve  -> Stripe placeholder
  if (path.match(/^launches\/[^/]+\/reserve$/)) {
    const id = path.split('/')[1]
    const { email, amount_cents } = body
    if (!email) return err('email required')
    const reservation = { id: uuidv4(), launch_id: id, email, amount_cents: amount_cents || 0, status: 'held', stripe_session_id: 'placeholder_' + uuidv4(), created_at: new Date().toISOString() }
    const sb = getSupabaseServer()
    if (sb) {
      const { data, error } = await sb.from('reservations').insert(reservation).select().single()
      if (error) return err(error.message, 500)
      return json({ reservation: data, checkout_url: '#stripe-placeholder' })
    }
    store.reservations.push(reservation)
    return json({ reservation, checkout_url: '#stripe-placeholder' })
  }

  return err('not found', 404)
}
