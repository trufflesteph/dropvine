import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { store, uuidv4 } from '@/lib/mock-store'
import { getSupabaseServer, getSupabaseAdmin, getServerSupabaseConfig } from '@/lib/supabase/server'
import { sendWaitlistConfirmation, sendLaunchReminder, sendLaunchLiveNotification } from '@/lib/email/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_API_KEY || 'sk_test_emergent', { apiVersion: '2024-06-20' })

const json = (data, init = {}) => NextResponse.json(data, init)
const err = (msg, status = 400) => NextResponse.json({ error: msg }, { status })

async function getLaunch(id) {
  const sb = getSupabaseAdmin() || getSupabaseServer()
  if (sb) {
    const { data } = await sb.from('launches').select('*').eq('id', id).maybeSingle()
    return data
  }
  return store.launches.get(id) || null
}

async function insertReservation(row) {
  const sb = getSupabaseAdmin()
  if (sb) {
    const id = uuidv4()
    const full = { id, ...row }
    const { error } = await sb.from('reservations').insert(full)
    if (error) throw new Error(error.message)
    return { ...full, created_at: new Date().toISOString() }
  }
  if (getServerSupabaseConfig().configured) {
    // Real Supabase configured but no admin key — should never happen if .env is set right
    throw new Error('Supabase admin client unavailable; SUPABASE_SERVICE_ROLE_KEY not set')
  }
  const full = { id: uuidv4(), created_at: new Date().toISOString(), ...row }
  store.reservations.push(full)
  return full
}

async function getReservationBySession(sessionId) {
  const sb = getSupabaseAdmin()
  if (sb) {
    const { data } = await sb.from('reservations').select('*').eq('stripe_session_id', sessionId).maybeSingle()
    return data
  }
  return store.reservations.find(x => x.stripe_session_id === sessionId) || null
}

async function updateReservationStatusIfPending(sessionId, newStatus) {
  const sb = getSupabaseAdmin()
  if (sb) {
    const existing = await getReservationBySession(sessionId)
    if (!existing || existing.status !== 'pending') return existing
    const { data } = await sb.from('reservations').update({ status: newStatus }).eq('stripe_session_id', sessionId).select().maybeSingle()
    return data
  }
  const r = store.reservations.find(x => x.stripe_session_id === sessionId)
  if (!r) return null
  if (r.status !== 'pending') return r
  r.status = newStatus
  return r
}

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

  // GET /api/launches/[id]/reservations  (creator-scoped via RLS)
  if (path.match(/^launches\/[^/]+\/reservations$/)) {
    const id = path.split('/')[1]
    const sb = getSupabaseServer()
    if (sb) {
      // RLS ensures only the launch's creator can read these rows
      const { data, error } = await sb
        .from('reservations')
        .select('id,email,amount_cents,status,stripe_session_id,created_at,launch_id')
        .eq('launch_id', id)
        .order('created_at', { ascending: false })
      if (error) return err(error.message, 500)
      return json({ reservations: data || [] })
    }
    // Mock-mode fallback
    const userId = await getCurrentUserId(request)
    const launch = store.launches.get(id)
    if (!launch || launch.creator_id !== userId) return err('forbidden', 403)
    const reservations = store.reservations.filter(r => r.launch_id === id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    return json({ reservations })
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

  // GET /api/payments/checkout/status/[session_id]
  if (path.startsWith('payments/checkout/status/')) {
    const sessionId = path.replace('payments/checkout/status/', '')
    if (!sessionId) return err('session_id required')
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      // Update reservation if paid (idempotent)
      if (session.payment_status === 'paid') {
        await updateReservationStatusIfPending(sessionId, 'held')
      } else if (session.status === 'expired') {
        await updateReservationStatusIfPending(sessionId, 'cancelled')
      }
      const reservation = await getReservationBySession(sessionId)
      return json({
        status: session.status,                  // open | complete | expired
        payment_status: session.payment_status,  // unpaid | paid | no_payment_required
        amount_total: session.amount_total,
        currency: session.currency,
        metadata: session.metadata || {},
        reservation,
      })
    } catch (e) {
      return err(e.message || 'stripe error', 500)
    }
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
    // capacity is optional and may not exist as a column yet (graceful migration)
    if (body.capacity != null && body.capacity !== '' && !isNaN(Number(body.capacity))) {
      launch.capacity = Number(body.capacity)
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
    const launch = await getLaunch(id)
    if (!launch) return err('launch not found', 404)
    const sb = getSupabaseServer()
    const baseUrl = new URL(request.url).origin
    if (sb) {
      // No .select() — anon visitors can't read back their own row (RLS), but the insert still commits.
      const { error: insertError } = await sb.from('waitlist_entries').insert({ launch_id: id, email, name })
      if (insertError) {
        if (String(insertError.code) === '23505') return json({ ok: true, dedup: true })
        return err(insertError.message, 500)
      }
      // Fire-and-forget email
      sendWaitlistConfirmation({ launch, entry: { email, name }, baseUrl }).catch(() => {})
      return json({ ok: true })
    }
    if (store.waitlist.find(w => w.launch_id === id && w.email === email)) return json({ ok: true, dedup: true })
    const entry = { id: uuidv4(), launch_id: id, email, name: name || '', created_at: new Date().toISOString() }
    store.waitlist.push(entry)
    sendWaitlistConfirmation({ launch, entry, baseUrl }).catch(() => {})
    return json({ entry })
  }

  // POST /api/launches/[id]/reserve  -> Real Stripe Checkout Session
  // body: { email, origin_url }
  if (path.match(/^launches\/[^/]+\/reserve$/)) {
    const id = path.split('/')[1]
    const { email, origin_url } = body
    if (!email) return err('email required')
    if (!origin_url) return err('origin_url required')

    const launch = await getLaunch(id)
    if (!launch) return err('launch not found', 404)
    if (!launch.reservation_enabled) return err('reservations not enabled for this launch', 400)
    const amountCents = Number(launch.reservation_hold_cents) || 0
    if (amountCents < 50) return err('reservation amount too low', 400)

    // Build URLs from frontend's origin (never hardcode)
    const success_url = `${origin_url}/l/${launch.handle}?session_id={CHECKOUT_SESSION_ID}`
    const cancel_url = `${origin_url}/l/${launch.handle}?cancelled=1`

    let session
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Reservation hold — ${launch.title}`,
              description: `Refundable hold to reserve your slot for ${launch.title}.`,
            },
            unit_amount: amountCents, // server-defined, never trust client
          },
          quantity: 1,
        }],
        customer_email: email,
        success_url,
        cancel_url,
        metadata: {
          launch_id: String(launch.id),
          launch_handle: launch.handle,
          email,
          source: 'dropvine_reservation',
        },
      })
    } catch (e) {
      console.error('[stripe] create session failed:', e.message)
      return err('stripe error: ' + e.message, 500)
    }

    // Persist reservation BEFORE redirecting (mandatory per playbook)
    const reservation = await insertReservation({
      launch_id: launch.id,
      email,
      amount_cents: amountCents,
      stripe_session_id: session.id,
      status: 'pending',
    })

    return json({ url: session.url, session_id: session.id, reservation })
  }

  return err('not found', 404)
}
